import { startOfDayInTimeZone, toDayKey } from '../../utils/timezone.js';
import { DoctorModel } from '../doctors/doctor.model.js';
import { PatientModel } from '../patients/patient.model.js';
import type { DashboardQuery } from './dashboard.schema.js';

const DAY_MS = 24 * 60 * 60 * 1000;
const TOP_DOCTORS_LIMIT = 10;

/**
 * Builds every dashboard metric with small, independent queries executed in
 * parallel. Each one starts with a `$match`/`$group` that can use an index
 * (unlike `$facet`, whose sub-pipelines cannot use indexes), and only the final
 * top-N rows are joined with `$lookup` — never the whole collection.
 */
export async function getDashboardStats({ days, timezone }: DashboardQuery) {
  // The period is `days` whole local days, today included, in the viewer's time zone.
  const now = new Date();
  const periodStart = startOfDayInTimeZone(new Date(now.getTime() - (days - 1) * DAY_MS), timezone);
  const previousPeriodStart = new Date(periodStart.getTime() - days * DAY_MS);

  const [
    totalDoctors,
    totalPatients,
    criticalPatients,
    patientsInPeriod,
    patientsInPreviousPeriod,
    doctorsInPeriod,
    patientsPerDoctor,
    admissionsByDay,
    conditionBreakdown,
    doctorsBySpecialization,
  ] = await Promise.all([
    // Metadata-based counts: O(1), no collection scan.
    DoctorModel.estimatedDocumentCount(),
    PatientModel.estimatedDocumentCount(),
    PatientModel.countDocuments({ condition: 'critical' }),
    PatientModel.countDocuments({ admittedAt: { $gte: periodStart } }),
    PatientModel.countDocuments({ admittedAt: { $gte: previousPeriodStart, $lt: periodStart } }),
    DoctorModel.countDocuments({ createdAt: { $gte: periodStart } }),

    PatientModel.aggregate<{
      doctorId: string;
      name: string;
      specialization: string;
      count: number;
    }>([
      { $group: { _id: '$doctor', count: { $sum: 1 } } },
      { $sort: { count: -1 } },
      { $limit: TOP_DOCTORS_LIMIT },
      {
        $lookup: {
          from: 'doctors',
          localField: '_id',
          foreignField: '_id',
          pipeline: [{ $project: { name: 1, specialization: 1 } }],
          as: 'doctor',
        },
      },
      { $unwind: '$doctor' },
      {
        $project: {
          _id: 0,
          doctorId: { $toString: '$_id' },
          name: '$doctor.name',
          specialization: '$doctor.specialization',
          count: 1,
        },
      },
    ]),

    PatientModel.aggregate<{ _id: string; count: number }>([
      { $match: { admittedAt: { $gte: periodStart } } },
      {
        $group: {
          _id: { $dateToString: { format: '%Y-%m-%d', date: '$admittedAt', timezone } },
          count: { $sum: 1 },
        },
      },
    ]),

    PatientModel.aggregate<{ condition: string; count: number }>([
      { $group: { _id: '$condition', count: { $sum: 1 } } },
      { $project: { _id: 0, condition: '$_id', count: 1 } },
      { $sort: { count: -1 } },
    ]),

    DoctorModel.aggregate<{ specialization: string; count: number }>([
      { $group: { _id: '$specialization', count: { $sum: 1 } } },
      { $project: { _id: 0, specialization: '$_id', count: 1 } },
      { $sort: { count: -1 } },
    ]),
  ]);

  // Fill days without admissions with 0 so the chart has a continuous x-axis.
  const countsByDay = new Map(admissionsByDay.map((row) => [row._id, row.count]));
  // Keys are taken at local noon so DST shifts can never skip or repeat a day.
  const firstNoon = periodStart.getTime() + DAY_MS / 2;
  const admissionsTimeline = Array.from({ length: days }, (_, index) => {
    const date = toDayKey(new Date(firstNoon + index * DAY_MS), timezone);
    return { date, count: countsByDay.get(date) ?? 0 };
  });

  const growth =
    patientsInPreviousPeriod === 0
      ? null
      : Math.round(
          ((patientsInPeriod - patientsInPreviousPeriod) / patientsInPreviousPeriod) * 100,
        );

  return {
    range: { days, from: periodStart.toISOString(), to: now.toISOString() },
    totals: {
      doctors: totalDoctors,
      patients: totalPatients,
      criticalPatients,
      avgPatientsPerDoctor: totalDoctors ? Number((totalPatients / totalDoctors).toFixed(1)) : 0,
    },
    period: {
      newPatients: patientsInPeriod,
      previousNewPatients: patientsInPreviousPeriod,
      newPatientsGrowth: growth,
      newDoctors: doctorsInPeriod,
    },
    patientsPerDoctor,
    admissionsTimeline,
    conditionBreakdown,
    doctorsBySpecialization,
  };
}
