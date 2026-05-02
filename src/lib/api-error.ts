/**
 * Structured API error codes for both human developers and LLM agents.
 *
 * Each error response follows the format:
 *   { success: false, error: { code: string, message: string, details?: any } }
 *
 * LLM agents should key on `error.code` to decide recovery strategy:
 *   - Codes ending in _RETRYABLE: retry with backoff
 *   - Codes starting with AUTH_: do not retry, check credentials
 *   - Codes starting with FUNDS_: do not retry, request more funds
 */

export const ErrorCode = {
  // Auth
  AUTH_MISSING: "AUTH_MISSING",
  AUTH_INVALID_KEY: "AUTH_INVALID_KEY",

  // Request validation
  INVALID_JSON: "INVALID_JSON",
  MISSING_FIELD: "MISSING_FIELD",
  SCHEMA_INVALID: "SCHEMA_INVALID",

  // Resources
  PRODUCT_NOT_FOUND: "PRODUCT_NOT_FOUND",

  // Financial
  INSUFFICIENT_BALANCE: "INSUFFICIENT_BALANCE",
  BUDGET_EXCEEDED: "BUDGET_EXCEEDED",
  SELF_PURCHASE: "SELF_PURCHASE",

  // System
  RATE_LIMITED: "RATE_LIMITED",
  INTERNAL_ERROR: "INTERNAL_ERROR",
  TRANSACTION_FAILED: "TRANSACTION_FAILED",
} as const;

export type ErrorCodeType = (typeof ErrorCode)[keyof typeof ErrorCode];

export interface ApiErrorBody {
  success: false;
  error: {
    code: ErrorCodeType;
    message: string;
    details?: unknown;
    requestId?: string;
  };
}

/** Build a structured error response. */
export function apiError(
  status: number,
  code: ErrorCodeType,
  message: string,
  details?: unknown,
): Response {
  const body: ApiErrorBody = {
    success: false,
    error: { code, message, ...(details ? { details } : {}) },
  };

  return new Response(JSON.stringify(body), {
    status,
    headers: {
      "Content-Type": "application/json",
      "X-Error-Code": code, // machine-parseable header for fast routing
    },
  });
}

/** Generate a short request ID for tracing. */
export function requestId(): string {
  const timestamp = Date.now().toString(36);
  const random = Math.random().toString(36).slice(2, 7);
  return `${timestamp}-${random}`;
}
