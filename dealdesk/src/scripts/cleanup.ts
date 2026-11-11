import "dotenv/config";
import mongoose from "mongoose";
import { Invoice } from "../models/Invoice";
import { IntegrationLog } from "../models/IntegrationLog";
import { WebhookEvent } from "../models/WebhookEvent";

async function main() {
  await mongoose.connect(process.env.MONGO_URI!);
  await Invoice.deleteMany({});
  await IntegrationLog.deleteMany({});
  await WebhookEvent.deleteMany({});
  console.log("cleaned");
  await mongoose.disconnect();
}

main();