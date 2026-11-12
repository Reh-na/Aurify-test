"use strict";
Object.defineProperty(exports, "__esModule", { value: true });
exports.createInvoiceForDeal = createInvoiceForDeal;
const Invoice_1 = require("../models/Invoice");
/**
 * Deal "won" aayi convert cheyyumbol ithu vilikkuka (Part 2/3-le convert code-il).
 * - BillPort-ine ivide vilikkunnilla: invoice LOCAL aayi undaakki, pushState="queued" aakkunnu.
 *   Pinne background worker push cheyyum -> BillPort down aanenkilum convert fail aakilla.
 * - dealId-inu unique index + upsert: randu pravashyam convert cheythaalum oru invoice mathram.
 */
async function createInvoiceForDeal(input) {
    return Invoice_1.Invoice.findOneAndUpdate({ dealId: input.dealId }, {
        $setOnInsert: {
            dealId: input.dealId,
            amount: input.amount,
            customerId: input.customerId,
            ownerId: input.ownerId,
            status: "pending",
            pushState: "queued",
            pushAttempts: 0,
            nextAttemptAt: new Date(),
        },
    }, { upsert: true, returnDocument: "after" });
}
