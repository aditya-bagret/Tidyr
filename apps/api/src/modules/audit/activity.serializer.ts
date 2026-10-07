import type { ActivityEntry, FieldChange } from '@tidyr/shared';
import type { Prisma } from '../../generated/prisma/client';

/** Columns an activity entry needs. `userId` and `projectId` stay internal. */
export const activityDtoSelect = {
  id: true,
  entityType: true,
  entityId: true,
  action: true,
  changes: true,
  createdAt: true,
} as const satisfies Prisma.AuditLogSelect;

export type ActivityDtoRow = Prisma.AuditLogGetPayload<{ select: typeof activityDtoSelect }>;

const isJsonObject = (value: Prisma.JsonValue | undefined): value is Prisma.JsonObject =>
  typeof value === 'object' && value !== null && !Array.isArray(value);

/** `audit.record` writes `{ field: { from, to } }` or SQL NULL; anything else is dropped. */
function toChanges(value: Prisma.JsonValue): Record<string, FieldChange> | null {
  if (!isJsonObject(value)) return null;
  const changes: Record<string, FieldChange> = {};
  for (const [field, change] of Object.entries(value)) {
    if (isJsonObject(change)) changes[field] = { from: change.from ?? null, to: change.to ?? null };
  }
  return changes;
}

/** The only way an audit row leaves the API: an explicit allow-list. */
export function toActivityDto(row: ActivityDtoRow): ActivityEntry {
  return {
    id: row.id,
    entityType: row.entityType,
    entityId: row.entityId,
    action: row.action,
    changes: toChanges(row.changes),
    createdAt: row.createdAt.toISOString(),
  };
}
