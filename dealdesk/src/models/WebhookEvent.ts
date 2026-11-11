import { Schema, model } from "mongoose";

// eventId-inu UNIQUE index. Same eventId randaam pravashyam insert cheythaal Mongo error tharum.
const webhookEventSchema = new Schema(
  { eventId: { type: String, required: true, unique: true } },
  { timestamps: true }
);

export const WebhookEvent = model("WebhookEvent", webhookEventSchema);