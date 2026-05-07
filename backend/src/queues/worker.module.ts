import { Module } from '@nestjs/common';
import { SignalComputeProcessor } from './signal-compute.processor';
import { EmailProcessor } from './email.processor';
import { GithubSyncProcessor } from './github-sync.processor';
import { PrismaModule } from '../prisma/prisma.module';
import { ScoringModule } from '../modules/scoring/scoring.module';
import { SignalExtractorModule } from '../modules/scoring/signal-extractor/signal-extractor.module';
import { CacheModule } from '../modules/scoring/cache/cache.module';
import { GithubAdapterModule } from '../modules/scoring/github-adapter/github-adapter.module';
import { QueuesModule } from './queues.module';
import { EmailModule } from '../modules/email/email.module';
import { ConfigModule } from '../shared/config/config.module';

@Module({
  imports: [
    ConfigModule,
    QueuesModule,
    PrismaModule,
    ScoringModule,
    SignalExtractorModule,
    GithubAdapterModule,
    CacheModule,
    EmailModule,
  ],
  providers: [SignalComputeProcessor, EmailProcessor, GithubSyncProcessor],
})
export class WorkerModule {}
