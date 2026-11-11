import crypto from "crypto";

const secret = () => process.env.BILLPORT_SECRET || "";

export function sign(rawBody: Buffer | string): string {
  return crypto.createHmac("sha256", secret()).update(rawBody).digest("hex");
}

export function verify(rawBody: Buffer, signature: string): boolean {
  const expected = Buffer.from(sign(rawBody));
  const given = Buffer.from(signature);
  // timingSafeEqual: length samam allenkil error varum, athukondu aadyam length nokkunnu
  return expected.length === given.length && crypto.timingSafeEqual(expected, given);
}