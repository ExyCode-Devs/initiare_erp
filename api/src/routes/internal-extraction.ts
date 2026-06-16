import type { FastifyPluginAsync } from "fastify";
import { z } from "zod";

const attachmentSchema = z.object({
  id: z.string(),
  filename: z.string(),
  mimeType: z.string(),
  extractedText: z.string().nullable()
});

const requestSchema = z.object({
  company: z.object({
    id: z.string(),
    name: z.string(),
    domain: z.string()
  }),
  email: z.object({
    id: z.string(),
    sender: z.string(),
    recipients: z.array(z.string()),
    subject: z.string(),
    bodyText: z.string(),
    receivedAt: z.string()
  }),
  attachments: z.array(attachmentSchema),
  context: z.object({
    knownSuppliers: z.array(z.string()),
    knownClients: z.array(z.string()),
    knownCategories: z.array(z.string()),
    hints: z.array(z.string()).optional()
  })
});

function pickType(text: string) {
  const lowered = text.toLowerCase();
  const receivableHits = ["conta_receber", "conta receber", "cobranca para o cliente", "a receber", "cliente:"];
  const payableHits = ["conta_pagar", "conta pagar", "boleto", "fatura", "fornecedor:", "pagamento"];

  if (receivableHits.some((token) => lowered.includes(token))) {
    return "conta_receber" as const;
  }

  if (payableHits.some((token) => lowered.includes(token))) {
    return "conta_pagar" as const;
  }

  return "conta_pagar" as const;
}

function pickAmount(text: string) {
  const currencyMatch = text.match(/r\$\s*([\d.]+,\d{2})/i);
  if (currencyMatch) {
    return Number(currencyMatch[1].replace(/\./g, "").replace(",", "."));
  }

  const plainMatch = text.match(/\bvalor[:\s]*([\d]+(?:[.,]\d{2})?)\b/i);
  if (plainMatch) {
    return Number(plainMatch[1].replace(",", "."));
  }

  return null;
}

function pickDueDate(text: string) {
  const isoMatch = text.match(/\b(20\d{2}-\d{2}-\d{2})\b/);
  if (isoMatch) {
    return isoMatch[1];
  }

  const brMatch = text.match(/\b(\d{2})\/(\d{2})\/(20\d{2})\b/);
  if (brMatch) {
    return `${brMatch[3]}-${brMatch[2]}-${brMatch[1]}`;
  }

  return null;
}

function pickCpfCnpj(text: string) {
  const match = text.match(/\b\d{2}\.\d{3}\.\d{3}\/\d{4}-\d{2}\b/);
  return match?.[0] ?? null;
}

function pickPartyName(text: string, sender: string, type: "conta_pagar" | "conta_receber") {
  const labelMatches =
    type === "conta_receber"
      ? [text.match(/cliente:\s*([^\n\r]+)/i), text.match(/cliente\s+([A-Z][^\n\r]+)/i)]
      : [text.match(/fornecedor:\s*([^\n\r]+)/i), text.match(/de\s+([A-Z][^\n\r]+)/i)];

  const explicit = labelMatches.map((item) => item?.[1]?.trim()).find(Boolean);
  if (explicit) {
    return explicit;
  }

  const senderName = sender.match(/^"?([^"<]+)"?\s*</)?.[1]?.trim();
  return senderName && senderName.length > 1 ? senderName : sender;
}

function pickCategory(text: string, categories: string[]) {
  const lowered = text.toLowerCase();

  for (const category of categories) {
    if (lowered.includes(category.toLowerCase())) {
      return category;
    }
  }

  if (lowered.includes("software")) {
    return "Software";
  }
  if (lowered.includes("servic")) {
    return "Servicos";
  }
  if (lowered.includes("marketing")) {
    return "Marketing";
  }

  return "A classificar";
}

const internalExtractionRoutes: FastifyPluginAsync = async (app) => {
  app.post("/internal/extraction-sync", async (request) => {
    const payload = requestSchema.parse(request.body);
    const attachmentText = payload.attachments.map((item) => item.extractedText ?? "").filter(Boolean).join("\n");
    const combinedText = [payload.email.subject, payload.email.bodyText, attachmentText].filter(Boolean).join("\n");

    const type = pickType(combinedText);
    const partyName = pickPartyName(combinedText, payload.email.sender, type);
    const amount = pickAmount(combinedText);
    const dueDate = pickDueDate(combinedText);
    const cpfCnpj = pickCpfCnpj(combinedText);
    const suggestedCategory = pickCategory(combinedText, payload.context.knownCategories);

    const evidence = [
      amount != null ? `Detected amount ${amount}` : "Amount not found",
      dueDate ? `Detected due date ${dueDate}` : "Due date not found",
      cpfCnpj ? `Detected CPF/CNPJ ${cpfCnpj}` : "CPF/CNPJ not found",
      payload.attachments.length ? `${payload.attachments.length} attachment(s) processed` : "No attachments"
    ];

    return {
      type,
      partyName,
      cpfCnpj,
      ...(amount != null ? { amount } : {}),
      dueDate,
      competence: dueDate ? dueDate.slice(0, 7) : null,
      description: payload.email.subject || payload.email.bodyText.slice(0, 240) || "Email financeiro recebido",
      suggestedCategory,
      paymentMethod: type === "conta_pagar" ? "Boleto" : "PIX",
      notes: "Internal sync extraction fallback",
      evidence,
      providerMeta: {
        source: "internal-sync-fallback",
        emailId: payload.email.id
      }
    };
  });
};

export default internalExtractionRoutes;
