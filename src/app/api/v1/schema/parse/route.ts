import { NextRequest, NextResponse } from "next/server"
import { parseSchema } from "@/lib/schema-engine"
import { apiError, ErrorCode, requestId } from "@/lib/api-error"

export const dynamic = "force-dynamic"

export async function POST(req: NextRequest) {
  const rid = requestId()

  try {
    let body: { raw?: string }
    try {
      body = await req.json()
    } catch {
      return apiError(400, ErrorCode.INVALID_JSON, "Request body is not valid JSON.", { requestId: rid })
    }

    if (!body.raw || typeof body.raw !== "string") {
      return apiError(400, ErrorCode.MISSING_FIELD, "Missing required field: raw (API documentation text).", { field: "raw", requestId: rid })
    }

    const result = parseSchema(body.raw)

    if (!result.success) {
      return apiError(400, ErrorCode.SCHEMA_INVALID, result.error ?? "Failed to parse schema.", { requestId: rid })
    }

    return NextResponse.json({
      success: true,
      data: {
        suggestedName: result.suggestedName,
        suggestedDescription: result.suggestedDescription,
        toolSchema: result.toolSchema,
        operations: result.operations?.map((op) => ({
          method: op.method,
          path: op.path,
          summary: op.summary,
          parameterCount: op.parameters.length,
        })),
      },
    })
  } catch (error) {
    return apiError(500, ErrorCode.INTERNAL_ERROR, "Schema parsing failed.", { requestId: rid })
  }
}
