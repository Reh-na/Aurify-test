"use strict";
var __importDefault = (this && this.__importDefault) || function (mod) {
    return (mod && mod.__esModule) ? mod : { "default": mod };
};
Object.defineProperty(exports, "__esModule", { value: true });
require("dotenv/config");
const express_1 = __importDefault(require("express"));
const mongoose_1 = __importDefault(require("mongoose"));
const webhooks_1 = __importDefault(require("./routes/webhooks"));
const invoices_1 = require("./routes/invoices");
const auth_1 = __importDefault(require("./routes/auth"));
const deals_1 = __importDefault(require("./routes/deals"));
const admin_1 = __importDefault(require("./routes/admin"));
const auth_2 = require("./middleware/auth");
const pushWorker_1 = require("./services/pushWorker");
const reconciler_1 = require("./services/reconciler");
const app = (0, express_1.default)();
// Webhook router express.json()-inu MUNPU. Allenkil body parse aayi raw body poyi pokum,
// signature verify cheyyaan pattilla.
app.use(webhooks_1.default);
app.use(express_1.default.json());
app.use(auth_1.default);
app.use(deals_1.default);
app.use(admin_1.default);
// Part 4 invoice routes now sit behind the same permission guard (invoice.issue)
app.use((0, invoices_1.createInvoiceRouter)(auth_2.requirePermission));
app.get("/health", (_req, res) => {
    res.json({ ok: true });
});
async function main() {
    await mongoose_1.default.connect(process.env.MONGO_URI);
    console.log("Mongo connected");
    const port = Number(process.env.PORT) || 3000;
    app.listen(port, () => console.log(`DealDesk on http://localhost:${port}`));
    (0, pushWorker_1.startPushWorker)();
    (0, reconciler_1.startReconciler)();
}
main();
