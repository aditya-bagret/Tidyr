// Audit trail (BON-08, D-012). Entries are data in the database, written in the same transaction
// as the change they describe, so a rolled-back change never leaves a history row behind.
import type { ActivityAction, ActivityEntityType } from '@tidyr/shared';
import { Prisma } from '../../generated/prisma/client';

/** Field values as they appear in API responses (dates already `YYYY-MM-DD`). */
export type AuditValue = string | number | boolean | null;
export type AuditChanges = Record<string, { from: AuditValue; to: AuditValue }>;

// API_CONTRACT §8: long text (descriptions) is recorded truncated, so history can't grow without bound.
const MAX_RECORDED_LENGTH = 200;

export interface AuditEntry {
  userId: string;
  /** The project the entity belongs to (itself for a project), so project activity includes its tasks. */
  projectId: string;
  entityType: ActivityEntityType;
  entityId: string;
  action: ActivityAction;
  /** `null` for CREATED and DELETED. */
  changes: AuditChanges | null;
}

export async function record(tx: Prisma.TransactionClient, entry: AuditEntry): Promise<void> {
  await tx.auditLog.create({ data: { ...entry, changes: entry.changes ?? Prisma.DbNull } });
}

function truncate(value: AuditValue): AuditValue {
  return typeof value === 'string' && value.length > MAX_RECORDED_LENGTH
    ? value.slice(0, MAX_RECORDED_LENGTH)
    : value;
}

/**
 * `{ field: { from, to } }` for each listed field whose value differs, or `null` if none do.
 * Values are compared in full and only truncated when recorded.
 */
export function diff<K extends string, T extends Record<K, AuditValue>>(
  before: T,
  after: T,
  fields: readonly K[],
): AuditChanges | null {
  const changes: AuditChanges = {};
  for (const field of fields) {
    if (before[field] !== after[field]) {
      changes[field] = { from: truncate(before[field]), to: truncate(after[field]) };
    }
  }
  return Object.keys(changes).length > 0 ? changes : null;
}
