import { Injectable, UnauthorizedException } from '@nestjs/common';
import { PassportStrategy } from '@nestjs/passport';
import { ExtractJwt, Strategy } from 'passport-jwt';
import { ConfigService } from '@nestjs/config';
import { PrismaService } from '../../../prisma/prisma.service';

type EmployerJwtPayload = {
  sub: string;
};

@Injectable()
export class JwtStrategy extends PassportStrategy(Strategy, 'jwt-employer') {
  constructor(
    private configService: ConfigService,
    private prisma: PrismaService,
  ) {
    super({
      jwtFromRequest: ExtractJwt.fromExtractors([
        (req) => req?.cookies?.access_token,
        ExtractJwt.fromAuthHeaderAsBearerToken(),
      ]),
      ignoreExpiration: false,
      secretOrKey: configService.get<string>('JWT_SECRET'),
    });
  }

  async validate(payload: EmployerJwtPayload) {
    const company = await this.prisma.company.findUnique({
      where: { id: payload.sub },
    });

    if (!company) {
      throw new UnauthorizedException('Company not found');
    }

    return company;
  }
}
