import { sign } from "./signature";

export class PushError extends Error {}

// Idempotency-Key = invoiceId. Retry cheythaalum maarilla.
export async function pushInvoice(invoiceId: string, payload: object): Promise<string> {
  const body = JSON.stringify(payload);
  const res = await fetch(`${process.env.BILLPORT_URL}/billing/invoices`, {
    method: "POST",
    headers: {
      "Content-Type": "application/json",
      "Idempotency-Key": invoiceId,
      "X-Signature": sign(body),
    },
    body,
    // 6s-il response varunna BillPort-ine kaathirikkilla
    signal: AbortSignal.timeout(Number(process.env.PUSH_TIMEOUT_MS) || 3500),
  });
  if (res.status !== 201) throw new PushError(`BillPort responded ${res.status}`);
  const data = (await res.json()) as { externalId: string };
  return data.externalId;
}
export async function fetchInvoice(externalId: string): Promise<{ status: string; updatedAt: string }> {
    const res = await fetch(`${process.env.BILLPORT_URL}/billing/invoices/${externalId}`, {
      signal: AbortSignal.timeout(Number(process.env.PUSH_TIMEOUT_MS) || 3500),
    });
    if (!res.ok) throw new Error(`BillPort responded ${res.status}`);
    return (await res.json()) as { status: string; updatedAt: string };
  }