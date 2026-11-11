import { z } from 'zod';
import { dateRangeFields, withValidDateRange } from '../../utils/dateRange.js';
import { paginationQuerySchema } from '../../utils/pagination.js';
import { emailSchema, emptyToUndefined, phoneSchema } from '../../utils/validators.js';
import { SPECIALIZATIONS } from './doctor.model.js';

export const DOCTOR_SORT_OPTIONS = ['newest', 'oldest', 'name_asc', 'name_desc'] as const;

export const createDoctorSchema = z.object({
  name: z.string().trim().min(2, 'Name must be at least 2 characters').max(100),
  specialization: z.enum(SPECIALIZATIONS, {
    errorMap: () => ({ message: 'Select a valid specialization' }),
  }),
  hospital: z.string().trim().min(2, 'Hospital must be at least 2 characters').max(150),
  phone: phoneSchema,
  email: emailSchema,
});

export const listDoctorsQuerySchema = withValidDateRange(
  paginationQuerySchema.extend({
    search: z
      .preprocess(emptyToUndefined, z.string().trim().max(100).optional())
      .describe('Prefix search on name, e-mail, phone and hospital (e.g. "dr rah")'),
    specialization: z
      .preprocess(emptyToUndefined, z.enum(SPECIALIZATIONS).optional())
      .describe('Filter by specialization'),
    sort: z
      .preprocess(emptyToUndefined, z.enum(DOCTOR_SORT_OPTIONS).default('newest'))
      .describe('Sort order'),
    ...dateRangeFields,
  }),
);

export type CreateDoctorInput = z.infer<typeof createDoctorSchema>;
export type ListDoctorsQuery = z.infer<typeof listDoctorsQuerySchema>;
export type DoctorSort = (typeof DOCTOR_SORT_OPTIONS)[number];
