<!-- BEGIN:nextjs-agent-rules -->
# This is NOT the Next.js you know

This version has breaking changes — APIs, conventions, and file structure may all differ from your training data. Read the relevant guide in `node_modules/next/dist/docs/` before writing any code. Heed deprecation notices.
<!-- END:nextjs-agent-rules -->

# Project Notes

## Known Technical Debt

- **Dashboard Auth (P0)**: Server Actions (`createAgent`, `depositFunds`, `deleteAgent`, etc.) have zero authentication. Anyone with dashboard access can perform any action. Next.js Auth (Auth.js) or Supabase Auth must be added before production deployment.
- **In-Memory Rate Limiting**: Current `rate-limit.ts` uses an in-memory Map — limits reset on server restart and don't work across multiple instances. Replace with Upstash Redis in Phase 2.

## Migration Notes (2026-05-02)

Schema changes from Phase 1 review:
- `Agent.apiKey` → `Agent.apiKeyHash` (SHA-256) + `Agent.apiKeyPrefix` (first 14 chars for display)
- `LedgerTransaction.userId` added (nullable, backfill existing rows)
- `Product.ownerId` added (nullable)

To migrate:
```bash
npx prisma db push --force-reset  # WARNING: wipes dev data
npx prisma generate
```

Production migration will need a proper Prisma migration file with data backfill.
