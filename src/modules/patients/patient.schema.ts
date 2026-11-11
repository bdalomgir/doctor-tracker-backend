import { z } from 'zod';
import { dateRangeFields, withValidDateRange } from '../../utils/dateRange.js';
import { paginationQuerySchema } from '../../utils/pagination.js';
import {
  emailSchema,
  emptyToUndefined,
  objectIdSchema,
  phoneSchema,
} from '../../utils/validators.js';
import { GENDERS, PATIENT_CONDITIONS } from './patient.model.js';

export const PATIENT_SORT_OPTIONS = ['newest', 'oldest', 'name_asc', 'name_desc'] as const;

/** Fields shared by "add patient to doctor" and "edit patient". */
const patientFieldsSchema = z.object({
  name: z.string().trim().min(2, 'Name must be at least 2 characters').max(100),
  age: z.coerce.number().int().min(0, 'Age must be 0 or more').max(130, 'Age looks invalid'),
  gender: z.enum(GENDERS, { errorMap: () => ({ message: 'Select a gender' }) }),
  phone: phoneSchema,
  email: z.preprocess(emptyToUndefined, emailSchema.optional()),
  condition: z.enum(PATIENT_CONDITIONS, { errorMap: () => ({ message: 'Select a condition' }) }),
  diagnosis: z.string().trim().min(2, 'Diagnosis is required').max(200),
  admittedAt: z.coerce
    .date()
    .refine((date) => date <= new Date(), 'Admission date cannot be in the future'),
});

/** Body of `POST /doctors/:id/patients` — the doctor comes from the URL. */
export const createPatientSchema = patientFieldsSchema;

/** Body of `PATCH /patients/:id` — every field optional; the patient may be re-assigned. */
export const updatePatientSchema = patientFieldsSchema
  .extend({ doctor: objectIdSchema })
  .partial()
  .refine((value) => Object.keys(value).length > 0, 'Provide at least one field to update');

export const listPatientsQuerySchema = withValidDateRange(
  paginationQuerySchema.extend({
    search: z
      .preprocess(emptyToUndefined, z.string().trim().max(100).optional())
      .describe('Prefix search on name, phone, e-mail and diagnosis'),
    condition: z
      .preprocess(emptyToUndefined, z.enum(PATIENT_CONDITIONS).optional())
      .describe('Filter by condition'),
    gender: z.preprocess(emptyToUndefined, z.enum(GENDERS).optional()).describe('Filter by gender'),
    doctor: z
      .preprocess(emptyToUndefined, objectIdSchema.optional())
      .describe('Filter by doctor id (ignored on /doctors/{id}/patients)'),
    sort: z
      .preprocess(emptyToUndefined, z.enum(PATIENT_SORT_OPTIONS).default('newest'))
      .describe('Sort order (by admission date or name)'),
    ...dateRangeFields,
  }),
);

export type CreatePatientInput = z.infer<typeof createPatientSchema>;
export type UpdatePatientInput = z.infer<typeof updatePatientSchema>;
export type ListPatientsQuery = z.infer<typeof listPatientsQuerySchema>;
export type PatientSort = (typeof PATIENT_SORT_OPTIONS)[number];
