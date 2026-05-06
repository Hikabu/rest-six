import { Test, TestingModule } from '@nestjs/testing';
import { GithubAdapterService } from './github-adapter.service';
import { PrismaService } from '../../../prisma/prisma.service';
import { Octokit } from 'octokit';

jest.mock('octokit');

describe('GithubAdapterService', () => {
  let service: GithubAdapterService;
  let prisma: PrismaService;
  let mockOctokit: any;

  beforeEach(async () => {
    mockOctokit = {
      rest: {
        users: {
          getByUsername: jest.fn(),
        },
        repos: {
          listForUser: jest.fn(),
        },
      },
      graphql: jest.fn(),
    };

    (Octokit as any).mockImplementation(() => mockOctokit);

    const module: TestingModule = await Test.createTestingModule({
      providers: [
        GithubAdapterService,
        {
          provide: PrismaService,
          useValue: {
            githubProfile: {
              findUnique: jest.fn(),
              update: jest.fn(),
            },
          },
        },
        {
          provide: 'REDIS',
          useValue: {
            get: jest.fn(),
            set: jest.fn(),
          },
        },
      ],
    }).compile();

    service = module.get<GithubAdapterService>(GithubAdapterService);
    prisma = module.get<PrismaService>(PrismaService);
  });

  afterEach(() => {
    jest.clearAllMocks();
  });

  it('TEST: fetchRawData returns GitHubRawData with all fields correctly shaped', async () => {
    const mockUser = {
      login: 'testuser',
      created_at: '2020-01-01T00:00:00Z',
      public_repos: 10,
      followers: 5,
    };
    const mockRepos = Array(5)
      .fill(null)
      .map((_, i) => ({
        name: `repo-${i}`,
        language: 'TypeScript',
        stargazers_count: 10,
        forks_count: 5,
        topics: ['nestjs'],
        created_at: '2021-01-01T00:00:00Z',
        pushed_at: '2023-01-01T00:00:00Z',
        fork: false,
        description: 'desc',
      }));

    const mockGql = {
      user: {
        contributionsCollection: {
          contributionCalendar: {
            weeks: Array(52).fill({
              contributionDays: [{ contributionCount: 1 }],
            }),
          },
        },
        pullRequests: {
          nodes: [
            { repository: { name: 'ext-repo', owner: { login: 'other' } } },
          ],
        },
      },
    };

    mockOctokit.rest.users.getByUsername.mockResolvedValue({ data: mockUser });
    mockOctokit.rest.repos.listForUser.mockResolvedValue({ data: mockRepos });
    mockOctokit.graphql.mockResolvedValue(mockGql);
    mockOctokit.rest.search = {
      issuesAndPullRequests: jest.fn().mockResolvedValue({
        data: { items: [{ repository_url: 'https://api.github.com/repos/facebook/react' }] }
      })
    };

    const result = await service.fetchRawData(mockOctokit, 'testuser');

    expect(result.profile.username).toBe('testuser');
    expect(result.repos).toHaveLength(5);
    expect(result.contributions.weeklyTotals).toHaveLength(52);
    expect(result.externalPRs.mergedExternalPRCount).toBe(1);
    expect(result.fetchedAt).toBeInstanceOf(Date);
  });

  it('TEST: weeklyTotals has exactly 52 entries', async () => {
    const mockGql = {
      user: {
        contributionsCollection: {
          contributionCalendar: {
            weeks: Array(10).fill({
              contributionDays: [{ contributionCount: 5 }],
            }), // Only 10 weeks
          },
        },
        pullRequests: { nodes: [] },
      },
    };

    mockOctokit.rest.users.getByUsername.mockResolvedValue({
      data: { login: 'u', created_at: '...', public_repos: 0, followers: 0 },
    });

    mockOctokit.rest.repos.listForUser.mockResolvedValue({ data: [] });
    mockOctokit.graphql.mockResolvedValue(mockGql);

    const result = await service.fetchRawData(mockOctokit, 'u');
    expect(result.contributions.weeklyTotals).toHaveLength(52);
    expect(result.contributions.weeklyTotals[0]).toBe(0); // Padded
    expect(result.contributions.weeklyTotals[51]).toBe(5); // Recent
  });

  it('TEST: isFork repos are identified correctly', async () => {
    mockOctokit.rest.users.getByUsername.mockResolvedValue({
      data: { created_at: '2020-01-01T00:00:00Z' },
    });

    mockOctokit.rest.repos.listForUser.mockResolvedValue({
      data: [
        { name: 'r1', fork: true, pushed_at: '2023-01-01T00:00:00Z' },
        { name: 'r2', fork: false, pushed_at: '2023-01-01T00:00:00Z' },
      ],
    });

    mockOctokit.graphql.mockResolvedValue({
      user: {
        contributionsCollection: { contributionCalendar: { weeks: [] } },
        pullRequests: { nodes: [] },
      },
    });

    const result = await service.fetchRawData(mockOctokit, 'u');
    expect(result.repos[0].isFork).toBe(true);
    expect(result.repos[1].isFork).toBe(false);
  });

  it('TEST: topics field is populated (Mercy header must be included)', async () => {
    mockOctokit.rest.users.getByUsername.mockResolvedValue({
      data: { created_at: '2020-01-01T00:00:00Z' },
    });
    mockOctokit.rest.repos.listForUser.mockResolvedValue({
      data: [{ name: 'r1', topics: ['a', 'b'], pushed_at: '2023-01-01T00:00:00Z' }],
    });
    mockOctokit.graphql.mockResolvedValue({
      user: {
        contributionsCollection: { contributionCalendar: { weeks: [] } },
        pullRequests: { nodes: [] },
      },
    });

    const result = await service.fetchRawData(mockOctokit, 'u');
    expect(result.repos[0].topics).toEqual(['a', 'b']);
    expect(mockOctokit.rest.repos.listForUser).toHaveBeenCalledWith(
      expect.objectContaining({
        headers: { accept: 'application/vnd.github.mercy-preview+json' },
      }),
    );
  });

  it('TEST: 429 response triggers a retry', async () => {
    const error429 = new Error('Rate limit');
    (error429 as any).status = 429;

    mockOctokit.rest.users.getByUsername
      .mockRejectedValueOnce(error429)
      .mockResolvedValueOnce({
        data: { login: 'u', created_at: '2020-01-01T00:00:00Z' },
      });

    mockOctokit.rest.repos.listForUser.mockResolvedValue({ data: [] });
    mockOctokit.graphql.mockResolvedValue({
      user: {
        contributionsCollection: { contributionCalendar: { weeks: [] } },
        pullRequests: { nodes: [] },
      },
    });

    // Mock setTimeout to resolve immediately
    jest
      .spyOn(global, 'setTimeout' as any)
      .mockImplementation((fn: any) => fn());

    const result = await service.fetchRawData(mockOctokit, 'u');
    expect(result.profile.username).toBe('u');
    expect(mockOctokit.rest.users.getByUsername).toHaveBeenCalledTimes(2);
  });

  it('TEST: Second 429 in a row throws descriptive error message', async () => {
    const error429 = new Error('Rate limit');
    (error429 as any).status = 429;

    mockOctokit.rest.users.getByUsername.mockRejectedValue(error429);
    
    jest
      .spyOn(global, 'setTimeout' as any)
      .mockImplementation((fn: any) => fn());

    await expect(service.fetchRawData(mockOctokit, 'u')).rejects.toThrow(
      'GitHub API rate limit exceeded — please retry in a few minutes',
    );

    expect(mockOctokit.rest.users.getByUsername).toHaveBeenCalledTimes(2);
  });

  it('TEST: repos array length is ≤ MAX_REPOS', async () => {
    const manyRepos = Array(50)
      .fill(null)
      .map((_, i) => ({
        name: `repo-${i}`,
        pushed_at: new Date(2023, 0, 50 - i).toISOString(),
      }));

    mockOctokit.rest.users.getByUsername.mockResolvedValue({
      data: { created_at: '2020-01-01T00:00:00Z' },
    });
    mockOctokit.rest.repos.listForUser.mockResolvedValue({ data: manyRepos });
    mockOctokit.graphql.mockResolvedValue({
      user: {
        contributionsCollection: { contributionCalendar: { weeks: [] } },
        pullRequests: { nodes: [] },
      },
    });

    const result = await service.fetchRawData(mockOctokit, 'u');
    expect(result.repos.length).toBe(30);
  });

  it('TEST: repos are ordered by pushedAt DESC', async () => {
    const repos = [
      { name: 'old', pushed_at: '2021-01-01T00:00:00Z' },
      { name: 'new', pushed_at: '2023-01-01T00:00:00Z' },
    ];
    // We assume they come sorted from API as pushed DESC, so 'new' then 'old'
    const sortedMock = [repos[1], repos[0]];

    mockOctokit.rest.users.getByUsername.mockResolvedValue({
      data: { created_at: '2020-01-01T00:00:00Z' },
    });
    mockOctokit.rest.repos.listForUser.mockResolvedValue({ data: sortedMock });
    mockOctokit.graphql.mockResolvedValue({
      user: {
        contributionsCollection: { contributionCalendar: { weeks: [] } },
        pullRequests: { nodes: [] },
      },
    });

    const result = await service.fetchRawData(mockOctokit, 'u');
    expect(result.repos[0].name).toBe('new');
    expect(result.repos[1].name).toBe('old');
  });

  it('TEST: no additional pagination or extra repo fetch calls are made', async () => {
    mockOctokit.rest.users.getByUsername.mockResolvedValue({ data: { created_at: '2020-01-01T00:00:00Z' } });
    mockOctokit.rest.repos.listForUser.mockResolvedValue({ data: [] });
    mockOctokit.graphql.mockResolvedValue({ user: { contributionsCollection: { contributionCalendar: { weeks: [] } }, pullRequests: { nodes: [] } } });

    await service.fetchRawData(mockOctokit, 'u');
    
    expect(mockOctokit.rest.repos.listForUser).toHaveBeenCalledTimes(1);
    expect(mockOctokit.rest.repos.listForUser).toHaveBeenCalledWith(expect.objectContaining({
      per_page: 100
    }));
  });
  describe('Manifest caching', () => {
    let mockOctokitInstance: any;

    beforeEach(() => {
      mockOctokitInstance = {
        rest: {
          repos: {
            getContent: jest.fn(),
          },
        },
      };
      (service as any).redis.get.mockResolvedValue(null);
      (service as any).redis.set.mockResolvedValue('OK');
    });

    it('5. Redis has cached result -> octokit NOT called, returns cached dep keys', async () => {
      (service as any).redis.get.mockResolvedValue(JSON.stringify(['react']));
      const result = await (service as any).fetchManifest(mockOctokitInstance, 'owner', 'repo', 'package.json');
      expect(mockOctokitInstance.rest.repos.getContent).not.toHaveBeenCalled();
      expect(result).toEqual(['react']);
    });

    it('6. Redis miss, GitHub returns 200 -> extracted, cached with TTL 172800', async () => {
      const packageJson = { dependencies: { react: '^18' } };
      mockOctokitInstance.rest.repos.getContent.mockResolvedValue({
        headers: { 'x-ratelimit-remaining': '4999', 'x-ratelimit-reset': '1600000000' },
        data: {
          type: 'file',
          content: Buffer.from(JSON.stringify(packageJson)).toString('base64'),
        },
      });

      const result = await (service as any).fetchManifest(mockOctokitInstance, 'owner', 'repo', 'package.json');
      expect(result).toEqual(['react']);
      expect((service as any).redis.set).toHaveBeenCalledWith(
        'github:manifest:owner:repo:package.json',
        JSON.stringify(['react']),
        'EX',
        172800,
      );
    });

    it('7. Redis miss, GitHub returns 404 -> [] cached with TTL 21600, returns null', async () => {
      const error404 = new Error('Not found');
      (error404 as any).status = 404;
      mockOctokitInstance.rest.repos.getContent.mockRejectedValue(error404);

      const result = await (service as any).fetchManifest(mockOctokitInstance, 'owner', 'repo', 'package.json');
      expect(result).toBeNull();
      expect((service as any).redis.set).toHaveBeenCalledWith(
        'github:manifest:owner:repo:package.json',
        JSON.stringify([]),
        'EX',
        21600,
      );

      // simulate second call
      (service as any).redis.get.mockResolvedValue(JSON.stringify([]));
      mockOctokitInstance.rest.repos.getContent.mockClear();
      const result2 = await (service as any).fetchManifest(mockOctokitInstance, 'owner', 'repo', 'package.json');
      expect(result2).toBeNull();
      expect(mockOctokitInstance.rest.repos.getContent).not.toHaveBeenCalled();
    });

    it('8. Redis miss, GitHub returns 403 (rate limit) -> error thrown, NOT cached', async () => {
      const error403 = new Error('Rate limit');
      (error403 as any).status = 403;
      mockOctokitInstance.rest.repos.getContent.mockRejectedValue(error403);

      await expect((service as any).fetchManifest(mockOctokitInstance, 'owner', 'repo', 'package.json')).rejects.toThrow('Rate limit');
      expect((service as any).redis.set).not.toHaveBeenCalled();
    });

    it('9. Manifest loop: 12 repos available, cap=10 -> getContent called max 20 times', async () => {
      const repos = Array(12).fill(null).map((_, i) => ({ name: `repo${i}`, isFork: false, stars: i }));
      
      // Mocks inside fetchManifests
      const spy = jest.spyOn(service as any, 'fetchManifest').mockResolvedValue(null);

      await (service as any).fetchManifests(mockOctokitInstance, 'user', repos);
      
      expect(spy).toHaveBeenCalledTimes(20); // 10 repos * 2 files
      spy.mockRestore();
    });

    it('10. Manifest loop: 6th repo returns 403 -> loop breaks, first 5 repos preserved, job does NOT fail', async () => {
      const repos = Array(10).fill(null).map((_, i) => ({ name: `repo${i}`, isFork: false, stars: i }));
      
      let calls = 0;
      const spy = jest.spyOn(service as any, 'fetchManifest').mockImplementation(async (octokit, user, repoName, filename) => {
        calls++;
        if (repoName === 'repo4') { // 6th repo when sorting by stars desc (9 down to 0)
          const err = new Error('Rate limit');
          (err as any).status = 403;
          throw err;
        }
        return ['dep'];
      });

      const result = await (service as any).fetchManifests(mockOctokitInstance, 'user', repos);
      
      expect(Object.keys(result).length).toBe(5);
      expect(spy).toHaveBeenCalled();
      
      spy.mockRestore();
    });
  });

  describe('Search API / external PRs', () => {
    let mockOctokitInstance: any;

    beforeEach(() => {
      mockOctokitInstance = {
        rest: {
          search: {
            issuesAndPullRequests: jest.fn(),
          },
        },
      };
      (service as any).redis.get.mockResolvedValue(null);
      (service as any).redis.set.mockResolvedValue('OK');
      jest.spyOn(global, 'setTimeout' as any).mockImplementation((fn: any) => fn());
    });

    afterEach(() => {
      jest.restoreAllMocks();
    });

    it('11. First call succeeds -> results cached, second call returns cache', async () => {
      mockOctokitInstance.rest.search.issuesAndPullRequests.mockResolvedValue({
        data: { items: [{ repository_url: 'https://api.github.com/repos/facebook/react' }] }
      });

      const result1 = await (service as any).fetchExternalPRs(mockOctokitInstance, 'alice');
      expect(result1.mergedExternalPRCount).toBe(1);
      expect((service as any).redis.set).toHaveBeenCalledWith('github:prs:alice', JSON.stringify([{ repo: 'facebook/react', merged: true }]), 'EX', 1800);

      // Second call from cache
      (service as any).redis.get.mockResolvedValue(JSON.stringify([{ repo: 'facebook/react', merged: true }]));
      mockOctokitInstance.rest.search.issuesAndPullRequests.mockClear();
      
      const result2 = await (service as any).fetchExternalPRs(mockOctokitInstance, 'alice');
      expect(result2.mergedExternalPRCount).toBe(1);
      expect(mockOctokitInstance.rest.search.issuesAndPullRequests).not.toHaveBeenCalled();
    });

    it('12. First call: 403 with x-ratelimit-remaining: 0 -> waits, retries, succeeds', async () => {
      const error403 = new Error('Rate limit');
      (error403 as any).status = 403;
      (error403 as any).response = { headers: { 'x-ratelimit-remaining': '0', 'x-ratelimit-reset': (Date.now() / 1000 + 2).toString() } };

      mockOctokitInstance.rest.search.issuesAndPullRequests
        .mockRejectedValueOnce(error403)
        .mockResolvedValueOnce({
          data: { items: [{ repository_url: 'https://api.github.com/repos/facebook/react' }] }
        });

      const result = await (service as any).fetchExternalPRs(mockOctokitInstance, 'alice');
      expect(mockOctokitInstance.rest.search.issuesAndPullRequests).toHaveBeenCalledTimes(2);
      expect(result.mergedExternalPRCount).toBe(1);
    });

    it('13. First call: 403 with x-ratelimit-remaining: 0, both retries fail -> returns empty array without throwing', async () => {
      const error403 = new Error('Rate limit');
      (error403 as any).status = 403;
      (error403 as any).response = { headers: { 'x-ratelimit-remaining': '0', 'x-ratelimit-reset': (Date.now() / 1000 + 2).toString() } };

      mockOctokitInstance.rest.search.issuesAndPullRequests.mockRejectedValue(error403);

      const result = await (service as any).fetchExternalPRs(mockOctokitInstance, 'alice');
      expect(mockOctokitInstance.rest.search.issuesAndPullRequests).toHaveBeenCalledTimes(3); // Initial + 2 retries
      expect(result.mergedExternalPRCount).toBe(0);
    });

    it('14. First call: 500 server error -> returns [] immediately (no retry)', async () => {
      const error500 = new Error('Server error');
      (error500 as any).status = 500;

      mockOctokitInstance.rest.search.issuesAndPullRequests.mockRejectedValue(error500);

      const result = await (service as any).fetchExternalPRs(mockOctokitInstance, 'alice');
      expect(mockOctokitInstance.rest.search.issuesAndPullRequests).toHaveBeenCalledTimes(1);
      expect(result.mergedExternalPRCount).toBe(0);
    });
  });
});
