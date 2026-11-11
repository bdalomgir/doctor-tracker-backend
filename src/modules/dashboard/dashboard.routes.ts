import { Router } from 'express';
import { validate } from '../../middlewares/validate.js';
import * as dashboardController from './dashboard.controller.js';
import { dashboardQuerySchema } from './dashboard.schema.js';

export const dashboardRouter = Router();

dashboardRouter.get('/stats', validate({ query: dashboardQuerySchema }), dashboardController.stats);
