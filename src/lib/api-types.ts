export interface AuthUser {
  id: string;
  name: string;
  email: string;
  role: "ADMIN" | "ANALYST" | "VIEWER";
}

export interface AuthCompany {
  id: string;
  name: string;
  domain: string;
}

export interface AuthMembership {
  id: string;
  role: "ADMIN" | "ANALYST" | "VIEWER";
  isDefault: boolean;
  company: AuthCompany;
}

export interface AuthResponse {
  token: string;
  user: AuthUser;
  activeCompany: AuthCompany;
  memberships: AuthMembership[];
}

export interface MeResponse {
  user: AuthUser;
  activeCompany: AuthCompany;
  memberships: AuthMembership[];
}

export interface AutomationSummaryResponse {
  stats: {
    totalEmails: number;
    processed: number;
    errorCount: number;
    pendingReview: number;
    approved: number;
    rejected: number;
    lowConfidence: number;
    volume: number;
  };
  runtime: {
    emailIngestEnabled: boolean;
    batchProcessingEnabled: boolean;
    autoSyncMailboxes: boolean;
    defaultEnvironment: "HOMOLOG" | "SANDBOX";
    maxEmailsPerRun: number;
    batchIntervalMinutes: number;
    totalMailboxes: number;
    activeMailboxes: number;
    unhealthyMailboxes: number;
    latestSuccessfulSyncAt: string | null;
  };
  latestEmails: Array<{
    id: string;
    sender: string;
    subject: string;
    status: string;
    receivedAt: string;
  }>;
  latestRuns: Array<{
    id: string;
    runType: string;
    status: string;
    fetchedCount: number;
    processedCount: number;
    errorCount: number;
    startedAt: string;
    finishedAt: string | null;
  }>;
}

export interface AutomationSettingsResponse {
  settings: {
    emailIngestEnabled: boolean;
    batchProcessingEnabled: boolean;
    autoSyncMailboxes: boolean;
    autoTestIntegrations: boolean;
    draftAutoReprocess: boolean;
    notificationDigestEnabled: boolean;
    defaultEnvironment: "HOMOLOG" | "SANDBOX";
    maxEmailsPerRun: number;
    batchIntervalMinutes: number;
  };
}

export interface MailboxesResponse {
  items: Array<{
    id: string;
    name: string;
    host: string;
    port: number;
    tls: boolean;
    username: string;
    legalEntityId: string | null;
    fromFilter: string | null;
    active: boolean;
    lastSyncAt: string | null;
    lastError: string | null;
    createdAt: string;
  }>;
}

export interface InboxListResponse {
  items: Array<{
    id: string;
    mailbox: string;
    sender: string;
    subject: string;
    receivedAt: string;
    status: string;
    attachmentCount: number;
    extractionStatus: string | null;
    draft: {
      id: string;
      direction: string;
      partyName: string;
      amount: number | null;
      confidenceScore: number;
      confidenceBand: string;
      status: string;
    } | null;
  }>;
}

export interface InboxEmailDetailResponse {
  id: string;
  mailbox: string;
  sender: string;
  replyTo: string | null;
  toRecipients: string[];
  ccRecipients: string[] | null;
  bccRecipients: string[] | null;
  subject: string;
  bodyText: string;
  bodyHtml: string | null;
  receivedAt: string;
  status: string;
  processingError: string | null;
  attachments: Array<{
    id: string;
    originalName: string;
    mimeType: string;
    sizeBytes: number;
    status: string;
    processingError: string | null;
    extractedText: string | null;
    downloadPath: string;
  }>;
  extractionRuns: Array<{
    id: string;
    provider: string;
    workflowId: string | null;
    status: string;
    durationMs: number | null;
    errorMessage: string | null;
    startedAt: string;
    completedAt: string | null;
    parsedResponse: unknown;
  }>;
  drafts: Array<{
    id: string;
    direction: string;
    partyName: string;
    cpfCnpj: string | null;
    amount: number | null;
    dueDate: string | null;
    competence: string | null;
    description: string;
    suggestedCategory: string | null;
    finalCategory: string | null;
    paymentMethod: string | null;
    bankData: Record<string, unknown> | null;
    notes: string | null;
    confidenceScore: number;
    confidenceBand: string;
    status: string;
    evidence: unknown;
    rawPayload: unknown;
    rejectionReason: string | null;
    reviews: Array<{
      id: string;
      action: string;
      note: string | null;
      fieldDelta: unknown;
      createdAt: string;
      user: {
        id: string;
        name: string;
        email: string;
      };
    }>;
  }>;
}

