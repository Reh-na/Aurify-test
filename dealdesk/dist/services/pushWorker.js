"use strict";
Object.defineProperty(exports, "__esModule", { value: true });
exports.startPushWorker = startPushWorker;
const Invoice_1 = require("../models/Invoice");
const IntegrationLog_1 = require("../models/IntegrationLog");
const billport_1 = require("./billport");
const events_1 = require("./events");
const maxAttempts = () => Number(process.env.PUSH_MAX_ATTEMPTS) || 8;
const baseDelay = () => Number(process.env.PUSH_BASE_DELAY_MS) || 2000;
const CLAIM_LEASE_MS = 30_000;
// 2s, 4s, 8s, 16s, 32s, 60s (cap). Fail aayi irikkunna service-ine idikkaathirikkaan.
const backoff = (attempts) => Math.min(baseDelay() * 2 ** (attempts - 1), 60_000);
async function processOne() {
    // Oru invoice "claim" cheyyunnu. nextAttemptAt 30s munnottu maattunnu (lease),
    // athukondu verey tick/instance aa invoice edukkilla. Worker crash aayaal 30s kazhinju veendum edukkum.
    const invoice = await Invoice_1.Invoice.findOneAndUpdate({ pushState: "queued", nextAttemptAt: { $lte: new Date() } }, { nextAttemptAt: new Date(Date.now() + CLAIM_LEASE_MS) }, { sort: { nextAttemptAt: 1 }, returnDocument: "after" });
    if (!invoice)
        return;
    const invoiceId = String(invoice._id);
    const attempt = invoice.pushAttempts + 1;
    const payload = { invoiceId, dealId: invoice.dealId, amount: invoice.amount };
    try {
        const externalId = await (0, billport_1.pushInvoice)(invoiceId, payload);
        await Invoice_1.Invoice.updateOne({ _id: invoice._id }, { externalId, pushState: "pushed", pushAttempts: attempt, $unset: { lastError: "" } });
        await IntegrationLog_1.IntegrationLog.create({
            direction: "outbound",
            invoiceId,
            externalId,
            payload,
            response: { status: 201, externalId },
            outcome: "push_ok",
            detail: `attempt ${attempt}`,
        });
    }
    catch (err) {
        const exhausted = attempt >= maxAttempts();
        const message = err?.name === "TimeoutError" ? "timeout" : err?.message ?? String(err);
        await Invoice_1.Invoice.updateOne({ _id: invoice._id }, exhausted
            ? { pushState: "failed", pushAttempts: attempt, lastError: message }
            : {
                pushAttempts: attempt,
                lastError: message,
                nextAttemptAt: new Date(Date.now() + backoff(attempt)),
            });
        await IntegrationLog_1.IntegrationLog.create({
            direction: "outbound",
            invoiceId,
            payload,
            response: { error: message },
            outcome: exhausted ? "push_failed_terminal" : "push_retry_scheduled",
            detail: `attempt ${attempt}/${maxAttempts()}: ${message}${exhausted ? "" : ` (next in ${backoff(attempt)}ms)`}`,
        });
        if (exhausted) {
            // Terminal: aarenkilum action edukkanam -> notification + GET /invoices?pushState=failed
            events_1.eventBus.emit("invoice.push_failed", {
                invoiceId,
                dealId: invoice.dealId,
                ownerId: invoice.ownerId,
                attempts: attempt,
                error: message,
            });
        }
    }
}
function startPushWorker() {
    const tick = async () => {
        try {
            await processOne();
        }
        catch (err) {
            console.error("push worker error", err);
        }
        finally {
            setTimeout(tick, Number(process.env.PUSH_POLL_MS) || 1000);
        }
    };
    tick();
    console.log("Push worker started");
}
