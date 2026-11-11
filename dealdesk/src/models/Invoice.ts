import { Schema, model } from "mongoose";

export const INVOICE_STATUSES = ["pending", "sent", "viewed", "paid", "failed"] as const;
export type InvoiceStatus = (typeof INVOICE_STATUSES)[number];

export const PUSH_STATES = ["queued", "pushed", "failed"] as const;

const invoiceSchema = new Schema(
  {
    // unique: oru deal-inu oru invoice mathram (convert randu pravashyam click cheythaalum)
    dealId: { type: String, required: true, unique: true },
    amount: { type: Number, required: true },
    // Part 1-3 modelukalil ninnu varunnath. Paid aakumpol balance kurakkaanum notify cheyyaanum venam.
    customerId: { type: String },
    ownerId: { type: String },

    status: { type: String, enum: INVOICE_STATUSES, default: "pending" },
    externalId: { type: String, index: true },
    lastSequence: { type: Number, default: 0 },

    // push state (outbound job)
    pushState: { type: String, enum: PUSH_STATES, default: "queued" },
    pushAttempts: { type: Number, default: 0 },
    nextAttemptAt: { type: Date, default: () => new Date() },
    lastError: { type: String },

    // paid side-effect (balance) onnu mathram nadakkaan
    balanceApplied: { type: Boolean, default: false },
    paidAt: { type: Date },
  },
  { timestamps: true }
);

// push worker-inte claim query-kku
invoiceSchema.index({ pushState: 1, nextAttemptAt: 1 });

export const Invoice = model("Invoice", invoiceSchema);
