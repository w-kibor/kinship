import { NextRequest, NextResponse } from "next/server";
import { createSuccessResponse, createErrorResponse } from "@/lib/security";

/**
 * POST /api/monitoring/logs
 * Client-side error logging endpoint
 * Allows frontend to report errors to backend
 */
export async function POST(request: NextRequest) {
  try {
    const body = await request.json();
    const { level, message, error, metadata } = body;

    // Log the client error
    const logEntry = {
      source: "client",
      timestamp: new Date().toISOString(),
      level: level || "error",
      message,
      error,
      metadata,
      userAgent: request.headers.get("user-agent"),
    };

    // In production, send to logging service (Datadog, LogRocket, etc.)
    console.error("Client error:", JSON.stringify(logEntry, null, 2));

    return createSuccessResponse({ received: true });
  } catch (error) {
    console.error("Error processing client log:", error);
    return createErrorResponse("Failed to log error", 500);
  }
}

/**
 * GET /api/monitoring/logs
 * Retrieve recent logs (development only)
 */
export async function GET(request: NextRequest) {
  if (process.env.NODE_ENV === "production") {
    return createErrorResponse("Not available in production", 404);
  }

  return createSuccessResponse({
    message: "Log retrieval not implemented. Check server console for logs.",
  });
}
