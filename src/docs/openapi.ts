/**
 * OpenAPI 3 document, generated from the same Zod schemas the routes use for
 * validation, so the documentation cannot drift from the real request rules.
 * Served by Swagger UI at `/api-docs` (raw JSON at `/api-docs.json`).
 */
import {
  extendZodWithOpenApi,
  OpenApiGeneratorV3,
  OpenAPIRegistry,
  type ResponseConfig,
} from '@asteasolutions/zod-to-openapi';
import { z } from 'zod';
import { loginSchema } from '../modules/auth/auth.schema.js';
import { USER_ROLES } from '../modules/auth/user.model.js';
import { dashboardQuerySchema } from '../modules/dashboard/dashboard.schema.js';
import { SPECIALIZATIONS } from '../modules/doctors/doctor.model.js';
import { createDoctorSchema, listDoctorsQuerySchema } from '../modules/doctors/doctor.schema.js';
import { GENDERS, PATIENT_CONDITIONS } from '../modules/patients/patient.model.js';
import {
  createPatientSchema,
  listPatientsQuerySchema,
  updatePatientSchema,
} from '../modules/patients/patient.schema.js';
import { objectIdSchema } from '../utils/validators.js';

extendZodWithOpenApi(z);

const registry = new OpenAPIRegistry();

// ---------------------------------------------------------------------------
// Security
// ---------------------------------------------------------------------------

const cookieAuth = registry.registerComponent('securitySchemes', 'cookieAuth', {
  type: 'apiKey',
  in: 'cookie',
  name: 'access_token',
  description:
    'httpOnly JWT cookie set by `POST /api/auth/login`. In this page, call the login endpoint ' +
    'first ("Try it out"); the browser then sends the cookie with every request.',
});
const secured = [{ [cookieAuth.name]: [] }];

// ---------------------------------------------------------------------------
// Shared response schemas
// ---------------------------------------------------------------------------

const ObjectId = z.string().openapi({ example: '6af31c26e2b6ebfefa03a094' });
const Timestamp = z.string().datetime().openapi({ example: '2026-11-10T09:34:53.360Z' });

const ErrorResponse = registry.register(
  'ErrorResponse',
  z.object({
    success: z.literal(false),
    message: z.string().openapi({ example: 'Validation failed' }),
    errors: z
      .record(z.array(z.string()))
      .optional()
      .openapi({
        description: 'Field-level messages (validation / duplicate errors)',
        example: { email: ['Enter a valid email'] },
      }),
  }),
);

const PaginationMeta = registry.register(
  'PaginationMeta',
  z.object({
    page: z.number().int().openapi({ example: 1 }),
    limit: z.number().int().openapi({ example: 10 }),
    total: z.number().int().openapi({ example: 36 }),
    totalPages: z.number().int().openapi({ example: 4 }),
  }),
);

const User = registry.register(
  'User',
  z.object({
    id: ObjectId,
    name: z.string().openapi({ example: 'Admin' }),
    email: z.string().email().openapi({ example: 'admin@doctortracker.com' }),
    role: z.enum(USER_ROLES),
  }),
);

const Doctor = registry.register(
  'Doctor',
  z.object({
    _id: ObjectId,
    name: z.string().openapi({ example: 'Dr. Ayesha Rahman' }),
    specialization: z.enum(SPECIALIZATIONS),
    hospital: z.string().openapi({ example: 'Square Hospital' }),
    phone: z.string().openapi({ example: '+8801711000000' }),
    email: z.string().email().openapi({ example: 'ayesha.rahman@clinic.com' }),
    patientCount: z.number().int().openapi({ example: 24 }),
    createdAt: Timestamp,
    updatedAt: Timestamp,
  }),
);

