"use strict";
var __importDefault = (this && this.__importDefault) || function (mod) {
    return (mod && mod.__esModule) ? mod : { "default": mod };
};
Object.defineProperty(exports, "__esModule", { value: true });
require("dotenv/config");
const mongoose_1 = __importDefault(require("mongoose"));
const Invoice_1 = require("../models/Invoice");
async function main() {
    await mongoose_1.default.connect(process.env.MONGO_URI);
    const invoices = await Invoice_1.Invoice.find().sort({ createdAt: 1 });
    for (const i of invoices) {
        console.log(String(i._id), i.status, "seq:", i.lastSequence, "push:", i.pushState, "attempts:", i.pushAttempts, i.externalId ?? "-");
    }
    await mongoose_1.default.disconnect();
}
main();
