export const navItems = [
  { group: "Operacional", items: [
    { label: "Dashboard", to: "/", icon: "LayoutDashboard" },
    { label: "Operações", to: "/operacoes", icon: "Activity" },
    { label: "Contas a Pagar", to: "/contas-a-pagar", icon: "ArrowUpRight" },
    { label: "Contas a Receber", to: "/contas-a-receber", icon: "ArrowDownLeft" },
    { label: "Conciliação", to: "/conciliacao", icon: "GitMerge" },
    { label: "Exceções", to: "/excecoes", icon: "AlertTriangle", badge: 17 },
  ]},
  { group: "Inteligência", items: [
    { label: "Central IA", to: "/central-ia", icon: "Sparkles" },
    { label: "Logs IA", to: "/logs-ia", icon: "Terminal" },
    { label: "Fluxos", to: "/fluxos", icon: "Workflow" },
    { label: "Automação", to: "/automacao", icon: "Zap" },
  ]},
  { group: "Cadastros", items: [
    { label: "Clientes", to: "/clientes", icon: "Users" },
    { label: "Fornecedores", to: "/fornecedores", icon: "Building2" },
  ]},
  { group: "Análise", items: [
    { label: "Relatórios", to: "/relatorios", icon: "FileBarChart" },
    { label: "Dashboard Executivo", to: "/executivo", icon: "TrendingUp" },
    { label: "Configurações", to: "/configuracoes", icon: "Settings" },
  ]},
] as const;

export const cashflow = [
  { month: "Jan", entrada: 420, saida: 310 },
  { month: "Fev", entrada: 480, saida: 340 },
  { month: "Mar", entrada: 520, saida: 360 },
  { month: "Abr", entrada: 610, saida: 410 },
  { month: "Mai", entrada: 580, saida: 430 },
  { month: "Jun", entrada: 720, saida: 480 },
  { month: "Jul", entrada: 690, saida: 470 },
  { month: "Ago", entrada: 810, saida: 520 },
  { month: "Set", entrada: 880, saida: 540 },
  { month: "Out", entrada: 920, saida: 580 },
  { month: "Nov", entrada: 980, saida: 610 },
  { month: "Dez", entrada: 1120, saida: 670 },
];

export const expensesByCategory = [
  { name: "Folha", value: 38 },
  { name: "Infra", value: 22 },
  { name: "Marketing", value: 14 },
  { name: "Software", value: 12 },
  { name: "Operação", value: 9 },
  { name: "Outros", value: 5 },
];

export const conciliacaoDaily = Array.from({ length: 14 }, (_, i) => ({
  day: `${i + 1}`,
  auto: 70 + Math.round(Math.sin(i / 2) * 12 + Math.random() * 8),
  manual: 8 + Math.round(Math.cos(i / 2) * 4 + Math.random() * 3),
}));

export const aiActivity = [
  { t: "14:32", type: "ok", text: "Pagamento PIX R$ 12.400 conciliado com NF 8821" },
  { t: "14:31", type: "ok", text: "Fornecedor 'AWS' classificado em Infra · 99% confiança" },
  { t: "14:29", type: "warn", text: "Categoria ambígua: 'Notion' — sugerido Software (82%)" },
  { t: "14:27", type: "ok", text: "DDA Itaú validado — 14 boletos programados" },
  { t: "14:25", type: "err", text: "Fornecedor 'Mendes & Cia' não encontrado no cadastro" },
  { t: "14:22", type: "ok", text: "12 lançamentos importados do Omie automaticamente" },
  { t: "14:20", type: "ok", text: "Antecipação de recebíveis sugerida: economia R$ 4.120" },
  { t: "14:18", type: "warn", text: "Possível duplicidade detectada: NF 8819 ↔ 8820" },
];

export const operations = [
  { id: "OP-29481", fornecedor: "Amazon Web Services", valor: 18420.5, vencimento: "2026-05-28", categoria: "Infraestrutura", status: "Processado", origem: "DDA", confianca: 0.99, responsavel: "IA" },
  { id: "OP-29480", fornecedor: "Notion Labs", valor: 1240.0, vencimento: "2026-05-30", categoria: "Software", status: "Em revisão", origem: "Email", confianca: 0.82, responsavel: "IA" },
  { id: "OP-29479", fornecedor: "Mendes & Cia LTDA", valor: 8900.0, vencimento: "2026-06-02", categoria: "—", status: "Exceção", origem: "DDA", confianca: 0.41, responsavel: "Rafael" },
  { id: "OP-29478", fornecedor: "Stripe Payments", valor: 32100.0, vencimento: "2026-05-26", categoria: "Receita", status: "Conciliado", origem: "API", confianca: 0.99, responsavel: "IA" },
  { id: "OP-29477", fornecedor: "Google Workspace", valor: 980.0, vencimento: "2026-05-29", categoria: "Software", status: "Processado", origem: "Email", confianca: 0.97, responsavel: "IA" },
  { id: "OP-29476", fornecedor: "Energisa", valor: 4210.45, vencimento: "2026-05-27", categoria: "Utilidades", status: "Pendente", origem: "DDA", confianca: 0.93, responsavel: "IA" },
  { id: "OP-29475", fornecedor: "RD Station", valor: 2890.0, vencimento: "2026-06-01", categoria: "Marketing", status: "Processado", origem: "Email", confianca: 0.95, responsavel: "IA" },
  { id: "OP-29474", fornecedor: "Cloudflare Inc", valor: 1450.0, vencimento: "2026-05-31", categoria: "Infraestrutura", status: "Conciliado", origem: "API", confianca: 0.98, responsavel: "IA" },
  { id: "OP-29473", fornecedor: "Posto Shell BR-101", valor: 612.8, vencimento: "2026-05-25", categoria: "—", status: "Exceção", origem: "Manual", confianca: 0.38, responsavel: "Carla" },
  { id: "OP-29472", fornecedor: "Linear Software", valor: 320.0, vencimento: "2026-06-03", categoria: "Software", status: "Processado", origem: "Email", confianca: 0.99, responsavel: "IA" },
];

