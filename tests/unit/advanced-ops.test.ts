import { describe, expect, it } from "vitest";
import {
  allocateLegalEntity,
  classifyReconciliationMovement,
  detectBillableServiceOrders,
  detectDueContracts
} from "../../api/src/lib/advanced-ops.js";

describe("advanced-ops", () => {
  it("detects due contracts and suppresses duplicates already turned into drafts", () => {
    const items = detectDueContracts({
      contracts: [
        {
          originId: "contract-1",
          businessClientId: "client-1",
          businessClientName: "Client A",
          amount: 100,
          dueDate: "2026-06-10",
          category: "Recorrencia",
          description: "Mensalidade",
          scheduleReason: "monthly_due"
        },
        {
          originId: "contract-2",
          businessClientId: "client-1",
          businessClientName: "Client A",
          amount: 100,
          dueDate: "2026-06-12",
          category: "Recorrencia",
          description: "Futuro",
          scheduleReason: "future"
        }
      ],
      existingDrafts: [
        {
          rawPayload: {
            _advancedOps: {
              originId: "contract-1"
            }
          }
        }
      ],
      referenceDate: new Date("2026-06-10T12:00:00.000Z")
    });

    expect(items).toHaveLength(0);
  });

  it("detects faturavel service orders only once", () => {
    const items = detectBillableServiceOrders({
      serviceOrders: [
        {
          originId: "os-1",
          businessClientId: "client-1",
          businessClientName: "Client A",
          amount: 80,
          dueDate: "2026-06-10",
          category: "Projeto",
          description: "OS 1",
          faturavel: true
        },
        {
          originId: "os-2",
          businessClientId: "client-1",
          businessClientName: "Client A",
          amount: 90,
          dueDate: "2026-06-10",
          category: "Projeto",
          description: "OS 2",
          faturavel: false
        }
      ],
      existingDrafts: []
    });

    expect(items).toHaveLength(1);
    expect(items[0]?.originId).toBe("os-1");
  });

  it("allocates legal entity with group and cap logic", () => {
    const allocation = allocateLegalEntity({
      amount: 500,
      tags: ["enterprise"],
      legalEntities: [
        { id: "legal-1", isDefault: true },
        { id: "legal-2", isDefault: false }
      ],
      rule: {
        strategy: "GROUP",
        groupMap: [{ legalEntityId: "legal-2", tag: "enterprise" }]
      }
    });

    expect(allocation.legalEntityId).toBe("legal-2");
  });

  it("classifies reconciliation movement as fee when fee label matches", () => {
    const result = classifyReconciliationMovement({
      movement: {
        id: "mv-1",
        direction: "OUT",
        amount: 10,
        description: "Asaas fee June",
        occurredAt: "2026-06-10"
      },
      candidates: [],
      knownFeeLabels: ["asaas fee"]
    });

    expect(result.classification).toBe("fee");
    expect(result.matchedCandidateId).toBeNull();
  });
});
