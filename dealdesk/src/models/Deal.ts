import { Schema, model } from "mongoose";

export const DEAL_STATUSES = ["open", "pending_approval", "won"] as const;

const dealSchema = new Schema(
  {
    title: { type: String, required: true },
    customerId: { type: Schema.Types.ObjectId, ref: "Customer", required: true },
    productId: { type: Schema.Types.ObjectId, ref: "Product" },
    amount: { type: Number, required: true, min: 0 },
    status: { type: String, enum: DEAL_STATUSES, default: "open" },
    discountPercent: { type: Number, default: 0 },
    // ownerId + branchId are stored ON the deal so scope is a plain indexed query filter.
    // branchId is copied from the owner at creation time and never taken from the client.
    ownerId: { type: Schema.Types.ObjectId, ref: "User", required: true, index: true },
    branchId: { type: Schema.Types.ObjectId, ref: "Branch", required: true, index: true },
  },
  { timestamps: true }
);

export const Deal = model("Deal", dealSchema);
