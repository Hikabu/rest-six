import {
  Controller,
  Post,
  Get,
  Body,
  Param,
  UseGuards,
  NotFoundException,
  HttpCode,
  HttpStatus,
  Req,
  BadRequestException,
  UsePipes,
  ValidationPipe,

  UnauthorizedException,
  InternalServerErrorException,
} from '@nestjs/common';
import { Queue } from 'bullmq';
import { InjectQueue } from '@nestjs/bullmq';
import { CacheService } from '../cache/cache.service';
import { InternalKeyGuard } from '../../scorecard/internal-key.guard';
import { OptionalJwtAuthGuard } from '../../auth-candidate/guards/optional-jwt-auth.guard';
import {
  ApiTags,
  ApiOperation,
  ApiParam,
  ApiBody,
  ApiCreatedResponse,
  ApiOkResponse,
  ApiBadRequestResponse,
  ApiUnauthorizedResponse,
  ApiNotFoundResponse,
  ApiBearerAuth,
  ApiHeader
} from '@nestjs/swagger';
import { PrismaService } from '../../../prisma/prisma.service';
import { Prisma } from '@prisma/client';

import { CreateAnalysisDto, RecomputeAnalysisDto } from './dto/analysis.dto';

import {
  JobQueueResponseDto,
  JobStatusResponseDto,
  JobResultResponseDto,
  AnalysisErrorResponseDto,
} from './dto/analysis-response.dto';
import { JobResponseDto } from '../../jobs/dto/jobResponse.dto';
import { ProfileResolverService } from '../../profile-candidate/profile-resolver.service';

@ApiTags('Proof Of Talent')
@Controller('api/analysis')
export class AnalysisController {
  constructor(
    @InjectQueue('signal-compute') private readonly signalQueue: Queue,
    private readonly cacheService: CacheService,
    private readonly prisma: PrismaService,
	private readonly profileResolver: ProfileResolverService
  ) {}

  @Post()
  @UseGuards(OptionalJwtAuthGuard)
  @HttpCode(HttpStatus.CREATED)
  @ApiOperation({
    summary: 'Trigger developer analysis',
    description: `
Creates or retrieves an analysis job for a developer.

Modes:
1. Authenticated: Reads linked GitHub/Wallet from profile.
2. Anonymous: Takes identifiers from body.

Features:
- Cache check (skip if force=true)
- GitHub snapshot reuse (<24h)
- Async execution via BullMQ
    `,
  })
  @ApiBody({
  type: CreateAnalysisDto,
  required: false,
  description: `
Optional if authenticated.

- If JWT is provided → body is ignored (uses linked accounts)
- If no JWT → must provide githubUsername or walletAddress
`,
})
  @ApiCreatedResponse({ type: JobQueueResponseDto })
  @ApiBadRequestResponse({ type: AnalysisErrorResponseDto })
  async createAnalysis(
    @Req() req: any,
@Body() body?: CreateAnalysisDto & { force?: boolean }  ) {
    let githubUsername: string | null = null;
    let walletAddress: string | null = null;
    let useGithubCache = false;

//     if (req.user) {
//       const userId = req.user.id;
//     //   const githubProfile = await this.prisma.githubProfile.findUnique({
//     //     where: { userId },
//     //   });
// 	const { devProfile } = await this.profileResolver.ensureDevStack(userId);

// const githubProfile = devProfile?.githubProfile;
// const web3Profile = devProfile?.web3Profile;
// console.log('devProfile:', devProfile);
// console.log('githubProfile:', githubProfile);
//     //   const web3Profile = await this.prisma.web3Profile.findUnique({
//     //     where: { userId },
//     //   });

//       if (!githubProfile && !web3Profile) {
//         throw new BadRequestException(
//           'No linked accounts. Use POST /sync/github or POST /sync/wallet first.',
//         );
//       }

//       githubUsername = githubProfile?.githubUsername ?? null;
//       walletAddress = web3Profile?.solanaAddress ?? null;

//       if (githubProfile?.lastSyncAt) {
//         useGithubCache =
//           githubProfile.lastSyncAt.getTime() > Date.now() - 86_400_000;
//       }
//     } 
if (req.user) {
  const input = await this.resolveInputFromUser(req.user.id);

  githubUsername = input.githubUsername;
  walletAddress = input.walletAddress;
  useGithubCache = input.useGithubCache ?? false;
}
	else {
      githubUsername = body?.githubUsername ?? null;
      walletAddress = body?.walletAddress ?? null;

      if (!githubUsername && !walletAddress) {
        throw new BadRequestException(
          'githubUsername or walletAddress is required',
        );
      }

      if (
        walletAddress &&
        !/^[1-9A-HJ-NP-Za-km-z]{32,44}$/.test(walletAddress)
      ) {
        throw new BadRequestException('Invalid Solana wallet address format');
      }
    }

    const mode =
      githubUsername && walletAddress
        ? 'github+wallet'
        : walletAddress
          ? 'wallet-only'
          : 'github-only';

    const cacheKey = this.cacheService.buildCacheKey(
      githubUsername ?? undefined,
      walletAddress ?? undefined,
    );

    if (!body?.force) {
      const cached = await this.cacheService.get(cacheKey);
      if (cached) {
        return { jobId: `cached-${cacheKey}`, cached: true, result: cached };
      }
    }

    const jobRecord = await this.prisma.analysisJob.create({
      data: {
        status: 'pending',
        input: { githubUsername, walletAddress, mode, useGithubCache } as any,
        userId: req.user?.id ?? null,
      },
    });

    await this.signalQueue.add('analyze', {
      jobId: jobRecord.id,
      githubUsername,
      walletAddress,
      mode,
      useGithubCache,
      userId: req.user?.id ?? null,
    },
{attempts: 1});

    return { jobId: jobRecord.id };
  }

