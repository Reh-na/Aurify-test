"use strict";
Object.defineProperty(exports, "__esModule", { value: true });
const express_1 = require("express");
const signature_1 = require("../services/signature");
const WebhookEvent_1 = require("../models/WebhookEvent");
const IntegrationLog_1 = require("../models/IntegrationLog");
const invoiceStatus_1 = require("../services/invoiceStatus");
const router = (0, express_1.Router)();
// raw() kondu body Buffer aayi kittum. Signature RAW body-yil aanu check cheyyendath.
router.post("/webhooks/billport", (0, express_1.raw)({ type: "*/*" }), async (req, res) => {
    const rawBody = req.body;
    const signature = req.header("X-Signature") || "";
    // 1. Signature aadyam, parse cheyyunnathinu munpu
    if (!Buffer.isBuffer(rawBody) || !(0, signature_1.verify)(rawBody, signature)) {
        await IntegrationLog_1.IntegrationLog.create({
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
async function processEvent(rawBody) {
    let event;
    try {
        event = JSON.parse(rawBody.toString());
    }
    catch {
        await IntegrationLog_1.IntegrationLog.create({ direction: "inbound", outcome: "ignored_malformed", payload: rawBody.toString() });
        return;
    }
    const { eventId, externalId, status, sequence } = event;
    const base = { direction: "inbound", eventId, externalId, payload: event };
    if (!eventId || !externalId || !status || typeof sequence !== "number") {
        await IntegrationLog_1.IntegrationLog.create({ ...base, outcome: "ignored_malformed" });
        return;
    }
    // 3. Duplicate: eventId insert cheyyaan nokku. Munpu undenkil 11000 error (unique index).
    try {
        await WebhookEvent_1.WebhookEvent.create({ eventId });
    }
    catch (err) {
        if (err.code === 11000) {
            await IntegrationLog_1.IntegrationLog.create({ ...base, outcome: "ignored_duplicate" });
            return;
        }
        throw err;
    }
    try {
        // 4. Stale check + status update + paid side-effects = shared function (reconciler-um ithu thanne use cheyyum)
        const { result, invoiceId } = await (0, invoiceStatus_1.applyInvoiceStatus)({ externalId, status, sequence });
        switch (result) {
            case "applied":
                await IntegrationLog_1.IntegrationLog.create({ ...base, invoiceId, outcome: "applied", detail: `-> ${status} (seq ${sequence})` });
                return;
            case "stale":
                await IntegrationLog_1.IntegrationLog.create({ ...base, outcome: "ignored_stale", detail: `seq ${sequence} <= current` });
                return;
            case "unknown_status":
                await IntegrationLog_1.IntegrationLog.create({ ...base, outcome: "ignored_unknown_status", detail: status });
                return;
            case "unknown_invoice":
                // Push response varunnathinu munpe webhook vannaal externalId namukku ariyilla.
                // eventId "processed" ennu mark cheythu vekkaruth -> record delete cheyyunnu, reconciler repair cheyyum.
                await WebhookEvent_1.WebhookEvent.deleteOne({ eventId });
                await IntegrationLog_1.IntegrationLog.create({ ...base, outcome: "ignored_unknown_invoice", detail: "reconciler will repair" });
                return;
        }
    }
    catch (err) {
        // DB error: eventId free aakkunnu, appol redelivery/duplicate-inu veendum apply cheyyaam
        await WebhookEvent_1.WebhookEvent.deleteOne({ eventId }).catch(() => { });
        await IntegrationLog_1.IntegrationLog.create({ ...base, outcome: "processing_error", detail: err.message });
        throw err;
    }
}
exports.default = router;
