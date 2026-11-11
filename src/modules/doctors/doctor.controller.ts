import type { Request, Response } from 'express';
import type { CreatePatientInput, ListPatientsQuery } from '../patients/patient.schema.js';
import * as patientService from '../patients/patient.service.js';
import type { CreateDoctorInput, ListDoctorsQuery } from './doctor.schema.js';
import * as doctorService from './doctor.service.js';

// `req.query` has already been parsed & coerced by the `validate` middleware;
// Express types it as raw `ParsedQs`, hence the explicit assertions below.
type IdParams = { id: string };
type DoctorPatientParams = { id: string; patientId: string };

export async function list(req: Request, res: Response) {
  const result = await doctorService.listDoctors(req.query as unknown as ListDoctorsQuery);
  res.json({ success: true, ...result });
}

export async function create(req: Request<object, unknown, CreateDoctorInput>, res: Response) {
  const doctor = await doctorService.createDoctor(req.body);
  res.status(201).json({ success: true, data: doctor });
}

export async function getById(req: Request<IdParams>, res: Response) {
  const doctor = await doctorService.getDoctorById(req.params.id);
  res.json({ success: true, data: doctor });
}

export async function listPatients(req: Request<IdParams>, res: Response) {
  const query = req.query as unknown as ListPatientsQuery;
  const result = await patientService.listPatients({ ...query, doctor: req.params.id });
  res.json({ success: true, ...result });
}

export async function addPatient(
  req: Request<IdParams, unknown, CreatePatientInput>,
  res: Response,
) {
  const patient = await patientService.createPatientForDoctor(req.params.id, req.body);
  res.status(201).json({ success: true, data: patient });
}

export async function removePatient(req: Request<DoctorPatientParams>, res: Response) {
  await patientService.deletePatient(req.params.patientId, req.params.id);
  res.status(204).end();
}
