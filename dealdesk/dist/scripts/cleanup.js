"use strict";
var __importDefault = (this && this.__importDefault) || function (mod) {
    return (mod && mod.__esModule) ? mod : { "default": mod };
};
Object.defineProperty(exports, "__esModule", { value: true });
require("dotenv/config");
const mongoose_1 = __importDefault(require("mongoose"));
const Invoice_1 = require("../models/Invoice");
const IntegrationLog_1 = require("../models/IntegrationLog");
const WebhookEvent_1 = require("../models/WebhookEvent");
async function main() {
    await mongoose_1.default.connect(process.env.MONGO_URI);
    await Invoice_1.Invoice.deleteMany({});
    await IntegrationLog_1.IntegrationLog.deleteMany({});
    await WebhookEvent_1.WebhookEvent.deleteMany({});
    console.log("cleaned");
    await mongoose_1.default.disconnect();
}
main();
