import { z } from 'zod';
import { emptyToUndefined } from './validators.js';

const DATE_ONLY = /^\d{4}-\d{2}-\d{2}$/;

/**
 * Accepts a date-only value (`2026-01-31`, interpreted as a UTC day) or a full
 * ISO date-time (used as-is). Clients in other time zones should send exact
 * instants for their local day boundaries, e.g. `2026-01-30T18:00:00.000Z`.
 */
const boundary = (endOfDay: boolean) =>
  z.preprocess(
    emptyToUndefined,
    z
      .string()
      .refine((value) => !Number.isNaN(Date.parse(value)), 'Invalid date')
      .transform((value) => {
        const date = new Date(value);
        if (endOfDay && DATE_ONLY.test(value)) date.setUTCHours(23, 59, 59, 999);
        return date;
      })
      .optional(),
  );

/** `from` / `to` query fields, to spread into a list endpoint's query object. */
export const dateRangeFields = {
  from: boundary(false).describe('Start of the range (inclusive): YYYY-MM-DD or ISO date-time'),
  to: boundary(true).describe('End of the range (inclusive): YYYY-MM-DD or ISO date-time'),
};

/**
 * Adds the "`from` must not be after `to`" check to a query schema. Kept as a
 * refinement on the whole object (rather than an intersection) so the schema
 * stays a single object that the OpenAPI generator can document.
 */
export function withValidDateRange<T extends z.AnyZodObject>(
  schema: T,
): z.ZodEffects<T, z.output<T>, z.input<T>> {
  // Explicit return type keeps the concrete query type (otherwise inferred from the `any` bound).
  return schema.refine(
    (value) => {
      const { from, to } = value as { from?: Date; to?: Date };
      return !from || !to || from <= to;
    },
    { message: '`from` must be before or equal to `to`', path: ['from'] },
  );
}

export function buildDateRangeFilter(
  field: string,
  from?: Date,
  to?: Date,
): Record<string, unknown> {
  if (!from && !to) return {};

  return {
    [field]: {
      ...(from && { $gte: from }),
      ...(to && { $lte: to }),
    },
  };
}
