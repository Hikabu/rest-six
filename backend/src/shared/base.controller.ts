export interface ApiResponse<T = any> {
  success: boolean;
  message?: string;
  data?: T;
  meta?: any;
}

export interface ApiSuccessResponse<T> {
  success: true;
  message?: string;
  data: T;
  meta?: any;
}

export class BaseController {
  protected handleSuccess<T>(data: T): ApiSuccessResponse<T>;
  protected handleSuccess<T>(data: T, message: string): ApiSuccessResponse<T>;
  protected handleSuccess<T>(
    data: T,
    message?: string,
    meta?: any,
  ): ApiSuccessResponse<T> {
    return {
      success: true,
      message,
      data,
      meta,
    };
  }
  protected handleCreated<T>(data: T, message?: string): ApiSuccessResponse<T> {
    return {
      success: true,
      message: message || 'Created successfully',
      data,
    };
  }
}
