import { describe, expect, it } from "vitest";
import { normalizeAsaasCustomer, normalizeAsaasPayment } from "../../api/src/lib/asaas-mapper.ts";

describe("asaas-mapper", () => {
  it("normalizes customer payload", () => {
    expect(
      normalizeAsaasCustomer({
        id: "cus_123",
        name: "Acme",
        email: "billing@acme.test",
        cpfCnpj: "12.345.678/0001-99"
      })
    ).toMatchObject({
      id: "cus_123",
      name: "Acme",
      email: "billing@acme.test",
      cpfCnpj: "12.345.678/0001-99"
    });
  });

  it("normalizes payment values and fee", () => {
    expect(
      normalizeAsaasPayment(
        {
          id: "pay_123",
          customer: "cus_123",
          status: "RECEIVED",
          value: 150,
          netValue: 145.5,
          dueDate: "2026-06-20",
          clientPaymentDate: "2026-06-21",
          billingType: "PIX",
          description: "June invoice"
        },
        "Acme"
      )
    ).toMatchObject({
      id: "pay_123",
      customerId: "cus_123",
      customerName: "Acme",
      grossValue: 150,
      netValue: 145.5,
      feeValue: 4.5,
      paymentDate: "2026-06-21"
    });
  });
});
