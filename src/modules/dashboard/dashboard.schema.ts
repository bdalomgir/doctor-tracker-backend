import { z } from 'zod';

export const DASHBOARD_RANGES = [7, 30, 90, 365] as const;

function isValidTimeZone(timeZone: string): boolean {
  try {
    new Intl.DateTimeFormat('en-US', { timeZone });
    return true;
  } catch {
    return false;
  }
}

export const dashboardQuerySchema = z.object({
  days: z.coerce
    .number()
    .refine((value) => (DASHBOARD_RANGES as readonly number[]).includes(value), {
      message: `days must be one of ${DASHBOARD_RANGES.join(', ')}`,
    })
    .default(30)
    .describe(`Period length in days: ${DASHBOARD_RANGES.join(', ')}`),
  // Used to bucket the time series by the viewer's local day instead of UTC.
  timezone: z
    .string()
    .refine(isValidTimeZone, 'Invalid timezone')
    .default('UTC')
    .describe('IANA time zone for daily buckets, e.g. Asia/Dhaka'),
});

export type DashboardQuery = z.infer<typeof dashboardQuerySchema>;
