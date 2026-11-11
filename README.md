## Part 1 — Permissions & data scope

**Run:** `npm run seed` (idempotent; all users use password `Password@123`), then `npm run dev`.
Login at `POST /auth/login` → `{ token }`, send as `Authorization: Bearer <token>`.

| user | role | branch | `deal.view` scope |
|---|---|---|---|
| exec.a@dealdesk.test | sales_exec | A | own |
| exec.b@dealdesk.test | sales_exec | B | own |
| manager.a@dealdesk.test | sales_manager | A | branch |
| finance@dealdesk.test | finance | A | all (read-only) |
| admin@dealdesk.test | admin | A | all |

**Model.** A `Role` document is `{ name, permissions: [{ key, scope }], approvalLimit }`. Permission keys are fixed
(`deal.view`, `deal.edit`, `discount.approve`, `invoice.issue`, `invoice.cancel`, `chat.send`, plus `role.manage`,
`approval.configure` for admins); roles are data. A new role is `POST /roles` — no code change. No business logic
branches on a role name.

**One guard.** `requirePermission("deal.view")` (src/middleware/auth.ts) verifies the JWT, loads user + role from the DB on
every request (token holds only the user id, so role edits apply immediately), and returns 401 / 403.
Part 4's `createInvoiceRouter(requirePermission)` uses the same guard.

**Scope in the query.** `scopeFilter(user, permission)` returns `{ownerId}` / `{branchId}` / `{}` and is merged into the
Mongo filter: `Deal.find({...scope})`, `Deal.findOne({_id, ...scope})`, and for edits `findOneAndUpdate({_id, status:"open", ...scope})`.
Nothing is filtered in JS after fetching. It fails closed (no permission → matches nothing).
`ownerId` and `branchId` are stamped on the deal from the logged-in user at creation, never from the request body.

**No leak by id.** An out-of-scope `GET /deals/:id` returns 404, identical to a non-existent id. For `PATCH`, a deal you can
see but not edit gives 403; one you cannot see gives 404.
