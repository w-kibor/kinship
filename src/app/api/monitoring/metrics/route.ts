import { NextRequest, NextResponse } from "next/server";
import { MetricsCollector } from "@/lib/monitoring";
import { createSuccessResponse, createErrorResponse } from "@/lib/security";

/**
 * GET /api/monitoring/metrics
 * Get application performance metrics
 * In production, protect this endpoint with authentication
 */
export async function GET(request: NextRequest) {
  try {
    // In production, add authentication check here
    const isDev = process.env.NODE_ENV === "development";
    const apiKey = request.headers.get("x-api-key");

    if (!isDev && apiKey !== process.env.MONITORING_API_KEY) {
      return createErrorResponse("Unauthorized", 401);
    }

    const metrics = MetricsCollector.getAllMetrics();

    return createSuccessResponse({
      metrics,
      timestamp: new Date().toISOString(),
    });
  } catch (error) {
    console.error("GET /api/monitoring/metrics error:", error);
    return createErrorResponse("Failed to fetch metrics", 500);
  }
}
