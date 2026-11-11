import bcrypt from 'bcryptjs';
import jwt from 'jsonwebtoken';
import { env } from '../../config/env.js';
import { ApiError } from '../../utils/ApiError.js';
import type { LoginInput } from './auth.schema.js';
import { UserModel, type UserRole } from './user.model.js';

export interface AuthTokenPayload {
  sub: string;
  role: UserRole;
}

export interface PublicUser {
  id: string;
  name: string;
  email: string;
  role: UserRole;
}

const BCRYPT_ROUNDS = 12;
// Compared against when the e-mail does not exist, so a failed login takes the
// same time either way and cannot be used to discover registered e-mails.
const DUMMY_HASH = bcrypt.hashSync('dummy-password-for-timing', BCRYPT_ROUNDS);

export const hashPassword = (password: string) => bcrypt.hash(password, BCRYPT_ROUNDS);

export function signToken(payload: AuthTokenPayload): string {
  return jwt.sign(payload, env.JWT_SECRET, { expiresIn: `${env.JWT_EXPIRES_IN_HOURS}h` });
}

export function verifyToken(token: string): AuthTokenPayload {
  try {
    return jwt.verify(token, env.JWT_SECRET) as AuthTokenPayload;
  } catch {
    throw ApiError.unauthorized('Session expired or invalid, please sign in again');
  }
}

export async function login({ email, password }: LoginInput) {
  const user = await UserModel.findOne({ email }).select('+password');
  const isValid = await bcrypt.compare(password, user?.password ?? DUMMY_HASH);

  if (!user || !isValid) throw ApiError.unauthorized('Invalid email or password');

  const token = signToken({ sub: user.id, role: user.role });
  const publicUser: PublicUser = {
    id: user.id,
    name: user.name,
    email: user.email,
    role: user.role,
  };

  return { token, user: publicUser };
}

export async function getUserById(id: string): Promise<PublicUser> {
  const user = await UserModel.findById(id).lean();
  if (!user) throw ApiError.unauthorized('User no longer exists');

  return { id: String(user._id), name: user.name, email: user.email, role: user.role };
}