const Patient = registry.register(
  'Patient',
  z.object({
    _id: ObjectId,
    name: z.string().openapi({ example: 'Rahim Uddin' }),
    age: z.number().int().openapi({ example: 42 }),
    gender: z.enum(GENDERS),
    phone: z.string().openapi({ example: '01811223344' }),
    email: z.string().email().optional(),
    condition: z.enum(PATIENT_CONDITIONS),
    diagnosis: z.string().openapi({ example: 'Hypertension' }),
    admittedAt: Timestamp,
    doctor: z.object({
      _id: ObjectId,
      name: z.string(),
      specialization: z.enum(SPECIALIZATIONS),
      hospital: z.string(),
    }),
    createdAt: Timestamp,
    updatedAt: Timestamp,
  }),
);

const DashboardStats = registry.register(
  'DashboardStats',
  z.object({
    range: z.object({ days: z.number().int(), from: Timestamp, to: Timestamp }),
    totals: z.object({
      doctors: z.number().int(),
      patients: z.number().int(),
      criticalPatients: z.number().int(),
      avgPatientsPerDoctor: z.number(),
    }),
    period: z.object({
      newPatients: z.number().int(),
      previousNewPatients: z.number().int(),
      newPatientsGrowth: z
        .number()
        .nullable()
        .openapi({ description: '% change vs previous period; null if no previous data' }),
      newDoctors: z.number().int(),
    }),
    patientsPerDoctor: z
      .array(
        z.object({
          doctorId: ObjectId,
          name: z.string(),
          specialization: z.enum(SPECIALIZATIONS),
          count: z.number().int(),
        }),
      )
      .openapi({ description: 'Top 10 doctors by patient count' }),
    admissionsTimeline: z
      .array(z.object({ date: z.string().openapi({ example: '2026-11-10' }), count: z.number() }))
      .openapi({ description: 'One entry per local day of the period (zero-filled)' }),
    conditionBreakdown: z.array(
      z.object({ condition: z.enum(PATIENT_CONDITIONS), count: z.number().int() }),
    ),
    doctorsBySpecialization: z.array(
      z.object({ specialization: z.enum(SPECIALIZATIONS), count: z.number().int() }),
    ),
  }),
);

// ---------------------------------------------------------------------------
// Helpers
// ---------------------------------------------------------------------------

const ok = <T extends z.ZodTypeAny>(description: string, data: T): ResponseConfig => ({
  description,
  content: {
    'application/json': { schema: z.object({ success: z.literal(true), data }) },
  },
});

const paginated = <T extends z.ZodTypeAny>(description: string, item: T): ResponseConfig => ({
  description,
  content: {
    'application/json': {
      schema: z.object({ success: z.literal(true), data: z.array(item), meta: PaginationMeta }),
    },
  },
});

const error = (description: string): ResponseConfig => ({
  description,
  content: { 'application/json': { schema: ErrorResponse } },
});

const jsonBody = <T extends z.ZodTypeAny>(schema: T, example?: Record<string, unknown>) => ({
  required: true,
  content: { 'application/json': { schema, example } },
});

/** Errors every protected endpoint can return. */
const protectedErrors = {
  401: error('Not signed in, or the session has expired'),
  403: error('Signed in, but not an admin'),
};

const doctorIdParams = z.object({
  id: objectIdSchema.openapi({ description: 'Doctor id', example: '6af31c26e2b6ebfefa03a094' }),
});
const patientIdParams = z.object({
  id: objectIdSchema.openapi({ description: 'Patient id', example: '6af31c39920db7c7e06dddca' }),
});
const doctorPatientParams = z.object({
  id: objectIdSchema.openapi({ description: 'Doctor id' }),
  patientId: objectIdSchema.openapi({ description: 'Patient id' }),
});

// ---------------------------------------------------------------------------
// Auth
// ---------------------------------------------------------------------------

