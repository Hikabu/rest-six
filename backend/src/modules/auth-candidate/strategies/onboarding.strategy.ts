import { Injectable, UnauthorizedException } from '@nestjs/common';
import { PassportStrategy } from '@nestjs/passport';
import { Strategy, ExtractJwt } from 'passport-jwt';
import { ConfigService } from '@nestjs/config';

@Injectable()
export class OnboardingStrategy extends PassportStrategy(
  Strategy,
  'onboarding',
) {
  constructor(private config: ConfigService) {
    super({
      jwtFromRequest: ExtractJwt.fromExtractors([
        (req) => req?.cookies?.temp_auth,
        (req) => req?.headers?.authorization?.split(' ')[1],
      ]),
      secretOrKey: config.get('jwt_secret.onboarding'),
    });
  }

  async validate(payload: any) {
    if (payload.type !== 'onboarding') {
      throw new UnauthorizedException('Invalid token type');
    }

    return payload; // becomes req.user
  }
}
