import type { Request, Response } from 'express';
import type { ListPatientsQuery, UpdatePatientInput } from './patient.schema.js';
import * as patientService from './patient.service.js';

type IdParams = { id: string };

export async function list(req: Request, res: Response) {
  // Parsed & coerced by the `validate` middleware (Express types it as raw ParsedQs).
  const result = await patientService.listPatients(req.query as unknown as ListPatientsQuery);
  res.json({ success: true, ...result });
}

export async function update(req: Request<IdParams, unknown, UpdatePatientInput>, res: Response) {
  const patient = await patientService.updatePatient(req.params.id, req.body);
  res.json({ success: true, data: patient });
}

export async function remove(req: Request<IdParams>, res: Response) {
  await patientService.deletePatient(req.params.id);
  res.status(204).end();
}
