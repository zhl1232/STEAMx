# Agent Instructions

- Before changing code, read the relevant section of `PROJECT_INDEX.md`.
- When adding a feature, route, shared module, script, database structure, or important behavior change, update `PROJECT_INDEX.md` in the same change.
- This project uses Next.js 16. Use root-level `proxy.ts` with an exported `proxy` function for request interception. Do not create or restore the deprecated `middleware.ts` convention.
- For database migrations, follow `.cursor/rules/db-migrations.mdc` and use `pnpm db:push`, not `supabase db push`.
