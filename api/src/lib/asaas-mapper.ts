import type { AsaasNormalizedCustomer, AsaasNormalizedPayment } from "./asaas-types.js";

function toNullableString(value: unknown) {
  if (value == null) {
    return null;
  }

  const text = String(value).trim();
  return text.length ? text : null;
}

function toNullableNumber(value: unknown) {
  if (value == null || value === "") {
    return null;
  }

  const num = Number(value);
  return Number.isFinite(num) ? num : null;
}

export function normalizeAsaasCustomer(payload: Record<string, unknown>): AsaasNormalizedCustomer {
  return {
    id: String(payload.id ?? ""),
    name: String(payload.name ?? payload.company ?? "Cliente Asaas"),
    email: toNullableString(payload.email),
    cpfCnpj: toNullableString(payload.cpfCnpj),
    mobilePhone: toNullableString(payload.mobilePhone ?? payload.phone)
  };
}

export function normalizeAsaasPayment(payload: Record<string, unknown>, customerName?: string | null): AsaasNormalizedPayment {
  const grossValue = toNullableNumber(payload.value) ?? 0;
  const netValue = toNullableNumber(payload.netValue);
  const feeValue =
    toNullableNumber(payload.fee) ??
    (grossValue && netValue != null ? Math.max(0, Number((grossValue - netValue).toFixed(2))) : null);

  return {
    id: String(payload.id ?? ""),
    customerId: toNullableString(payload.customer),
    customerName: customerName ?? toNullableString(payload.customerName),
    status: String(payload.status ?? "UNKNOWN"),
    description: toNullableString(payload.description),
    billingType: toNullableString(payload.billingType),
    grossValue,
    netValue,
    feeValue,
    dueDate: toNullableString(payload.dueDate),
    paymentDate: toNullableString(payload.paymentDate ?? payload.clientPaymentDate ?? payload.confirmedDate),
    invoiceUrl: toNullableString(payload.invoiceUrl)
  };
}
