import { beforeEach, describe, expect, it, vi } from "vitest";

const prismaMock = {
  client: {
    findFirst: vi.fn(),
    create: vi.fn()
  },
  erpSyncRecord: {
    upsert: vi.fn()
  }
};

const resolveAsaasConnectionMock = vi.fn();
const touchAsaasLastSyncMock = vi.fn();
const listCustomersMock = vi.fn();
const listPaymentsMock = vi.fn();

vi.mock("../../api/src/lib/prisma.js", () => ({
  prisma: prismaMock
}));

vi.mock("../../api/src/lib/asaas-connections.js", () => ({
  resolveAsaasConnection: resolveAsaasConnectionMock,
  touchAsaasLastSync: touchAsaasLastSyncMock
}));

vi.mock("../../api/src/lib/asaas-client.ts", () => ({
  AsaasClient: class {
    listCustomers = listCustomersMock;
    listPayments = listPaymentsMock;
  }
}));

describe("asaas-sync-service", () => {
  beforeEach(() => {
    vi.clearAllMocks();
    resolveAsaasConnectionMock.mockResolvedValue({
      id: "conn-1",
      provider: "ASAAS",
      environment: "SANDBOX",
      baseUrl: "https://api-sandbox.asaas.com/v3",
      apiKey: "$aact_hmlg_secret"
    });
  });

  it("syncs customers and payments", async () => {
    prismaMock.client.findFirst.mockResolvedValue(null);
    prismaMock.client.create.mockResolvedValue({ id: "client-1", name: "Acme" });
    prismaMock.erpSyncRecord.upsert.mockResolvedValue({ id: "sync-1" });
    listCustomersMock.mockResolvedValue({
      data: [{ id: "cus_1", name: "Acme", email: "billing@acme.test" }]
    });
    listPaymentsMock.mockResolvedValue({
      data: [{ id: "pay_1", customer: "cus_1", status: "RECEIVED", value: 100, netValue: 97, fee: 3 }]
    });

    const { syncAsaasData } = await import("../../api/src/lib/asaas-sync-service.ts");
    const result = await syncAsaasData({
      companyId: "company-1",
      environment: "SANDBOX",
      triggeredByUserId: "user-1"
    });

    expect(result.counts.customers).toBe(1);
    expect(result.counts.charges).toBe(1);
    expect(result.counts.payments).toBe(1);
    expect(result.counts.fees).toBe(1);
    expect(prismaMock.erpSyncRecord.upsert).toHaveBeenCalled();
    expect(touchAsaasLastSyncMock).toHaveBeenCalledOnce();
  });
});
