"use strict";
var __importDefault = (this && this.__importDefault) || function (mod) {
    return (mod && mod.__esModule) ? mod : { "default": mod };
};
Object.defineProperty(exports, "__esModule", { value: true });
const express_1 = require("express");
const mongoose_1 = __importDefault(require("mongoose"));
const Role_1 = require("../models/Role");
const User_1 = require("../models/User");
const auth_1 = require("../middleware/auth");
const router = (0, express_1.Router)();
const guard = (0, auth_1.requirePermission)("role.manage");
function parsePermissions(input) {
    if (!Array.isArray(input))
        return null;
    const out = [];
    for (const p of input) {
        if (!p || !Role_1.PERMISSIONS.includes(p.key))
            return null;
        const scope = p.scope ?? "all";
        if (!Role_1.SCOPES.includes(scope))
            return null;
        out.push({ key: p.key, scope });
    }
    return out;
}
router.get("/roles", guard, async (_req, res) => res.json(await Role_1.Role.find().sort({ name: 1 })));
// Adding a role = a data change. No deploy.
router.post("/roles", guard, async (req, res) => {
    const { name, permissions, approvalLimit } = req.body ?? {};
    const perms = parsePermissions(permissions);
    if (typeof name !== "string" || !name.trim() || !perms) {
        return res.status(400).json({ error: "name and permissions [{key, scope}] required", allowedKeys: Role_1.PERMISSIONS, allowedScopes: Role_1.SCOPES });
    }
    try {
        res.status(201).json(await Role_1.Role.create({ name: name.trim(), permissions: perms, approvalLimit: Number(approvalLimit) || 0 }));
    }
    catch (err) {
        if (err.code === 11000)
            return res.status(409).json({ error: "Role name already exists" });
        throw err;
    }
});
router.put("/roles/:id", guard, async (req, res) => {
    if (!mongoose_1.default.isValidObjectId(req.params.id))
        return res.status(404).json({ error: "Not found" });
    const perms = parsePermissions(req.body?.permissions);
    if (!perms)
        return res.status(400).json({ error: "permissions [{key, scope}] required" });
    const update = { permissions: perms };
    if (req.body.approvalLimit !== undefined)
        update.approvalLimit = Number(req.body.approvalLimit) || 0;
    const role = await Role_1.Role.findByIdAndUpdate(req.params.id, update, { returnDocument: "after" });
    if (!role)
        return res.status(404).json({ error: "Not found" });
    res.json(role);
});
router.get("/users", guard, async (_req, res) => res.json(await User_1.User.find().select("-passwordHash").populate("roleId", "name").populate("branchId", "name")));
router.patch("/users/:id/role", guard, async (req, res) => {
    const { roleId } = req.body ?? {};
    if (!mongoose_1.default.isValidObjectId(req.params.id) || !mongoose_1.default.isValidObjectId(roleId))
        return res.status(400).json({ error: "valid ids required" });
    if (!(await Role_1.Role.exists({ _id: roleId })))
        return res.status(400).json({ error: "role not found" });
    const user = await User_1.User.findByIdAndUpdate(req.params.id, { roleId }, { returnDocument: "after" }).select("-passwordHash");
    if (!user)
        return res.status(404).json({ error: "Not found" });
    res.json(user);
});
exports.default = router;
