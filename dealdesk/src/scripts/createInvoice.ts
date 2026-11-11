import "dotenv/config";
import mongoose from "mongoose";
import { createInvoiceForDeal } from "../services/invoices";

// Usage: npx tsx src/scripts/createInvoice.ts [amount] [customerId]
// Deal convert simulate cheyyunnu: invoice local aayi undaakkum, push background worker cheyyum.
async function main() {
  const [amount, customerId] = process.argv.slice(2);
  await mongoose.connect(process.env.MONGO_URI!);
  const inv = await createInvoiceForDeal({
    dealId: "deal-" + Date.now(),
    amount: Number(amount) || 5000,
    customerId,
  });
  console.log("created invoice", String(inv!._id));
  await mongoose.disconnect();
}

main();
