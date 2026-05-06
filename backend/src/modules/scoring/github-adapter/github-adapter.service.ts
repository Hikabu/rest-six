import { Injectable, Inject, Logger } from '@nestjs/common';
import { Octokit } from 'octokit';
import Redis from 'ioredis';
import { PrismaService } from '../../../prisma/prisma.service';
import { decrypt } from '../../../shared/utils/crypto.utils';
import { SyncStatus } from '@prisma/client';
import {
  GitHubRawData,
  GitHubRepo,
  GitHubUserProfile,
  GitHubContributionData,
  GitHubExternalPRData,
} from './github-data.types';

const MAX_REPOS = 30;

@Injectable()
export class GithubAdapterService {
  private readonly logger = new Logger(GithubAdapterService.name);

  constructor(
    private readonly prisma: PrismaService,
    @Inject('REDIS') private readonly redis: Redis,
  ) {}

  /**
   * Main entry point to fetch and sync all GitHub data for a profile.
   */
  async syncProfile(githubProfileId: string): Promise<void> {
    const profile = await this.prisma.githubProfile.findUnique({
      where: { id: githubProfileId },
    });

    if (!profile) {
      throw new Error(`GithubProfile ${githubProfileId} not found`);
    }

    await this.prisma.githubProfile.update({
      where: { id: githubProfileId },
      data: { syncStatus: SyncStatus.RUNNING },
    });

    try {
      const token = this.decryptToken(profile.encryptedToken);
      const octokit = new Octokit({
        auth: token,
        request: {
          headers: {
            'X-GitHub-Api-Version': '2022-11-28',
          },
        },
      });
      const rawData = await this.fetchRawData(octokit, profile.githubUsername);

      await this.prisma.githubProfile.update({
        where: { id: githubProfileId },
        data: {
          rawDataSnapshot: rawData as any,
          syncStatus: SyncStatus.DONE,
          syncProgress: 'COMPLETE',
          lastSyncAt: new Date(),
        },
      });
    } catch (error) {
      this.logger.error(
        `Sync failed for profile ${githubProfileId}: ${error.message}`,
      );
      await this.prisma.githubProfile.update({
        where: { id: githubProfileId },
        data: { syncStatus: SyncStatus.FAILED },
      });
      throw error;
    }
  }

  /**
   * Fetches the minimal audited data required for scoring.
   */
  async fetchRawData(
    octokit: Octokit,
    githubUsername: string,
    jobId?: string,
  ): Promise<GitHubRawData> {
    return this.withCache(`github:v2:raw:${githubUsername}`, async () => {
      // 1. Fetch Profile
      const profileData = await this.fetchProfile(octokit, githubUsername, jobId);

      // 2. Fetch Repos (limited to MAX_REPOS)
      const repos = await this.fetchRepos(octokit, githubUsername, jobId);

      const manifestKeys = await this.fetchManifests(
        octokit,
        githubUsername,
        repos,
        jobId,
      );

      // 3. Fetch GraphQL data (Contributions)
      const contributions = await this.fetchGraphQLData(
        octokit,
        githubUsername,
      );

      // 4. Fetch External PRs (Search API with retry)
      const externalPRs = await this.fetchExternalPRs(
        octokit,
        githubUsername,
      );

      return {
        profile: profileData,
        repos,
        contributions,
        externalPRs,
        manifestKeys,
        fetchedAt: new Date(),
      };
    });
  }

  private async fetchProfile(
    octokit: Octokit,
    username: string,
    jobId?: string,
  ): Promise<GitHubUserProfile> {
    const res = await this.withRetry(() =>
      octokit.rest.users.getByUsername({ username }),
    );
    this.logRateLimit(res, 'users.getByUsername', jobId);
    const data = res.data;

    const accountCreatedAt = new Date(data.created_at);
    const monthsDiff =
      (new Date().getTime() - accountCreatedAt.getTime()) /
      (1000 * 60 * 60 * 24 * 30.44);

    return {
      username: data.login,
      accountCreatedAt: new Date(data.created_at),
      accountAge: Math.floor(monthsDiff),
      publicRepos: data.public_repos,
      followers: data.followers,
    };
  }

  private async fetchRepos(
    octokit: Octokit,
    username: string,
    jobId?: string,
  ): Promise<GitHubRepo[]> {
    const res = await this.withRetry(() =>
      octokit.rest.repos.listForUser({
        username,
        sort: 'pushed',
        per_page: 100, // We fetch 100 but only take MAX_REPOS
        headers: {
          accept: 'application/vnd.github.mercy-preview+json',
        },
      }),
    );
    this.logRateLimit(res, 'repos.listForUser', jobId);

    const rawRepos = res.data as any[];
    return rawRepos.slice(0, MAX_REPOS).map((r) => ({
      name: r.name,
      language: r.language,
      stars: r.stargazers_count,
      forks: r.forks_count,
      topics: r.topics || [],
      createdAt: new Date(r.created_at),
      pushedAt: new Date(r.pushed_at),
      isFork: r.fork,
      description: r.description,
    }));
  }

