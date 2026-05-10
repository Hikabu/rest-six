import { Controller, Post, UseGuards, Res, Req, Logger } from '@nestjs/common';
import {
  ApiTags,
  ApiOperation,
  ApiBearerAuth,
  ApiOkResponse,
  ApiUnauthorizedResponse,
  ApiBadRequestResponse,
} from '@nestjs/swagger';
import { CookieOptions, Request, Response } from 'express';

import { AuthEmployerService } from './auth.employer.service';
import { BaseController } from '../../shared/base.controller';
import { Public } from './decorators/public.decorator';
import { AuthGuard } from '@nestjs/passport/dist/auth.guard';
import { verifyPrivyToken } from './verify-privy-token';

class LoginResponseDto {
  token: string;
  role: 'employer';
  username: string;
  user: {
    id: string;
    name: string;
    email: string | null;
    walletAddress: string | null;
    privyUserId: string;
  };
}

class AuthEmplErrorResponseDto {
  statusCode: number;
  message: string;
  error: string;
}

@ApiTags('Auth (Employer)')
@Controller('auth/employer')
export class AuthEmployerController extends BaseController {
  private readonly logger = new Logger(AuthEmployerController.name);

  constructor(private readonly authService: AuthEmployerService) {
    super();
  }

  private readonly authCookieOptions: CookieOptions = {
    httpOnly: true,
    secure: process.env.NODE_ENV === 'production',
    sameSite: 'lax',
  };

  // ---------------- LOGIN ----------------

  @Public()
  @Post('login')
  @ApiBearerAuth()
  @ApiOperation({
    summary: 'Login with Privy token',
    description:
      'Verifies a Privy access token from Authorization header and returns an employer JWT.',
  })
  @ApiOkResponse({
    description: 'Successfully authenticated and returned application JWT',
    type: LoginResponseDto,
  })
  @ApiUnauthorizedResponse({
    description: 'Invalid or missing Privy token',
    type: AuthEmplErrorResponseDto,
  })
  @ApiBadRequestResponse({
    description: 'Missing authorization header or invalid request payload',
    type: AuthEmplErrorResponseDto,
  })
  async login(@Req() req: Request, @Res() res: Response) {
    try {
      const privyUser = await verifyPrivyToken(req);
      this.logger.log(`Privy user verified: ${privyUser.privyUserId}`);
      const result = await this.authService.login(privyUser);
      res.cookie('access_token', result.token, this.authCookieOptions);
      return res.json({
        success: true,
        message: 'Logged in successfully',
        data: result,
      });
    } catch (error) {
      const errorMessage = error instanceof Error ? error.message : 'Unknown error';
      this.logger.error(`Employer Privy login failed: ${errorMessage}`);
      throw error;
    }
  }

  @Post('logout')
  @ApiBearerAuth()
  @UseGuards(AuthGuard('jwt-employer'))
  @ApiOperation({
    summary: 'Logout user',
    description: 'Invalidates the user session or JWT token.',
  })
  logout(@Res() res: Response) {
    res.clearCookie('access_token');
    res.clearCookie('refresh_token');
    return res.json({
      success: true,
      message: 'Logged out successfully',
      data: null,
    });
  }
}
