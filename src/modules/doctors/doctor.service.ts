import { Types, type SortOrder } from 'mongoose';
import { ApiError } from '../../utils/ApiError.js';
import { buildDateRangeFilter } from '../../utils/dateRange.js';
import { buildPaginationMeta } from '../../utils/pagination.js';
import { buildSearchFilter } from '../../utils/search.js';
import { PatientModel } from '../patients/patient.model.js';
import { DoctorModel } from './doctor.model.js';
import type { CreateDoctorInput, DoctorSort, ListDoctorsQuery } from './doctor.schema.js';

const SORT_MAP: Record<DoctorSort, Record<string, SortOrder>> = {
  newest: { createdAt: -1, _id: -1 },
  oldest: { createdAt: 1, _id: 1 },
  name_asc: { name: 1, _id: 1 },
  name_desc: { name: -1, _id: -1 },
};

/**
 * Counts patients for the given doctors only (i.e. the current page), using the
 * `{ doctor, admittedAt }` index. Much cheaper than a `$lookup` across the whole
 * collection or keeping a counter in sync on every write.
 */
async function countPatientsByDoctor(doctorIds: Types.ObjectId[]): Promise<Map<string, number>> {
  if (doctorIds.length === 0) return new Map();

  const rows = await PatientModel.aggregate<{ _id: Types.ObjectId; count: number }>([
    { $match: { doctor: { $in: doctorIds } } },
    { $group: { _id: '$doctor', count: { $sum: 1 } } },
  ]);

  return new Map(rows.map((row) => [String(row._id), row.count]));
}

export async function createDoctor(input: CreateDoctorInput) {
  const doctor = await DoctorModel.create(input);
  return { ...doctor.toObject(), patientCount: 0 };
}

export async function listDoctors(query: ListDoctorsQuery) {
  const { page, limit, search, specialization, from, to, sort } = query;

  const filter = {
    ...buildSearchFilter(search),
    ...buildDateRangeFilter('createdAt', from, to),
    ...(specialization && { specialization }),
  };

  // Page and total are independent, so run them concurrently.
  const [doctors, total] = await Promise.all([
    DoctorModel.find(filter)
      .sort(SORT_MAP[sort])
      .skip((page - 1) * limit)
      .limit(limit)
      .lean(),
    DoctorModel.countDocuments(filter),
  ]);

  const counts = await countPatientsByDoctor(doctors.map((doctor) => doctor._id));

  return {
    data: doctors.map((doctor) => ({
      ...doctor,
      patientCount: counts.get(String(doctor._id)) ?? 0,
    })),
    meta: buildPaginationMeta(page, limit, total),
  };
}

export async function getDoctorById(id: string) {
  const [doctor, patientCount] = await Promise.all([
    DoctorModel.findById(id).lean(),
    PatientModel.countDocuments({ doctor: id }),
  ]);

  if (!doctor) throw ApiError.notFound('Doctor not found');

  return { ...doctor, patientCount };
}

/** Throws 404 unless the doctor exists. Used before attaching patients to a doctor. */
export async function assertDoctorExists(id: string): Promise<void> {
  const exists = await DoctorModel.exists({ _id: id });
  if (!exists) throw ApiError.notFound('Doctor not found');
}
