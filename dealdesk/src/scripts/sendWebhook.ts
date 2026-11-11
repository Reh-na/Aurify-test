import "dotenv/config";
import mongoose from "mongoose";
import { Invoice } from "../models/Invoice";
import { sign } from "../services/signature";

// Usage: npx tsx src/scripts/sendWebhook.ts <eventId> <STATUS> <sequence> [bad]
async function main() {
  const [eventId, status, sequence, bad] = process.argv.slice(2);
  await mongoose.connect(process.env.MONGO_URI!);

  // test invoice illenkil undaakkum
  await Invoice.updateOne(
    { externalId: "ext_test" },
    { $setOnInsert: { dealId: "test-deal", amount: 100, externalId: "ext_test" } },
    { upsert: true }
  );

  const body = JSON.stringify({
    eventId,
    externalId: "ext_test",
    status,
    sequence: Number(sequence),
    occurredAt: new Date().toISOString(),
  });
  // "bad" koduthaal thettaaya signature
  const signature = bad === "bad" ? "deadbeef" : sign(body);

  const res = await fetch(`http://localhost:${process.env.PORT || 3000}/webhooks/billport`, {
    method: "POST",
    headers: { "Content-Type": "application/json", "X-Signature": signature },
    body,
  });
  console.log("HTTP", res.status);

  await new Promise((r) => setTimeout(r, 500)); // async processing-inu kaathirikkunnu
  const inv = await Invoice.findOne({ externalId: "ext_test" });
  console.log("invoice:", inv?.status, "lastSequence:", inv?.lastSequence);
  await mongoose.disconnect();
}

main();