import "dotenv/config";
import mongoose from "mongoose";
import { IntegrationLog } from "../models/IntegrationLog";

async function main() {
  await mongoose.connect(process.env.MONGO_URI!);
  const logs = await IntegrationLog.find().sort({ createdAt: 1 });
  for (const l of logs) {
    console.log(l.createdAt?.toISOString(), l.direction, l.eventId ?? "-", l.outcome, l.detail ?? "");
  }
  await mongoose.disconnect();
}

main();