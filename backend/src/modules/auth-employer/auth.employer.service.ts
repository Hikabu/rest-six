import { Injectable } from '@nestjs/common';
import { JwtService } from '@nestjs/jwt';
import { PrismaService } from '../../prisma/prisma.service';
import { UnauthorizedException } from '@nestjs/common';
import { PrivyAuthUser } from './privyAuth';

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
    private jwtService: JwtService,
  ) {}

  async login(privyUser: PrivyAuthUser) {
    const { privyUserId, email, walletAddress } = privyUser;

    if (!privyUserId) {
      throw new UnauthorizedException('Invalid Privy token');
    }

    let company = await this.prisma.company.findUnique({
      where: { privyId: privyUserId },
    });

    if (!company && email) {
      company = await this.prisma.company.findUnique({
        where: { email },
      });
    }

    if (!company && walletAddress) {
      company = await this.prisma.company.findUnique({
        where: { walletAddress },
      });
    }

    if (company) {
      company = await this.prisma.company.update({
        where: { id: company.id },
        data: {
          privyId: privyUserId,
          email: email ?? undefined,
          walletAddress: walletAddress ?? undefined,
          smartAccountAddress: walletAddress ?? undefined,
        },
      });
    } else {
      company = await this.prisma.company.create({
        data: {
          privyId: privyUserId,
          email: email ?? null,
          walletAddress: walletAddress ?? null,
          smartAccountAddress: walletAddress ?? null,
          name: 'New company',
          country: 'Unknown',
          isVerified: true,
        },
      });
    }

    const payload = {
      sub: company.id,
      walletAddress: company.walletAddress,
      privyId: company.privyId,
    };

    return {
      token: this.jwtService.sign(payload),
      role: 'employer',
      username: company.name,
      user: {
        id: company.id,
        name: company.name,
        email: company.email,
        walletAddress: company.walletAddress,
        privyUserId: company.privyId,
      },
    };
  }
}
