import { Module, Global } from '@nestjs/common';
import { RedisProvider } from './redis.provider';
import { RedisShutdownService } from './redis-shutdown.service';

@Global()
@Module({
  providers: [RedisProvider, RedisShutdownService],
  exports: [RedisProvider],
})
export class RedisModule {}
