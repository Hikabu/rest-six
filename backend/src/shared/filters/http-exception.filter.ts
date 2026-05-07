import {
  ArgumentsHost,
  Catch,
  ExceptionFilter,
  HttpException,
  HttpStatus,
  Logger,
} from '@nestjs/common';
import { Request, Response } from 'express';

@Catch()
export class HttpExceptionFilter implements ExceptionFilter {
  private readonly logger = new Logger(HttpExceptionFilter.name);

  catch(exception: unknown, host: ArgumentsHost) {
    const ctx = host.switchToHttp();
    const response = ctx.getResponse<Response>();
    const request = ctx.getRequest<Request>();
    const isHttpException = exception instanceof HttpException;
    const status = isHttpException
      ? exception.getStatus()
      : HttpStatus.INTERNAL_SERVER_ERROR;
    const body = isHttpException ? exception.getResponse() : null;
    const message =
      typeof body === 'object' && body && 'message' in body
        ? (body as { message: unknown }).message
        : isHttpException
          ? exception.message
          : 'Internal server error';

    if (status >= 500) {
      this.logger.error(
        `${request.method} ${request.url} failed with ${status}`,
        exception instanceof Error ? exception.stack : undefined,
      );
    }

    response.status(status).json({
      statusCode: status,
      message,
      error:
        typeof body === 'object' && body && 'error' in body
          ? (body as { error: unknown }).error
          : HttpStatus[status],
      path: request.url,
      timestamp: new Date().toISOString(),
    });
  }
}
