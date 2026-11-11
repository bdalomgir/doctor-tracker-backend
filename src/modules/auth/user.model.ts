import { Schema, model, type InferSchemaType, type HydratedDocument } from 'mongoose';

export const USER_ROLES = ['admin'] as const;
export type UserRole = (typeof USER_ROLES)[number];

const userSchema = new Schema(
  {
    name: { type: String, required: true, trim: true },
    email: { type: String, required: true, unique: true, lowercase: true, trim: true },
    // Never returned by default; must be requested explicitly with `.select('+password')`.
    password: { type: String, required: true, select: false },
    role: { type: String, enum: USER_ROLES, default: 'admin' },
  },
  { timestamps: true },
);

export type User = InferSchemaType<typeof userSchema>;
export type UserDocument = HydratedDocument<User>;

export const UserModel = model('User', userSchema);
