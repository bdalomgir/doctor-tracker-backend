import { Schema, model, type InferSchemaType } from 'mongoose';
import { hideInternalFields, tokenize } from '../../utils/search.js';

export const PATIENT_CONDITIONS = [
  'stable',
  'under_observation',
  'recovering',
  'critical',
  'discharged',
] as const;

export const GENDERS = ['male', 'female', 'other'] as const;

const patientSchema = new Schema(
  {
    name: { type: String, required: true, trim: true, maxlength: 100 },
    age: { type: Number, required: true, min: 0, max: 130 },
    gender: { type: String, required: true, enum: GENDERS },
    phone: { type: String, required: true, trim: true },
    email: { type: String, trim: true, lowercase: true },
    condition: { type: String, required: true, enum: PATIENT_CONDITIONS, default: 'stable' },
    diagnosis: { type: String, required: true, trim: true, maxlength: 200 },
    admittedAt: { type: Date, required: true, default: () => new Date() },
    doctor: { type: Schema.Types.ObjectId, ref: 'Doctor', required: true },
    searchTokens: { type: [String], select: false },
  },
  { timestamps: true, versionKey: false },
);

// Keep the internal search index out of API responses.
patientSchema.set('toObject', { transform: hideInternalFields });

patientSchema.pre('validate', function () {
  this.searchTokens = tokenize(this.name, this.email, this.phone, this.diagnosis);
});

/*
 * Indexes (Equality -> Sort -> Range ordering). `_id` is the sort tie-breaker for
 * stable pagination; including it lets MongoDB return rows in index order
 * instead of running a blocking in-memory SORT:
 *  - doctor + admittedAt:     a doctor's patient list, "patients per doctor" aggregation
 *  - condition + admittedAt:  condition filter sorted / ranged by admission date
 *  - admittedAt + _id:        default listing, date range filter, dashboard time series
 *  - searchTokens:            prefix search (multikey index)
 *  - name + _id:              alphabetical sorting (A–Z / Z–A)
 */
patientSchema.index({ doctor: 1, admittedAt: -1, _id: -1 });
patientSchema.index({ condition: 1, admittedAt: -1, _id: -1 });
patientSchema.index({ admittedAt: -1, _id: -1 });
patientSchema.index({ searchTokens: 1 });
patientSchema.index({ name: 1, _id: 1 });

export type Patient = InferSchemaType<typeof patientSchema>;

export const PatientModel = model('Patient', patientSchema);
