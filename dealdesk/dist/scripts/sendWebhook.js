"use strict";
var __importDefault = (this && this.__importDefault) || function (mod) {
    return (mod && mod.__esModule) ? mod : { "default": mod };
};
Object.defineProperty(exports, "__esModule", { value: true });
require("dotenv/config");
const mongoose_1 = __importDefault(require("mongoose"));
const Invoice_1 = require("../models/Invoice");
const signature_1 = require("../services/signature");
// Usage: npx tsx src/scripts/sendWebhook.ts <eventId> <STATUS> <sequence> [bad]
async function main() {
    const [eventId, status, sequence, bad] = process.argv.slice(2);
    await mongoose_1.default.connect(process.env.MONGO_URI);
    // test invoice illenkil undaakkum
    await Invoice_1.Invoice.updateOne({ externalId: "ext_test" }, { $setOnInsert: { dealId: "test-deal", amount: 100, externalId: "ext_test" } }, { upsert: true });
    const body = JSON.stringify({
        eventId,
        externalId: "ext_test",
        status,
        sequence: Number(sequence),
        occurredAt: new Date().toISOString(),
    });
    // "bad" koduthaal thettaaya signature
    const signature = bad === "bad" ? "deadbeef" : (0, signature_1.sign)(body);
    const res = await fetch(`http://localhost:${process.env.PORT || 3000}/webhooks/billport`, {
        method: "POST",
        headers: { "Content-Type": "application/json", "X-Signature": signature },
        body,
    });
    console.log("HTTP", res.status);
    await new Promise((r) => setTimeout(r, 500)); // async processing-inu kaathirikkunnu
    const inv = await Invoice_1.Invoice.findOne({ externalId: "ext_test" });
    console.log("invoice:", inv?.status, "lastSequence:", inv?.lastSequence);
    await mongoose_1.default.disconnect();
}
main();