export interface FinancialDraftListResponse {
  items: Array<{
    review: {
      workflowStatus: string;
      execution: {
        provider: string;
        environment: string;
        status: string;
        queuedAt: string | null;
        startedAt: string | null;
        finishedAt: string | null;
        retryCount: number;
        lastError: string | null;
        externalPartyId: string | null;
        externalEntryId: string | null;
        requestPayload: unknown;
        responsePayload: unknown;
        billingArtifact: unknown;
      } | null;
      blockers: Array<{
        code: string;
        message: string;
      }>;
      canApprove: boolean;
    };
    id: string;
    direction: string;
    partyName: string;
    cpfCnpj: string | null;
    amount: number | null;
    dueDate: string | null;
    description: string;
    suggestedCategory: string | null;
    finalCategory: string | null;
    paymentMethod: string | null;
    legalEntityId: string | null;
    legalEntityName: string | null;
    routingStatus: string;
    routingReason: string | null;
    routeSource: string;
    confidenceScore: number;
    confidenceBand: string;
    status: string;
    source: {
      id: string;
      originType: string;
      channel: string;
      sender: string | null;
      subject: string | null;
      summary?: string | null;
      receivedAt: string;
    } | null;
    email: {
      id: string;
      sender: string;
      subject: string;
    } | null;
    omieSync: {
      environment: "HOMOLOG" | "PRODUCTION";
      status: string;
      externalId: string | null;
      errorMessage: string | null;
    } | null;
  }>;
}

export interface FinancialDraftDetailResponse {
  review: {
    workflowStatus: string;
    execution: {
      provider: string;
      environment: string;
      status: string;
      queuedAt: string | null;
      startedAt: string | null;
      finishedAt: string | null;
      retryCount: number;
      lastError: string | null;
      externalPartyId: string | null;
      externalEntryId: string | null;
      requestPayload: unknown;
      responsePayload: unknown;
      billingArtifact: unknown;
    } | null;
    blockers: Array<{
      code: string;
      message: string;
    }>;
    canApprove: boolean;
    duplicateCandidates: Array<{
      id: string;
      partyName: string;
      amount: number | null;
      dueDate: string | null;
      status: string;
      score: number;
    }>;
  };
  id: string;
  direction: string;
  partyName: string;
  cpfCnpj: string | null;
  amount: string | number | null;
  dueDate: string | null;
  competence: string | null;
  description: string;
  suggestedCategory: string | null;
  finalCategory: string | null;
  paymentMethod: string | null;
  legalEntityId: string | null;
  legalEntityName: string | null;
  routingStatus: string;
  routingReason: string | null;
  routeSource: string;
  bankData: Record<string, unknown> | null;
  notes: string | null;
  confidenceScore: number;
  confidenceBand: string;
  status: string;
  evidence: unknown;
  rawPayload: unknown;
  rejectionReason: string | null;
  source: {
    id: string;
    originType: string;
    channel: string;
    sender: string | null;
    subject: string | null;
    summary: string | null;
    receivedAt: string;
    attachments: unknown;
    rawPayload: unknown;
    status: string;
    processingError: string | null;
  } | null;
  aiRun: {
    id: string;
    provider: string;
    status: string;
    errorMessage: string | null;
    rawResponse: string | null;
    parsedResponse: unknown;
    startedAt: string;
    completedAt: string | null;
  } | null;
  sourceEmail: {
    id: string;
    sender: string;
    subject: string;
    bodyText: string;
    receivedAt: string;
    attachments: Array<{
      id: string;
      originalName: string;
      mimeType: string;
      extractedText: string | null;
    }>;
    extractionRuns: Array<{
      id: string;
      provider: string;
      workflowId: string | null;
      status: string;
      errorMessage: string | null;
      parsedResponse: unknown;
      startedAt: string;
      completedAt: string | null;
    }>;
  } | null;
  reviews: Array<{
    id: string;
    action: string;
    note: string | null;
    fieldDelta: unknown;
    createdAt: string;
    user: {
      id: string;
      name: string;
      email: string;
    };
  }>;
  omieHistory: {
    syncs: Array<{
      id: string;
      entityType: string;
      environment: "HOMOLOG" | "PRODUCTION";
      status: string;
      externalId: string | null;
      errorMessage: string | null;
      syncedAt: string | null;
      createdAt: string;
    }>;
    requests: Array<{
      id: string;
      endpoint: string;
      method: string;
      httpStatus: number | null;
      operationStatus: string;
      friendlyError: string | null;
      technicalError: string | null;
      createdAt: string;
    }>;
  };
}

export interface LegalEntitiesResponse {
  items: Array<{
    id: string;
    legalName: string;
    tradeName: string | null;
    cnpj: string;
    active: boolean;
    isDefault: boolean;
    defaultRecipientEmails: string[];
    defaultMailboxIds: string[];
    notes: string | null;
    createdAt: string;
    updatedAt: string;
  }>;
}

