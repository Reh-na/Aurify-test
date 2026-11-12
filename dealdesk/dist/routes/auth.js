"use strict";
var __importDefault = (this && this.__importDefault) || function (mod) {
    return (mod && mod.__esModule) ? mod : { "default": mod };
};
Object.defineProperty(exports, "__esModule", { value: true });
const express_1 = require("express");
const bcryptjs_1 = __importDefault(require("bcryptjs"));
const User_1 = require("../models/User");
const auth_1 = require("../middleware/auth");
const router = (0, express_1.Router)();
router.post("/auth/login", async (req, res) => {
    const { email, password } = req.body ?? {};
    if (typeof email !== "string" || typeof password !== "string") {
        return res.status(400).json({ error: "email and password required" });
    }
    const user = await User_1.User.findOne({ email: email.toLowerCase().trim() });
    // same message for unknown email and wrong password
    const ok = user ? await bcryptjs_1.default.compare(password, user.passwordHash) : false;
    if (!user || !ok)
        return res.status(401).json({ error: "Invalid credentials" });
    res.json({ token: (0, auth_1.signToken)(String(user._id)) });
});
router.get("/auth/me", auth_1.authenticate, (req, res) => {
    const u = req.user;
    res.json({
        id: u.id,
        email: u.email,
        role: u.roleName,
        branchId: u.branchId,
        permissions: Object.fromEntries(u.permissions),
    });
});
exports.default = router;
