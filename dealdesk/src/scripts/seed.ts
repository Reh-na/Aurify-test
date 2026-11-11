import "dotenv/config";
import mongoose from "mongoose";
import bcrypt from "bcryptjs";
import { Branch } from "../models/Branch";
import { Role } from "../models/Role";
import { User } from "../models/User";
import { Customer } from "../models/Customer";
import { Product } from "../models/Product";
import { Deal } from "../models/Deal";

const PASSWORD = "Password@123";
const ALL = (keys: string[]) => keys.map((key) => ({ key, scope: "all" }));

// Roles are plain data. Add/edit freely (or via POST /roles) - no code change needed.
const roles = [
  {
    name: "sales_exec",
    permissions: [
      { key: "deal.view", scope: "own" },
      { key: "deal.edit", scope: "own" },
      ...ALL(["chat.send"]),
    ],
    approvalLimit: 0,
  },
  {
    name: "sales_manager",
    permissions: [
      { key: "deal.view", scope: "branch" },
      { key: "deal.edit", scope: "own" },
      ...ALL(["discount.approve", "chat.send"]),
    ],
    approvalLimit: 25,
  },
  {
    name: "finance",
    permissions: [
      { key: "deal.view", scope: "all" }, // read-only: no deal.edit
      ...ALL(["discount.approve", "invoice.issue", "invoice.cancel", "chat.send"]),
    ],
    approvalLimit: 100,
  },
  {
    name: "admin",
    permissions: [
      { key: "deal.view", scope: "all" },
      { key: "deal.edit", scope: "all" },
      ...ALL(["discount.approve", "invoice.issue", "invoice.cancel", "chat.send", "role.manage", "approval.configure"]),
    ],
    approvalLimit: 100,
  },
];

async function main() {
  await mongoose.connect(process.env.MONGO_URI!);

  const [branchA, branchB] = await Promise.all(
    ["Branch A", "Branch B"].map((name) =>
      Branch.findOneAndUpdate({ name }, { name }, { upsert: true, returnDocument: "after" })
    )
  );
  const roleDocs: Record<string, any> = {};
  for (const r of roles) {
    roleDocs[r.name] = await Role.findOneAndUpdate({ name: r.name }, r, { upsert: true, returnDocument: "after" });
  }

  const passwordHash = await bcrypt.hash(PASSWORD, 10);
  const userSpecs = [
    { name: "Asha Exec (A)", email: "exec.a@dealdesk.test", role: "sales_exec", branch: branchA },
    { name: "Bilal Exec (B)", email: "exec.b@dealdesk.test", role: "sales_exec", branch: branchB },
    { name: "Meera Manager (A)", email: "manager.a@dealdesk.test", role: "sales_manager", branch: branchA },
    { name: "Farid Finance", email: "finance@dealdesk.test", role: "finance", branch: branchA },
    { name: "Ada Admin", email: "admin@dealdesk.test", role: "admin", branch: branchA },
  ];
  const users: Record<string, any> = {};
  for (const u of userSpecs) {
    users[u.email] = await User.findOneAndUpdate(
      { email: u.email },
      { name: u.name, email: u.email, passwordHash, roleId: roleDocs[u.role]._id, branchId: u.branch!._id },
      { upsert: true, returnDocument: "after" }
    );
  }

  const customers = [];
  for (const name of ["Northwind Traders", "Globex Industries", "Initech Ltd"]) {
    customers.push(await Customer.findOneAndUpdate({ name }, { $setOnInsert: { name, outstandingBalance: 10000 } }, { upsert: true, returnDocument: "after" }));
  }
  const products = [];
  for (const p of [
    { name: "Industrial Printer X1", sku: "PRN-X1", price: 4500 },
    { name: "Forklift F200", sku: "FLT-200", price: 18000 },
    { name: "Packaging Line P5", sku: "PKG-P5", price: 32000 },
  ]) {
    products.push(await Product.findOneAndUpdate({ sku: p.sku }, p, { upsert: true, returnDocument: "after" }));
  }

  const dealSpecs = [
    { title: "A1 - Printers for Northwind", owner: "exec.a@dealdesk.test", c: 0, p: 0, amount: 9000 },
    { title: "A2 - Forklifts for Globex", owner: "exec.a@dealdesk.test", c: 1, p: 1, amount: 36000 },
    { title: "A3 - Manager's own deal", owner: "manager.a@dealdesk.test", c: 2, p: 2, amount: 64000 },
    { title: "B1 - Printers for Initech", owner: "exec.b@dealdesk.test", c: 2, p: 0, amount: 4500 },
    { title: "B2 - Packaging for Globex", owner: "exec.b@dealdesk.test", c: 1, p: 2, amount: 32000 },
  ];
  for (const d of dealSpecs) {
    const owner = users[d.owner];
    await Deal.findOneAndUpdate(
      { title: d.title },
      { $setOnInsert: { title: d.title, customerId: customers[d.c]._id, productId: products[d.p]._id, amount: d.amount, ownerId: owner._id, branchId: owner.branchId } },
      { upsert: true }
    );
  }

  console.log("Seeded. All users have password:", PASSWORD);
  console.table(userSpecs.map((u) => ({ email: u.email, role: u.role, branch: u.branch!.name })));
  await mongoose.disconnect();
}

main();
