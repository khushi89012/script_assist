import { ExceptionFilter, Catch, ArgumentsHost, HttpException, Logger } from '@nestjs/common';
import { Request, Response } from 'express';

@Catch(HttpException)
export class HttpExceptionFilter implements ExceptionFilter {
  private readonly logger = new Logger(HttpExceptionFilter.name);

  catch(exception: HttpException, host: ArgumentsHost) {
    const ctx = host.switchToHttp();
    const response = ctx.getResponse<Response>();
    const request = ctx.getRequest<Request>();
    const status = exception.getStatus();
    const exceptionResponse = exception.getResponse();

    // Format the error response consistently
    let message = 'An unexpected error occurred.';
    let errorDetails = exceptionResponse;
    
    // If the response is an object, destructure it
    if (typeof exceptionResponse === 'object' && exceptionResponse !== null) {
      message = (exceptionResponse as { message?: string }).message || message;
      errorDetails = exceptionResponse;
    } else {
      message = exceptionResponse as string;
    }

    // Log the exception appropriately
    if (status >= 500) {
      // Server errors (e.g., internal server error)
      this.logger.error(
        `Internal Server Error: ${message}`,
        exception.stack,
      );
    } else if (status >= 400) {
      // Client errors (e.g., bad request, unauthorized)
      this.logger.warn(
        `Client Error: ${message}`,
        exception.stack,
      );
    }

    // Send response in a consistent format
    response.status(status).json({
      success: false,
      statusCode: status,
      message: message,
      error: errorDetails, // Optionally include additional error details (be mindful of sensitive data)
      path: request.url,
      timestamp: new Date().toISOString(),
    });
  }
}
