import { EventEmitter } from "events";

// Chat + notifications ellaam ORU event bus-ilude pokanam (Part 3).
// Part 4 ivide EMIT mathram cheyyum. Socket layer ithu SUBSCRIBE cheyth room-ilekku ayakkum.
export interface InvoiceStatusChanged {
  invoiceId: string;
  dealId: string;
  ownerId?: string | null;
  customerId?: string | null;
  externalId?: string | null;
  status: string;
}

export interface InvoicePushFailed {
  invoiceId: string;
  dealId: string;
  ownerId?: string | null;
  attempts: number;
  error: string;
}

type EventMap = {
  "invoice.status_changed": [InvoiceStatusChanged];
  "invoice.push_failed": [InvoicePushFailed];
};

class TypedBus extends EventEmitter {
  emit<K extends keyof EventMap>(event: K, ...args: EventMap[K]): boolean {
    return super.emit(event, ...args);
  }
  on<K extends keyof EventMap>(event: K, listener: (...args: EventMap[K]) => void): this {
    return super.on(event, listener as (...a: any[]) => void);
  }
}

export const eventBus = new TypedBus();
