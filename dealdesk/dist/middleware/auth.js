"use strict";
var __importDefault = (this && this.__importDefault) || function (mod) {
    return (mod && mod.__esModule) ? mod : { "default": mod };
};
Object.defineProperty(exports, "__esModule", { value: true });
exports.requirePermission = exports.authenticate = void 0;
exports.signToken = signToken;
exports.authenticateToken = authenticateToken;
const jsonwebtoken_1 = __importDefault(require("jsonwebtoken"));
const User_1 = require("../models/User");
const Role_1 = require("../models/Role");
const jwtSecret = () => process.env.JWT_SECRET || "dev-jwt-secret-change-me";
function signToken(userId) {
    return jsonwebtoken_1.default.sign({ sub: userId }, jwtSecret(), {
        expiresIn: (process.env.JWT_EXPIRES_IN || "8h"),
    });
}
/** Verify a JWT (HTTP or socket handshake) and load the user + role permissions FROM THE DB.
 *  The token carries only the user id, so changing a role takes effect on the very next request. */
async function authenticateToken(token) {
    let sub;
    try {
        sub = jsonwebtoken_1.default.verify(token, jwtSecret()).sub;
    }
    catch {
        return null;
    }
    const user = await User_1.User.findById(sub).lean();
    if (!user)
        return null;
    const role = await Role_1.Role.findById(user.roleId).lean();
    if (!role)
        return null;
    return {
        id: String(user._id),
        email: user.email,
        roleName: role.name,
        branchId: String(user.branchId),
        approvalLimit: role.approvalLimit ?? 0,
        permissions: new Map(role.permissions.map((p) => [p.key, p.scope])),
    };
}
const bearer = (header) => header && header.startsWith("Bearer ") ? header.slice(7) : null;
/** Login required, no specific permission. */
const authenticate = async (req, res, next) => {
    try {
        const token = bearer(req.header("Authorization"));
        const user = token ? await authenticateToken(token) : null;
        if (!user)
            return res.status(401).json({ error: "Unauthenticated" });
        req.user = user;
        next();
    }
    catch (err) {
        next(err);
    }
};
exports.authenticate = authenticate;
/** THE reusable guard. Takes a permission name, never a role name.
 *  Usage: router.get("/deals", requirePermission("deal.view"), handler) */
const requirePermission = (permission) => async (req, res, next) => {
    try {
        const token = bearer(req.header("Authorization"));
        const user = token ? await authenticateToken(token) : null;
        if (!user)
            return res.status(401).json({ error: "Unauthenticated" });
        if (!user.permissions.has(permission)) {
            return res.status(403).json({ error: `Missing permission: ${permission}` });
        }
        req.user = user;
        next();
    }
    catch (err) {
        next(err);
    }
};
exports.requirePermission = requirePermission;
