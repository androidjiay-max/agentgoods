/**
 * Schema Engine — converts raw API documentation into LLM tool-calling schemas.
 *
 * Supported input formats:
 *   - OpenAPI 3.x (JSON/YAML)
 *   - Swagger 2.0 (JSON/YAML)
 *   - Plain text (heuristic extraction)
 *
 * Output: OpenAI function-calling tool schema
 *   { type: "object", properties: {...}, required: [...] }
 */

interface ParsedParam {
  name: string
  type: string
  description: string
  required: boolean
  enum?: string[]
}

interface ParsedOperation {
  method: string
  path: string
  summary: string
  description: string
  parameters: ParsedParam[]
}

export interface ParseResult {
  success: boolean
  error?: string
  operations?: ParsedOperation[]
  /// The tool_schema ready for agent function-calling
  toolSchema?: Record<string, unknown>
  /// Friendly name derived from the API doc
  suggestedName?: string
  suggestedDescription?: string
}

// ─── Type mapping ────────────────────────────────────────────────────────────

const TYPE_MAP: Record<string, string> = {
  string: "string",
  number: "number",
  integer: "integer",
  boolean: "boolean",
  array: "array",
  object: "object",
}

function mapType(raw: string | undefined): string {
  if (!raw) return "string"
  return TYPE_MAP[raw.toLowerCase()] ?? "string"
}

// ─── OpenAPI / Swagger Parser ────────────────────────────────────────────────

function parseOpenAPI(raw: string): ParseResult {
  let doc: Record<string, unknown>
  try {
    doc = JSON.parse(raw)
  } catch {
    // Try YAML — simple parsing for MVP (full YAML requires js-yaml dep)
    try {
      doc = parseSimpleYaml(raw)
    } catch {
      return { success: false, error: "Invalid JSON/YAML. Paste a valid OpenAPI or Swagger document." }
    }
  }

  const info = (doc.info as Record<string, unknown>) ?? {}
  const title = (info.title as string) ?? "API Service"
  const desc = (info.description as string) ?? ""

  // Detect version
  const isSwagger2 = doc.swagger !== undefined
  const paths = (doc.paths as Record<string, unknown>) ?? {}

  const operations: ParsedOperation[] = []
  const allParams: ParsedParam[] = []

  for (const [path, pathItem] of Object.entries(paths)) {
    if (!pathItem || typeof pathItem !== "object") continue
    const methods = pathItem as Record<string, unknown>

    for (const [method, operation] of Object.entries(methods)) {
      if (!["get", "post", "put", "delete", "patch"].includes(method.toLowerCase())) continue
      if (!operation || typeof operation !== "object") continue

      const op = operation as Record<string, unknown>
      const summary = (op.summary as string) ?? (op.operationId as string) ?? `${method.toUpperCase()} ${path}`
      const opDesc = (op.description as string) ?? summary

      const params: ParsedParam[] = []

      // Path/query parameters
      const rawParams = (op.parameters as Array<Record<string, unknown>>) ?? []
      for (const p of rawParams) {
        const schema = (p.schema as Record<string, unknown>) ?? {}
        params.push({
          name: (p.name as string) ?? "param",
          type: isSwagger2 ? mapType(p.type as string) : mapType(schema.type as string),
          description: (p.description as string) ?? (p.name as string),
          required: (p.required as boolean) ?? (p.in === "path"),
          enum: p.enum as string[] | undefined,
        })
      }

      // Request body (OpenAPI 3.x)
      if (!isSwagger2 && op.requestBody) {
        const rb = op.requestBody as Record<string, unknown>
        const content = rb.content as Record<string, Record<string, unknown>>
        if (content) {
          const jsonSchema = content["application/json"]?.schema as Record<string, unknown>
          if (jsonSchema?.properties) {
            const props = jsonSchema.properties as Record<string, Record<string, unknown>>
            const required = (jsonSchema.required as string[]) ?? []
            for (const [name, prop] of Object.entries(props)) {
              params.push({
                name,
                type: mapType(prop.type as string),
                description: (prop.description as string) ?? name,
                required: required.includes(name),
                enum: prop.enum as string[] | undefined,
              })
            }
          }
        }
      }

      // Swagger 2.0 body parameters
      if (isSwagger2) {
        for (const p of rawParams) {
          if (p.in === "body" && p.schema) {
            const bodySchema = p.schema as Record<string, unknown>
            const props = bodySchema.properties as Record<string, Record<string, unknown>>
            const required = (bodySchema.required as string[]) ?? []
            if (props) {
              for (const [name, prop] of Object.entries(props)) {
                params.push({
                  name,
                  type: mapType(prop.type as string),
                  description: (prop.description as string) ?? name,
                  required: required.includes(name),
                  enum: prop.enum as string[] | undefined,
                })
              }
            }
          }
        }
      }

      if (params.length > 0) {
        operations.push({ method: method.toUpperCase(), path, summary, description: opDesc, parameters: params })
        allParams.push(...params)
      }
    }
  }

  if (operations.length === 0) {
    return { success: false, error: "No operations with parameters found. Ensure your API doc includes GET/POST endpoints with defined parameters." }
  }

  // Generate tool schema from the first operation (or merge all)
  const primaryOp = operations[0]
  const toolSchema = buildToolSchema(primaryOp.parameters)

  return {
    success: true,
    operations,
    toolSchema,
    suggestedName: title,
    suggestedDescription: desc || `${operations.length} endpoint(s) available`,
  }
}

