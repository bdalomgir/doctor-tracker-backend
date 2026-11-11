import type { SortOrder } from 'mongoose';
import { ApiError } from '../../utils/ApiError.js';
import { buildDateRangeFilter } from '../../utils/dateRange.js';
import { buildPaginationMeta } from '../../utils/pagination.js';
import { buildSearchFilter } from '../../utils/search.js';
import { assertDoctorExists } from '../doctors/doctor.service.js';
import { PatientModel } from './patient.model.js';
import type {
  CreatePatientInput,
  ListPatientsQuery,
  PatientSort,
  UpdatePatientInput,
} from './patient.schema.js';

const SORT_MAP: Record<PatientSort, Record<string, SortOrder>> = {
  newest: { admittedAt: -1, _id: -1 },
  oldest: { admittedAt: 1, _id: 1 },
  name_asc: { name: 1, _id: 1 },
  name_desc: { name: -1, _id: -1 },
};

/** Only the fields the UI needs from the referenced doctor. */
const DOCTOR_PROJECTION = 'name specialization hospital';

export async function listPatients(query: ListPatientsQuery) {
  const { page, limit, search, condition, gender, doctor, from, to, sort } = query;

  const filter = {
    ...buildSearchFilter(search),
    ...buildDateRangeFilter('admittedAt', from, to),
    ...(condition && { condition }),
    ...(gender && { gender }),
    ...(doctor && { doctor }),
  };

  const [patients, total] = await Promise.all([
    PatientModel.find(filter)
      .sort(SORT_MAP[sort])
      .skip((page - 1) * limit)
      .limit(limit)
      // populate issues ONE extra `$in` query for the whole page, not one per row.
      .populate('doctor', DOCTOR_PROJECTION)
      .lean(),
    PatientModel.countDocuments(filter),
  ]);

  return { data: patients, meta: buildPaginationMeta(page, limit, total) };
}

export async function createPatientForDoctor(doctorId: string, input: CreatePatientInput) {
  await assertDoctorExists(doctorId);

  const patient = await PatientModel.create({ ...input, doctor: doctorId });
  await patient.populate('doctor', DOCTOR_PROJECTION);
  return patient.toObject();
}

export async function updatePatient(id: string, input: UpdatePatientInput) {
  const patient = await PatientModel.findById(id);
  if (!patient) throw ApiError.notFound('Patient not found');

  if (input.doctor && String(patient.doctor) !== input.doctor) {
    await assertDoctorExists(input.doctor);
  }

  // `set` + `save` (instead of findByIdAndUpdate) runs schema validators and the
  // pre-validate hook, so the search tokens stay in sync with the edited fields.
  // A cleared optional field (e.g. email: undefined) is unset by Mongoose.
  patient.set(input);
  await patient.save();
  await patient.populate('doctor', DOCTOR_PROJECTION);
  return patient.toObject();
}

export async function deletePatient(id: string, doctorId?: string): Promise<void> {
  // When called from a doctor's page, the patient must belong to that doctor.
  const filter = doctorId ? { _id: id, doctor: doctorId } : { _id: id };
  const result = await PatientModel.deleteOne(filter);
  if (result.deletedCount === 0) throw ApiError.notFound('Patient not found');
}