export interface OmieSettingsResponse {
  provider: "OMIE";
  environments: Array<{
    id: string;
    legalEntityId: string;
    legalEntityName: string;
    provider: "OMIE";
    environment: "HOMOLOG" | "PRODUCTION";
    baseUrl: string;
    enabled: boolean;
    hasAppKey: boolean;
    hasAppSecret: boolean;
    lastSyncAt: string | null;
    lastHealthcheckAt: string | null;
    lastHealthcheckStatus: "UNKNOWN" | "HEALTHY" | "ERROR";
    lastError: string | null;
  }>;
}

export interface AsaasSettingsResponse {
  provider: "ASAAS";
  environments: Array<{
    id: string;
    legalEntityId: string;
    legalEntityName: string;
    provider: "ASAAS";
    environment: "SANDBOX" | "PRODUCTION";
    baseUrl: string;
    enabled: boolean;
    hasApiKey: boolean;
    hasWebhookToken: boolean;
    lastSyncAt: string | null;
    lastHealthcheckAt: string | null;
    lastHealthcheckStatus: "UNKNOWN" | "HEALTHY" | "ERROR";
    lastError: string | null;
  }>;
}

export interface AsaasPaymentsResponse {
  stats: {
    charges: number;
    paid: number;
    overdue: number;
    netReceived: number;
    fees: number;
    webhookEvents: number;
    integrationErrors: number;
  };
  items: Array<{
    id: string;
    externalId: string;
    customer: string;
    amount: number;
    netAmount: number | null;
    fee: number | null;
    dueDate: string | null;
    paymentDate: string | null;
    status: string;
    billingType: string | null;
    description: string | null;
    invoiceUrl: string | null;
    source: string;
    webhookStatus: string | null;
    webhookError: string | null;
  }>;
  latestWebhook: {
    id: string;
    eventType: string;
    status: string;
    errorMessage: string | null;
    createdAt: string;
  } | null;
}

export interface AsaasWebhooksResponse {
  items: Array<{
    id: string;
    environment: "SANDBOX" | "PRODUCTION";
    externalEventId: string;
    eventType: string;
    status: string;
    errorMessage: string | null;
    processedAt: string | null;
    createdAt: string;
  }>;
}

export interface IntegrationErrorsResponse {
  stats: {
    total: number;
    requestErrors: number;
    webhookErrors: number;
    connectionErrors: number;
    mailboxErrors: number;
  };
  items: Array<{
    id: string;
    sourceType: "REQUEST" | "WEBHOOK" | "CONNECTION" | "MAILBOX";
    provider: "OMIE" | "ASAAS" | "MAILBOX";
    environment: "HOMOLOG" | "SANDBOX" | "PRODUCTION" | null;
    legalEntityName: string | null;
    title: string;
    message: string;
    technicalError: string | null;
    endpoint: string | null;
    method: string | null;
    httpStatus: number | null;
    draftId: string | null;
    externalEventId: string | null;
    connectionId: string | null;
    mailboxId: string | null;
    occurredAt: string;
  }>;
}

export interface ChangelogPublicResponse {
  items: Array<{
    id: string;
    title: string;
    description: string;
    version: string;
    category: string;
    status: string;
    imageUrl: string | null;
    publishedAt: string | null;
    createdAt: string;
    author: {
      id: string;
      name: string;
    };
    unread: boolean;
  }>;
}

export interface ChangelogAdminResponse {
  items: Array<{
    id: string;
    title: string;
    description: string;
    version: string;
    category: string;
    status: string;
    imageUrl: string | null;
    createdAt: string;
    updatedAt: string;
    publishedAt: string | null;
    authorId: string;
    companyId: string;
  }>;
}

export interface AdvancedOpsOverviewResponse {
  summary: {
    dueContracts: number;
    dueServiceOrders: number;
    reconciliationCount: number;
    approvedDrafts: number;
    receivableVolume: number;
  };
  businessClients: Array<{
    id: string;
    name: string;
    linkedClientId: string | null;
    linkedClientName: string | null;
    allocationRule: {
      id: string;
      strategy: string;
      legalEntityId: string | null;
    } | null;
    legalEntities: Array<{
      id: string;
      legalName: string;
      tradeName: string | null;
      percentage: number | null;
      monthlyCap: number | null;
    }>;
  }>;
  legalEntities: Array<{
    id: string;
    legalName: string;
    tradeName: string | null;
    isDefault: boolean;
  }>;
  latestDrafts: Array<{
    id: string;
    partyName: string;
    status: string;
    sourceLabel: string;
    createdAt: string;
  }>;
}

export interface PortalOverviewResponse {
  businessClient: {
    id: string;
    name: string;
  };
  client: {
    id: string;
    name: string;
  } | null;
  stats: {
    totalReceivables: number;
    totalVolume: number;
  };
  items: Array<{
    id: string;
    amount: number;
    dueDate: string;
    status: string;
    source: string;
    channel: string;
  }>;
}