  private async fetchGraphQLData(
    octokit: Octokit,
    username: string,
  ): Promise<GitHubContributionData> {
    const query = `
      query($login: String!) {
        user(login: $login) {
          contributionsCollection {
            contributionCalendar {
              weeks {
                contributionDays {
                  contributionCount
                }
              }
            }
          }
        }
      }
    `;

    const result: any = await this.withRetry(() =>
      octokit.graphql(query, {
        login: username,
      }),
    );

    const user = result.user;

    // Process Contributions
    const weeklyTotals: number[] = (
      user.contributionsCollection.contributionCalendar.weeks || []
    )
      .map((week: any) =>
        week.contributionDays.reduce(
          (sum: number, day: any) => sum + day.contributionCount,
          0,
        ),
      )
      .slice(-52); // Ensure exactly 52 weeks

    // Pad if fewer than 52 weeks returned
    while (weeklyTotals.length < 52) {
      weeklyTotals.unshift(0);
    }

    const activeWeeksCount = weeklyTotals.filter((total) => total > 0).length;

    return {
      weeklyTotals,
      activeWeeksCount,
    };
  }

  private async fetchExternalPRsFromApi(
    octokit: Octokit,
    username: string
  ): Promise<{ repo: string; merged: boolean }[]> {
    const MAX_RETRIES = 2;
    let attempt = 0;

    while (attempt <= MAX_RETRIES) {
      try {
        const result = await octokit.rest.search.issuesAndPullRequests({
          q: `type:pr author:${username} is:merged -user:${username}`,
          per_page: 50,
          sort: 'created',
          order: 'desc'
        });
        return result.data.items.map(pr => ({
          repo: pr.repository_url.replace('https://api.github.com/repos/', ''),
          merged: true
        }));
      } catch (err: any) {
        if (err.status === 403 && err.response?.headers?.['x-ratelimit-remaining'] === '0') {
          // Search API rate limit specifically
          const resetMs = Number(err.response.headers['x-ratelimit-reset']) * 1000;
          const waitMs  = Math.min(resetMs - Date.now() + 1000, 65000); // max 65s wait

          this.logger.warn({
            username,
            waitMs,
            attempt
          }, 'github_search_rate_limited');

          if (attempt < MAX_RETRIES) {
            await new Promise(resolve => setTimeout(resolve, waitMs));
            attempt++;
            continue;
          }
        }
        // Non-rate-limit error OR retries exhausted:
        // Return empty array — external PRs are signal, not required
        this.logger.warn({ username, err: err.status }, 'external_pr_fetch_failed');
        return [];
      }
    }
    return [];
  }

  private async fetchExternalPRs(
    octokit: Octokit,
    username: string,
  ): Promise<GitHubExternalPRData> {
    const prCacheKey = `github:prs:${username}`;
    let prs: { repo: string; merged: boolean }[] = [];
    
    const cached = await this.redis.get(prCacheKey);
    if (cached) {
      prs = JSON.parse(cached);
    } else {
      prs = await this.fetchExternalPRsFromApi(octokit, username);
      await this.redis.set(prCacheKey, JSON.stringify(prs), 'EX', 1800);
    }

    return {
      mergedExternalPRCount: prs.length,
      externalRepoNames: Array.from(new Set(prs.map((pr) => pr.repo))),
    };
  }

  public decryptToken(encryptedToken: string): string {
    // console.log(
    //   `Decrypting token, length: ${encryptedToken.length}, startsWith v1: ${encryptedToken.startsWith('v1:')}`,
    // );
    const key = process.env.AUTH_ENCRYPTION_KEY;
    if (!key) throw new Error('AUTH_ENCRYPTION_KEY not set');

    const data = encryptedToken.startsWith('v1:')
      ? encryptedToken.substring(3)
      : encryptedToken;

    const decripted = decrypt(data, key);
    // console.log(`Decrypted token, length: ${decripted.length}`);
    return decripted;
  }

  private async withCache<T>(
    key: string,
    fetcher: () => Promise<T>,
  ): Promise<T> {
    const cached = await this.redis.get(key);
    if (cached) {
      const parsed = JSON.parse(cached);
      // Revive dates if necessary (simplified here, but works for plain data)
      return parsed;
    }
    const result = await fetcher();
    await this.redis.set(key, JSON.stringify(result), 'EX', 24 * 60 * 60);
    return result;
  }

  private async withRetry<T>(fn: () => Promise<T>, attempts = 2): Promise<T> {
    try {
      return await fn();
    } catch (error: any) {
      const status = error.status || (error.response && error.response.status);
      const isRateLimit =
        status === 429 ||
        (status === 403 && error.message?.toLowerCase().includes('rate limit'));

      if (attempts > 1 && isRateLimit) {
        this.logger.warn(`GitHub API rate limit hit. Retrying in 2 seconds...`);
        await new Promise((resolve) => setTimeout(resolve, 2000));
        return this.withRetry(fn, attempts - 1);
      }

      if (isRateLimit) {
        throw new Error(
          'GitHub API rate limit exceeded — please retry in a few minutes',
        );
      }

      throw error;
    }
  }

