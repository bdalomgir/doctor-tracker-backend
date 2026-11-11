/**
 * Seeds the admin account and (optionally) demo data.
 *
 *   npm run seed            -> creates/updates the admin user only
 *   npm run seed -- --demo  -> also resets doctors & patients with demo data
 */
import { connectDatabase, disconnectDatabase } from '../config/db.js';
import { env } from '../config/env.js';
import { hashPassword } from '../modules/auth/auth.service.js';
import { UserModel } from '../modules/auth/user.model.js';
import { DoctorModel, SPECIALIZATIONS } from '../modules/doctors/doctor.model.js';
import { GENDERS, PATIENT_CONDITIONS, PatientModel } from '../modules/patients/patient.model.js';
import { tokenize } from '../utils/search.js';

const DOCTOR_COUNT = 36;
const PATIENT_COUNT = 900;
const HISTORY_DAYS = 400;
const DAY_MS = 24 * 60 * 60 * 1000;

const FIRST_NAMES = [
  'Ayesha',
  'Rahim',
  'Karim',
  'Nusrat',
  'Tanvir',
  'Farhana',
  'Imran',
  'Sadia',
  'Arif',
  'Mehnaz',
  'Rafiq',
  'Sumaiya',
  'Hasan',
  'Tahmina',
  'Sabbir',
  'Nadia',
  'Fahim',
  'Shirin',
  'Zahid',
  'Laila',
  'Omar',
  'Priya',
  'James',
  'Emily',
  'Daniel',
  'Sophia',
  'Michael',
  'Olivia',
  'David',
  'Mia',
];
const LAST_NAMES = [
  'Rahman',
  'Hossain',
  'Ahmed',
  'Islam',
  'Chowdhury',
  'Khan',
  'Akter',
  'Uddin',
  'Sarker',
  'Das',
  'Roy',
  'Begum',
  'Talukder',
  'Mahmud',
  'Haque',
  'Smith',
  'Carter',
  'Bennett',
  'Walker',
  'Brooks',
];
const HOSPITALS = [
  'Square Hospital',
  'United Hospital',
  'Evercare Hospital',
  'Labaid Specialized Hospital',
  'Popular Medical College Hospital',
  'Ibn Sina Hospital',
  'Green Life Medical College',
  'BIRDEM General Hospital',
];
const DIAGNOSES = [
  'Hypertension',
  'Type 2 Diabetes',
  'Asthma',
  'Migraine',
  'Dengue Fever',
  'Pneumonia',
  'Fractured Arm',
  'Gastritis',
  'Chronic Kidney Disease',
  'Arrhythmia',
  'Eczema',
  'Bronchitis',
  'Anemia',
  'Thyroid Disorder',
  'Lower Back Pain',
  'Appendicitis',
  'Cataract',
  'Depression',
];
// Weighted so the condition chart looks realistic (mostly stable, few critical).
const CONDITION_WEIGHTS: Record<(typeof PATIENT_CONDITIONS)[number], number> = {
  stable: 40,
  recovering: 25,
  under_observation: 15,
  discharged: 12,
  critical: 8,
};

const pick = <T>(items: readonly T[]): T => items[Math.floor(Math.random() * items.length)]!;
const randomInt = (min: number, max: number) => Math.floor(Math.random() * (max - min + 1)) + min;
const randomPhone = () => `+8801${randomInt(3, 9)}${randomInt(10_000_000, 99_999_999)}`;

function weightedCondition() {
  const total = Object.values(CONDITION_WEIGHTS).reduce((sum, weight) => sum + weight, 0);
  let roll = Math.random() * total;
  for (const [condition, weight] of Object.entries(CONDITION_WEIGHTS)) {
    roll -= weight;
    if (roll <= 0) return condition;
  }
  return 'stable';
}

/**
 * Random date between `from` and now. `skew` > 1 favours recent dates (growth
 * curve for patients), `skew` < 1 favours older dates (established doctors).
 */
