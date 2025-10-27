import { Request, Response, NextFunction } from "express";
import { ApiKeyService } from "../utils/apiKeyService";

export interface ApiKeyRequest extends Request {
  apiKey?: {
    id: string;
    employerId: string;
    scopes: string[];
  };
}

/**
 * Middleware to authenticate API requests using API keys
 * Expects API key in Authorization header: "Bearer wotc_live_abc123..."
 */
export async function apiKeyAuth(req: Request, res: Response, next: NextFunction) {
  const startTime = Date.now();
  
  try {
    // Extract API key from Authorization header
    const authHeader = req.headers.authorization;
    
    if (!authHeader) {
      return res.status(401).json({
        error: "Unauthorized",
        message: "Missing Authorization header",
      });
    }

    if (!authHeader.startsWith("Bearer ")) {
      return res.status(401).json({
        error: "Unauthorized",
        message: "Invalid Authorization header format. Use: Bearer <api_key>",
      });
    }

    const apiKey = authHeader.substring(7); // Remove "Bearer " prefix

    // Validate the API key
    const validation = await ApiKeyService.validateApiKey(apiKey);

    if (!validation.valid) {
      // Note: Failed auth attempts are not logged to api_key_usage table
      // because we don't have a valid apiKeyId (would violate FK constraint)
      // Consider implementing a separate auth_audit table for failed attempts
      return res.status(401).json({
        error: "Unauthorized",
        message: validation.error || "Invalid API key",
      });
    }

    // Attach API key info to request for use in route handlers
    (req as ApiKeyRequest).apiKey = {
      id: validation.keyId!,
      employerId: validation.employerId!,
      scopes: validation.scopes!,
    };

    next();
  } catch (error) {
    console.error("Error in API key authentication:", error);
    res.status(500).json({
      error: "Internal Server Error",
      message: "Failed to authenticate API key",
    });
  }
}

/**
 * Middleware to check if API key has required scope
 */
export function requireScope(requiredScope: string) {
  return (req: Request, res: Response, next: NextFunction) => {
    const apiKeyReq = req as ApiKeyRequest;
    
    if (!apiKeyReq.apiKey) {
      return res.status(401).json({
        error: "Unauthorized",
        message: "API key not authenticated",
      });
    }

    const hasPermission = ApiKeyService.hasScope(apiKeyReq.apiKey.scopes, requiredScope);

    if (!hasPermission) {
      return res.status(403).json({
        error: "Forbidden",
        message: `Missing required scope: ${requiredScope}`,
        requiredScope,
        providedScopes: apiKeyReq.apiKey.scopes,
      });
    }

    next();
  };
}

/**
 * Middleware to check if API key has ANY of the required scopes (OR logic)
 * Use this when multiple scopes should grant access
 */
export function requireAnyScope(requiredScopes: string[]) {
  return (req: Request, res: Response, next: NextFunction) => {
    const apiKeyReq = req as ApiKeyRequest;
    
    if (!apiKeyReq.apiKey) {
      return res.status(401).json({
        error: "Unauthorized",
        message: "API key not authenticated",
      });
    }

    // Check if key has ANY of the required scopes
    const hasPermission = requiredScopes.some(scope => 
      ApiKeyService.hasScope(apiKeyReq.apiKey!.scopes, scope)
    );

    if (!hasPermission) {
      return res.status(403).json({
        error: "Forbidden",
        message: `Missing required scope. Need one of: ${requiredScopes.join(', ')}`,
        requiredScopes,
        providedScopes: apiKeyReq.apiKey.scopes,
      });
    }

    next();
  };
}
