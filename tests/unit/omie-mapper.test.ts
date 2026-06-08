import { describe, expect, it } from "vitest";
import { mapOmieDraftPayload, normalizeOmieLookupLabel } from "../../api/src/lib/omie-mapper.ts";

describe("omie-mapper", () => {
  it("maps payable draft to minimal OMIE payload", () => {
    const payload = mapOmieDraftPayload({
      draft: {
        id: "draft-1",
        direction: "CONTA_PAGAR",
        amount: 150.55,
        dueDate: new Date("2026-06-15T12:00:00Z"),
        description: "Infra bill",
        notes: "manual review ok"
      },
      partyExternalId: "3795260786",
      categoryExternalId: "2.04.01",
      currentAccountExternalId: "3731356020"
    });

    expect(payload).toMatchObject({
      codigo_lancamento_integracao: "draft-1",
      codigo_cliente_fornecedor: 3795260786,
      valor_documento: 150.55,
      codigo_categoria: "2.04.01",
      id_conta_corrente: 3731356020,
      observacao: "manual review ok"
    });
    expect(payload.data_vencimento).toBe("15/06/2026");
    expect(payload.data_previsao).toBe("15/06/2026");
  });

  it("normalizes accents and case for catalog matching", () => {
    expect(normalizeOmieLookupLabel(" Produção Árvore ")).toBe("producao arvore");
  });
});
