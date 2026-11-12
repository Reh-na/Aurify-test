"use strict";
Object.defineProperty(exports, "__esModule", { value: true });
exports.WebhookEvent = void 0;
const mongoose_1 = require("mongoose");
// eventId-inu UNIQUE index. Same eventId randaam pravashyam insert cheythaal Mongo error tharum.
const webhookEventSchema = new mongoose_1.Schema({ eventId: { type: String, required: true, unique: true } }, { timestamps: true });
exports.WebhookEvent = (0, mongoose_1.model)("WebhookEvent", webhookEventSchema);
