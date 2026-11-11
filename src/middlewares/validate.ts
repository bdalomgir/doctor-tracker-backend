import type { NextFunction, Request, Response } from 'express';
import type { ZodTypeAny } from 'zod';

interface RequestSchemas {
  body?: ZodTypeAny;
  query?: ZodTypeAny;
  params?: ZodTypeAny;
}

/**
 * Validates and coerces request input. On success the parsed (typed, defaulted,
 * stripped) values replace the raw ones, so controllers only ever see clean data.
 * A ZodError is forwarded to the error handler, which responds with 400.
 */
export const validate =
  (schemas: RequestSchemas) => (req: Request, _res: Response, next: NextFunction) => {
    if (schemas.params) req.params = schemas.params.parse(req.params);
    if (schemas.body) req.body = schemas.body.parse(req.body);
    if (schemas.query) {
      // `req.query` is a getter in Express 5, so it has to be redefined.
      Object.defineProperty(req, 'query', {
        value: schemas.query.parse(req.query),
        writable: true,
        enumerable: true,
      });
    }
    next();
  };
