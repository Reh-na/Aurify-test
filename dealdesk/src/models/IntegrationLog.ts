import { Schema, model } from "mongoose";

const integrationLogSchema = new Schema(
  {
    direction: { type: String, enum: ["inbound", "outbound"], required: true },
    invoiceId: { type: String, index: true },
    externalId: { type: String },
    eventId: { type: String },
    payload: { type: Schema.Types.Mixed },
    response: { type: Schema.Types.Mixed }, // BillPort-inte marupadi (status code / body)
    outcome: { type: String, required: true }, // applied, ignored_duplicate, ignored_stale, rejected_signature ...
    detail: { type: String },
  },
  { timestamps: true }
);

export const IntegrationLog = model("IntegrationLog", integrationLogSchema);
