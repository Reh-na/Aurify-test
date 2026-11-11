import { Router } from "express";
import bcrypt from "bcryptjs";
import { User } from "../models/User";
import { authenticate, signToken } from "../middleware/auth";

const router = Router();

router.post("/auth/login", async (req, res) => {
  const { email, password } = req.body ?? {};
  if (typeof email !== "string" || typeof password !== "string") {
    return res.status(400).json({ error: "email and password required" });
  }
  const user = await User.findOne({ email: email.toLowerCase().trim() });
  // same message for unknown email and wrong password
  const ok = user ? await bcrypt.compare(password, user.passwordHash) : false;
  if (!user || !ok) return res.status(401).json({ error: "Invalid credentials" });
  res.json({ token: signToken(String(user._id)) });
});

router.get("/auth/me", authenticate, (req, res) => {
  const u = req.user!;
  res.json({
    id: u.id,
    email: u.email,
    role: u.roleName,
    branchId: u.branchId,
    permissions: Object.fromEntries(u.permissions),
  });
});

export default router;
