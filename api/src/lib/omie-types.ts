import type {
  ErpConnection,
  ErpEnvironment,
  ErpHealthStatus,
  ErpProvider,
  ErpSyncEntityType,
  ErpSyncStatus
} from "@prisma/client";

export type OmieResolvedConnection = ErpConnection & {
  appKey: string;
  appSecret: string;
};

export type OmieConnectionSummary = {
  id: string;
  legalEntityId: string;
  legalEntityName: string;
  provider: ErpProvider;
  environment: ErpEnvironment;
  baseUrl: string;
  enabled: boolean;
  hasAppKey: boolean;
  hasAppSecret: boolean;
  lastSyncAt: string | null;
  lastHealthcheckAt: string | null;
  lastHealthcheckStatus: ErpHealthStatus;
  lastError: string | null;
};

export type OmieCatalogSyncResult = {
  environment: ErpEnvironment;
  syncedAt: string;
  counts: {
    clients: number;
    suppliers: number;
    categories: number;
    currentAccounts: number;
  };
};

export type OmieDraftHistoryItem = {
  id: string;
  entityType: ErpSyncEntityType;
  environment: ErpEnvironment;
  status: ErpSyncStatus;
  externalId: string | null;
  errorMessage: string | null;
  syncedAt: string | null;
  createdAt: string;
};
