import { Module, Global } from '@nestjs/common';
import { GithubAdapterService } from './github-adapter/github-adapter.service';
import { CacheService } from './cache/cache.service';
import { PrismaModule } from '../../prisma/prisma.module';
import { RedisModule } from '../../redis/redis.module';
import { AnalysisController } from './analysis/analysis.controller';
import { BullModule } from '@nestjs/bullmq';
import { ScoringService } from './scoring-service/scoring.service';
import { SignalExtractorService } from './signal-extractor/signal-extractor.service';
import { EcosystemClassifierService } from './signal-extractor/ecosystem-clarifier.service';
import { StackFingerprintService } from './signal-extractor/stack-fingerprint.service';
import { SummaryGeneratorService } from './summary-generator/summary-generator.service';
import { SolanaAdapterService } from './web3-adapter/solana-adapter.service';
import { Web3MergeService } from './web3-merge/web3-merge.service';
import { ConfigModule } from '@nestjs/config';

import { GapAnalysisModule } from './gap-analysis/gap-analysis.module';
import { DecisionCardModule } from './decision-card/decision-card.module';
import { ProfileResolverModule } from '../profile-candidate/profile-resolver.module';

@Global()
@Module({
  imports: [
    ConfigModule,
    PrismaModule,
    RedisModule,
    GapAnalysisModule,
    DecisionCardModule,
    ProfileResolverModule,
    ...(process.env.NODE_ENV === 'test'
      ? []
      : [BullModule.registerQueue({ name: 'signal-compute' })]),
  ],
  providers: [
    GithubAdapterService,
    CacheService,
    ScoringService,
    SignalExtractorService,
    EcosystemClassifierService,
    StackFingerprintService,
    SummaryGeneratorService,
    SolanaAdapterService,
    Web3MergeService,
  ],
  controllers: [AnalysisController],
  exports: [
    GithubAdapterService,
    CacheService,
    ScoringService,
    SolanaAdapterService,
    Web3MergeService,
    ...(process.env.NODE_ENV === 'test' ? [] : [BullModule]),
  ],
})
export class ScoringModule {}
