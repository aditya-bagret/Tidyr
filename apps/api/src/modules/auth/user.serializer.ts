import type { User } from '@tidyr/shared';
import type { User as UserRow } from '../../generated/prisma/client';

/** Columns a user DTO needs. Queries select exactly these unless they also need the hash. */
export const userDtoSelect = { id: true, fullName: true, email: true, createdAt: true } as const;

/** The only way a user leaves the API: an explicit allow-list, never `passwordHash` (SEC-03). */
export function toUserDto(user: Pick<UserRow, keyof typeof userDtoSelect>): User {
  return {
    id: user.id,
    fullName: user.fullName,
    email: user.email,
    createdAt: user.createdAt.toISOString(),
  };
}
