import { z } from "zod";

export const automationSettingsSchema = z.object({
  emailIngestEnabled: z.boolean().default(true),
  batchProcessingEnabled: z.boolean().default(true),
  autoSyncMailboxes: z.boolean().default(true),
  autoTestIntegrations: z.boolean().default(false),
  draftAutoReprocess: z.boolean().default(false),
  notificationDigestEnabled: z.boolean().default(true),
  defaultEnvironment: z.enum(["HOMOLOG", "SANDBOX"]).default("HOMOLOG"),
  maxEmailsPerRun: z.coerce.number().int().min(1).max(100).default(10),
  batchIntervalMinutes: z.coerce.number().int().min(1).max(1440).default(15),
});

export type AutomationSettings = z.infer<typeof automationSettingsSchema>;

export const DEFAULT_AUTOMATION_SETTINGS: AutomationSettings = {
  emailIngestEnabled: true,
  batchProcessingEnabled: true,
  autoSyncMailboxes: true,
  autoTestIntegrations: false,
  draftAutoReprocess: false,
  notificationDigestEnabled: true,
  defaultEnvironment: "HOMOLOG",
  maxEmailsPerRun: 10,
  batchIntervalMinutes: 15,
};

export function normalizeAutomationSettings(value: unknown): AutomationSettings {
  return automationSettingsSchema.parse({
    ...DEFAULT_AUTOMATION_SETTINGS,
    ...(value && typeof value === "object" ? value : {}),
  });
}
