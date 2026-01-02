# Phase 6: Security & Monitoring - Implementation Guide

## 🛡️ Security Features Implemented

### 1. Rate Limiting (`src/lib/rate-limiter.ts`)
In-memory rate limiter with configurable limits:
- **AUTH**: 5 requests per 15 minutes
- **STATUS**: 60 requests per minute
- **CIRCLE**: 30 requests per minute
- **PROFILE**: 10 requests per minute
- **SMS**: 10 requests per hour
- **WEBHOOK**: 100 requests per minute

### 2. Security Utilities (`src/lib/security.ts`)
- Security headers (XSS, clickjacking, MIME sniffing protection)
- Input sanitization
- Email, phone, UUID, coordinate validation
- SQL injection detection
- CSRF token generation
- Data hashing (SHA-256)

### 3. Monitoring (`src/lib/monitoring.ts`)
- Structured logging (Logger class)
- API request monitoring (APIMonitor class)
- Performance metrics collection (MetricsCollector)
- Error tracking (ErrorTracker)

### 4. Monitoring Endpoints
- **GET /api/monitoring/health** - Health check (database, env vars)
- **GET /api/monitoring/metrics** - Performance metrics (requires API key in production)
- **POST /api/monitoring/logs** - Client-side error reporting

## 📖 Usage Examples

### Example 1: Add Rate Limiting to Existing Endpoint

```typescript
// Before (no rate limiting)
export async function POST(request: NextRequest) {
  // ... handler code
}

// After (with rate limiting)
import { withRateLimit } from "@/middleware/withRateLimit";
import { RateLimits } from "@/lib/rate-limiter";

async function handler(request: NextRequest) {
  // ... handler code
}

export const POST = withRateLimit(handler, RateLimits.AUTH, "/api/auth/send-link");
```

### Example 2: Use Security Response Helpers

```typescript
import { createSuccessResponse, createErrorResponse } from "@/lib/security";

export async function GET(request: NextRequest) {
  try {
    const data = await fetchSomeData();
    return createSuccessResponse(data);
  } catch (error) {
    return createErrorResponse("Failed to fetch data", 500, error);
  }
}
```

### Example 3: Add Monitoring to Endpoint

```typescript
import { APIMonitor } from "@/lib/monitoring";
import { MetricsCollector } from "@/lib/monitoring";

export async function POST(request: NextRequest) {
  const monitor = new APIMonitor("/api/status", "POST");
  const startTime = Date.now();

  try {
    // ... process request
    const duration = Date.now() - startTime;
    MetricsCollector.record("status_create_duration_ms", duration);
    monitor.success(200, userId);
    return response;
  } catch (error) {
    monitor.failure(500, error);
    throw error;
  }
}
```

### Example 4: Validate Input

```typescript
import { isValidEmail, isValidUUID, sanitizeString } from "@/lib/security";

const email = sanitizeString(body.email);
if (!isValidEmail(email)) {
  return createErrorResponse("Invalid email format", 400);
}

if (!isValidUUID(userId)) {
  return createErrorResponse("Invalid user ID", 400);
}
```

## 🔧 Environment Variables

Add to `.env.local`:

```env
# Monitoring API Key (for production metrics endpoint)
MONITORING_API_KEY=your_secure_key_here

# Allowed origins for CORS
ALLOWED_ORIGINS=http://localhost:3000,https://yourdomain.com

# App version for health checks
APP_VERSION=1.0.0
```

## 🧪 Testing Security Features

### Test Rate Limiting
```bash
# Make 6 requests quickly to trigger rate limit
for i in {1..6}; do
  curl http://localhost:3000/api/auth/send-link \
    -X POST \
    -H "Content-Type: application/json" \
    -d '{"email":"test@example.com"}'
done
```

### Check Health Status
```http
GET http://localhost:3000/api/monitoring/health
```

### Get Metrics
```http
GET http://localhost:3000/api/monitoring/metrics
X-Api-Key: your_key_here
```

### Report Client Error
```http
POST http://localhost:3000/api/monitoring/logs
Content-Type: application/json

{
  "level": "error",
  "message": "Button click failed",
  "error": {
    "name": "TypeError",
    "message": "Cannot read property 'foo' of undefined"
  },
  "metadata": {
    "component": "StatusButton",
    "userId": "123"
  }
}
```

## 🚀 Next Steps

### Apply Rate Limiting to All Endpoints
Update each route to use `withRateLimit`:

1. **Auth endpoints** → `RateLimits.AUTH`
2. **Status endpoints** → `RateLimits.STATUS`
3. **Circle endpoints** → `RateLimits.CIRCLE`
4. **Profile endpoint** → `RateLimits.PROFILE`
5. **SMS endpoints** → `RateLimits.SMS`
6. **Webhook** → `RateLimits.WEBHOOK`

### Production Recommendations

1. **Rate Limiting**: Replace in-memory store with Redis for distributed rate limiting
2. **Logging**: Integrate with DataDog, LogRocket, or CloudWatch
3. **Error Tracking**: Set up Sentry or Rollbar
4. **Metrics**: Use Prometheus, Grafana, or application monitoring service
5. **Security Headers**: Review and customize for your domain
6. **Authentication**: Add JWT validation to protected endpoints
7. **HTTPS**: Ensure all production traffic uses HTTPS
8. **API Keys**: Rotate regularly and store in secure vault

## ✅ Security Checklist

- [x] Rate limiting implemented
- [x] Security headers added
- [x] Input validation utilities
- [x] SQL injection protection
- [x] CORS configuration
- [x] Health check endpoint
- [x] Metrics collection
- [x] Error tracking
- [x] Structured logging
- [ ] Apply rate limiting to all endpoints
- [ ] Add authentication to monitoring endpoints
- [ ] Configure production logging service
- [ ] Set up error tracking service
- [ ] Review and test CORS settings
