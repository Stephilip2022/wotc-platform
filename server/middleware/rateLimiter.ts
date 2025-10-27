import { Request, Response, NextFunction } from "express";
import { ApiKeyService } from "../utils/apiKeyService";
import { ApiKeyRequest, apiKeyAuth as apiKeyAuthMiddleware, requireScope as requireScopeMiddleware, requireAnyScope as requireAnyScopeMiddleware } from "./apiKeyAuth";
import { getCanonicalEndpoint } from "../utils/normalizeEndpoint";

/**
 * Rate limiting middleware for API endpoints
 * Enforces per-API-key rate limits using database-backed sliding window
 * This approach works across multiple server instances (no Redis needed)
 * 
 * IMPORTANT: Apply at route level for accurate endpoint normalization.
 * Good:  router.get('/employees/:id', apiKeyAuth({}), rateLimiter, handler)
 * Bad:   app.use(rateLimiter)  // req.route unavailable, normalization fails
 */
export async function rateLimiter(req: Request, res: Response, next: NextFunction) {
  const startTime = Date.now();
  const apiKeyReq = req as ApiKeyRequest;

  try {
    if (!apiKeyReq.apiKey) {
      // If no API key is attached, skip rate limiting
      // (should not happen if apiKeyAuth is used first)
      return next();
    }

    const { id: keyId } = apiKeyReq.apiKey;

    // Get canonical endpoint (e.g., /api/v1/employees/123 → /api/v1/employees/:id)
    // This prevents ID rotation from bypassing rate limits
    const canonicalEndpoint = getCanonicalEndpoint(req);

    // Check rate limit using the database-backed service (per-endpoint)
    const rateLimitStatus = await ApiKeyService.checkRateLimit(keyId, canonicalEndpoint);

    // Set standard rate limit headers
    res.setHeader("X-RateLimit-Limit", rateLimitStatus.limit.toString());
    res.setHeader("X-RateLimit-Remaining", Math.max(0, rateLimitStatus.remaining).toString());
    res.setHeader("X-RateLimit-Reset", rateLimitStatus.resetAt.toISOString());

    if (!rateLimitStatus.allowed) {
      // Note: Rate limit exceeded is NOT logged to avoid further database load
      // The failed request itself isn't processed, so no usage is recorded
      return res.status(429).json({
        error: "Too Many Requests",
        message: "Rate limit exceeded. Please try again later.",
        limit: rateLimitStatus.limit,
        remaining: 0,
        resetAt: rateLimitStatus.resetAt,
      });
    }

    // Continue to route handler
    next();
  } catch (error) {
    console.error("Error in rate limiter:", error);
    // On error, allow the request through (fail open)
    next();
  }
}

/**
 * Usage tracking middleware
 * Logs ALL API requests for analytics and billing
 * Hooks into res.finish event to capture all response types (json, send, etc.)
 * 
 * IMPORTANT: Apply at route level for accurate endpoint normalization.
 * Good:  router.get('/employees/:id', apiKeyAuth({}), usageTracker, handler)
 * Bad:   app.use(usageTracker)  // req.route unavailable, normalization fails
 */
export function usageTracker(req: Request, res: Response, next: NextFunction) {
  const startTime = Date.now();
  const apiKeyReq = req as ApiKeyRequest;

  // Get canonical endpoint for consistent tracking
  const canonicalEndpoint = getCanonicalEndpoint(req);

  // Hook into finish event to capture all responses regardless of method used
  res.on('finish', () => {
    if (apiKeyReq.apiKey) {
      const responseTime = Date.now() - startTime;
      
      // Fire and forget - don't block the response
      ApiKeyService.logUsage(
        apiKeyReq.apiKey.id,
        canonicalEndpoint,
        req.method,
        res.statusCode,
        responseTime,
        req.ip,
        req.get("user-agent"),
        res.statusCode >= 400 ? `HTTP ${res.statusCode}` : undefined
      ).catch(err => {
        console.error("Error logging API usage:", err);
      });
    }
  });

  next();
}

/**
 * Convenience function to apply all public API middleware at route level
 * Combines authentication, rate limiting, and usage tracking
 * 
 * Usage examples:
 *   // Without scope requirements
 *   router.get('/health', ...publicApiMiddleware(), healthHandler);
 * 
 *   // With single scope requirement
 *   router.get('/employees/:id', ...publicApiMiddleware('employees:read'), employeeHandler);
 * 
 *   // With multiple scope requirements (any of - OR logic)
 *   router.post('/screenings', ...publicApiMiddleware(['screenings:write', 'screenings:admin']), handler);
 *   // Key with EITHER 'screenings:write' OR 'screenings:admin' can access this route
 * 
 * This ensures middleware runs AFTER Express route matching, making req.route.path
 * available for accurate endpoint normalization (preventing ID rotation bypasses).
 * 
 * @param scope - Optional scope requirement (string or string array for any-of logic)
 */
export function publicApiMiddleware(scope?: string | string[]) {
  const middleware: any[] = [apiKeyAuthMiddleware];
  
  // Add scope requirement if specified
  if (scope) {
    if (Array.isArray(scope)) {
      // Multiple scopes: require ANY of them (OR logic)
      middleware.push(requireAnyScopeMiddleware(scope));
    } else {
      // Single scope: require exactly that one
      middleware.push(requireScopeMiddleware(scope));
    }
  }
  
  // Add rate limiting and usage tracking
  middleware.push(rateLimiter, usageTracker);
  
  return middleware;
}

export { apiKeyAuthMiddleware as apiKeyAuth, requireScopeMiddleware as requireScope, requireAnyScopeMiddleware as requireAnyScope };
