import {
  Inject,
  Injectable,
  Logger,
  OnApplicationShutdown,
} from '@nestjs/common';
import Redis from 'ioredis';

@Injectable()
export class RedisShutdownService implements OnApplicationShutdown {
  private readonly logger = new Logger(RedisShutdownService.name);

  constructor(@Inject('REDIS') private readonly redis: Redis) {}

  async onApplicationShutdown() {
    try {
      await this.redis.quit();
    } catch (err) {
      const message =
        err instanceof Error ? err.message : 'Unknown Redis error';
      this.logger.warn(`Redis shutdown skipped: ${message}`);
      this.redis.disconnect();
    }
  }
}
