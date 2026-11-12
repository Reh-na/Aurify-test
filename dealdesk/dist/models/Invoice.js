"use strict";
Object.defineProperty(exports, "__esModule", { value: true });
exports.Invoice = exports.PUSH_STATES = exports.INVOICE_STATUSES = void 0;
const mongoose_1 = require("mongoose");
exports.INVOICE_STATUSES = ["pending", "sent", "viewed", "paid", "failed"];
exports.PUSH_STATES = ["queued", "pushed", "failed"];
const invoiceSchema = new mongoose_1.Schema({
    // unique: oru deal-inu oru invoice mathram (convert randu pravashyam click cheythaalum)
    dealId: { type: String, required: true, unique: true },
    amount: { type: Number, required: true },
    // Part 1-3 modelukalil ninnu varunnath. Paid aakumpol balance kurakkaanum notify cheyyaanum venam.
    customerId: { type: String },
    ownerId: { type: String },
    status: { type: String, enum: exports.INVOICE_STATUSES, default: "pending" },
    externalId: { type: String, index: true },
    lastSequence: { type: Number, default: 0 },
    // push state (outbound job)
    pushState: { type: String, enum: exports.PUSH_STATES, default: "queued" },
    pushAttempts: { type: Number, default: 0 },
    nextAttemptAt: { type: Date, default: () => new Date() },
    lastError: { type: String },
    // paid side-effect (balance) onnu mathram nadakkaan
    balanceApplied: { type: Boolean, default: false },
    paidAt: { type: Date },
}, { timestamps: true });
// push worker-inte claim query-kku
invoiceSchema.index({ pushState: 1, nextAttemptAt: 1 });
exports.Invoice = (0, mongoose_1.model)("Invoice", invoiceSchema);
