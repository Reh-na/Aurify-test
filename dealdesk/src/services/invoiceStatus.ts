
import mongoose from "mongoose";
import { Invoice, InvoiceStatus } from "../models/Invoice";
import { Customer } from "../models/Customer";
import { IntegrationLog } from "../models/IntegrationLog";
import { eventBus } from "./events";

export const STATUS_MAP: Record<string, InvoiceStatus> = {
  QUEUED: "pending",
  SENT: "sent",
  VIEWED: "viewed",
  PAID: "paid",
  FAILED: "failed",
};

export const SEQ: Record<string, number> = {
  QUEUED: 0,
  SENT: 1,
  VIEWED: 2,
  PAID: 3,
  FAILED: 3,
};

export type ApplyResult =
  | "applied"
  | "stale"
  | "unknown_invoice"
  | "unknown_status";

export async function applyInvoiceStatus(args: {
  externalId: string;
  status: string;
  sequence: number;
}): Promise<{ result: ApplyResult; invoiceId?: string }> {
  const newStatus = STATUS_MAP[args.status];

  if (!newStatus) {
    return { result: "unknown_status" };
  }

  const session = await mongoose.startSession();

  let updatedInvoice: any = null;
  const outcome: { result: ApplyResult } = {
    result: "unknown_invoice",
  };
  try {
    await session.withTransaction(async () => {
      // Update only if the incoming sequence is newer.
      updatedInvoice = await Invoice.findOneAndUpdate(
        {
          externalId: args.externalId,
          lastSequence: { $lt: args.sequence },
        },
        {
          $set: {
            status: newStatus,
            lastSequence: args.sequence,
          },
        },
        {
          new: true,
          session,
        }
      );

      if (!updatedInvoice) {
        const exists = await Invoice.exists({
          externalId: args.externalId,
        }).session(session);

        outcome.result = exists ? "stale" : "unknown_invoice";        return;
      }

      // Payment settlement happens in the SAME transaction.
      if (newStatus === "paid" && updatedInvoice.customerId) {
        const invoiceToSettle = await Invoice.findOneAndUpdate(
          {
            _id: updatedInvoice._id,
            balanceApplied: false,
          },
          {
            $set: {
              balanceApplied: true,
              paidAt: new Date(),
            },
          },
          {
            new: true,
            session,
          }
        );

        if (invoiceToSettle) {
          const customer = await Customer.updateOne(
            { _id: updatedInvoice.customerId },
            {
              $inc: {
                outstandingBalance: -updatedInvoice.amount,
              },
            },
            { session }
          );

          if (customer.matchedCount === 0) {
            throw new Error("Customer not found during payment settlement");
          }
        }
      }

      outcome.result = "applied";    });

    // Notify only AFTER the transaction successfully commits.
    if (outcome.result === "applied" && updatedInvoice) {      eventBus.emit("invoice.status_changed", {
        invoiceId: String(updatedInvoice._id),
        dealId: updatedInvoice.dealId,
        ownerId: updatedInvoice.ownerId,
        customerId: updatedInvoice.customerId,
        externalId: updatedInvoice.externalId,
        status: newStatus,
      });
    }

    return {
        result: outcome.result,      invoiceId: updatedInvoice
        ? String(updatedInvoice._id)
        : undefined,
    };
  } catch (err: any) {
    await IntegrationLog.create({
      direction: "inbound",
      externalId: args.externalId,
      outcome: "settlement_error",
      detail: err.message,
    }).catch(console.error);

    throw err;
  } finally {
    await session.endSession();
  }
}