registry.registerPath({
  method: 'post',
  path: '/api/auth/login',
  tags: ['Auth'],
  summary: 'Sign in',
  description:
    'Verifies the credentials and sets the `access_token` httpOnly cookie. ' +
    'Rate limited to 10 failed attempts per IP + e-mail per 15 minutes.',
  request: {
    body: jsonBody(loginSchema, { email: 'admin@doctortracker.com', password: 'Admin@12345' }),
  },
  responses: {
    200: ok('Signed in; session cookie set', User),
    400: error('Invalid request body'),
    401: error('Invalid email or password'),
    429: error('Too many failed login attempts'),
  },
});

registry.registerPath({
  method: 'post',
  path: '/api/auth/logout',
  tags: ['Auth'],
  summary: 'Sign out',
  description: 'Clears the session cookie.',
  responses: { 200: ok('Signed out', z.null()) },
});

registry.registerPath({
  method: 'get',
  path: '/api/auth/me',
  tags: ['Auth'],
  summary: 'Current user',
  security: secured,
  responses: { 200: ok('The signed-in user', User), 401: protectedErrors[401] },
});

// ---------------------------------------------------------------------------
// Doctors
// ---------------------------------------------------------------------------

registry.registerPath({
  method: 'get',
  path: '/api/doctors',
  tags: ['Doctors'],
  summary: 'List doctors',
  description:
    'Paginated list with index-backed prefix search, specialization and join-date filters. ' +
    'Each doctor includes its `patientCount`.',
  security: secured,
  request: { query: listDoctorsQuerySchema },
  responses: {
    200: paginated('A page of doctors', Doctor),
    400: error('Invalid query parameters'),
    ...protectedErrors,
  },
});

registry.registerPath({
  method: 'post',
  path: '/api/doctors',
  tags: ['Doctors'],
  summary: 'Create a doctor',
  security: secured,
  request: {
    body: jsonBody(createDoctorSchema, {
      name: 'Dr. Ayesha Rahman',
      specialization: 'Cardiology',
      hospital: 'Square Hospital',
      phone: '+8801711000000',
      email: 'ayesha.rahman@clinic.com',
    }),
  },
  responses: {
    201: ok('Doctor created', Doctor),
    400: error('Validation failed'),
    409: error('A doctor with this e-mail already exists'),
    ...protectedErrors,
  },
});

registry.registerPath({
  method: 'get',
  path: '/api/doctors/{id}',
  tags: ['Doctors'],
  summary: 'Get a doctor',
  security: secured,
  request: { params: doctorIdParams },
  responses: {
    200: ok('The doctor, with patient count', Doctor),
    400: error('Invalid id'),
    404: error('Doctor not found'),
    ...protectedErrors,
  },
});

registry.registerPath({
  method: 'get',
  path: '/api/doctors/{id}/patients',
  tags: ['Doctors'],
  summary: "List a doctor's patients",
  description: 'Same search, filters and pagination as `GET /api/patients`, scoped to one doctor.',
  security: secured,
  request: { params: doctorIdParams, query: listPatientsQuerySchema },
  responses: {
    200: paginated("A page of the doctor's patients", Patient),
    400: error('Invalid id or query parameters'),
    ...protectedErrors,
  },
});

registry.registerPath({
  method: 'post',
  path: '/api/doctors/{id}/patients',
  tags: ['Doctors'],
  summary: 'Add a patient under a doctor',
  security: secured,
  request: {
    params: doctorIdParams,
    body: jsonBody(createPatientSchema, {
      name: 'Rahim Uddin',
      age: 42,
      gender: 'male',
      phone: '01811223344',
      email: 'rahim@mail.com',
      condition: 'stable',
      diagnosis: 'Hypertension',
      admittedAt: '2026-11-09T18:00:00.000Z',
    }),
  },
  responses: {
    201: ok('Patient created', Patient),
    400: error('Validation failed'),
    404: error('Doctor not found'),
    ...protectedErrors,
  },
});