  private parsePackageJsonKeys(content: string): string[] {
    try {
      const parsed = JSON.parse(content);
      return Object.keys(parsed.dependencies || {}).concat(
        Object.keys(parsed.devDependencies || {}),
      );
    } catch (e) {
      return [];
    }
  }

  private parseCargoTomlKeys(content: string): string[] {
    const depKeys: string[] = [];
    const lines = content.split('\n');
    let inDependencies = false;

    for (const line of lines) {
      const trimmed = line.trim();
      if (!trimmed || trimmed.startsWith('#')) continue;

      if (trimmed.startsWith('[')) {
        if (
          trimmed === '[dependencies]' ||
          trimmed === '[dev-dependencies]' ||
          trimmed === '[build-dependencies]'
        ) {
          inDependencies = true;
        } else {
          inDependencies = false;
        }
        continue;
      }

      if (inDependencies) {
        const parts = trimmed.split('=');
        if (parts.length >= 2) {
          depKeys.push(parts[0].trim());
        }
      }
    }
    return depKeys;
  }

  private async fetchManifest(
    octokit: Octokit,
    owner: string,
    repo: string,
    filename: 'package.json' | 'Cargo.toml',
    jobId?: string,
  ): Promise<string[] | null> {
    const cacheKey = `github:manifest:${owner}:${repo}:${filename}`;

    try {
      const cached = await this.redis.get(cacheKey);
      if (cached !== null) {
        const parsed = JSON.parse(cached);
        return parsed.length === 0 ? null : parsed;
      }
    } catch {}

    try {
      const response = await octokit.rest.repos.getContent({
        owner,
        repo,
        path: filename,
      });
      this.logRateLimit(response, `repos.getContent:${filename}`, jobId);

      if (
        !Array.isArray(response.data) &&
        response.data.type === 'file' &&
        response.data.content
      ) {
        const contentStr = Buffer.from(
          response.data.content,
          'base64',
        ).toString('utf8');
        
        const depKeys = filename === 'package.json'
          ? this.parsePackageJsonKeys(contentStr)
          : this.parseCargoTomlKeys(contentStr);

        await this.redis.set(cacheKey, JSON.stringify(depKeys), 'EX', 172800);
        return depKeys;
      }
      return null;
    } catch (err: any) {
      if (err.status === 404) {
        await this.redis.set(cacheKey, JSON.stringify([]), 'EX', 21600);
        return null;
      }
      throw err;
    }
  }

  private async fetchManifests(
    octokit: Octokit,
    username: string,
    repos: GitHubRepo[],
    jobId?: string,
  ): Promise<Record<string, string[]>> {
    const manifestKeys: Record<string, string[]> = {};
    const reposToScan = repos
      .filter((r) => !r.isFork)
      .sort((a, b) => b.stars - a.stars)
      .slice(0, 10);

    for (const repo of reposToScan) {
      try {
        const pkgKeys = await this.fetchManifest(octokit, username, repo.name, 'package.json', jobId);
        const cargoKeys = await this.fetchManifest(octokit, username, repo.name, 'Cargo.toml', jobId);
        
        if (pkgKeys) {
          manifestKeys[repo.name] = [...(manifestKeys[repo.name] ?? []), ...pkgKeys];
        }
        if (cargoKeys) {
          manifestKeys[repo.name] = [...(manifestKeys[repo.name] ?? []), ...cargoKeys];
        }
      } catch (err: any) {
        if (err.status === 403 || err.status === 429) {
          this.logger.warn({ repo: repo.name }, 'manifest_fetch_rate_limited_stopping');
          break;
        }
        this.logger.debug({ repo: repo.name, err: err.status }, 'manifest_fetch_skipped');
      }
    }

    return manifestKeys;
  }

  async getRateLimitRemaining(octokit: Octokit): Promise<number> {
    const r = await octokit.rest.rateLimit.get();
    return r.data.rate.remaining;
  }

  private logRateLimit(response: any, endpoint: string, jobId?: string) {
    if (!response || !response.headers) return;
    const remaining = response.headers['x-ratelimit-remaining'];
    const limit     = response.headers['x-ratelimit-limit'];
    const reset     = response.headers['x-ratelimit-reset'];
    const tokenHint = response.headers['x-oauth-scopes']
      ? 'oauth-token'
      : response.headers['x-ratelimit-limit'] === '60'
        ? 'unauthenticated'
        : 'pat-or-system-token';

    this.logger.debug({
      endpoint,
      remaining: Number(remaining),
      limit:     Number(limit),
      resetAt:   new Date(Number(reset) * 1000).toISOString(),
      tokenType: tokenHint,
      jobId
    }, 'github_api_call');

    if (Number(remaining) < 100) {
      this.logger.warn({
        remaining: Number(remaining),
        resetAt:   new Date(Number(reset) * 1000).toISOString(),
        jobId
      }, 'github_rate_limit_low');
    }
  }
}
