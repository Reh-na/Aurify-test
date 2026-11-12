"use strict";
Object.defineProperty(exports, "__esModule", { value: true });
exports.PushError = void 0;
exports.pushInvoice = pushInvoice;
exports.fetchInvoice = fetchInvoice;
const signature_1 = require("./signature");
class PushError extends Error {
}
exports.PushError = PushError;
// Idempotency-Key = invoiceId. Retry cheythaalum maarilla.
async function pushInvoice(invoiceId, payload) {
    const body = JSON.stringify(payload);
    const res = await fetch(`${process.env.BILLPORT_URL}/billing/invoices`, {
        method: "POST",
        headers: {
            "Content-Type": "application/json",
            "Idempotency-Key": invoiceId,
            "X-Signature": (0, signature_1.sign)(body),
        },
        body,
        // 6s-il response varunna BillPort-ine kaathirikkilla
        signal: AbortSignal.timeout(Number(process.env.PUSH_TIMEOUT_MS) || 3500),
    });
    if (res.status !== 201)
        throw new PushError(`BillPort responded ${res.status}`);
    const data = (await res.json());
    return data.externalId;
}
async function fetchInvoice(externalId) {
    const res = await fetch(`${process.env.BILLPORT_URL}/billing/invoices/${externalId}`, {
        signal: AbortSignal.timeout(Number(process.env.PUSH_TIMEOUT_MS) || 3500),
    });
    if (!res.ok)
        throw new Error(`BillPort responded ${res.status}`);
    return (await res.json());
}
