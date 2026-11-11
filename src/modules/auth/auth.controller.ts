import type { CookieOptions, Request, Response } from 'express';
import { env, isProduction } from '../../config/env.js';
import { AUTH_COOKIE } from '../../middlewares/auth.js';
import type { LoginInput } from './auth.schema.js';
import * as authService from './auth.service.js';

const SESSION_MAX_AGE_MS = env.JWT_EXPIRES_IN_HOURS * 60 * 60 * 1000;

const cookieOptions: CookieOptions = {
  httpOnly: true, // not readable from JS -> not stealable via XSS
  secure: isProduction,
  sameSite: 'lax', // the frontend proxies /api, so the cookie is first-party
  path: '/',
};

export async function login(req: Request<object, unknown, LoginInput>, res: Response) {
  const { token, user } = await authService.login(req.body);

  res.cookie(AUTH_COOKIE, token, { ...cookieOptions, maxAge: SESSION_MAX_AGE_MS });
  res.json({ success: true, data: user });
}

export function logout(_req: Request, res: Response) {
  res.clearCookie(AUTH_COOKIE, cookieOptions);
  res.json({ success: true, data: null });
}

export async function me(req: Request, res: Response) {
  const user = await authService.getUserById(req.user!.id);
  res.json({ success: true, data: user });
}
