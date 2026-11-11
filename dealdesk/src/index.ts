import "dotenv/config";
import express from "express";
import mongoose from "mongoose";
import webhookRouter from "./routes/webhooks";
import { createInvoiceRouter } from "./routes/invoices";
import authRouter from "./routes/auth";
import dealsRouter from "./routes/deals";
import adminRouter from "./routes/admin";
import { requirePermission } from "./middleware/auth";
import { startPushWorker } from "./services/pushWorker";
import { startReconciler } from "./services/reconciler";
const app = express();

// Webhook router express.json()-inu MUNPU. Allenkil body parse aayi raw body poyi pokum,
// signature verify cheyyaan pattilla.
app.use(webhookRouter);
app.use(express.json());

app.use(authRouter);
app.use(dealsRouter);
app.use(adminRouter);
// Part 4 invoice routes now sit behind the same permission guard (invoice.issue)
app.use(createInvoiceRouter(requirePermission));

app.get("/health", (_req, res) => {
  res.json({ ok: true });
});

async function main() {
  await mongoose.connect(process.env.MONGO_URI!);
  console.log("Mongo connected");
  const port = Number(process.env.PORT) || 3000;
  app.listen(port, () => console.log(`DealDesk on http://localhost:${port}`));
  startPushWorker();
  startReconciler();
}

main();
