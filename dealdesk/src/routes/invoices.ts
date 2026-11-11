import { RequestHandler, Router } from "express";
import mongoose from "mongoose";
import { Invoice, INVOICE_STATUSES, PUSH_STATES } from "../models/Invoice";
import { IntegrationLog } from "../models/IntegrationLog";

// Part 1-le reusable guard ivide pass cheyyuka: createInvoiceRouter(requirePermission)
// Guard illenkil (standalone test) open aayi irikkum.
type GuardFactory = (permission: string) => RequestHandler;
const open: GuardFactory = () => (_req, _res, next) => next();

export function createInvoiceRouter(requirePermission: GuardFactory = open) {
  const router = Router();
  const guard = requirePermission("invoice.issue");

  // Failed push-ukal kaanaan: GET /invoices?pushState=failed
  router.get("/invoices", guard, async (req, res) => {
    const filter: Record<string, unknown> = {};
    const { pushState, status } = req.query;
    if (typeof pushState === "string" && (PUSH_STATES as readonly string[]).includes(pushState)) filter.pushState = pushState;
    if (typeof status === "string" && (INVOICE_STATUSES as readonly string[]).includes(status)) filter.status = status;
    res.json(await Invoice.find(filter).sort({ createdAt: -1 }).limit(100));
  });

  router.get("/invoices/:id", guard, async (req, res) => {
    if (!mongoose.isValidObjectId(req.params.id)) return res.status(404).json({ error: "Not found" });
    const invoice = await Invoice.findById(req.params.id);
    if (!invoice) return res.status(404).json({ error: "Not found" });
    res.json(invoice);
  });

  // "Ee invoice enthukondu unpaid?" -> ithu thanne uttharam
  router.get("/invoices/:id/logs", guard, async (req, res) => {
    if (!mongoose.isValidObjectId(req.params.id)) return res.status(404).json({ error: "Not found" });
    res.json(await IntegrationLog.find({ invoiceId: req.params.id }).sort({ createdAt: 1 }));
  });

  // Terminal "failed" aaya push veendum queue cheyyaan. Idempotency-Key athu thanne -> duplicate invoice varilla.
  router.post("/invoices/:id/retry", guard, async (req, res) => {
    if (!mongoose.isValidObjectId(req.params.id)) return res.status(404).json({ error: "Not found" });
    const invoice = await Invoice.findOneAndUpdate(
      { _id: req.params.id, pushState: "failed" },
      { pushState: "queued", pushAttempts: 0, nextAttemptAt: new Date(), $unset: { lastError: "" } },
      { returnDocument: "after" }
    );
    if (!invoice) return res.status(409).json({ error: "Invoice not found or push is not in failed state" });
    await IntegrationLog.create({ direction: "outbound", invoiceId: String(invoice._id), outcome: "manual_retry" });
    res.json(invoice);
  });

  return router;
}
