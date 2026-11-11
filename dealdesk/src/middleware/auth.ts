import { RequestHandler } from "express";
import jwt from "jsonwebtoken";
import { User } from "../models/User";
import { Role, Scope } from "../models/Role";

export interface AuthUser {
  id: string;
  email: string;
  roleName: string; // informational only - never branch on this
  branchId: string;
  approvalLimit: number;
  permissions: Map<string, Scope>; // permission key -> scope
}

declare global {
  // eslint-disable-next-line @typescript-eslint/no-namespace
  namespace Express {
    interface Request {
      user?: AuthUser;
    }
  }
}

const jwtSecret = () => process.env.JWT_SECRET || "dev-jwt-secret-change-me";

export function signToken(userId: string): string {
  return jwt.sign({ sub: userId }, jwtSecret(), {
    expiresIn: (process.env.JWT_EXPIRES_IN || "8h") as any,
  });
}

/** Verify a JWT (HTTP or socket handshake) and load the user + role permissions FROM THE DB.
 *  The token carries only the user id, so changing a role takes effect on the very next request. */
export async function authenticateToken(token: string): Promise<AuthUser | null> {
  let sub: string;
  try {
    sub = (jwt.verify(token, jwtSecret()) as { sub: string }).sub;
  } catch {
    return null;
  }
  const user = await User.findById(sub).lean();
  if (!user) return null;
  const role = await Role.findById(user.roleId).lean();
  if (!role) return null;
  return {
    id: String(user._id),
    email: user.email,
    roleName: role.name,
    branchId: String(user.branchId),
    approvalLimit: role.approvalLimit ?? 0,
    permissions: new Map(role.permissions.map((p: any) => [p.key, p.scope as Scope])),
  };
}

const bearer = (header?: string) =>
  header && header.startsWith("Bearer ") ? header.slice(7) : null;

/** Login required, no specific permission. */
export const authenticate: RequestHandler = async (req, res, next) => {
  try {
    const token = bearer(req.header("Authorization"));
    const user = token ? await authenticateToken(token) : null;
    if (!user) return res.status(401).json({ error: "Unauthenticated" });
    req.user = user;
    next();
  } catch (err) {
    next(err);
  }
};

/** THE reusable guard. Takes a permission name, never a role name.
 *  Usage: router.get("/deals", requirePermission("deal.view"), handler) */
export const requirePermission =
  (permission: string): RequestHandler =>
  async (req, res, next) => {
    try {
      const token = bearer(req.header("Authorization"));
      const user = token ? await authenticateToken(token) : null;
      if (!user) return res.status(401).json({ error: "Unauthenticated" });
      if (!user.permissions.has(permission)) {
        return res.status(403).json({ error: `Missing permission: ${permission}` });
      }
      req.user = user;
      next();
    } catch (err) {
      next(err);
    }
  };
