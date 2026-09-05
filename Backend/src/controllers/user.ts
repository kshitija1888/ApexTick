import { Request, Response } from "express";
import { supabaseAdmin } from "../services/supabase";

export async function heartbeat(req: Request, res: Response) {
  const userId = req.userId!;

  // Read the OLD timestamp before overwriting it — this is the reference
  // point every "since you last checked" diff is computed against. If we
  // update first, that reference point is destroyed before we can use it.
  const { data: existing, error: readError } = await supabaseAdmin
    .from("user_sessions")
    .select("last_visited_at")
    .eq("user_id", userId)
    .maybeSingle();

  if (readError) {
    return res.status(500).json({ error: readError.message });
  }

  const previousVisit = existing?.last_visited_at ?? null;
  const now = new Date().toISOString();

  const { error: writeError } = await supabaseAdmin
    .from("user_sessions")
    .upsert(
      { user_id: userId, last_visited_at: now },
      { onConflict: "user_id" },
    );

  if (writeError) {
    return res.status(500).json({ error: writeError.message });
  }

  res.json({ previousVisit, currentVisit: now });
}
