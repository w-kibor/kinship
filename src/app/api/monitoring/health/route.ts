import { NextRequest, NextResponse } from "next/server";
import { createClient } from "@supabase/supabase-js";
import { createSuccessResponse, createErrorResponse } from "@/lib/security";

/**
 * GET /api/monitoring/health
 * Health check endpoint for monitoring services
 */
export async function GET(request: NextRequest) {
  try {
    const checks: Record<string, any> = {
      status: "healthy",
      timestamp: new Date().toISOString(),
      uptime: process.uptime(),
      version: process.env.APP_VERSION || "1.0.0",
    };

    // Check Supabase connection
    try {
      const supabaseUrl = process.env.NEXT_PUBLIC_SUPABASE_URL;
      const supabaseKey = process.env.SUPABASE_SERVICE_ROLE_KEY;

      if (supabaseUrl && supabaseKey) {
        const supabase = createClient(supabaseUrl, supabaseKey);
        const { error } = await supabase.from("profiles").select("id").limit(1);
        checks.database = error ? "unhealthy" : "healthy";
      } else {
        checks.database = "not_configured";
      }
    } catch (dbError) {
      checks.database = "unhealthy";
      checks.databaseError = "Connection failed";
    }

    // Check environment variables
    checks.environment = {
      supabaseConfigured: !!(process.env.NEXT_PUBLIC_SUPABASE_URL && process.env.SUPABASE_SERVICE_ROLE_KEY),
      twilioConfigured: !!(process.env.TWILIO_ACCOUNT_SID && process.env.TWILIO_AUTH_TOKEN),
    };

    const isHealthy = checks.database === "healthy";
    const statusCode = isHealthy ? 200 : 503;

    return NextResponse.json(checks, { status: statusCode });
  } catch (error) {
    console.error("Health check error:", error);
    return createErrorResponse("Health check failed", 500, error);
  }
}