  @Post('recompute')
  @UsePipes(new ValidationPipe({ transform: false }))
  @HttpCode(HttpStatus.CREATED)
  @UseGuards(InternalKeyGuard)
  @ApiBearerAuth()
  @ApiHeader({
  name: 'x-internal-key',
  required: true,
  description: 'Internal API key',
})
  @ApiOperation({
    summary: 'Recompute analysis',
    description: `
Triggers a fresh analysis.

- If force=true → cache is invalidated
- Requires internal API key (Bearer token)

Use this for admin/system reprocessing.
    `,
  })
  @ApiBody({
    type: RecomputeAnalysisDto,
  })
  @ApiCreatedResponse({
    description: 'Recompute job created',
    type: JobResponseDto,
  })
  @ApiUnauthorizedResponse({
    description: 'Missing or invalid internal API key',
    type: AnalysisErrorResponseDto,
  })
  @ApiNotFoundResponse({
    description: 'Profile not found',
    type: AnalysisErrorResponseDto,
  })
async recompute(@Body() body: RecomputeAnalysisDto) {
  const { userId, force } = body;

  if (!userId) {
    throw new BadRequestException('userId is required');
  }

  const input = await this.resolveInputFromUser(userId);

  const cacheKey = this.cacheService.buildCacheKey(
    input.githubUsername ?? undefined,
    input.walletAddress ?? undefined,
  );

  if (!force) {
    const cached = await this.cacheService.get(cacheKey);
    if (cached) {
      return { jobId: `cached-${cacheKey}`, cached: true, result: cached };
    }
  }

  const jobRecord = await this.prisma.analysisJob.create({
    data: {
      status: 'pending',
      input: {
        githubUsername: input.githubUsername,
        walletAddress: input.walletAddress,
        mode: input.mode,
        useGithubCache: input.useGithubCache ?? false,
      } as any,
      userId, // ✅ ALWAYS SET
    },
  });

  await this.signalQueue.add('analyze', {
    jobId: jobRecord.id,
    githubUsername: input.githubUsername,
    walletAddress: input.walletAddress,
    mode: input.mode,
    useGithubCache: input.useGithubCache,
    userId,
  });

  return { jobId: jobRecord.id };
}
//   async recompute(@Req() req: any, @Body() body: RecomputeAnalysisDto) {
// 	// console.log(body);
//     return this.createAnalysis(req, { ...body, force: true });
//   }
private async resolveInputFromUser(userId: string):Promise<{
  githubUsername: string | null;
  walletAddress: string | null;
  useGithubCache: boolean; // ✅ force strict boolean
  mode: 'github+wallet' | 'wallet-only' | 'github-only';
}>  {
  const { devProfile } = await this.profileResolver.ensureDevStack(userId);

  const githubProfile = devProfile?.githubProfile;
  const web3Profile = devProfile?.web3Profile;

  if (!githubProfile && !web3Profile) {
    throw new NotFoundException(
      'No linked accounts. Use POST /sync/github or POST /sync/wallet first.',
    );
  }

  const githubUsername = githubProfile?.githubUsername ?? null;
  const walletAddress = web3Profile?.solanaAddress ?? null;

  const useGithubCache = !!(
  githubProfile?.lastSyncAt &&
  githubProfile.lastSyncAt.getTime() > Date.now() - 86_400_000
);

  const mode =
    githubUsername && walletAddress
      ? 'github+wallet'
      : walletAddress
      ? 'wallet-only'
      : 'github-only';

  return {
    githubUsername,
    walletAddress,
    useGithubCache,
    mode,
  };
}
  @Get(':jobId/status')
  @ApiOperation({
    summary: 'Get job status',
    description: 'Returns current job state, stage, and progress percentage.',
  })
  @ApiParam({
    name: 'jobId',
    type: String,
    example: '12345',
    description: 'BullMQ job ID returned when creating analysis',
  })
  @ApiOkResponse({
    description: 'Job status retrieved',
    type: JobStatusResponseDto,
  })
  @ApiNotFoundResponse({
    description: 'Job not found',
    type: AnalysisErrorResponseDto,
  })
  async getStatus(@Param('jobId') jobId: string) {
    if (jobId.startsWith('cached-')) {
      return {
        status: 'complete',
        stage: 'complete',
        progress: 100,
      };
    }

    const job = await this.prisma.analysisJob.findUnique({
    where: { id: jobId },
  });

  if (!job) {
    throw new NotFoundException(`Job ${jobId} not found`);
  }

  let progress = 0;
  let stage = 'queued';

  if (job.status === 'processing') {
    stage = 'analyzing_projects'; // you can refine later
    progress = 50; // placeholder unless you persist progress
  }

  if (job.status === 'completed') {
    stage = 'complete';
    progress = 100;
  }

  if (job.status === 'failed') {
    stage = 'failed';
  }

  return {
    status:
      job.status === 'completed'
        ? 'complete'
        : job.status === 'failed'
        ? 'failed'
        : 'pending',
    stage,
    progress,
    failureReason: job.error ?? undefined,
  };
  }