// ─── Heuristic plain-text parser ─────────────────────────────────────────────

function parsePlainText(raw: string): ParseResult {
  const params: ParsedParam[] = []

  // Heuristic: look for "param" / "field" / "query" patterns
  const paramRegex = /[-*]\s*(?:param|field|query|arg|parameter)\s*[:=]?\s*`?(\w+)`?\s*[-—:]\s*(.+)/gi
  let match: RegExpExecArray | null
  while ((match = paramRegex.exec(raw)) !== null) {
    const name = match[1]
    const desc = match[2].trim()
    let type = "string"
    if (desc.toLowerCase().includes("number") || desc.toLowerCase().includes("integer")) type = "number"
    if (desc.toLowerCase().includes("boolean") || desc.toLowerCase().includes("true/false")) type = "boolean"
    params.push({ name, type, description: desc, required: !desc.includes("optional") })
  }

  // Heuristic: JSON code block
  const jsonBlockRegex = /```(?:json)?\s*\n?(\{[\s\S]*?\})\s*```/g
  while ((match = jsonBlockRegex.exec(raw)) !== null) {
    try {
      const obj = JSON.parse(match[1])
      if (obj.properties) {
        const props = obj.properties as Record<string, Record<string, unknown>>
        for (const [name, prop] of Object.entries(props)) {
          if (!params.find((p) => p.name === name)) {
            params.push({
              name,
              type: mapType(prop.type as string),
              description: (prop.description as string) ?? name,
              required: !!(obj.required as string[])?.includes(name),
            })
          }
        }
      }
    } catch {
      // Not valid JSON, skip
    }
  }

  if (params.length === 0) {
    return { success: false, error: "No parameters found. Use '- param: description' format, or paste OpenAPI JSON." }
  }

  return {
    success: true,
    operations: [{ method: "POST", path: "/api", summary: "API Call", description: raw.slice(0, 200), parameters: params }],
    toolSchema: buildToolSchema(params),
    suggestedName: "API Service",
    suggestedDescription: raw.slice(0, 200),
  }
}

// ─── Tool schema builder ─────────────────────────────────────────────────────

function buildToolSchema(params: ParsedParam[]): Record<string, unknown> {
  const properties: Record<string, Record<string, unknown>> = {}
  const required: string[] = []

  for (const p of params) {
    const prop: Record<string, unknown> = {
      type: p.type,
      description: p.description,
    }
    if (p.enum) prop.enum = p.enum
    properties[p.name] = prop
    if (p.required) required.push(p.name)
  }

  return {
    type: "object",
    properties,
    ...(required.length > 0 ? { required } : {}),
  }
}

// ─── Simple YAML parser (MVP — handles indentation-based key:value) ──────────

function parseSimpleYaml(raw: string): Record<string, unknown> {
  // This is a minimal YAML parser for common OpenAPI patterns.
  // Full YAML support requires js-yaml. For MVP, we handle simple key: value pairs.
  const lines = raw.split("\n")
  const result: Record<string, unknown> = {}
  const stack: Array<{ obj: Record<string, unknown>; indent: number }> = [{ obj: result, indent: -1 }]

  for (const line of lines) {
    if (!line.trim() || line.trim().startsWith("#")) continue
    const indent = line.search(/\S/)
    const trimmed = line.trim()

    // Pop stack to correct indent level
    while (stack.length > 1 && stack[stack.length - 1].indent >= indent) {
      stack.pop()
    }

    const colonIdx = trimmed.indexOf(":")
    if (colonIdx === -1) continue

    const key = trimmed.slice(0, colonIdx).trim()
    const value = trimmed.slice(colonIdx + 1).trim()

    const currentObj = stack[stack.length - 1].obj

    if (value === "" || value === "object" || value === "array") {
      const child: Record<string, unknown> = {}
      currentObj[key] = child
      stack.push({ obj: child, indent })
    } else {
      // Try to parse as number/boolean
      if (value === "true") currentObj[key] = true
      else if (value === "false") currentObj[key] = false
      else if (!isNaN(Number(value)) && value !== "") currentObj[key] = Number(value)
      else currentObj[key] = value.replace(/^["']|["']$/g, "")
    }
  }

  return result
}

// ─── Main entry point ────────────────────────────────────────────────────────

export function parseSchema(raw: string): ParseResult {
  if (!raw.trim()) return { success: false, error: "Empty input." }

  // Detect format
  const trimmed = raw.trim()

  // OpenAPI/Swagger JSON detection
  if (trimmed.startsWith("{") || trimmed.startsWith("openapi") || trimmed.startsWith("swagger")) {
    return parseOpenAPI(trimmed)
  }

  // Plain text
  return parsePlainText(trimmed)
}
