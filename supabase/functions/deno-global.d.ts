/** Supabase Edge Functions 运行在 Deno，非 Node。供 IDE 类型检查用。 */
declare const Deno: {
  serve(handler: (req: Request) => Response | Promise<Response>): void
  env: {
    get(key: string): string | undefined
  }
}
