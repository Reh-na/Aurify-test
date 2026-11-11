import { Router } from "express";
import mongoose from "mongoose";
import { Deal, DEAL_STATUSES } from "../models/Deal";
import { Customer } from "../models/Customer";
import { requirePermission } from "../middleware/auth";
import { scopeFilter } from "../services/scope";

const router = Router();
const validId = (id: unknown) => typeof id === "string" && mongoose.isValidObjectId(id);

// LIST - scope is part of the Mongo query, never an array filter after fetching
router.get("/deals", requirePermission("deal.view"), async (req, res) => {
  const filter: Record<string, unknown> = { ...scopeFilter(req.user!, "deal.view") };
  const { status } = req.query;
  if (typeof status === "string" && (DEAL_STATUSES as readonly string[]).includes(status)) {
    filter.status = status;
  }
  res.json(await Deal.find(filter).sort({ createdAt: -1 }).limit(200));
});

// DETAIL - same scope in the query. Out-of-scope id looks exactly like a missing id (404),
// so nobody can even probe which ids exist.
router.get("/deals/:id", requirePermission("deal.view"), async (req, res) => {
  if (!validId(req.params.id)) return res.status(404).json({ error: "Not found" });
  const deal = await Deal.findOne({
    _id: req.params.id,
    ...scopeFilter(req.user!, "deal.view"),
  });
  if (!deal) return res.status(404).json({ error: "Not found" });
  res.json(deal);
});

// CREATE - owner and branch always come from the logged-in user, never from the body
router.post("/deals", requirePermission("deal.edit"), async (req, res) => {
  const { title, customerId, productId, amount } = req.body ?? {};
  if (typeof title !== "string" || !title.trim()) return res.status(400).json({ error: "title required" });
  if (!validId(customerId)) return res.status(400).json({ error: "valid customerId required" });
  if (typeof amount !== "number" || amount < 0) return res.status(400).json({ error: "amount must be a number >= 0" });
  if (productId !== undefined && !validId(productId)) return res.status(400).json({ error: "invalid productId" });
  if (!(await Customer.exists({ _id: customerId }))) return res.status(400).json({ error: "customer not found" });

  const deal = await Deal.create({
    title: title.trim(),
    customerId,
    productId,
    amount,
    ownerId: req.user!.id,
    branchId: req.user!.branchId,
  });
  res.status(201).json(deal);
});

// EDIT - the edit scope is inside the update filter itself, so it is atomic (no check-then-write gap)
router.patch("/deals/:id", requirePermission("deal.edit"), async (req, res) => {
  if (!validId(req.params.id)) return res.status(404).json({ error: "Not found" });
  const user = req.user!;

  const editable = await Deal.findOne({ _id: req.params.id, ...scopeFilter(user, "deal.edit") });
  if (!editable) {
    // can they at least see it? then 403, otherwise pretend it does not exist
    const visible = user.permissions.has("deal.view")
      ? await Deal.exists({ _id: req.params.id, ...scopeFilter(user, "deal.view") })
      : null;
    return visible
      ? res.status(403).json({ error: "You cannot edit this deal" })
      : res.status(404).json({ error: "Not found" });
  }
  if (editable.status !== "open") return res.status(409).json({ error: `Deal is ${editable.status}, only open deals can be edited` });

  // whitelist - status/owner/branch/discount are never client-editable here
  const update: Record<string, unknown> = {};
  const { title, amount, customerId, productId } = req.body ?? {};
  if (typeof title === "string" && title.trim()) update.title = title.trim();
  if (typeof amount === "number" && amount >= 0) update.amount = amount;
  if (validId(customerId)) update.customerId = customerId;
  if (validId(productId)) update.productId = productId;
  if (Object.keys(update).length === 0) return res.status(400).json({ error: "nothing to update" });

  const updated = await Deal.findOneAndUpdate(
    { _id: req.params.id, status: "open", ...scopeFilter(user, "deal.edit") },
    { $set: update },
    { returnDocument: "after" }
  );
  if (!updated) return res.status(409).json({ error: "Deal changed, retry" });
  res.json(updated);
});

export default router;
