import { Schema, model, type InferSchemaType } from 'mongoose';
import { hideInternalFields, tokenize } from '../../utils/search.js';

export const SPECIALIZATIONS = [
  'Cardiology',
  'Dermatology',
  'Endocrinology',
  'Gastroenterology',
  'General Medicine',
  'Gynecology',
  'Nephrology',
  'Neurology',
  'Oncology',
  'Ophthalmology',
  'Orthopedics',
  'Pediatrics',
  'Psychiatry',
  'Pulmonology',
  'Radiology',
  'Urology',
] as const;

const doctorSchema = new Schema(
  {
    name: { type: String, required: true, trim: true, maxlength: 100 },
    specialization: { type: String, required: true, enum: SPECIALIZATIONS },
    hospital: { type: String, required: true, trim: true, maxlength: 150 },
    phone: { type: String, required: true, trim: true },
    email: { type: String, required: true, trim: true, lowercase: true, unique: true },
    // Denormalised, lower-cased words used by the index-backed prefix search.
    searchTokens: { type: [String], select: false },
  },
  { timestamps: true, versionKey: false },
);

// Keep the internal search index out of API responses.
doctorSchema.set('toObject', { transform: hideInternalFields });

doctorSchema.pre('validate', function () {
  this.searchTokens = tokenize(this.name, this.email, this.phone, this.hospital);
});

/*
 * Indexes — each one backs a concrete query pattern of the list endpoint:
 *  - searchTokens:                 prefix search (multikey index)
 *  - createdAt + _id:              default "newest first" listing & date range filter
 *  - specialization + createdAt:   specialization filter, sorted by date (ESR rule)
 *  - name:                         alphabetical sorting
 *  - email (unique, declared above)
 */
doctorSchema.index({ searchTokens: 1 });
doctorSchema.index({ createdAt: -1, _id: -1 });
doctorSchema.index({ specialization: 1, createdAt: -1, _id: -1 });
doctorSchema.index({ name: 1, _id: 1 });

export type Doctor = InferSchemaType<typeof doctorSchema>;

export const DoctorModel = model('Doctor', doctorSchema);
