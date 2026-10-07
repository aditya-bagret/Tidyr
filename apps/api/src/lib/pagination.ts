import type { PageMeta, Pagination } from '@tidyr/shared';

/** Prisma `skip`/`take` for a validated `page`/`limit`. */
export function toSkipTake({ page, limit }: Pagination): { skip: number; take: number } {
  return { skip: (page - 1) * limit, take: limit };
}

/** A page past the last one still reports the real total (API_CONTRACT §1.1). */
export function toPageMeta({ page, limit }: Pagination, total: number): PageMeta {
  return { page, limit, total, totalPages: Math.ceil(total / limit) };
}
