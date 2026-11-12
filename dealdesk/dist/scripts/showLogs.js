"use strict";
var __importDefault = (this && this.__importDefault) || function (mod) {
    return (mod && mod.__esModule) ? mod : { "default": mod };
};
Object.defineProperty(exports, "__esModule", { value: true });
require("dotenv/config");
const mongoose_1 = __importDefault(require("mongoose"));
const IntegrationLog_1 = require("../models/IntegrationLog");
async function main() {
    await mongoose_1.default.connect(process.env.MONGO_URI);
    const logs = await IntegrationLog_1.IntegrationLog.find().sort({ createdAt: 1 });
    for (const l of logs) {
        console.log(l.createdAt?.toISOString(), l.direction, l.eventId ?? "-", l.outcome, l.detail ?? "");
    }
    await mongoose_1.default.disconnect();
}
main();
