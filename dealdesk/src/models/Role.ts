import { Schema, model } from "mongoose";

export const PERMISSIONS = [
  "deal.view",
  "deal.edit",
  "discount.approve",
  "invoice.issue",
  "invoice.cancel",
  "chat.send",
  // admin-only management permissions
  "role.manage",
  "approval.configure",
] as const;
export type Permission = (typeof PERMISSIONS)[number];

export const SCOPES = ["own", "branch", "all"] as const;
export type Scope = (typeof SCOPES)[number];

// A role is DATA: a set of permissions, each with a data scope.
// New role = new document in this collection. No code change, no role names in business logic.
const roleSchema = new Schema(
  {
    name: { type: String, required: true, unique: true },
    permissions: [
      {
        _id: false,
        key: { type: String, enum: PERMISSIONS, required: true },
        // scope only matters for data permissions (deal.view / deal.edit)
        scope: { type: String, enum: SCOPES, default: "all" },
      },
    ],
    // Part 2: max discount % this role can approve on its own (manager limit)
    approvalLimit: { type: Number, default: 0 },
  },
  { timestamps: true }
);

export const Role = model("Role", roleSchema);
