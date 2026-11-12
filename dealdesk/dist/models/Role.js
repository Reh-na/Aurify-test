"use strict";
Object.defineProperty(exports, "__esModule", { value: true });
exports.Role = exports.SCOPES = exports.PERMISSIONS = void 0;
const mongoose_1 = require("mongoose");
exports.PERMISSIONS = [
    "deal.view",
    "deal.edit",
    "discount.approve",
    "invoice.issue",
    "invoice.cancel",
    "chat.send",
    // admin-only management permissions
    "role.manage",
    "approval.configure",
];
exports.SCOPES = ["own", "branch", "all"];
// A role is DATA: a set of permissions, each with a data scope.
// New role = new document in this collection. No code change, no role names in business logic.
const roleSchema = new mongoose_1.Schema({
    name: { type: String, required: true, unique: true },
    permissions: [
        {
            _id: false,
            key: { type: String, enum: exports.PERMISSIONS, required: true },
            // scope only matters for data permissions (deal.view / deal.edit)
            scope: { type: String, enum: exports.SCOPES, default: "all" },
        },
    ],
    // Part 2: max discount % this role can approve on its own (manager limit)
    approvalLimit: { type: Number, default: 0 },
}, { timestamps: true });
exports.Role = (0, mongoose_1.model)("Role", roleSchema);
