import { NextRequest, NextResponse } from "next/server";

/**
 * Security headers for all API responses
 */
export function addSecurityHeaders(response: NextResponse): NextResponse {
  response.headers.set("X-Content-Type-Options", "nosniff");
  response.headers.set("X-Frame-Options", "DENY");
  response.headers.set("X-XSS-Protection", "1; mode=block");
  response.headers.set("Referrer-Policy", "strict-origin-when-cross-origin");
  response.headers.set(
    "Permissions-Policy",
    "geolocation=(self), camera=(), microphone=()"
  );

  // CORS headers for API
  response.headers.set("Access-Control-Allow-Origin", "*");
  response.headers.set("Access-Control-Allow-Methods", "GET, POST, PUT, DELETE, PATCH, OPTIONS");
  response.headers.set("Access-Control-Allow-Headers", "Content-Type, Authorization, x-user-id");

  return response;
}

/**
 * Sanitize input strings to prevent injection attacks
 */
export function sanitizeString(input: string, maxLength: number = 1000): string {
  return input
    .trim()
    .slice(0, maxLength)
    .replace(/[<>]/g, ""); // Remove potential HTML/script tags
}

/**
 * Validate email format
 */
export function isValidEmail(email: string): boolean {
  const emailRegex = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;
  return emailRegex.test(email) && email.length <= 254;
}

/**
 * Validate phone number format (E.164 format)
 */
export function isValidPhone(phone: string): boolean {
  const phoneRegex = /^\+[1-9]\d{1,14}$/;
  return phoneRegex.test(phone);
}

/**
 * Validate UUID format
 */
export function isValidUUID(uuid: string): boolean {
  const uuidRegex = /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i;
  return uuidRegex.test(uuid);
}

/**
 * Validate coordinates
 */
export function isValidCoordinates(lat: number, lng: number): boolean {
  return (
    typeof lat === "number" &&
    typeof lng === "number" &&
    lat >= -90 &&
    lat <= 90 &&
    lng >= -180 &&
    lng <= 180 &&
    !isNaN(lat) &&
    !isNaN(lng)
  );
}

/**
 * Create a secure error response that doesn't leak internal details
 */
export function createErrorResponse(
  message: string,
  statusCode: number,
  devDetails?: any
): NextResponse {
  const isProduction = process.env.NODE_ENV === "production";

  const response = NextResponse.json(
    {
      error: message,
      ...(isProduction ? {} : { details: devDetails }),
    },
    { status: statusCode }
  );

  return addSecurityHeaders(response);
}

/**
 * Create a success response with security headers
 */
export function createSuccessResponse(
  data: any,
  statusCode: number = 200
): NextResponse {
  const response = NextResponse.json(data, { status: statusCode });
  return addSecurityHeaders(response);
}

/**
 * Check for common SQL injection patterns
 */
export function containsSQLInjection(input: string): boolean {
  const sqlPatterns = [
    /(\b(SELECT|INSERT|UPDATE|DELETE|DROP|CREATE|ALTER|EXEC|EXECUTE)\b)/i,
    /(UNION.*SELECT)/i,
    /(--|\*\/|\/\*)/,
    /(\bOR\b.*=.*)/i,
    /('|")\s*(OR|AND)\s*('|")?/i,
  ];

  return sqlPatterns.some((pattern) => pattern.test(input));
}

/**
 * Validate request origin
 */
export function isValidOrigin(request: NextRequest): boolean {
  const origin = request.headers.get("origin");
  const allowedOrigins = process.env.ALLOWED_ORIGINS?.split(",") || ["http://localhost:3000"];

  if (!origin) return true; // Allow requests without origin (e.g., Postman)

  return allowedOrigins.some((allowed) => origin.startsWith(allowed));
}

/**
 * Generate CSRF token (for future use with forms)
 */
export function generateCSRFToken(): string {
  const array = new Uint8Array(32);
  crypto.getRandomValues(array);
  return Array.from(array, (byte) => byte.toString(16).padStart(2, "0")).join("");
}

/**
 * Hash sensitive data (one-way)
 */
export async function hashData(data: string): Promise<string> {
  const encoder = new TextEncoder();
  const dataBuffer = encoder.encode(data);
  const hashBuffer = await crypto.subtle.digest("SHA-256", dataBuffer);
  const hashArray = Array.from(new Uint8Array(hashBuffer));
  return hashArray.map((b) => b.toString(16).padStart(2, "0")).join("");
}
