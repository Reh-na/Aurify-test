import { Router } from "express";
import mongoose from "mongoose";
import { Role, PERMISSIONS, SCOPES } from "../models/Role";
import { User } from "../models/User";
import { requirePermission } from "../middleware/auth";

const router = Router();
const guard = requirePermission("role.manage");

function parsePermissions(input: unknown): { key: string; scope: string }[] | null {
  if (!Array.isArray(input)) return null;
  const out: { key: string; scope: string }[] = [];
  for (const p of input) {
    if (!p || !(PERMISSIONS as readonly string[]).includes(p.key)) return null;
    const scope = p.scope ?? "all";
    if (!(SCOPES as readonly string[]).includes(scope)) return null;
    out.push({ key: p.key, scope });
  }
  return out;
}

router.get("/roles", guard, async (_req, res) => res.json(await Role.find().sort({ name: 1 })));

// Adding a role = a data change. No deploy.
router.post("/roles", guard, async (req, res) => {
  const { name, permissions, approvalLimit } = req.body ?? {};
  const perms = parsePermissions(permissions);
  if (typeof name !== "string" || !name.trim() || !perms) {
    return res.status(400).json({ error: "name and permissions [{key, scope}] required", allowedKeys: PERMISSIONS, allowedScopes: SCOPES });
  }
  try {
    res.status(201).json(await Role.create({ name: name.trim(), permissions: perms, approvalLimit: Number(approvalLimit) || 0 }));
  } catch (err: any) {
    if (err.code === 11000) return res.status(409).json({ error: "Role name already exists" });
    throw err;
  }
});

router.put("/roles/:id", guard, async (req, res) => {
  if (!mongoose.isValidObjectId(req.params.id)) return res.status(404).json({ error: "Not found" });
  const perms = parsePermissions(req.body?.permissions);
  if (!perms) return res.status(400).json({ error: "permissions [{key, scope}] required" });
  const update: Record<string, unknown> = { permissions: perms };
  if (req.body.approvalLimit !== undefined) update.approvalLimit = Number(req.body.approvalLimit) || 0;
  const role = await Role.findByIdAndUpdate(req.params.id, update, { returnDocument: "after" });
  if (!role) return res.status(404).json({ error: "Not found" });
  res.json(role);
});

router.get("/users", guard, async (_req, res) =>
  res.json(await User.find().select("-passwordHash").populate("roleId", "name").populate("branchId", "name"))
);

router.patch("/users/:id/role", guard, async (req, res) => {
  const { roleId } = req.body ?? {};
  if (!mongoose.isValidObjectId(req.params.id) || !mongoose.isValidObjectId(roleId)) return res.status(400).json({ error: "valid ids required" });
  if (!(await Role.exists({ _id: roleId }))) return res.status(400).json({ error: "role not found" });
  const user = await User.findByIdAndUpdate(req.params.id, { roleId }, { returnDocument: "after" }).select("-passwordHash");
  if (!user) return res.status(404).json({ error: "Not found" });
  res.json(user);
});

export default router;
