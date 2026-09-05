import { Request, Response, NextFunction } from "express";
import { createRemoteJWKSet, jwtVerify } from "jose";

declare global {
  namespace Express {
    interface Request {
      userId?: string;
    }
  }
}

// Supabase's asymmetric signing keys expose their public keys here — no
// shared secret needed. createRemoteJWKSet handles fetching, 10-minute
// caching, and matching the token's `kid` to the right public key.
// Lazily initialized so a missing SUPABASE_URL doesn't crash at import time.
let jwks: ReturnType<typeof createRemoteJWKSet> | null = null;
function getJwks() {
  if (!jwks) {
    const supabaseUrl = process.env.SUPABASE_URL;
    if (!supabaseUrl) {
      throw new Error("SUPABASE_URL is not set");
    }
    jwks = createRemoteJWKSet(
      new URL(`${supabaseUrl}/auth/v1/.well-known/jwks.json`),
    );
  }
  return jwks;
}

// Two modes, switched by AUTH_MODE env var:
//
// - "supabase" (real): verifies a Supabase-issued JWT from
//   `Authorization: Bearer <token>` against Supabase's JWKS endpoint,
//   using the `sub` claim as the user id.
// - anything else (default): the original dev stub — reads `x-user-id`
//   directly. Kept as the default so existing Postman tests keep working
//   until AUTH_MODE=supabase is explicitly flipped on.
export function auth(req: Request, res: Response, next: NextFunction) {
  if (process.env.AUTH_MODE === "supabase") {
    return supabaseAuth(req, res, next);
  }
  return devAuth(req, res, next);
}

async function supabaseAuth(req: Request, res: Response, next: NextFunction) {
  const header = req.header("authorization");
  const token = header?.startsWith("Bearer ") ? header.slice(7) : null;

  if (!token) {
    return res
      .status(401)
      .json({ error: "Missing Authorization: Bearer <token> header" });
  }

  try {
    const { payload } = await jwtVerify(token, getJwks());
    if (!payload.sub) {
      return res.status(401).json({ error: "Token missing sub claim" });
    }
    req.userId = payload.sub;
    next();
  } catch (err) {
    return res
      .status(401)
      .json({ error: `Invalid token: ${(err as Error).message}` });
  }
}

function devAuth(req: Request, res: Response, next: NextFunction) {
  const userId = req.header("x-user-id");
  if (!userId) {
    return res
      .status(401)
      .json({ error: "Missing x-user-id header (dev auth stub)" });
  }
  req.userId = userId;
  next();
}
