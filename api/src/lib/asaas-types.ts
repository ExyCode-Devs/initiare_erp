import type { ErpConnection, ErpEnvironment, ErpHealthStatus, ErpProvider, ErpSyncStatus } from "@prisma/client";

export type AsaasResolvedConnection = ErpConnection & {
  apiKey: string;
  webhookAuthToken: string | null;
};

export type AsaasConnectionSummary = {
  id: string;
  legalEntityId: string;
  legalEntityName: string;
  provider: ErpProvider;
  environment: ErpEnvironment;
  baseUrl: string;
  enabled: boolean;
  hasApiKey: boolean;
  hasWebhookToken: boolean;
  lastSyncAt: string | null;
  lastHealthcheckAt: string | null;
  lastHealthcheckStatus: ErpHealthStatus;
  lastError: string | null;
};

export type AsaasNormalizedCustomer = {
  id: string;
  name: string;
  email: string | null;
  cpfCnpj: string | null;
  mobilePhone: string | null;
};

export type AsaasNormalizedPayment = {
  id: string;
  customerId: string | null;
  customerName: string | null;
  status: string;
  description: string | null;
  billingType: string | null;
  grossValue: number;
  netValue: number | null;
  feeValue: number | null;
  dueDate: string | null;
  paymentDate: string | null;
  invoiceUrl: string | null;
};

export type AsaasSyncResult = {
  environment: ErpEnvironment;
  syncedAt: string;
  counts: {
    customers: number;
    charges: number;
    payments: number;
    fees: number;
  };
};

export type AsaasWebhookResult = {
  accepted: boolean;
  eventId: string;
  eventType: string;
  status: ErpSyncStatus;
};
