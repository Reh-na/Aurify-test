import { Router, raw } from "express";
import { verify } from "../services/signature";
import { WebhookEvent } from "../models/WebhookEvent";
import { IntegrationLog } from "../models/IntegrationLog";
import { applyInvoiceStatus } from "../services/invoiceStatus";

const router = Router();

// raw() kondu body Buffer aayi kittum. Signature RAW body-yil aanu check cheyyendath.
router.post("/webhooks/billport", raw({ type: "*/*" }), async (req, res) => {
  const rawBody = req.body as Buffer;
  const signature = req.header("X-Signature") || "";

  // 1. Signature aadyam, parse cheyyunnathinu munpu
  if (!Buffer.isBuffer(rawBody) || !verify(rawBody, signature)) {
    await IntegrationLog.create({
      direction: "inbound",
      outcome: "rejected_signature",
      payload: Buffer.isBuffer(rawBody) ? rawBody.toString() : null,
    });
    return res.status(401).json({ error: "Invalid signature" });
  }

  // 2. Udane 200, processing pinne (BillPort 3s kazhinjaal retry cheyyum)
  res.status(200).json({ received: true });

  setImmediate(() => {
    processEvent(rawBody).catch((err) => console.error("webhook processing failed", err));
  });
});

async function processEvent(rawBody: Buffer) {
  let event: any;
  try {
    event = JSON.parse(rawBody.toString());
  } catch {
    await IntegrationLog.create({ direction: "inbound", outcome: "ignored_malformed", payload: rawBody.toString() });
    return;
  }

  const { eventId, externalId, status, sequence } = event;
  const base = { direction: "inbound" as const, eventId, externalId, payload: event };

  if (!eventId || !externalId || !status || typeof sequence !== "number") {
    await IntegrationLog.create({ ...base, outcome: "ignored_malformed" });
    return;
  }

  // 3. Duplicate: eventId insert cheyyaan nokku. Munpu undenkil 11000 error (unique index).
  try {
    await WebhookEvent.create({ eventId });
  } catch (err: any) {
    if (err.code === 11000) {
      await IntegrationLog.create({ ...base, outcome: "ignored_duplicate" });
      return;
    }
    throw err;
  }

  try {
    // 4. Stale check + status update + paid side-effects = shared function (reconciler-um ithu thanne use cheyyum)
    const { result, invoiceId } = await applyInvoiceStatus({ externalId, status, sequence });

    switch (result) {
      case "applied":
        await IntegrationLog.create({ ...base, invoiceId, outcome: "applied", detail: `-> ${status} (seq ${sequence})` });
        return;
      case "stale":
        await IntegrationLog.create({ ...base, outcome: "ignored_stale", detail: `seq ${sequence} <= current` });
        return;
      case "unknown_status":
        await IntegrationLog.create({ ...base, outcome: "ignored_unknown_status", detail: status });
        return;
      case "unknown_invoice":
        // Push response varunnathinu munpe webhook vannaal externalId namukku ariyilla.
        // eventId "processed" ennu mark cheythu vekkaruth -> record delete cheyyunnu, reconciler repair cheyyum.
        await WebhookEvent.deleteOne({ eventId });
        await IntegrationLog.create({ ...base, outcome: "ignored_unknown_invoice", detail: "reconciler will repair" });
        return;
    }
  } catch (err: any) {
    // DB error: eventId free aakkunnu, appol redelivery/duplicate-inu veendum apply cheyyaam
    await WebhookEvent.deleteOne({ eventId }).catch(() => {});
    await IntegrationLog.create({ ...base, outcome: "processing_error", detail: err.message });
    throw err;
  }
}

export default router;
