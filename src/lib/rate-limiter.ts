/**
 * Simple in-memory rate limiter
 * For production, use Redis or a dedicated rate limiting service
 */

type RateLimitStore = {
  [key: string]: {
    count: number;
    resetTime: number;
  };
};

const store: RateLimitStore = {};

// Cleanup old entries every 10 minutes
setInterval(() => {
  const now = Date.now();
  Object.keys(store).forEach((key) => {
    if (store[key].resetTime < now) {
      delete store[key];
    }
  });
}, 10 * 60 * 1000);

export type RateLimitConfig = {
  maxRequests: number; // Max requests allowed
  windowMs: number; // Time window in milliseconds
};

export type RateLimitResult = {
  allowed: boolean;
  remaining: number;
  resetTime: number;
  retryAfter?: number;
};

/**
 * Check if a request is within rate limit
 * @param identifier - Unique identifier (IP, user ID, etc.)
 * @param config - Rate limit configuration
 */
export function checkRateLimit(
  identifier: string,
  config: RateLimitConfig
): RateLimitResult {
  const now = Date.now();
  const key = `${identifier}`;

  // Initialize or reset if window expired
  if (!store[key] || store[key].resetTime < now) {
    store[key] = {
      count: 1,
      resetTime: now + config.windowMs,
    };

    return {
      allowed: true,
      remaining: config.maxRequests - 1,
      resetTime: store[key].resetTime,
    };
  }

  // Increment count
  store[key].count++;

  // Check if over limit
  if (store[key].count > config.maxRequests) {
    const retryAfter = Math.ceil((store[key].resetTime - now) / 1000);
    return {
      allowed: false,
      remaining: 0,
      resetTime: store[key].resetTime,
      retryAfter,
    };
  }

  return {
    allowed: true,
    remaining: config.maxRequests - store[key].count,
    resetTime: store[key].resetTime,
  };
}

/**
 * Preset rate limit configurations
 */
export const RateLimits = {
  // Auth endpoints: 5 requests per 15 minutes
  AUTH: { maxRequests: 5, windowMs: 15 * 60 * 1000 },

  // Status updates: 60 per minute
  STATUS: { maxRequests: 60, windowMs: 60 * 1000 },

  // Circle operations: 30 per minute
  CIRCLE: { maxRequests: 30, windowMs: 60 * 1000 },

  // Profile updates: 10 per minute
  PROFILE: { maxRequests: 10, windowMs: 60 * 1000 },

  // SMS operations: 10 per hour
  SMS: { maxRequests: 10, windowMs: 60 * 60 * 1000 },

  // Webhooks: 100 per minute
  WEBHOOK: { maxRequests: 100, windowMs: 60 * 1000 },
};

/**
 * Get client identifier from request
 */
export function getClientIdentifier(request: Request): string {
  // Try to get user ID from headers (if authenticated)
  const userId = request.headers.get("x-user-id");
  if (userId) return `user:${userId}`;

  // Fall back to IP address
  const forwarded = request.headers.get("x-forwarded-for");
  const ip = forwarded ? forwarded.split(",")[0] : "unknown";

  return `ip:${ip}`;
}
