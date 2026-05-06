import { Injectable, Logger } from '@nestjs/common';
import { ConfigService } from '@nestjs/config';
import { PrismaService } from '../../../prisma/prisma.service';
import { decrypt } from '../../../shared/utils/crypto.utils';
import { Octokit } from 'octokit';

@Injectable()
export class OctokitFactory {
  private readonly logger = new Logger(OctokitFactory.name);

  constructor(
    private readonly prisma: PrismaService,
    private readonly config: ConfigService,
  ) {}

  async forJob(userId: string | null): Promise<Octokit> {
    if (userId) {
      const profile = await this.prisma.githubProfile.findUnique({
        where: { userId },
        select: { encryptedToken: true },
      });

      if (profile?.encryptedToken) {
        try {
          const key = this.config.get<string>('AUTH_ENCRYPTION_KEY');
          if (!key) throw new Error('AUTH_ENCRYPTION_KEY not set');

          const data = profile.encryptedToken.startsWith('v1:')
            ? profile.encryptedToken.substring(3)
            : profile.encryptedToken;

          const token = decrypt(data, key);
          this.logger.debug({ userId }, 'octokit_using_user_token');
          return new Octokit({
            auth: token,
            request: {
              headers: {
                'X-GitHub-Api-Version': '2022-11-28',
              },
            },
          });
        } catch (err: any) {
          // Token decrypt failed — fall through to system token
          this.logger.warn(
            { userId, err: err.message },
            'octokit_token_decrypt_failed',
          );
        }
      }
    }

    // Anonymous or token unavailable — use system token
    this.logger.debug(
      { userId: userId ?? 'anonymous' },
      'octokit_using_system_token',
    );
    return new Octokit({
      auth: this.config.get<string>('GITHUB_SYSTEM_TOKEN'),
      request: {
        headers: {
          'X-GitHub-Api-Version': '2022-11-28',
        },
      },
    });
  }
}
