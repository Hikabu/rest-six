import { Injectable } from '@nestjs/common';
import { JwtService } from '@nestjs/jwt';
import { PrismaService } from '../../prisma/prisma.service';
import { PrivyService } from './privy.service';
import { LoginDto } from './dto/login.dto';
import { UnauthorizedException } from '@nestjs/common';

/*
  Login via Privy on the frontend to get the accessToken

  Call POST /auth/login and put that token in the Authorization header as a Bearer token

  The backend will verify it, find/create your company record using the Privy ID, and return a new token

  Use this new token for all future requests to the API
*/
@Injectable()
export class AuthEmployerService {
  constructor(
    private prisma: PrismaService,
    private privyService: PrivyService,
    private jwtService: JwtService,
  ) {}

  async login(token: string, body: LoginDto) {
    const { privyId, email } = await this.privyService.verifyToken(token);

    if (!privyId) {
      throw new UnauthorizedException('Invalid Privy token');
    }

    // Always fetch user from Privy to sync/verify privyId and get wallet address
    const privyUser = await this.privyService.getUser(privyId);
    const walletAddress =
      (privyUser as any).wallet?.address ?? body.walletAddress ?? null;
    const userEmail =
      (privyUser as any).email?.address ??
      (privyUser as any).google?.email ??
      email ??
      null;

    if (!walletAddress) {
      throw new UnauthorizedException('No wallet linked to Privy user');
    }

    const company = await this.prisma.company.upsert({
      where: { walletAddress },
      update: {
        privyId,
        email: userEmail || undefined,
      },
      create: {
        privyId,
        email: userEmail,
        walletAddress,
        smartAccountAddress: body.smartAccountAddress || walletAddress,
        name: 'New company',
        country: 'Unknown',
        isVerified: true,
      },
    });

    const payload = {
      sub: company.id,
      walletAddress: company.walletAddress,
      privyId: company.privyId,
    };

    return {
      accessToken: this.jwtService.sign(payload),
    };
  }
}