function randomDateSince(from: Date, skew: number): Date {
  const span = Date.now() - from.getTime();
  return new Date(from.getTime() + Math.pow(Math.random(), 1 / skew) * span);
}

async function seedAdmin() {
  const password = await hashPassword(env.SEED_ADMIN_PASSWORD);
  await UserModel.updateOne(
    { email: env.SEED_ADMIN_EMAIL },
    { $set: { name: env.SEED_ADMIN_NAME, password, role: 'admin' } },
    { upsert: true },
  );
  console.log(`Admin ready: ${env.SEED_ADMIN_EMAIL}`);
}

async function seedDemoData() {
  await Promise.all([DoctorModel.deleteMany({}), PatientModel.deleteMany({})]);
  const historyStart = new Date(Date.now() - HISTORY_DAYS * DAY_MS);

  const doctors = Array.from({ length: DOCTOR_COUNT }, (_, index) => {
    const name = `Dr. ${pick(FIRST_NAMES)} ${pick(LAST_NAMES)}`;
    const hospital = pick(HOSPITALS);
    const email = `${name
      .replace(/^Dr\.\s/, '')
      .toLowerCase()
      .replace(/\s+/g, '.')}${index}@clinic.com`;
    const phone = randomPhone();
    const createdAt = randomDateSince(historyStart, 0.6);
    return {
      name,
      specialization: pick(SPECIALIZATIONS),
      hospital,
      phone,
      email,
      createdAt,
      updatedAt: createdAt,
      // insertMany with `lean` skips hooks, so tokens are computed here.
      searchTokens: tokenize(name, email, phone, hospital),
    };
  });

  const insertedDoctors = await DoctorModel.insertMany(doctors, { lean: true });

  // Uneven distribution so "patients per doctor" is meaningful.
  const doctorWeights = insertedDoctors.map(() => Math.random() ** 2 + 0.05);
  const weightTotal = doctorWeights.reduce((sum, weight) => sum + weight, 0);
  const pickDoctor = () => {
    let roll = Math.random() * weightTotal;
    for (let i = 0; i < insertedDoctors.length; i++) {
      roll -= doctorWeights[i]!;
      if (roll <= 0) return insertedDoctors[i]!;
    }
    return insertedDoctors[0]!;
  };

  const patients = Array.from({ length: PATIENT_COUNT }, () => {
    const doctor = pickDoctor();
    const name = `${pick(FIRST_NAMES)} ${pick(LAST_NAMES)}`;
    const email =
      Math.random() > 0.3
        ? `${name.toLowerCase().replace(/\s+/g, '.')}${randomInt(1, 999)}@mail.com`
        : undefined;
    const phone = randomPhone();
    const diagnosis = pick(DIAGNOSES);
    // A patient can only be admitted after their doctor joined.
    const admittedAt = randomDateSince(doctor.createdAt, 1.4);
    return {
      name,
      age: randomInt(1, 90),
      gender: pick(GENDERS),
      phone,
      ...(email && { email }),
      condition: weightedCondition(),
      diagnosis,
      admittedAt,
      doctor: doctor._id,
      createdAt: admittedAt,
      updatedAt: admittedAt,
      searchTokens: tokenize(name, email, phone, diagnosis),
    };
  });

  await PatientModel.insertMany(patients, { lean: true });
  console.log(`Demo data: ${DOCTOR_COUNT} doctors, ${PATIENT_COUNT} patients`);
}

async function main() {
  await connectDatabase();

  // Make sure every schema-declared index exists (idempotent).
  await Promise.all([
    UserModel.syncIndexes(),
    DoctorModel.syncIndexes(),
    PatientModel.syncIndexes(),
  ]);

  await seedAdmin();
  if (process.argv.includes('--demo')) await seedDemoData();

  await disconnectDatabase();
}

main().catch(async (error) => {
  console.error('Seed failed:', error);
  await disconnectDatabase();
  process.exit(1);
});
