import { Router } from 'express';
import { validate } from '../../middlewares/validate.js';
import { idParamSchema } from '../../utils/validators.js';
import * as patientController from './patient.controller.js';
import { listPatientsQuerySchema, updatePatientSchema } from './patient.schema.js';

export const patientRouter = Router();

patientRouter.get('/', validate({ query: listPatientsQuerySchema }), patientController.list);

patientRouter
  .route('/:id')
  .patch(validate({ params: idParamSchema, body: updatePatientSchema }), patientController.update)
  .delete(validate({ params: idParamSchema }), patientController.remove);
