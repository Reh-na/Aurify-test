"use strict";
var __importDefault = (this && this.__importDefault) || function (mod) {
    return (mod && mod.__esModule) ? mod : { "default": mod };
};
Object.defineProperty(exports, "__esModule", { value: true });
exports.createInvoiceRouter = createInvoiceRouter;
const express_1 = require("express");
const mongoose_1 = __importDefault(require("mongoose"));
const Invoice_1 = require("../models/Invoice");
const IntegrationLog_1 = require("../models/IntegrationLog");
const open = () => (_req, _res, next) => next();
function createInvoiceRouter(requirePermission = open) {
    const router = (0, express_1.Router)();
    const guard = requirePermission("invoice.issue");
    // Failed push-ukal kaanaan: GET /invoices?pushState=failed
    router.get("/invoices", guard, async (req, res) => {
        const filter = {};
        const { pushState, status } = req.query;
        if (typeof pushState === "string" && Invoice_1.PUSH_STATES.includes(pushState))
            filter.pushState = pushState;
        if (typeof status === "string" && Invoice_1.INVOICE_STATUSES.includes(status))
            filter.status = status;
        res.json(await Invoice_1.Invoice.find(filter).sort({ createdAt: -1 }).limit(100));
    });
    router.get("/invoices/:id", guard, async (req, res) => {
        if (!mongoose_1.default.isValidObjectId(req.params.id))
            return res.status(404).json({ error: "Not found" });
        const invoice = await Invoice_1.Invoice.findById(req.params.id);
        if (!invoice)
            return res.status(404).json({ error: "Not found" });
        res.json(invoice);
    });
    // "Ee invoice enthukondu unpaid?" -> ithu thanne uttharam
    router.get("/invoices/:id/logs", guard, async (req, res) => {
        if (!mongoose_1.default.isValidObjectId(req.params.id))
            return res.status(404).json({ error: "Not found" });
        res.json(await IntegrationLog_1.IntegrationLog.find({ invoiceId: req.params.id }).sort({ createdAt: 1 }));
    });
    // Terminal "failed" aaya push veendum queue cheyyaan. Idempotency-Key athu thanne -> duplicate invoice varilla.
    router.post("/invoices/:id/retry", guard, async (req, res) => {
        if (!mongoose_1.default.isValidObjectId(req.params.id))
            return res.status(404).json({ error: "Not found" });
        const invoice = await Invoice_1.Invoice.findOneAndUpdate({ _id: req.params.id, pushState: "failed" }, { pushState: "queued", pushAttempts: 0, nextAttemptAt: new Date(), $unset: { lastError: "" } }, { returnDocument: "after" });
        if (!invoice)
            return res.status(409).json({ error: "Invoice not found or push is not in failed state" });
        await IntegrationLog_1.IntegrationLog.create({ direction: "outbound", invoiceId: String(invoice._id), outcome: "manual_retry" });
        res.json(invoice);
    });
    return router;
}
