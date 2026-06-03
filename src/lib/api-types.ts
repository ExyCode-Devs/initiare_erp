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

export interface AuthResponse {
  token: string;
  user: AuthUser;
  company: AuthCompany;
}

export interface MeResponse {
  user: AuthUser;
  company: AuthCompany;
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

export interface MailboxesResponse {
  items: Array<{
    id: string;
    name: string;
    host: string;
    port: number;
    tls: boolean;
    username: string;
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
  }>;
}

export interface FinancialDraftDetailResponse {
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
