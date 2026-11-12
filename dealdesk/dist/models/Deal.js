"use strict";
Object.defineProperty(exports, "__esModule", { value: true });
exports.Deal = exports.DEAL_STATUSES = void 0;
const mongoose_1 = require("mongoose");
exports.DEAL_STATUSES = ["open", "pending_approval", "won"];
const dealSchema = new mongoose_1.Schema({
    title: { type: String, required: true },
    customerId: { type: mongoose_1.Schema.Types.ObjectId, ref: "Customer", required: true },
    productId: { type: mongoose_1.Schema.Types.ObjectId, ref: "Product" },
    amount: { type: Number, required: true, min: 0 },
    status: { type: String, enum: exports.DEAL_STATUSES, default: "open" },
    discountPercent: { type: Number, default: 0 },
    // ownerId + branchId are stored ON the deal so scope is a plain indexed query filter.
    // branchId is copied from the owner at creation time and never taken from the client.
    ownerId: { type: mongoose_1.Schema.Types.ObjectId, ref: "User", required: true, index: true },
    branchId: { type: mongoose_1.Schema.Types.ObjectId, ref: "Branch", required: true, index: true },
}, { timestamps: true });
exports.Deal = (0, mongoose_1.model)("Deal", dealSchema);