registry.registerPath({
  method: 'delete',
  path: '/api/doctors/{id}/patients/{patientId}',
  tags: ['Doctors'],
  summary: "Remove a patient from a doctor's list",
  description: 'Deletes the patient only if it belongs to this doctor.',
  security: secured,
  request: { params: doctorPatientParams },
  responses: {
    204: { description: 'Patient deleted' },
    400: error('Invalid id'),
    404: error('Patient not found for this doctor'),
    ...protectedErrors,
  },
});

// ---------------------------------------------------------------------------
// Patients
// ---------------------------------------------------------------------------

registry.registerPath({
  method: 'get',
  path: '/api/patients',
  tags: ['Patients'],
  summary: 'List patients',
  description:
    'Paginated list across all doctors with prefix search and filters for condition, gender, ' +
    'doctor and admission date.',
  security: secured,
  request: { query: listPatientsQuerySchema },
  responses: {
    200: paginated('A page of patients', Patient),
    400: error('Invalid query parameters'),
    ...protectedErrors,
  },
});

registry.registerPath({
  method: 'patch',
  path: '/api/patients/{id}',
  tags: ['Patients'],
  summary: 'Update a patient',
  description: 'Partial update. Send `doctor` to re-assign the patient to another doctor.',
  security: secured,
  request: {
    params: patientIdParams,
    body: jsonBody(updatePatientSchema, { condition: 'recovering', diagnosis: 'Migraine' }),
  },
  responses: {
    200: ok('Patient updated', Patient),
    400: error('Validation failed'),
    404: error('Patient or doctor not found'),
    ...protectedErrors,
  },
});

registry.registerPath({
  method: 'delete',
  path: '/api/patients/{id}',
  tags: ['Patients'],
  summary: 'Delete a patient',
  security: secured,
  request: { params: patientIdParams },
  responses: {
    204: { description: 'Patient deleted' },
    400: error('Invalid id'),
    404: error('Patient not found'),
    ...protectedErrors,
  },
});

// ---------------------------------------------------------------------------
// Dashboard & health
// ---------------------------------------------------------------------------

registry.registerPath({
  method: 'get',
  path: '/api/dashboard/stats',
  tags: ['Dashboard'],
  summary: 'Dashboard analytics',
  description:
    'Totals, period comparison, top doctors by patients, condition mix, specialization ' +
    'coverage and a zero-filled daily admissions series in the requested time zone.',
  security: secured,
  request: { query: dashboardQuerySchema },
  responses: {
    200: ok('Aggregated statistics', DashboardStats),
    400: error('Invalid query parameters'),
    ...protectedErrors,
  },
});

registry.registerPath({
  method: 'get',
  path: '/health',
  tags: ['Health'],
  summary: 'Liveness and database status',
  responses: {
    200: {
      description: 'Service is up',
      content: {
        'application/json': {
          schema: z.object({
            success: z.literal(true),
            status: z.literal('ok'),
            database: z.enum(['connected', 'disconnected']),
          }),
        },
      },
    },
  },
});

export function buildOpenApiDocument() {
  return new OpenApiGeneratorV3(registry.definitions).generateDocument({
    openapi: '3.0.3',
    info: {
      title: 'Doctor Tracker API',
      version: '1.0.0',
      description:
        'REST API for the Doctor Tracker admin portal.\n\n' +
        '**Getting started:** open `POST /api/auth/login`, click *Try it out* and execute it with ' +
        'the demo credentials. The session cookie is then sent automatically with every request ' +
        'from this page.\n\n' +
        'All responses use `{ success, data, meta? }`, errors use `{ success: false, message, errors? }`.',
    },
    servers: [{ url: '/', description: 'This server' }],
    tags: [
      { name: 'Auth', description: 'Session management' },
      { name: 'Doctors', description: 'Doctors and their patients' },
      { name: 'Patients', description: 'All patients' },
      { name: 'Dashboard', description: 'Analytics' },
      { name: 'Health', description: 'Monitoring' },
    ],
  });
}
