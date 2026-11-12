"use strict";
var __importDefault = (this && this.__importDefault) || function (mod) {
    return (mod && mod.__esModule) ? mod : { "default": mod };
};
Object.defineProperty(exports, "__esModule", { value: true });
exports.sign = sign;
exports.verify = verify;
const crypto_1 = __importDefault(require("crypto"));
const secret = () => process.env.BILLPORT_SECRET || "";
function sign(rawBody) {
    return crypto_1.default.createHmac("sha256", secret()).update(rawBody).digest("hex");
}
function verify(rawBody, signature) {
    const expected = Buffer.from(sign(rawBody));
    const given = Buffer.from(signature);
    // timingSafeEqual: length samam allenkil error varum, athukondu aadyam length nokkunnu
    return expected.length === given.length && crypto_1.default.timingSafeEqual(expected, given);
}
