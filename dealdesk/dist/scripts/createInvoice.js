"use strict";
var __importDefault = (this && this.__importDefault) || function (mod) {
    return (mod && mod.__esModule) ? mod : { "default": mod };
};
Object.defineProperty(exports, "__esModule", { value: true });
require("dotenv/config");
const mongoose_1 = __importDefault(require("mongoose"));
const invoices_1 = require("../services/invoices");
// Usage: npx tsx src/scripts/createInvoice.ts [amount] [customerId]
// Deal convert simulate cheyyunnu: invoice local aayi undaakkum, push background worker cheyyum.
async function main() {
    const [amount, customerId] = process.argv.slice(2);
    await mongoose_1.default.connect(process.env.MONGO_URI);
    const inv = await (0, invoices_1.createInvoiceForDeal)({
        dealId: "deal-" + Date.now(),
        amount: Number(amount) || 5000,
        customerId,
    });
    console.log("created invoice", String(inv._id));
    await mongoose_1.default.disconnect();
}
main();
