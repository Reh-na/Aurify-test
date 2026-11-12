"use strict";
Object.defineProperty(exports, "__esModule", { value: true });
exports.IntegrationLog = void 0;
const mongoose_1 = require("mongoose");
const integrationLogSchema = new mongoose_1.Schema({
    direction: { type: String, enum: ["inbound", "outbound"], required: true },
    invoiceId: { type: String, index: true },
    externalId: { type: String },
    eventId: { type: String },
    payload: { type: mongoose_1.Schema.Types.Mixed },
    response: { type: mongoose_1.Schema.Types.Mixed }, // BillPort-inte marupadi (status code / body)
    outcome: { type: String, required: true }, // applied, ignored_duplicate, ignored_stale, rejected_signature ...
    detail: { type: String },
}, { timestamps: true });
exports.IntegrationLog = (0, mongoose_1.model)("IntegrationLog", integrationLogSchema);
