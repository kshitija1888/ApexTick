import { Request, Response, NextFunction } from "express";
import { createRemoteJWKSet, jwtVerify } from "jose";

declare global {
  namespace Express {
    interface Request {
      userId?: string;
    }
  }
}

let jwks: ReturnType<typeof createRemoteJWKSet> | null = null;

function getJwks() {
  if (!jwks) {
    const supabaseUrl = process.env.SUPABASE_URL;
    if (!supabaseUrl) {
      throw new Error("SUPABASE_URL is not set in environment variables");
    }
    const cleanUrl = supabaseUrl.replace(/\/+$/, "");
    jwks = createRemoteJWKSet(
      new URL(`${cleanUrl}/auth/v1/.well-known/jwks.json`),
    );
  }
  return jwks;
}

export function auth(req: Request, res: Response, next: NextFunction) {
  // Always use supabase mode in production, or fallback to devAuth if explicitly set to dev
  if (
    process.env.AUTH_MODE === "supabase" ||
    process.env.NODE_ENV === "production"
  ) {
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
    return next();
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
  return next();
}
