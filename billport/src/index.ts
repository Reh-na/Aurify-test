import express from "express";
import crypto from "crypto";

const app = express();
app.use(express.json());

const DEALDESK_WEBHOOK_URL =
  process.env.DEALDESK_WEBHOOK_URL || "http://localhost:3000/webhooks/billport";
const SHARED_SECRET = process.env.BILLPORT_SECRET || "dev-shared-secret-change-me";

const hmac = (body: string) =>
  crypto.createHmac("sha256", SHARED_SECRET).update(body).digest("hex");

const rand = (min: number, max: number) => min + Math.random() * (max - min);
const sleep = (ms: number) => new Promise((r) => setTimeout(r, ms));

type Invoice = {
  externalId: string;
  status: string;
  sequence: number; // ippol ethra vare ethi (GET status regress aakaathirikkaan)
  updatedAt: string;
  payload: unknown;
};

// In-memory "database"
const invoicesByKey = new Map<string, Invoice>(); // Idempotency-Key -> invoice
const invoicesById = new Map<string, Invoice>(); // externalId -> invoice

// Oru webhook ayakkunnu. 3s-il marupadi illenkil oru pravashyam retry.
async function deliver(body: string, signature: string, label: string) {
  for (let attempt = 1; attempt <= 2; attempt++) {
    try {
      const res = await fetch(DEALDESK_WEBHOOK_URL, {
        method: "POST",
        headers: { "Content-Type": "application/json", "X-Signature": signature },
        body,
        signal: AbortSignal.timeout(3000),
      });
      console.log(`[WEBHOOK] ${label} -> ${res.status} (attempt ${attempt})`);
      return;
    } catch {
      console.log(`[WEBHOOK] ${label} failed/timeout (attempt ${attempt})`);
    }
  }
}

// Oru invoice-inte life cycle: SENT -> VIEWED -> PAID/FAILED
function startLifecycle(invoice: Invoice) {
  const final = Math.random() < 0.8 ? "PAID" : "FAILED";
  const steps = [
    { status: "SENT", sequence: 1 },
    { status: "VIEWED", sequence: 2 },
    { status: final, sequence: 3 },
  ];

  // 30% samayam order maattum (PAID VIEWED-inu munpu varum)
  if (Math.random() < 0.3) [steps[1], steps[2]] = [steps[2]!, steps[1]!];

  let delay = 0;
  for (const step of steps) {
    delay += rand(5000, 30000);
    setTimeout(() => {
      // Webhook out-of-order aayi pokum, pakshe BillPort-inte "sathyam" (GET) pinnottu pokilla.
      if (step.sequence > invoice.sequence) {
        invoice.status = step.status;
        invoice.sequence = step.sequence;
        invoice.updatedAt = new Date().toISOString();
      }

      const body = JSON.stringify({
        eventId: "evt_" + crypto.randomUUID(),
        externalId: invoice.externalId,
        status: step.status,
        sequence: step.sequence,
        occurredAt: new Date().toISOString(),
      });

      const bad = Math.random() < 0.1; // 10% thettaaya signature
      const signature = bad ? "badsignature" : hmac(body);
      const label = `${step.status}#${step.sequence}${bad ? " (BAD SIG)" : ""}`;
      void deliver(body, signature, label);

      // 20% duplicate: same body, same eventId
      if (Math.random() < 0.2) {
        setTimeout(() => void deliver(body, signature, label + " (DUPLICATE)"), rand(200, 1500));
      }
    }, delay);
  }
}


app.post("/billing/invoices", async (req, res) => {
    const key = req.header("Idempotency-Key");
    const signature = req.header("X-Signature");
  
    if (!key || !signature) {
      return res.status(400).json({
        error: "Idempotency-Key and X-Signature required",
      });
    }
  
    // Check existing invoice before any delay
    const existing = invoicesByKey.get(key);
  
    if (existing) {
      console.log(`[REPLAY] key=${key} -> ${existing.externalId}`);
  
      return res.status(201).json({
        externalId: existing.externalId,
        status: existing.status,
      });
    }
  
    const roll = Math.random();
  
    // 15% failure simulation
    if (roll < 0.15) {
      console.log(`[503] key=${key}`);
  
      return res.status(503).json({
        error: "Service unavailable",
      });
    }
  
    // Create invoice immediately before waiting
    const invoice: Invoice = {
      externalId: "ext_" + crypto.randomUUID(),
      status: "QUEUED",
      sequence: 0,
      updatedAt: new Date().toISOString(),
      payload: req.body,
    };
  
    // Reserve the key immediately
    invoicesByKey.set(key, invoice);
    invoicesById.set(invoice.externalId, invoice);
  
    startLifecycle(invoice);
  
    // 10% slow response simulation
    if (roll < 0.25) {
      console.log(`[SLOW] key=${key}`);
      await sleep(6000);
    }
  
    console.log(`[CREATED] key=${key} -> ${invoice.externalId}`);
  
    return res.status(201).json({
      externalId: invoice.externalId,
      status: invoice.status,
    });
  });
  

app.get("/billing/invoices/:externalId", (req, res) => {
  const invoice = invoicesById.get(req.params.externalId);
  if (!invoice) return res.status(404).json({ error: "Not found" });
  res.json({
    externalId: invoice.externalId,
    status: invoice.status,
    updatedAt: invoice.updatedAt,
  });
});

app.listen(4000, () => console.log("BillPort on http://localhost:4000"));