import { Controller, Get, Inject } from '@nestjs/common';
import { ApiTags } from '@nestjs/swagger';
import { SkipThrottle } from '@nestjs/throttler';
import {
  HealthCheck,
  HealthCheckService,
  HealthIndicatorResult,
  PrismaHealthIndicator,
} from '@nestjs/terminus';
import Redis from 'ioredis';
import { Public } from '../auth-employer/decorators/public.decorator';
import { PrismaService } from '../../prisma/prisma.service';

@ApiTags('System')
@Controller('health')
export class HealthController {
  constructor(
    private readonly health: HealthCheckService,
    private readonly prismaHealth: PrismaHealthIndicator,
    private readonly prisma: PrismaService,
    @Inject('REDIS') private readonly redis: Redis,
  ) {}

  @Get()
  @SkipThrottle()
  @Public()
  @HealthCheck()
  check() {
    return this.health.check([
      () =>
        this.prismaHealth.pingCheck('database', this.prisma, { timeout: 1000 }),
      async (): Promise<HealthIndicatorResult> => {
        await this.redis.ping();
        return { redis: { status: 'up' } };
      },
    ]);
  }
}