export const exceptions = [
  { id: "EX-1042", title: "Fornecedor não encontrado", desc: "DDA Itaú · boleto R$ 8.900,00 · 'Mendes & Cia LTDA'", suggestion: "Criar fornecedor 'Mendes & Cia LTDA' (CNPJ 12.345.678/0001-90)", confidence: 0.68, severity: "Alta", time: "há 4 min" },
  { id: "EX-1041", title: "Valor divergente do histórico", desc: "AWS · cobrança 38% acima da média mensal", suggestion: "Validar com responsável de infraestrutura antes de aprovar", confidence: 0.74, severity: "Média", time: "há 12 min" },
  { id: "EX-1040", title: "Categoria ambígua", desc: "Lançamento 'Notion' pode ser Software ou Marketing", suggestion: "Classificar como Software · 82% de confiança", confidence: 0.82, severity: "Baixa", time: "há 22 min" },
  { id: "EX-1039", title: "Possível duplicidade", desc: "NF 8819 e NF 8820 com mesmo valor e fornecedor", suggestion: "Manter NF 8819 · arquivar NF 8820 como duplicata", confidence: 0.91, severity: "Alta", time: "há 38 min" },
  { id: "EX-1038", title: "Conta bancária não cadastrada", desc: "PIX recebido em conta Bradesco terminada em 4521", suggestion: "Vincular conta à empresa 'Acme Filial SP'", confidence: 0.65, severity: "Média", time: "há 1 h" },
];

export const aiLogs = [
  { time: "14:32:18", input: "PIX RECEB R$ 12.400,00 REF NF8821", action: "Conciliar lançamento", confidence: 0.99, status: "ok" },
  { time: "14:31:55", input: "INVOICE aws-billing@amazon.com $3.421,12", action: "Classificar como Infraestrutura", confidence: 0.99, status: "ok" },
  { time: "14:29:42", input: "BOLETO Notion Labs R$ 1.240,00", action: "Solicitar revisão humana", confidence: 0.82, status: "warn" },
  { time: "14:27:11", input: "DDA Itaú 14 títulos", action: "Programar pagamentos", confidence: 0.97, status: "ok" },
  { time: "14:25:03", input: "BOLETO Mendes & Cia R$ 8.900", action: "Abrir exceção · fornecedor inexistente", confidence: 0.41, status: "err" },
  { time: "14:22:48", input: "Omie sync · 12 lançamentos", action: "Importar e auto-classificar", confidence: 0.94, status: "ok" },
  { time: "14:20:31", input: "Análise fluxo de caixa D+30", action: "Sugerir antecipação", confidence: 0.88, status: "ok" },
  { time: "14:18:14", input: "NF 8819 vs NF 8820", action: "Abrir exceção · duplicidade", confidence: 0.91, status: "warn" },
];

export const conciliacaoRows = [
  { id: "CC-001", bank: { date: "24/05", desc: "PIX RECEB STRIPE BR", value: 32100.0 }, book: { date: "24/05", desc: "Stripe Payments · jan/26", value: 32100.0 }, match: 1.0 },
  { id: "CC-002", bank: { date: "24/05", desc: "DEB AWS BILLING", value: -18420.5 }, book: { date: "24/05", desc: "AWS · Infra mensal", value: -18420.5 }, match: 0.99 },
  { id: "CC-003", bank: { date: "23/05", desc: "TED ENVIADA MENDES", value: -8900.0 }, book: { date: "—", desc: "Sem correspondência", value: 0 }, match: 0 },
  { id: "CC-004", bank: { date: "23/05", desc: "PIX RECEB CLIENTE 042", value: 4500.0 }, book: { date: "23/05", desc: "Fatura 042 · Cliente Acme", value: 4500.0 }, match: 1.0 },
  { id: "CC-005", bank: { date: "22/05", desc: "DEB CLOUDFLARE", value: -1450.0 }, book: { date: "22/05", desc: "Cloudflare · Infra", value: -1452.5 }, match: 0.92 },
];

export const automacaoCards = [
  { title: "Conciliação automática", desc: "Match entre extrato bancário e lançamentos", runs: 1842, accuracy: 99.1, status: "active" },
  { title: "Leitura de e-mails", desc: "Captura de invoices, boletos e NFs", runs: 624, accuracy: 96.4, status: "active" },
  { title: "Processamento DDA", desc: "Importação automática de boletos bancários", runs: 318, accuracy: 98.7, status: "active" },
  { title: "Classificação financeira", desc: "Categorização por centro de custo e DRE", runs: 2104, accuracy: 94.8, status: "active" },
  { title: "Detecção de anomalias", desc: "Alertas sobre desvios de padrão histórico", runs: 76, accuracy: 91.2, status: "active" },
  { title: "Cobrança inteligente", desc: "Régua de cobrança adaptativa por cliente", runs: 412, accuracy: 88.5, status: "paused" },
];
