"use strict";
Object.defineProperty(exports, "__esModule", { value: true });
exports.Branch = void 0;
const mongoose_1 = require("mongoose");
const branchSchema = new mongoose_1.Schema({ name: { type: String, required: true, unique: true } }, { timestamps: true });
exports.Branch = (0, mongoose_1.model)("Branch", branchSchema);
