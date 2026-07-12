# Sentinel AMD Hackathon — Agent Rules

## Supabase Client: Never instantiate directly in components

**RULE:** Never call `createClient(import.meta.env.VITE_SUPABASE_URL, ...)` directly inside any file under `src/`.

**Always use the shared client:**
```ts
import { supabase } from "@/integrations/supabase/client";
```

**Why:** In Vercel production builds, `import.meta.env.VITE_SUPABASE_URL` resolves to `undefined` if the variable isn't registered in Vercel's Environment Variables dashboard. `createClient(undefined, undefined)` throws immediately, crashing the entire React component tree and producing a blank page. The shared client at `src/integrations/supabase/client.ts` has hardcoded fallback values to prevent this.

---

## Edge Function Timeouts: Do not add web search tools to freeform queries

**RULE:** In `sentinel-chat-query/index.ts`, the `search_web` tool MUST remain disabled when both `event_context` and `bulk_events` are absent.

**Why:** Supabase Edge Functions have a 60-second hard wall-clock limit. The agentic tool loop (LLM call -> web search -> LLM synthesis) takes 30-50 seconds. Freeform queries with tools enabled reliably exceed 60s and are killed silently, showing 'Analysis timed out' to the user.
