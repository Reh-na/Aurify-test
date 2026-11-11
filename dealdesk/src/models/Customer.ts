import mongoose, { Model, Schema, model } from "mongoose";

// NOTE: Nigalude Part 1-3-il Customer model undenkil ee file delete cheythu avide ninnu import cheyyuka.
// Venda field: outstandingBalance (Number).
const customerSchema = new Schema(
  {
    name: { type: String },
    outstandingBalance: { type: Number, default: 0 },
  },
  { timestamps: true }
);

export const Customer: Model<any> =
  (mongoose.models.Customer as Model<any>) || model("Customer", customerSchema);
