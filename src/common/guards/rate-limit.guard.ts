import {
  Injectable,
  CanActivate,
  ExecutionContext,
  HttpException,
  HttpStatus,
} from '@nestjs/common';
import { Reflector } from '@nestjs/core';

// A more efficient in-memory store using a Map
const requestRecords = new Map<string, { count: number, timestamp: number }[]>();

@Injectable()
export class RateLimitGuard implements CanActivate {
  constructor(private reflector: Reflector) {}

  canActivate(context: ExecutionContext): boolean {
    const request = context.switchToHttp().getRequest();
    const ip = this.getAnonymizedIp(request.ip); // Security: Anonymize IPs if needed

    // Get rate limit configuration from metadata (decorator)
    const rateLimitConfig = this.reflector.get<{ limit: number, windowMs: number }>(
      'rate-limit',
      context.getHandler()
    );
    
    if (!rateLimitConfig) {
      return true; // No rate limiting applied, continue
    }
    
    return this.handleRateLimit(ip, rateLimitConfig.limit, rateLimitConfig.windowMs);
  }

  private handleRateLimit(ip: string, maxRequests: number, windowMs: number): boolean {
    const now = Date.now();
    const windowStart = now - windowMs;

    // Initialize IP record if not exists
    if (!requestRecords.has(ip)) {
      requestRecords.set(ip, []);
    }

    const records = requestRecords.get(ip);

    // Filter out requests older than the window
    const recentRecords = records?.filter(record => record.timestamp > windowStart) || [];
    if (recentRecords.length >= maxRequests) {
      // Rate limit exceeded
      throw new HttpException(
        `Rate limit exceeded. Try again later.`,
        HttpStatus.TOO_MANY_REQUESTS
      );
    }

    // Add the current request timestamp
    recentRecords.push({ count: 1, timestamp: now });

    // Update the record with the filtered list
    requestRecords.set(ip, recentRecords);

    return true;
  }

  // Optionally anonymize IP addresses for privacy concerns
  private getAnonymizedIp(ip: string): string {
    const parts = ip.split('.');
    if (parts.length === 4) {
      parts[3] = '0'; // Anonymize last octet
    }
    return parts.join('.');
  }
}
