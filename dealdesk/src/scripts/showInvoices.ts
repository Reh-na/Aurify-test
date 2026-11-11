import "dotenv/config";
import mongoose from "mongoose";
import { Invoice } from "../models/Invoice";

async function main() {
  await mongoose.connect(process.env.MONGO_URI!);
  const invoices = await Invoice.find().sort({ createdAt: 1 });
  for (const i of invoices) {
    console.log(String(i._id), i.status, "seq:", i.lastSequence, "push:", i.pushState, "attempts:", i.pushAttempts, i.externalId ?? "-");
  }
  await mongoose.disconnect();
}

main();