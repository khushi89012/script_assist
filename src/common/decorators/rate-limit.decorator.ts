import { SetMetadata } from '@nestjs/common';

// Define metadata key for rate limiting
export const RATE_LIMIT_KEY = 'rate-limit';

export const RateLimit = (limit: number, windowMs: number) => {
  return SetMetadata(RATE_LIMIT_KEY, { limit, windowMs });
};
