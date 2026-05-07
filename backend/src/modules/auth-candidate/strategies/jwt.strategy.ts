import { Injectable } from '@nestjs/common';
import { PassportStrategy } from '@nestjs/passport';
import { Strategy, ExtractJwt } from 'passport-jwt';
import { ConfigService } from '@nestjs/config';

type JwtPayload = {
  sub: string;
  isEmailVerified: boolean;
  role: string;
  web3Profile?: unknown;
};

@Injectable()
export class JwtStrategy extends PassportStrategy(Strategy, 'jwt') {
  constructor(config: ConfigService) {
    const secret = config.get<string>('JWT_ACCESS_SECRET');

    if (!secret) throw new Error('JWT_ACCESS_SECRET missing');

    super({
      jwtFromRequest: ExtractJwt.fromExtractors([
        (req) => req?.cookies?.access_token,
        ExtractJwt.fromAuthHeaderAsBearerToken(),
      ]),
      ignoreExpiration: false,
      secretOrKey: secret,
    });
  }

  async validate(payload: JwtPayload) {
    return {
      id: payload.sub,
      isEmailVerified: payload.isEmailVerified,
      role: payload.role,
      web3Profile: payload.web3Profile || null,
    };
  }
}
