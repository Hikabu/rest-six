import {
  Controller,
  Post,
  Body,
  Headers,
  UseGuards,
  Res,
} from '@nestjs/common';
import {
  ApiTags,
  ApiOperation,
  ApiBearerAuth,
  ApiBody,
  ApiOkResponse,
  ApiUnauthorizedResponse,
  ApiBadRequestResponse,
  ApiHeader,
} from '@nestjs/swagger';
import { Response } from 'express';

import { AuthEmployerService } from './auth.employer.service';
import { LoginDto } from './dto/login.dto';
import { BaseController } from '../../shared/base.controller';
import { Public } from './decorators/public.decorator';
import { AppException } from '../../shared/app.exception';
import { AuthGuard } from '@nestjs/passport/dist/auth.guard';

class LoginResponseDto {
  accessToken: string;
}

class AuthEmplErrorResponseDto {
  statusCode: number;
  message: string;
  error: string;
}

@ApiTags('Auth (Employer)')
@Controller('auth/employer')
export class AuthEmployerController extends BaseController {
  constructor(private readonly authService: AuthEmployerService) {
    super();
  }

  private authCookieOptions() {
    return {
      httpOnly: true,
      secure: process.env.NODE_ENV === 'production',
      sameSite: 'lax' as const,
    };
  }

  // ---------------- LOGIN ----------------

  @Public()
  @Post('login')
  @ApiBearerAuth()
  @ApiOperation({
    summary: 'Login with Privy token',
    description:
      'Verifies a Privy access token from frontend authentication and returns a signed JWT for API access. \nTESTING:\n 1. make sure .env > PRIVY_BYPASS="true"\n2. Bearer Token = debugtoken \n3. Authorization header = did:privy:test-user-123 ',
  })
  @ApiBody({
    type: LoginDto,
    description:
      'Optional login metadata used during company creation or update',
    examples: {
      default: {
        value: {
          walletAddress: '0x123456789abcdef0123456789abcdef012345678',
          smartAccountAddress: '0x123456789abcdef0123456789abcdef012345678',
        },
      },
    },
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
  async login(
    @Res() res: Response,
    @Headers('authorization') authHeader: string,
    @Body() loginDto: LoginDto,
  ) {
    if (!authHeader) {
      throw new AppException('No authorization header found', 401);
    }
    const token = authHeader.replace('Bearer ', '');

    const result = await this.authService.login(token, loginDto);
    res.cookie('access_token', result.accessToken, this.authCookieOptions());
    return res.json({
      success: true,
      message: 'Logged in successfully',
      data: result,
    });
  }

  @Post('logout')
  @ApiBearerAuth()
  @UseGuards(AuthGuard('jwt-employer'))
  @ApiOperation({
    summary: 'Logout user',
    description: 'Invalidates the user session or JWT token.',
  })
  async logout(@Res() res: Response) {
    res.clearCookie('access_token');
    res.clearCookie('refresh_token');
    return res.json({
      success: true,
      message: 'Logged out successfully',
      data: null,
    });
  }
}
