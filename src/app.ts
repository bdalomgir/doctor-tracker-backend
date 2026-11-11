import compression from 'compression';
import cookieParser from 'cookie-parser';
import cors from 'cors';
import express, { Router } from 'express';
import helmet from 'helmet';
import mongoose from 'mongoose';
import morgan from 'morgan';
import swaggerUi from 'swagger-ui-express';
import { env, isProduction } from './config/env.js';
import { buildOpenApiDocument } from './docs/openapi.js';
import { authenticate, authorize } from './middlewares/auth.js';
import { errorHandler, notFoundHandler } from './middlewares/errorHandler.js';
import { authRouter } from './modules/auth/auth.routes.js';
import { dashboardRouter } from './modules/dashboard/dashboard.routes.js';
import { doctorRouter } from './modules/doctors/doctor.routes.js';
import { patientRouter } from './modules/patients/patient.routes.js';

export function createApp() {
  const app = express();

  // Behind Render's / Vercel's proxy: trust the first hop for req.ip & secure cookies.
  if (isProduction) app.set('trust proxy', 1);

  app.disable('x-powered-by');
  app.use(helmet());
  app.use(cors({ origin: env.CORS_ORIGINS, credentials: true }));
  app.use(compression());
  app.use(express.json({ limit: '100kb' }));
  app.use(cookieParser());
  app.use(morgan(isProduction ? 'combined' : 'dev'));

  app.get('/health', (_req, res) => {
    res.json({
      success: true,
      status: 'ok',
      database: mongoose.connection.readyState === 1 ? 'connected' : 'disconnected',
    });
  });

  // Interactive API documentation (public; the endpoints themselves stay protected).
  const openApiDocument = buildOpenApiDocument();
  app.get('/api-docs.json', (_req, res) => {
    res.json(openApiDocument);
  });
  app.use(
    '/api-docs',
    swaggerUi.serve,
    swaggerUi.setup(openApiDocument, {
      customSiteTitle: 'Doctor Tracker API',
      swaggerOptions: { persistAuthorization: true, withCredentials: true },
    }),
  );

  // Every resource except /auth requires an authenticated admin.
  const protectedRoutes = Router();
  protectedRoutes.use(authenticate, authorize('admin'));
  protectedRoutes.use('/doctors', doctorRouter);
  protectedRoutes.use('/patients', patientRouter);
  protectedRoutes.use('/dashboard', dashboardRouter);

  app.use('/api/auth', authRouter);
  app.use('/api', protectedRoutes);

  app.use(notFoundHandler);
  app.use(errorHandler);

  return app;
}