  @Get(':jobId/result')
  @ApiOperation({
    summary: 'Get job result',
    description: 'Returns final analysis result if completed.',
  })
  @ApiParam({
    name: 'jobId',
    type: String,
    example: '12345',
  })
  @ApiOkResponse({
    description: 'Job result response',
    type: JobResultResponseDto,
  })
  @ApiNotFoundResponse({
    description: 'Job not found',
    type: AnalysisErrorResponseDto,
  })
  async getResult(@Param('jobId') jobId: string) {
    if (jobId.startsWith('cached-')) {
      const cacheKey = jobId.replace('cached-', '');
      const cached = await this.cacheService.get(cacheKey);
      if (cached) {
        return { status: 'complete', result: cached };
      }
    }

    const job = await this.prisma.analysisJob.findUnique({
    where: { id: jobId },
  });

  if (!job) {
    throw new NotFoundException(`Job ${jobId} not found`);
  }

  if (job.status === 'completed') {
    return {
      status: 'completed',
      progress: 100,
      result: job.result,
    };
  }

  if (job.status === 'failed') {
    return {
      status: 'failed',
      progress: 0,
      error: job.error,
    };
  }

  return {
    status: 'pending',
    progress: 0,
  };
}

  private parseProgress(progress: any): number {
    if (typeof progress === 'number') return progress;
    if (typeof progress === 'string') {
      try {
        const parsed = JSON.parse(progress);
        return typeof parsed.percent === 'number' ? parsed.percent : 0;
      } catch {
        return 0;
      }
    }
    return 0;
  }
}
