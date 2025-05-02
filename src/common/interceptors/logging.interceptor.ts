import { Injectable, NestInterceptor, ExecutionContext, CallHandler, Logger } from '@nestjs/common';
import { Observable } from 'rxjs';
import { tap } from 'rxjs/operators';

@Injectable()
export class LoggingInterceptor implements NestInterceptor {
  private readonly logger = new Logger(LoggingInterceptor.name);

  intercept(context: ExecutionContext, next: CallHandler): Observable<any> {
    const request = context.switchToHttp().getRequest();
    const method = request.method;
    const url = request.url;
    const user = request.user || {}; // Assuming `user` information is attached to the request
    const userId = user.id || 'N/A'; // Replace with appropriate user field
    const ip = request.ip || 'N/A'; // IP of the client making the request
    const now = Date.now();

    // Log incoming request with contextual information
    this.logger.log(`Incoming Request: ${method} ${url} | User: ${userId} | IP: ${ip}`);

    return next.handle().pipe(
      tap({
        next: (response) => {
          // Log response details including time taken
          const responseTime = Date.now() - now;
          this.logger.log(`Outgoing Response: ${method} ${url} | Status: ${response.statusCode} | Time: ${responseTime}ms`);
        },
        error: (err) => {
          // Log error details including time taken
          const responseTime = Date.now() - now;
          this.logger.error(`Error in ${method} ${url} | Status: ${err.status || 500} | Time: ${responseTime}ms | Error: ${err.message}`);
        },
      }),
    );
  }
}
