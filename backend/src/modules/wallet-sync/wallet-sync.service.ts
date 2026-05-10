import {
  Injectable,
  Inject,
  BadRequestException,
  NotFoundException,
  UnauthorizedException,
  HttpException,
  HttpStatus,
} from '@nestjs/common';
import { PrismaService } from '../../prisma/prisma.service';
import Redis from 'ioredis';
import nacl from 'tweetnacl';
import bs58 from 'bs58';
import { PublicKey } from '@solana/web3.js';
import { ProfileResolverService } from '../profile-candidate/profile-resolver.service';

@Injectable()
export class WalletSyncService {
  constructor(
    private readonly prisma: PrismaService,
    private readonly profileResolver: ProfileResolverService,
    @Inject('REDIS') private readonly redis: Redis,
  ) {}

  async generateChallenge(userId: string): Promise<string> {
    const randomHex = Math.random().toString(16).substring(2, 8);
    const timestamp = Date.now();
    const challenge = `link-wallet:${userId}:${timestamp}:${randomHex}`;

    await this.redis.set(`wallet-challenge:${userId}`, challenge, 'EX', 300);

    return challenge;
  }

  async linkWallet(
    userId: string,
    walletAddress: string,
    signature: string,
    message?: string,
  ): Promise<{ linked: boolean; solanaAddress: string }> {
    // Cooldown Check
    const candidate = await this.prisma.candidate.findUnique({
      where: { userId },
      select: { walletCooldownUntil: true },
    });

    if (candidate?.walletCooldownUntil && candidate.walletCooldownUntil > new Date()) {
      throw new HttpException('Please wait before linking another wallet.', HttpStatus.TOO_MANY_REQUESTS);
    }

    // Step 1 — validate walletAddress format
    if (!/^[1-9A-HJ-NP-Za-km-z]{32,44}$/.test(walletAddress)) {
      throw new BadRequestException('Invalid Solana wallet address');
    }

    let finalChallenge: string;

    if (message) {
      // Simplified/Stateless flow
      // Format: "Link Solana wallet to 16Signals\nUser: <userId>\nTimestamp: <ts>"
      if (!message.includes(`User: ${userId}`)) {
        throw new UnauthorizedException('Challenge message user mismatch');
      }

      const tsMatch = message.match(/Timestamp: (\d+)/);
      if (!tsMatch) {
        throw new BadRequestException('Invalid challenge message format');
      }

      const timestamp = parseInt(tsMatch[1], 10);
      const now = Date.now();
      if (Math.abs(now - timestamp) > 300_000) { // 5 minutes window
        throw new UnauthorizedException('Challenge message expired');
      }

      finalChallenge = message;
    } else {
      // Step 2 — retrieve challenge from Redis (legacy flow)
      const challenge = await this.redis.get(`wallet-challenge:${userId}`);
      if (!challenge) {
        throw new NotFoundException('Challenge expired or not found');
      }
      finalChallenge = challenge;
      await this.redis.del(`wallet-challenge:${userId}`);
    }

    // Step 3 — verify signature
    try {
      const msgBytes = Buffer.from(finalChallenge, 'utf8');
      const sigBytes = bs58.decode(signature);
      const pubkeyBytes = new PublicKey(walletAddress).toBytes();

      const valid = nacl.sign.detached.verify(msgBytes, sigBytes, pubkeyBytes);
      if (!valid) {
        throw new UnauthorizedException('Wallet signature invalid');
      }
    } catch (err) {
      throw new UnauthorizedException(
        `Verification failed: ${(err as Error).message}`,
      );
    }
    // console.log("userid: ", userId);
    // Step 5 — ensure Candidate + DeveloperCandidate exist

    // Step 5 — ensure stack + upsert Web3Profile
    const { devProfile } = await this.profileResolver.ensureDevStack(userId);

    await this.prisma.web3Profile.upsert({
      where: { userId },
      create: {
        userId,
        solanaAddress: walletAddress,
        devCandidateId: devProfile.id,
      },
      update: {
        solanaAddress: walletAddress,
      },
    });

    // Set 10m cooldown
    await this.prisma.candidate.update({
      where: { userId },
      data: { walletCooldownUntil: new Date(Date.now() + 10 * 60 * 1000) },
    });

    return { linked: true, solanaAddress: walletAddress };
  }
}
