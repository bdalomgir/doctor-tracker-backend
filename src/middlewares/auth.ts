import type { NextFunction, Request, Response } from 'express';
import { verifyToken } from '../modules/auth/auth.service.js';
import type { UserRole } from '../modules/auth/user.model.js';
import { ApiError } from '../utils/ApiError.js';

export const AUTH_COOKIE = 'access_token';

declare module 'express-serve-static-core' {
  interface Request {
    user?: { id: string; role: UserRole };
  }
}

function extractToken(req: Request): string | undefined {
  const cookieToken = req.cookies?.[AUTH_COOKIE] as string | undefined;
  if (cookieToken) return cookieToken;

  // Bearer header is also accepted so the API can be used from tools like Postman.
  const header = req.headers.authorization;
  if (header?.startsWith('Bearer ')) return header.slice(7);

  return undefined;
}

/** Authentication: rejects the request unless it carries a valid JWT. */
export function authenticate(req: Request, _res: Response, next: NextFunction) {
  const token = extractToken(req);
  if (!token) throw ApiError.unauthorized();

  const payload = verifyToken(token);
  req.user = { id: payload.sub, role: payload.role };
  next();
}

/** Authorization: restricts a route to the given roles. Must run after `authenticate`. */
export const authorize =
  (...roles: UserRole[]) =>
  (req: Request, _res: Response, next: NextFunction) => {
    if (!req.user || !roles.includes(req.user.role)) {
      throw new ApiError(403, 'You do not have permission to perform this action');
    }
    next();
  };
