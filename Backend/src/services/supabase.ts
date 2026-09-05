import "dotenv/config";
import { createClient } from "@supabase/supabase-js";

// Service-role client — server-only, bypasses RLS.
// Never expose SUPABASE_SERVICE_ROLE_KEY to the frontend.
const supabaseUrl = process.env.SUPABASE_URL || "";
const serviceRoleKey = process.env.SUPABASE_SERVICE_ROLE_KEY || "";

if (!supabaseUrl || !serviceRoleKey) {
  console.warn(
    "Warning: Missing SUPABASE_URL or SUPABASE_SERVICE_ROLE_KEY env vars.",
  );
}

export const supabaseAdmin = createClient(supabaseUrl, serviceRoleKey, {
  auth: { persistSession: false },
});
