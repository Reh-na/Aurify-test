"use strict";
var __importDefault = (this && this.__importDefault) || function (mod) {
    return (mod && mod.__esModule) ? mod : { "default": mod };
};
Object.defineProperty(exports, "__esModule", { value: true });
exports.SEQ = exports.STATUS_MAP = void 0;
exports.applyInvoiceStatus = applyInvoiceStatus;
const mongoose_1 = __importDefault(require("mongoose"));
const Invoice_1 = require("../models/Invoice");
const Customer_1 = require("../models/Customer");
const IntegrationLog_1 = require("../models/IntegrationLog");
const events_1 = require("./events");
exports.STATUS_MAP = {
    QUEUED: "pending",
    SENT: "sent",
    VIEWED: "viewed",
    PAID: "paid",
    FAILED: "failed",
};
exports.SEQ = {
    QUEUED: 0,
    SENT: 1,
    VIEWED: 2,
    PAID: 3,
    FAILED: 3,
};
async function applyInvoiceStatus(args) {
    const newStatus = exports.STATUS_MAP[args.status];
    if (!newStatus) {
        return { result: "unknown_status" };
    }
    const session = await mongoose_1.default.startSession();
    let updatedInvoice = null;
    const outcome = {
        result: "unknown_invoice",
    };
    try {
        await session.withTransaction(async () => {
            // Update only if the incoming sequence is newer.
            updatedInvoice = await Invoice_1.Invoice.findOneAndUpdate({
                externalId: args.externalId,
                lastSequence: { $lt: args.sequence },
            }, {
                $set: {
                    status: newStatus,
                    lastSequence: args.sequence,
                },
            }, {
                new: true,
                session,
            });
            if (!updatedInvoice) {
                const exists = await Invoice_1.Invoice.exists({
                    externalId: args.externalId,
                }).session(session);
                outcome.result = exists ? "stale" : "unknown_invoice";
                return;
            }
            // Payment settlement happens in the SAME transaction.
            if (newStatus === "paid" && updatedInvoice.customerId) {
                const invoiceToSettle = await Invoice_1.Invoice.findOneAndUpdate({
                    _id: updatedInvoice._id,
                    balanceApplied: false,
                }, {
                    $set: {
                        balanceApplied: true,
                        paidAt: new Date(),
                    },
                }, {
                    new: true,
                    session,
                });
                if (invoiceToSettle) {
                    const customer = await Customer_1.Customer.updateOne({ _id: updatedInvoice.customerId }, {
                        $inc: {
                            outstandingBalance: -updatedInvoice.amount,
                        },
                    }, { session });
                    if (customer.matchedCount === 0) {
                        throw new Error("Customer not found during payment settlement");
                    }
                }
            }
            outcome.result = "applied";
        });
        // Notify only AFTER the transaction successfully commits.
        if (outcome.result === "applied" && updatedInvoice) {
            events_1.eventBus.emit("invoice.status_changed", {
                invoiceId: String(updatedInvoice._id),
                dealId: updatedInvoice.dealId,
                ownerId: updatedInvoice.ownerId,
                customerId: updatedInvoice.customerId,
                externalId: updatedInvoice.externalId,
                status: newStatus,
            });
        }
        return {
            result: outcome.result, invoiceId: updatedInvoice
                ? String(updatedInvoice._id)
                : undefined,
        };
    }
    catch (err) {
        await IntegrationLog_1.IntegrationLog.create({
            direction: "inbound",
            externalId: args.externalId,
            outcome: "settlement_error",
            detail: err.message,
        }).catch(console.error);
        throw err;
    }
    finally {
        await session.endSession();
    }
}
