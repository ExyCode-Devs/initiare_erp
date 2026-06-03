export type ConfidenceInput = {
  amountFound: boolean;
  dueDateFound: boolean;
  hasDocument: boolean;
  knownSender: boolean;
  partyFound: boolean;
  cpfCnpjFound: boolean;
  consistentValues: boolean;
  conflictingValues: boolean;
};

export function computeConfidence(input: ConfidenceInput) {
  let score = 0;

  if (input.amountFound) score += 24;
  if (input.dueDateFound) score += 18;
  if (input.hasDocument) score += 10;
  if (input.knownSender) score += 12;
  if (input.partyFound) score += 12;
  if (input.cpfCnpjFound) score += 10;
  if (input.consistentValues) score += 14;
  if (input.conflictingValues) score -= 22;

  const bounded = Math.max(0, Math.min(100, score));
  const band = bounded >= 80 ? "ALTA" : bounded >= 55 ? "MEDIA" : "BAIXA";

  return {
    score: bounded,
    band
  } as const;
}
