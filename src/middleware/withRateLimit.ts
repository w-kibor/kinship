import { NextRequest, NextResponse } from "next/server";
import {
  checkRateLimit,
  getClientIdentifier,
  RateLimitConfig,
} from "@/lib/rate-limiter";
import { APIMonitor } from "@/lib/monitoring";
import { createErrorResponse } from "@/lib/security";

/**
 * Middleware wrapper to add rate limiting to API routes
 */
export function withRateLimit(
  handler: (request: NextRequest) => Promise<NextResponse>,
  config: RateLimitConfig,
  endpointName: string
) {
  return async (request: NextRequest): Promise<NextResponse> => {
    const monitor = new APIMonitor(endpointName, request.method);
    const identifier = getClientIdentifier(request);

    // Check rate limit
    const rateLimit = checkRateLimit(identifier, config);

    if (!rateLimit.allowed) {
      monitor.rateLimit(identifier);
      const response = createErrorResponse(
        "Too many requests. Please try again later.",
        429,
        { retryAfter: rateLimit.retryAfter }
      );
      response.headers.set("X-RateLimit-Limit", config.maxRequests.toString());
      response.headers.set("X-RateLimit-Remaining", "0");
      response.headers.set("X-RateLimit-Reset", rateLimit.resetTime.toString());
      response.headers.set("Retry-After", rateLimit.retryAfter!.toString());
      return response;
    }

    // Add rate limit headers to response
    try {
      const response = await handler(request);
      response.headers.set("X-RateLimit-Limit", config.maxRequests.toString());
      response.headers.set("X-RateLimit-Remaining", rateLimit.remaining.toString());
      response.headers.set("X-RateLimit-Reset", rateLimit.resetTime.toString());

      if (response.status < 400) {
        monitor.success(response.status);
      } else {
        monitor.failure(response.status);
      }

      return response;
    } catch (error) {
      monitor.failure(500, error);
      throw error;
    }
  };
}
