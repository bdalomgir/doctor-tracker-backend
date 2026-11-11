import { z } from 'zod';

export const MAX_PAGE_SIZE = 100;

/** Shared query params for every paginated list endpoint. */
export const paginationQuerySchema = z.object({
  page: z.coerce.number().int().min(1).default(1).describe('Page number (1-based)'),
  limit: z.coerce
    .number()
    .int()
    .min(1)
    .max(MAX_PAGE_SIZE)
    .default(10)
    .describe(`Items per page (max ${MAX_PAGE_SIZE})`),
});

export interface PaginationMeta {
  page: number;
  limit: number;
  total: number;
  totalPages: number;
}

export interface Paginated<T> {
  data: T[];
  meta: PaginationMeta;
}

export function buildPaginationMeta(page: number, limit: number, total: number): PaginationMeta {
  return { page, limit, total, totalPages: Math.max(1, Math.ceil(total / limit)) };
}
