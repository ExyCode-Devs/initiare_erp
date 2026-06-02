import { PrismaClient } from "@prisma/client";
import { env } from "../src/config/env.js";
import { hashPassword } from "../src/lib/auth.js";

const prisma = new PrismaClient();

async function main() {
  const shouldReset = process.env.SEED_RESET === "true";
  const existingCompanies = await prisma.company.count();

  if (existingCompanies > 0 && !shouldReset) {
    console.log("Seed skipped: existing data found.");
    return;
  }

  if (shouldReset) {
    await prisma.auditLog.deleteMany();
    await prisma.insight.deleteMany();
    await prisma.dreEntry.deleteMany();
    await prisma.performancePoint.deleteMany();
    await prisma.dailyReconciliationPoint.deleteMany();
    await prisma.expenseCategory.deleteMany();
    await prisma.cashflowPoint.deleteMany();
    await prisma.integration.deleteMany();
    await prisma.report.deleteMany();
    await prisma.flow.deleteMany();
    await prisma.automation.deleteMany();
    await prisma.aiLog.deleteMany();
    await prisma.exceptionItem.deleteMany();
    await prisma.reconciliationItem.deleteMany();
    await prisma.operation.deleteMany();
    await prisma.accountReceivable.deleteMany();
    await prisma.accountPayable.deleteMany();
    await prisma.client.deleteMany();
    await prisma.supplier.deleteMany();
    await prisma.user.deleteMany();
    await prisma.company.deleteMany();
  }

  const company = await prisma.company.create({
    data: {
      name: env.SEED_COMPANY_NAME,
      slug: "acme-holdings",
      domain: env.SEED_COMPANY_DOMAIN,
      companiesCount: 3,
      operationalSavings: 42800
    }
  });

  const adminPasswordHash = await hashPassword(env.SEED_ADMIN_PASSWORD);

  const user = await prisma.user.create({
    data: {
      companyId: company.id,
      name: "Rafael Almeida",
      email: env.SEED_ADMIN_EMAIL,
      passwordHash: adminPasswordHash,
      role: "ADMIN"
    }
  });

  const clients = await Promise.all(
    [
      { name: "Acme Industries", segment: "Industria", annualRevenue: 184000, status: "Ativo", sinceYear: 2023 },
      { name: "Globex Corp", segment: "Tecnologia", annualRevenue: 122400, status: "Ativo", sinceYear: 2024 },
      { name: "Initech BR", segment: "Software", annualRevenue: 98000, status: "Ativo", sinceYear: 2022 },
      { name: "Soylent Co", segment: "FoodTech", annualRevenue: 54000, status: "Ativo", sinceYear: 2025 },
      { name: "Massive Dynamic", segment: "Engenharia", annualRevenue: 412000, status: "Ativo", sinceYear: 2021 },
      { name: "Hooli", segment: "Tecnologia", annualRevenue: 28000, status: "Pausado", sinceYear: 2024 }
    ].map((item) =>
      prisma.client.create({
        data: {
          companyId: company.id,
          name: item.name,
          segment: item.segment,
          annualRevenue: item.annualRevenue,
          status: item.status,
          sinceYear: item.sinceYear
        }
      })
    )
  );

  const suppliers = await Promise.all(
    [
      { name: "Amazon Web Services", cnpj: "15.436.940/0001-03", category: "Infraestrutura", yearlySpend: 184200, lastTransaction: "ontem" },
      { name: "Google Workspace", cnpj: "06.990.590/0001-23", category: "Software", yearlySpend: 11800, lastTransaction: "ha 3 dias" },
      { name: "Stripe Payments", cnpj: null, category: "Financeiro", yearlySpend: 42100, lastTransaction: "hoje" },
      { name: "Energisa", cnpj: "08.324.196/0001-81", category: "Utilidades", yearlySpend: 50500, lastTransaction: "ha 2 dias" },
      { name: "RD Station", cnpj: "12.345.678/0001-90", category: "Marketing", yearlySpend: 34680, lastTransaction: "ha 1 semana" },
      { name: "Notion Labs", cnpj: null, category: "Software", yearlySpend: 1240, lastTransaction: "hoje" },
      { name: "Cloudflare Inc", cnpj: null, category: "Infraestrutura", yearlySpend: 1450, lastTransaction: "ha 2 dias" },
      { name: "Mendes & Cia LTDA", cnpj: "12.345.678/0001-90", category: "Operacao", yearlySpend: 8900, lastTransaction: "ha 4 min" }
    ].map((item) =>
      prisma.supplier.create({
        data: {
          companyId: company.id,
          name: item.name,
          cnpj: item.cnpj,
          category: item.category,
          yearlySpend: item.yearlySpend,
          lastTransaction: item.lastTransaction
        }
      })
    )
  );

  const supplierByName = new Map(suppliers.map((supplier) => [supplier.name, supplier]));
  const clientByName = new Map(clients.map((client) => [client.name, client]));

  await prisma.accountPayable.createMany({
    data: [
      ["Amazon Web Services", 18420.5, "2026-05-28", "Infraestrutura", "PROCESSADO", 0.99, "DDA", "IA"],
      ["Notion Labs", 1240, "2026-05-30", "Software", "EM_REVISAO", 0.82, "Email", "IA"],
      ["Mendes & Cia LTDA", 8900, "2026-06-02", "A classificar", "EXCECAO", 0.41, "DDA", "Rafael"],
      ["Google Workspace", 980, "2026-05-29", "Software", "PROCESSADO", 0.97, "Email", "IA"],
      ["Energisa", 4210.45, "2026-05-27", "Utilidades", "PENDENTE", 0.93, "DDA", "IA"],
      ["RD Station", 2890, "2026-06-01", "Marketing", "PROCESSADO", 0.95, "Email", "IA"],
      ["Cloudflare Inc", 1450, "2026-05-31", "Infraestrutura", "CONCILIADO", 0.98, "API", "IA"],
      ["Linear Software", 320, "2026-06-03", "Software", "PROCESSADO", 0.99, "Email", "IA"]
    ].map(([supplierName, amount, dueDate, category, status, confidence, source, assignee]) => ({
      companyId: company.id,
      supplierId: supplierByName.get(String(supplierName))?.id,
      amount: Number(amount),
      dueDate: new Date(String(dueDate)),
      category: String(category),
      status: status as never,
      confidence: Number(confidence),
      source: String(source),
      assignee: String(assignee)
    }))
  });

  await prisma.accountReceivable.createMany({
    data: [
      ["Stripe Payments", 32100, "2026-05-26", "CONCILIADO", "API", "PIX"],
      ["Acme Industries", 18400, "2026-05-28", "PENDENTE", "Fatura", "Boleto"],
      ["Globex Corp", 24200, "2026-05-30", "EM_REVISAO", "Fatura", "TED"],
      ["Initech BR", 9800, "2026-06-02", "PENDENTE", "Recorrencia", "PIX"],
      ["Massive Dynamic", 41200, "2026-06-04", "PENDENTE", "Fatura", "Boleto"],
      ["Soylent Co", 5400, "2026-06-05", "CONCILIADO", "API", "PIX"]
    ].map(([clientName, amount, dueDate, status, source, channel]) => ({
      companyId: company.id,
      clientId: clientByName.get(String(clientName))?.id,
      amount: Number(amount),
      dueDate: new Date(String(dueDate)),
      status: status as never,
      source: String(source),
      channel: String(channel)
    }))
  });

  await prisma.operation.createMany({
    data: [
      ["OP-29481", "Amazon Web Services", 18420.5, "2026-05-28", "Infraestrutura", "PROCESSADO", "DDA", 0.99, "IA", "OUT"],
      ["OP-29480", "Notion Labs", 1240, "2026-05-30", "Software", "EM_REVISAO", "Email", 0.82, "IA", "OUT"],
      ["OP-29479", "Mendes & Cia LTDA", 8900, "2026-06-02", "A classificar", "EXCECAO", "DDA", 0.41, "Rafael", "OUT"],
      ["OP-29478", "Stripe Payments", 32100, "2026-05-26", "Receita", "CONCILIADO", "API", 0.99, "IA", "IN"],
      ["OP-29477", "Google Workspace", 980, "2026-05-29", "Software", "PROCESSADO", "Email", 0.97, "IA", "OUT"],
      ["OP-29476", "Energisa", 4210.45, "2026-05-27", "Utilidades", "PENDENTE", "DDA", 0.93, "IA", "OUT"],
      ["OP-29475", "RD Station", 2890, "2026-06-01", "Marketing", "PROCESSADO", "Email", 0.95, "IA", "OUT"],
      ["OP-29474", "Cloudflare Inc", 1450, "2026-05-31", "Infraestrutura", "CONCILIADO", "API", 0.98, "IA", "OUT"],
      ["OP-29473", "Mendes & Cia LTDA", 612.8, "2026-05-25", "A classificar", "EXCECAO", "Manual", 0.38, "Carla", "OUT"],
      ["OP-29472", "Google Workspace", 320, "2026-06-03", "Software", "PROCESSADO", "Email", 0.99, "IA", "OUT"]
    ].map(([reference, supplierName, amount, dueDate, category, status, source, confidence, assignee, direction]) => ({
      companyId: company.id,
      supplierId: supplierByName.get(String(supplierName))?.id,
      reference: String(reference),
      amount: Number(amount),
      dueDate: new Date(String(dueDate)),
      category: String(category),
      status: status as never,
      source: String(source),
      confidence: Number(confidence),
      assignee: String(assignee),
      direction: String(direction)
    }))
  });

  await prisma.reconciliationItem.createMany({
    data: [
      ["CC-001", "2026-05-24", "PIX RECEB STRIPE BR", 32100, "2026-05-24", "Stripe Payments · jan/26", 32100, 1],
      ["CC-002", "2026-05-24", "DEB AWS BILLING", -18420.5, "2026-05-24", "AWS · Infra mensal", -18420.5, 0.99],
      ["CC-003", "2026-05-23", "TED ENVIADA MENDES", -8900, null, "Sem correspondencia", 0, 0],
      ["CC-004", "2026-05-23", "PIX RECEB CLIENTE 042", 4500, "2026-05-23", "Fatura 042 · Cliente Acme", 4500, 1],
      ["CC-005", "2026-05-22", "DEB CLOUDFLARE", -1450, "2026-05-22", "Cloudflare · Infra", -1452.5, 0.92]
    ].map(([code, bankDate, bankDescription, bankValue, bookDate, bookDescription, bookValue, matchScore]) => ({
      companyId: company.id,
      code: String(code),
      bankDate: new Date(String(bankDate)),
      bankDescription: String(bankDescription),
      bankValue: Number(bankValue),
      bookDate: bookDate ? new Date(String(bookDate)) : null,
      bookDescription: String(bookDescription),
      bookValue: Number(bookValue),
      matchScore: Number(matchScore)
    }))
  });

  await prisma.exceptionItem.createMany({
    data: [
      [
        "EX-1042",
        "Fornecedor nao encontrado",
        "DDA Itau · boleto R$ 8.900,00 · Mendes & Cia LTDA",
        "Criar fornecedor Mendes & Cia LTDA (CNPJ 12.345.678/0001-90)",
        0.68,
        "ALTA",
        "ha 4 min",
        [
          { t: "14:25:03", text: "Entrada DDA Itau recebida" },
          { t: "14:25:04", text: "IA tentou match com cadastro de fornecedores" },
          { t: "14:25:04", text: "Match nao encontrado · escalado como excecao" },
          { t: "14:25:05", text: "Sugestao gerada · aguardando humano" }
        ]
      ],
      [
        "EX-1041",
        "Valor divergente do historico",
        "AWS · cobranca 38% acima da media mensal",
        "Validar com responsavel de infraestrutura antes de aprovar",
        0.74,
        "MEDIA",
        "ha 12 min",
        [
          { t: "14:12:11", text: "Cobranca AWS recebida" },
          { t: "14:12:12", text: "IA encontrou desvio do historico" }
        ]
      ],
      [
        "EX-1040",
        "Categoria ambigua",
        "Lancamento Notion pode ser Software ou Marketing",
        "Classificar como Software · 82% de confianca",
        0.82,
        "BAIXA",
        "ha 22 min",
        [
          { t: "13:58:41", text: "Email de cobranca recebido" },
          { t: "13:58:42", text: "Duas categorias ficaram proximas" }
        ]
      ]
    ].map(([code, title, description, suggestion, confidence, severity, timeLabel, timeline]) => ({
      companyId: company.id,
      code: String(code),
      title: String(title),
      description: String(description),
      suggestion: String(suggestion),
      confidence: Number(confidence),
      severity: severity as never,
      timeLabel: String(timeLabel),
      timeline
    }))
  });

  await prisma.aiLog.createMany({
    data: [
      ["2026-05-24T14:32:18Z", "PIX RECEB R$ 12.400,00 REF NF8821", "Pagamento PIX R$ 12.400 conciliado com NF 8821", 0.99, "OK", { entity: "payment" }, "Match exato identificado com historico bancario"],
      ["2026-05-24T14:31:55Z", "INVOICE aws-billing@amazon.com $3.421,12", "Fornecedor AWS classificado em Infraestrutura", 0.99, "OK", { entity: "supplier" }, "Padrao recorrente acima do threshold"],
      ["2026-05-24T14:29:42Z", "BOLETO Notion Labs R$ 1.240,00", "Solicitar revisao humana", 0.82, "WARN", { entity: "supplier" }, "Categoria ficou abaixo do threshold automatico"],
      ["2026-05-24T14:27:11Z", "DDA Itau 14 titulos", "Programar pagamentos", 0.97, "OK", { entity: "dda" }, "Lote validado com score alto"],
      ["2026-05-24T14:25:03Z", "BOLETO Mendes & Cia R$ 8.900", "Abrir excecao · fornecedor inexistente", 0.41, "ERR", { entity: "supplier" }, "Nao foi encontrado fornecedor compatível"],
      ["2026-05-24T14:22:48Z", "Omie sync · 12 lancamentos", "Importar e auto-classificar", 0.94, "OK", { entity: "erp_sync" }, "Registros importados com sucesso"],
      ["2026-05-24T14:20:31Z", "Analise fluxo de caixa D+30", "Sugerir antecipacao", 0.88, "OK", { entity: "cashflow" }, "Previsao de caixa com ganho em juros"],
      ["2026-05-24T14:18:14Z", "NF 8819 vs NF 8820", "Abrir excecao · duplicidade", 0.91, "WARN", { entity: "invoice" }, "Padrao duplicado identificado"]
    ].map(([occurredAt, input, action, confidence, status, parsedPayload, justification]) => ({
      companyId: company.id,
      occurredAt: new Date(String(occurredAt)),
      input: String(input),
      action: String(action),
      confidence: Number(confidence),
      status: status as never,
      parsedPayload,
      justification: String(justification)
    }))
  });

  await prisma.automation.createMany({
    data: [
      ["Conciliacao automatica", "Match entre extrato bancario e lancamentos", 1842, 99.1, "ACTIVE"],
      ["Leitura de e-mails", "Captura de invoices, boletos e NFs", 624, 96.4, "ACTIVE"],
      ["Processamento DDA", "Importacao automatica de boletos bancarios", 318, 98.7, "ACTIVE"],
      ["Classificacao financeira", "Categorizacao por centro de custo e DRE", 2104, 94.8, "ACTIVE"],
      ["Deteccao de anomalias", "Alertas sobre desvios de padrao historico", 76, 91.2, "ACTIVE"],
      ["Cobranca inteligente", "Regua de cobranca adaptativa por cliente", 412, 88.5, "PAUSED"]
    ].map(([title, description, runs, accuracy, status]) => ({
      companyId: company.id,
      title: String(title),
      description: String(description),
      runs: Number(runs),
      accuracy: Number(accuracy),
      status: status as never
    }))
  });

  await prisma.flow.createMany({
    data: [
      ["Captura -> Classificacao -> Pagamento", "Email/DDA -> IA Classifier -> Aprovacao -> Pagamento programado", 1842, "ACTIVE", ["Email", "IA", "Aprovar", "Pagar"]],
      ["Recebimento -> Conciliacao -> Lancamento", "PIX/TED -> Match IA -> Lancamento contabil -> Notificacao cliente", 1218, "ACTIVE", ["Banco", "Match", "Lancar", "Notificar"]],
      ["Cobranca inteligente", "Vencimento -> Regua adaptativa -> Cobranca automatizada", 412, "ACTIVE", ["Trigger", "IA Regua", "Enviar"]],
      ["Reconciliacao de NFs", "NF emitida -> Match com lancamento -> SPED ready", 624, "PAUSED", ["NF", "Match", "Validar"]]
    ].map(([name, description, runs, status, steps]) => ({
      companyId: company.id,
      name: String(name),
      description: String(description),
      runs: Number(runs),
      status: status as never,
      steps
    }))
  });

  await prisma.report.createMany({
    data: [
      ["DRE Mensal", "Demonstrativo de Resultado consolidado", "atualizado hoje"],
      ["Fluxo de Caixa Projetado", "Previsao de 12 meses com IA", "atualizado ha 1h"],
      ["Despesas por Categoria", "Distribuicao mensal e tendencias", "atualizado hoje"],
      ["Conciliacao Bancaria", "Status e divergencias do periodo", "atualizado ha 2h"],
      ["Contas a Pagar/Receber", "Aging completo da carteira", "atualizado hoje"],
      ["Performance IA", "Metricas operacionais dos modelos", "atualizado ha 5min"]
    ].map(([name, description, updatedLabel]) => ({
      companyId: company.id,
      name: String(name),
      description: String(description),
      updatedLabel: String(updatedLabel)
    }))
  });

  await prisma.integration.createMany({
    data: [
      ["Itau Open Finance", "DDA · extratos · TED/PIX", "CONNECTED"],
      ["Bradesco", "Extratos · DDA", "CONNECTED"],
      ["Stripe", "Pagamentos online", "CONNECTED"],
      ["Omie", "ERP financeiro", "CONNECTED"],
      ["Gmail / IMAP", "Captura de invoices", "CONNECTED"],
      ["OpenAI", "Modelo de linguagem", "CONNECTED"],
      ["N8N", "Orquestracao de fluxos", "AVAILABLE"],
      ["Slack", "Notificacoes em tempo real", "AVAILABLE"]
    ].map(([name, description, status]) => ({
      companyId: company.id,
      name: String(name),
      description: String(description),
      status: status as never
    }))
  });

  await prisma.cashflowPoint.createMany({
    data: [
      ["Jan", 420, 310],
      ["Fev", 480, 340],
      ["Mar", 520, 360],
      ["Abr", 610, 410],
      ["Mai", 580, 430],
      ["Jun", 720, 480],
      ["Jul", 690, 470],
      ["Ago", 810, 520],
      ["Set", 880, 540],
      ["Out", 920, 580],
      ["Nov", 980, 610],
      ["Dez", 1120, 670]
    ].map(([month, entrada, saida], index) => ({
      companyId: company.id,
      monthKey: index + 1,
      month: String(month),
      entrada: Number(entrada),
      saida: Number(saida)
    }))
  });

  await prisma.expenseCategory.createMany({
    data: [
      ["Folha", 38],
      ["Infra", 22],
      ["Marketing", 14],
      ["Software", 12],
      ["Operacao", 9],
      ["Outros", 5]
    ].map(([name, value]) => ({
      companyId: company.id,
      name: String(name),
      value: Number(value)
    }))
  });

  await prisma.dailyReconciliationPoint.createMany({
    data: Array.from({ length: 14 }, (_, index) => ({
      companyId: company.id,
      day: index + 1,
      auto: 70 + ((index * 7) % 18),
      manual: 8 + (index % 5)
    }))
  });

  await prisma.performancePoint.createMany({
    data: Array.from({ length: 30 }, (_, index) => ({
      companyId: company.id,
      day: index + 1,
      accuracy: 92 + ((index % 6) * 0.8),
      ops: 80 + ((index * 11) % 37)
    }))
  });

  await prisma.dreEntry.createMany({
    data: [
      ["Receita bruta", 1240000, "in", false, false],
      ["Deducoes", -84000, "out", false, false],
      ["Receita liquida", 1156000, "in", true, false],
      ["Custo de servicos", -342000, "out", false, false],
      ["Lucro bruto", 814000, "in", true, false],
      ["Despesas operacionais", -421000, "out", false, false],
      ["EBITDA", 393000, "in", true, false],
      ["Impostos", -82000, "out", false, false],
      ["Lucro liquido", 311000, "in", true, true]
    ].map(([label, value, type, bold, highlight]) => ({
      companyId: company.id,
      label: String(label),
      value: Number(value),
      type: String(type),
      bold: Boolean(bold),
      highlight: Boolean(highlight)
    }))
  });

  await prisma.insight.createMany({
    data: [
      ["ai", "Antecipacao inteligente", "Receba R$ 184k antes - economia projetada de R$ 4.120 em juros."],
      ["warning", "Concentracao de despesas", "62% dos gastos em 4 fornecedores - risco de dependencia."],
      ["success", "Eficiencia operacional", "Custo por transacao caiu 23% nos ultimos 90 dias."]
    ].map(([tone, title, description]) => ({
      companyId: company.id,
      tone: String(tone),
      title: String(title),
      description: String(description)
    }))
  });

  await prisma.auditLog.create({
    data: {
      companyId: company.id,
      userId: user.id,
      action: "seed.completed",
      resource: "system",
      details: {
        email: user.email
      }
    }
  });
}

main()
  .catch((error) => {
    console.error(error);
    process.exit(1);
  })
  .finally(async () => {
    await prisma.$disconnect();
  });
