/**
 * Known API v1 route patterns for canonical normalization
 * Maps path prefixes to their template patterns
 * This registry should be kept in sync with actual API routes defined in Task 3
 */
const API_ROUTE_PATTERNS: Array<{ prefix: string; pattern: RegExp; template: string }> = [
  { prefix: '/api/v1/employees/', pattern: /^\/api\/v1\/employees\/[^/]+$/, template: '/api/v1/employees/:id' },
  { prefix: '/api/v1/screenings/', pattern: /^\/api\/v1\/screenings\/[^/]+$/, template: '/api/v1/screenings/:id' },
  { prefix: '/api/v1/certifications/', pattern: /^\/api\/v1\/certifications\/[^/]+$/, template: '/api/v1/certifications/:id' },
  { prefix: '/api/v1/credits/', pattern: /^\/api\/v1\/credits\/[^/]+$/, template: '/api/v1/credits/:id' },
  // Nested routes
  { prefix: '/api/v1/employees/', pattern: /^\/api\/v1\/employees\/[^/]+\/screenings$/, template: '/api/v1/employees/:id/screenings' },
  { prefix: '/api/v1/screenings/', pattern: /^\/api\/v1\/screenings\/[^/]+\/status$/, template: '/api/v1/screenings/:id/status' },
];

/**
 * Normalize API endpoint paths to canonical templates using route pattern registry
 * Falls back to regex-based normalization for UUIDs and numeric IDs
 * 
 * Examples:
 *   /api/v1/employees/123 → /api/v1/employees/:id
 *   /api/v1/employees/abc123 → /api/v1/employees/:id (✅ uses registry)
 *   /api/v1/screenings/xyz789 → /api/v1/screenings/:id (✅ uses registry)
 *   /api/v1/credits/550e8400-... → /api/v1/credits/:id
 */
export function normalizeEndpoint(path: string): string {
  // First, try route pattern registry (most accurate)
  for (const route of API_ROUTE_PATTERNS) {
    if (path.startsWith(route.prefix) && route.pattern.test(path)) {
      return route.template;
    }
  }
  
  // Fallback to regex-based normalization
  // UUID pattern: 8-4-4-4-12 hex digits
  const uuidPattern = /[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}/gi;
  
  // Numeric ID pattern: one or more digits
  const numericIdPattern = /\/\d+(?=\/|$)/g;
  
  let normalized = path;
  
  // Replace UUIDs first (most specific)
  normalized = normalized.replace(uuidPattern, ':id');
  
  // Then replace numeric IDs
  normalized = normalized.replace(numericIdPattern, '/:id');
  
  return normalized;
}

/**
 * Get canonical endpoint from Express request
 * 
 * IMPORTANT: This function requires req.route to be available for accurate normalization.
 * Middleware must be applied at the ROUTE LEVEL (not globally via app.use) to ensure
 * Express has matched the route and populated req.route before this function is called.
 * 
 * Examples when middleware is applied at route level:
 *   router.get('/employees/:id', middleware, handler)
 *   → req.route.path = '/employees/:id'
 *   → req.baseUrl = '/api/v1'
 *   → Returns: '/api/v1/employees/:id' ✅
 * 
 * If applied globally (NOT recommended):
 *   app.use('/api/v1', middleware)
 *   → req.route = undefined (middleware runs before route matching)
 *   → Falls back to regex normalization (less reliable) ❌
 */
export function getCanonicalEndpoint(req: any): string {
  // Prefer matched route template (requires route-level middleware application)
  if (req.route) {
    const basePath = req.baseUrl || '';
    const routePath = req.route.path || '';
    return basePath + routePath;
  }
  
  // Fallback to pattern-based normalization (less reliable, used when req.route unavailable)
  // This should only happen if middleware is applied globally instead of at route level
  console.warn(`[normalizeEndpoint] req.route unavailable for ${req.path} - falling back to regex normalization. Apply middleware at route level for accuracy.`);
  return normalizeEndpoint(req.path);
}
