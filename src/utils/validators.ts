import { isValidObjectId } from 'mongoose';
import { z } from 'zod';

export const objectIdSchema = z
  .string()
  .refine((value) => isValidObjectId(value), { message: 'Invalid id' });

export const idParamSchema = z.object({ id: objectIdSchema });

/** International-friendly phone format: optional +, digits, spaces, dashes, brackets. */
export const phoneSchema = z
  .string()
  .trim()
  .regex(/^\+?[0-9\s\-()]{7,20}$/, 'Enter a valid phone number');

export const emailSchema = z.string().trim().toLowerCase().email('Enter a valid email');

/** Turns `""` from HTML forms / query strings into `undefined`. */
export const emptyToUndefined = (value: unknown) => (value === '' ? undefined : value);
