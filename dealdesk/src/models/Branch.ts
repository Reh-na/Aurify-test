import { Schema, model } from "mongoose";

const branchSchema = new Schema(
  { name: { type: String, required: true, unique: true } },
  { timestamps: true }
);

export const Branch = model("Branch", branchSchema);
