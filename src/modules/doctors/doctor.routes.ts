import { Router } from 'express';
import { z } from 'zod';
import { validate } from '../../middlewares/validate.js';
import { idParamSchema, objectIdSchema } from '../../utils/validators.js';
import { createPatientSchema, listPatientsQuerySchema } from '../patients/patient.schema.js';
import * as doctorController from './doctor.controller.js';
import { createDoctorSchema, listDoctorsQuerySchema } from './doctor.schema.js';

const doctorPatientParamsSchema = z.object({ id: objectIdSchema, patientId: objectIdSchema });

export const doctorRouter = Router();

doctorRouter
  .route('/')
  .get(validate({ query: listDoctorsQuerySchema }), doctorController.list)
  .post(validate({ body: createDoctorSchema }), doctorController.create);

doctorRouter.get('/:id', validate({ params: idParamSchema }), doctorController.getById);

doctorRouter
  .route('/:id/patients')
  .get(
    validate({ params: idParamSchema, query: listPatientsQuerySchema }),
    doctorController.listPatients,
  )
  .post(
    validate({ params: idParamSchema, body: createPatientSchema }),
    doctorController.addPatient,
  );

doctorRouter.delete(
  '/:id/patients/:patientId',
  validate({ params: doctorPatientParamsSchema }),
  doctorController.removePatient,
);
