import { Invoice } from "../models/Invoice";
import { IntegrationLog } from "../models/IntegrationLog";
import { fetchInvoice } from "./billport";
import { applyInvoiceStatus, SEQ } from "./invoiceStatus";

async function reconcileOnce() {
  const stuckMs = (Number(process.env.RECON_STUCK_AFTER_MIN) || 1) * 60_000;
  const cutoff = new Date(Date.now() - stuckMs);

  // Final alla (paid/failed), externalId undu, N minute-il kooduthal update illa
  const stuck = await Invoice.find({
    pushState: "pushed",
    externalId: { $exists: true },
    status: { $nin: ["paid", "failed"] },
    updatedAt: { $lt: cutoff },
  }).limit(20);

  for (const inv of stuck) {
    const invoiceId = String(inv._id);
    try {
      const remote = await fetchInvoice(inv.externalId!);
      const seq = SEQ[remote.status];
      if (seq === undefined) {
        await IntegrationLog.create({
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
      const { result } = await applyInvoiceStatus({
        externalId: inv.externalId!,
        status: remote.status,
        sequence: seq,
      });

      await IntegrationLog.create({
        direction: "inbound",
        invoiceId,
        externalId: inv.externalId,
        response: remote,
        outcome: result === "applied" ? "reconciled_repaired" : "reconciled_no_change",
        detail: `remote=${remote.status} result=${result}`,
      });

      // Change illenkil updatedAt puthukki, ororo run-um ethinte pinnale povaathirikkaan
      // (timestamps option updatedAt automatic aayi maattum)
      if (result !== "applied") await Invoice.updateOne({ _id: inv._id }, { $set: { lastError: null } });
    } catch (err: any) {
      await IntegrationLog.create({
        direction: "inbound",
        invoiceId,
        externalId: inv.externalId,
        outcome: "reconcile_error",
        detail: err.message,
      });
      // BillPort down aanenkilum updatedAt maattunnu -> adutha N minute vare veendum nokkilla
      await Invoice.updateOne({ _id: inv._id }, { $set: { lastError: `reconcile: ${err.message}` } });
    }
  }
}

export function startReconciler() {
  const tick = async () => {
    try {
      await reconcileOnce();
    } catch (err) {
      console.error("reconciler error", err);
    } finally {
      setTimeout(tick, Number(process.env.RECON_INTERVAL_MS) || 15000);
    }
  };
  tick();
  console.log("Reconciler started");
}
