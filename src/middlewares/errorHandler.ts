import type { NextFunction, Request, Response } from 'express';
import mongoose from 'mongoose';
import { ZodError } from 'zod';
import { isProduction } from '../config/env.js';
import { ApiError } from '../utils/ApiError.js';

interface ErrorBody {
  success: false;
  message: string;
  errors?: unknown;
}

function isDuplicateKeyError(err: unknown): err is { code: number; keyValue?: object } {
  return typeof err === 'object' && err !== null && (err as { code?: number }).code === 11000;
}

/** Maps every error to a consistent `{ success: false, message, errors? }` JSON shape. */
export function errorHandler(err: unknown, _req: Request, res: Response, _next: NextFunction) {
  let status = 500;
  const body: ErrorBody = { success: false, message: 'Internal server error' };

  if (err instanceof ApiError) {
    status = err.statusCode;
    body.message = err.message;
    if (err.details) body.errors = err.details;
  } else if (err instanceof ZodError) {
    status = 400;
    body.message = 'Validation failed';
    body.errors = err.flatten().fieldErrors;
  } else if (err instanceof mongoose.Error.CastError) {
    status = 400;
    body.message = `Invalid ${err.path}`;
  } else if (err instanceof mongoose.Error.ValidationError) {
    status = 400;
    body.message = 'Validation failed';
    body.errors = Object.fromEntries(
      Object.entries(err.errors).map(([field, error]) => [field, [error.message]]),
    );
  } else if (isDuplicateKeyError(err)) {
    status = 409;
    const field = Object.keys(err.keyValue ?? {})[0] ?? 'field';
    body.message = `A record with this ${field} already exists`;
    body.errors = { [field]: [`This ${field} is already in use`] };
  } else if (err instanceof SyntaxError && 'body' in err) {
    status = 400;
    body.message = 'Malformed JSON body';
  }

  if (status === 500) {
    console.error(err);
    if (!isProduction && err instanceof Error) body.message = err.message;
  }

  res.status(status).json(body);
}

export function notFoundHandler(req: Request, _res: Response, next: NextFunction) {
  next(ApiError.notFound(`Route ${req.method} ${req.originalUrl} not found`));
}
