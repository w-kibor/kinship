/**
 * Monitoring and logging utilities
 */

export type LogLevel = "info" | "warn" | "error" | "debug";

export type LogEntry = {
  timestamp: string;
  level: LogLevel;
  message: string;
  endpoint?: string;
  method?: string;
  statusCode?: number;
  duration?: number;
  userId?: string;
  error?: any;
  metadata?: Record<string, any>;
};

/**
 * Structured logger
 */
export class Logger {
  private context: string;

  constructor(context: string) {
    this.context = context;
  }

  private log(level: LogLevel, message: string, metadata?: Record<string, any>) {
    const entry: LogEntry = {
      timestamp: new Date().toISOString(),
      level,
      message: `[${this.context}] ${message}`,
      ...metadata,
    };

    // In production, send to monitoring service (DataDog, Sentry, etc.)
    const logFn = level === "error" ? console.error : level === "warn" ? console.warn : console.log;
    logFn(JSON.stringify(entry, null, 2));
  }

  info(message: string, metadata?: Record<string, any>) {
    this.log("info", message, metadata);
  }

  warn(message: string, metadata?: Record<string, any>) {
    this.log("warn", message, metadata);
  }

  error(message: string, error?: any, metadata?: Record<string, any>) {
    this.log("error", message, { ...metadata, error: this.serializeError(error) });
  }

  debug(message: string, metadata?: Record<string, any>) {
    if (process.env.NODE_ENV === "development") {
      this.log("debug", message, metadata);
    }
  }

  private serializeError(error: any): any {
    if (!error) return undefined;
    if (error instanceof Error) {
      return {
        name: error.name,
        message: error.message,
        stack: error.stack,
      };
    }
    return error;
  }
}

/**
 * API request monitoring
 */
export class APIMonitor {
  private endpoint: string;
  private method: string;
  private startTime: number;
  private logger: Logger;

  constructor(endpoint: string, method: string) {
    this.endpoint = endpoint;
    this.method = method;
    this.startTime = Date.now();
    this.logger = new Logger("API");
  }

  success(statusCode: number, userId?: string) {
    const duration = Date.now() - this.startTime;
    this.logger.info("Request completed", {
      endpoint: this.endpoint,
      method: this.method,
      statusCode,
      duration,
      userId,
    });
  }

  failure(statusCode: number, error?: any, userId?: string) {
    const duration = Date.now() - this.startTime;
    this.logger.error("Request failed", error, {
      endpoint: this.endpoint,
      method: this.method,
      statusCode,
      duration,
      userId,
    });
  }

  rateLimit(identifier: string) {
    this.logger.warn("Rate limit exceeded", {
      endpoint: this.endpoint,
      method: this.method,
      identifier,
    });
  }
}

/**
 * Performance metrics tracker
 */
export class MetricsCollector {
  private static metrics: Map<string, number[]> = new Map();

  static record(metric: string, value: number) {
    if (!this.metrics.has(metric)) {
      this.metrics.set(metric, []);
    }
    this.metrics.get(metric)!.push(value);

    // Keep only last 1000 values
    const values = this.metrics.get(metric)!;
    if (values.length > 1000) {
      values.shift();
    }
  }

  static getStats(metric: string) {
    const values = this.metrics.get(metric);
    if (!values || values.length === 0) {
      return null;
    }

    const sorted = [...values].sort((a, b) => a - b);
    const sum = values.reduce((a, b) => a + b, 0);

    return {
      count: values.length,
      min: sorted[0],
      max: sorted[sorted.length - 1],
      avg: sum / values.length,
      p50: sorted[Math.floor(sorted.length * 0.5)],
      p95: sorted[Math.floor(sorted.length * 0.95)],
      p99: sorted[Math.floor(sorted.length * 0.99)],
    };
  }

  static getAllMetrics() {
    const result: Record<string, any> = {};
    this.metrics.forEach((_, key) => {
      result[key] = this.getStats(key);
    });
    return result;
  }
}

/**
 * Error tracker for monitoring services
 */
export class ErrorTracker {
  static capture(error: Error, context?: Record<string, any>) {
    const errorData = {
      name: error.name,
      message: error.message,
      stack: error.stack,
      timestamp: new Date().toISOString(),
      ...context,
    };

    // In production, send to Sentry, Rollbar, etc.
    console.error("Error captured:", JSON.stringify(errorData, null, 2));

    // Track error metrics
    MetricsCollector.record("errors", 1);
  }
}
