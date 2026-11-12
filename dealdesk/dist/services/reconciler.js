"use strict";
Object.defineProperty(exports, "__esModule", { value: true });
exports.startReconciler = startReconciler;
const Invoice_1 = require("../models/Invoice");
const IntegrationLog_1 = require("../models/IntegrationLog");
const billport_1 = require("./billport");
const invoiceStatus_1 = require("./invoiceStatus");
async function reconcileOnce() {
    const stuckMs = (Number(process.env.RECON_STUCK_AFTER_MIN) || 1) * 60_000;
    const cutoff = new Date(Date.now() - stuckMs);
    // Final alla (paid/failed), externalId undu, N minute-il kooduthal update illa
    const stuck = await Invoice_1.Invoice.find({
        pushState: "pushed",
        externalId: { $exists: true },
        status: { $nin: ["paid", "failed"] },
        updatedAt: { $lt: cutoff },
    }).limit(20);
    for (const inv of stuck) {
        const invoiceId = String(inv._id);
        try {
            const remote = await (0, billport_1.fetchInvoice)(inv.externalId);
            const seq = invoiceStatus_1.SEQ[remote.status];
            if (seq === undefined) {
                await IntegrationLog_1.IntegrationLog.create({
                    direction: "inbound",
                    invoiceId,
                    externalId: inv.externalId,
                    response: remote,
                    outcome: "reconcile_unknown_status",
                    detail: remote.status,
                });
                continue;
            }
            // Webhook-inte athe function, athe rule (sequence kooduthal aanenkil mathram)
            const { result } = await (0, invoiceStatus_1.applyInvoiceStatus)({
                externalId: inv.externalId,
                status: remote.status,
                sequence: seq,
            });
            await IntegrationLog_1.IntegrationLog.create({
                direction: "inbound",
                invoiceId,
                externalId: inv.externalId,
                response: remote,
                outcome: result === "applied" ? "reconciled_repaired" : "reconciled_no_change",
                detail: `remote=${remote.status} result=${result}`,
            });
            // Change illenkil updatedAt puthukki, ororo run-um ethinte pinnale povaathirikkaan
            // (timestamps option updatedAt automatic aayi maattum)
            if (result !== "applied")
                await Invoice_1.Invoice.updateOne({ _id: inv._id }, { $set: { lastError: null } });
        }
        catch (err) {
            await IntegrationLog_1.IntegrationLog.create({
                direction: "inbound",
                invoiceId,
                externalId: inv.externalId,
                outcome: "reconcile_error",
                detail: err.message,
            });
            // BillPort down aanenkilum updatedAt maattunnu -> adutha N minute vare veendum nokkilla
            await Invoice_1.Invoice.updateOne({ _id: inv._id }, { $set: { lastError: `reconcile: ${err.message}` } });
        }
    }
}
function startReconciler() {
    const tick = async () => {
        try {
            await reconcileOnce();
        }
        catch (err) {
            console.error("reconciler error", err);
        }
        finally {
            setTimeout(tick, Number(process.env.RECON_INTERVAL_MS) || 15000);
        }
    };
    tick();
    console.log("Reconciler started");
}
