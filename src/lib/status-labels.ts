export function humanFinancialStatus(status: string): string {
  const map: Record<string, string> = {
    pending_review: "Em revisão",
    edited: "Editado",
    approved: "Aprovado",
    rejected: "Rejeitado",
    duplicated: "Duplicado",
    draft_ai: "Rascunho IA",
    draft_integration: "Rascunho integração",
    queued: "Na fila",
    running: "Enviando",
    success: "Concluído",
    error: "Erro integração",
    idle: "Aguardando",
    PENDENTE_REVISAO: "Em revisão",
    APROVADO: "Processado",
    REJEITADO: "Exceção",
    ALTA: "Alta",
    MEDIA: "Média",
    BAIXA: "Baixa",
    RECEIVED: "Pendente",
    PENDENTE: "Pendente",
    PROCESSED: "Processado",
    SUCESSO: "Processado",
    SUCCESS: "Processado",
    ERROR: "Exceção",
    BLOCKED: "Em revisão",
    FAILED: "Exceção",
    ERRO: "Exceção",
    AGUARDANDO_VALIDACAO: "Em revisão",
    RECEBIDO: "Pendente",
    PROCESSANDO: "Pendente",
    ROUTED: "Roteado",
    UNROUTED: "Sem roteamento",
  };

  if (map[status]) {
    return map[status];
  }

  return status
    .toLowerCase()
    .split("_")
    .map((part) => part.charAt(0).toUpperCase() + part.slice(1))
    .join(" ");
}

export function getDisplayStatus(status: string, secondaryStatus: string) {
  const secondary = humanFinancialStatus(secondaryStatus);
  const primary = humanFinancialStatus(status);
  return secondary === primary ? secondary : secondary || primary;
}

export function getDisplayStatuses(status: string, secondaryStatus?: string | null) {
  const primary = humanFinancialStatus(status);
  if (!secondaryStatus) {
    return [primary];
  }

  const secondary = humanFinancialStatus(secondaryStatus);
  if (primary === secondary) {
    return [primary];
  }

  return [primary, secondary];
}

export function humanReviewAction(action: string) {
  if (action === "EDIT") return "Edição";
  if (action === "APPROVE") return "Aprovação";
  if (action === "REJECT") return "Rejeição";
  return humanFinancialStatus(action);
}

export function humanRouteSource(source: string) {
  if (source === "CNPJ") return "CNPJ";
  if (source === "MAILBOX") return "Caixa de entrada";
  if (source === "MANUAL") return "Manual";
  if (source === "UNKNOWN") return "Desconhecido";
  return humanFinancialStatus(source);
}

export function humanRoutingReason(reason: string) {
  if (reason.startsWith("Routed by CNPJ ")) {
    return `Roteado por CNPJ ${reason.slice("Routed by CNPJ ".length)}`;
  }
  if (reason.startsWith("Ambiguous CNPJ route for ")) {
    return `Roteamento ambíguo por CNPJ ${reason.slice("Ambiguous CNPJ route for ".length)}`;
  }
  if (reason.startsWith("Routed by mailbox alias ")) {
    return `Roteado por alias de caixa ${reason.slice("Routed by mailbox alias ".length)}`;
  }
  if (reason.startsWith("Ambiguous mailbox route for ")) {
    return `Roteamento ambíguo por caixa ${reason.slice("Ambiguous mailbox route for ".length)}`;
  }
  if (reason === "Internal generation requires manual legal entity assignment") {
    return "Geração interna exige atribuição manual de entidade legal.";
  }
  if (reason === "Legal entity manually assigned by analyst") {
    return "Entidade legal atribuída manualmente pelo analista.";
  }
  if (reason === "Routed by legal entity mapping") {
    return "Roteado por mapeamento de entidade legal.";
  }
  if (reason.startsWith("No legal entity found for CNPJ ")) {
    return `Nenhuma entidade legal encontrada para CNPJ ${reason.slice("No legal entity found for CNPJ ".length)}`;
  }
  if (reason === "No legal entity match found from route hints") {
    return "Nenhuma entidade legal encontrada a partir das pistas de roteamento";
  }

  return reason;
}
