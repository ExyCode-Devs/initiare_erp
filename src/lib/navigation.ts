const isProduction = import.meta.env.PROD;

export const navItems = [
  {
    group: "Operacional",
    items: [
      { label: "Dashboard", to: "/", icon: "LayoutDashboard" },
      { label: "Operacoes", to: "/operacoes", icon: "Activity" },
      { label: "Validacao Financeira", to: "/validacao-financeira", icon: "ClipboardCheck" },
      { label: "Advanced Ops", to: "/advanced-ops", icon: "Layers3" },
      { label: "Contas a Pagar", to: "/contas-a-pagar", icon: "ArrowUpRight" },
      { label: "Contas a Receber", to: "/contas-a-receber", icon: "ArrowDownLeft" },
      { label: "Conciliacao", to: "/conciliacao", icon: "GitMerge" },
      { label: "Excecoes", to: "/excecoes", icon: "AlertTriangle" },
    ],
  },
  {
    group: "Inteligencia",
    items: [
      { label: "Central IA", to: "/central-ia", icon: "Sparkles" },
      { label: "Logs IA", to: "/logs-ia", icon: "Terminal" },
      { label: "Automacao", to: "/automacao", icon: "Zap" },
      ...(!isProduction ? [{ label: "Fluxos", to: "/fluxos", icon: "Workflow" }] : []),
    ],
  },
  {
    group: "Cadastros",
    items: [
      { label: "Clientes", to: "/clientes", icon: "Users" },
      { label: "Fornecedores", to: "/fornecedores", icon: "Building2" },
    ],
  },
  {
    group: "Analise",
    items: [
      { label: "Novidades", to: "/novidades", icon: "BellRing" },
      { label: "Relatorios", to: "/relatorios", icon: "FileBarChart" },
      { label: "Dashboard Executivo", to: "/executivo", icon: "TrendingUp" },
      { label: "Configuracoes", to: "/configuracoes", icon: "Settings" },
    ],
  },
] as const;
