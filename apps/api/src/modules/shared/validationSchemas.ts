import { z } from 'zod';

export const passwordComplexitySchema = z
  .string()
  .min(8, 'Password must be at least 8 characters long')
  .max(128, 'Password must not exceed 128 characters')
  .regex(
    /^(?=.*[a-z])(?=.*[A-Z])(?=.*\d)(?=.*[@$!%*?&#^()_+\-=[\]{};':"\\|,.<>/?])[A-Za-z\d@$!%*?&#^()_+\-=[\]{};':"\\|,.<>/?]{8,}$/,
    'Password must be 8+ chars with upper, lower, number, special'
  );

export const usernameSchema = z
  .string()
  .trim()
  .min(3, 'Username must be at least 3 characters')
  .max(50, 'Username must not exceed 50 characters')
  .regex(/^[a-zA-Z0-9_-]+$/, 'Username can only contain alphanumeric characters, underscores and hyphens');

export const emailSchema = z
  .string()
  .trim()
  .email('Valid email is required')
  .max(100, 'Email must not exceed 100 characters');

export const loginSchema = z.object({
  username: z.string().min(1, 'Username is required'),
  password: z.string().min(8, 'Password must be at least 8 characters'),
});

export const createUserSchema = z.object({
  username: usernameSchema,
  email: emailSchema,
  fullName: z.string().trim().min(2, 'Full name is required').max(100),
  password: passwordComplexitySchema,
  roleId: z.string().min(1, 'Role is required'),
  branchId: z.string().optional(),
});

export const updateUserSchema = z.object({
  fullName: z.string().trim().min(2).max(100).optional(),
  email: emailSchema.optional(),
  password: passwordComplexitySchema.optional(),
  roleId: z.string().optional(),
  branchId: z.string().optional(),
  status: z.enum(['active', 'inactive']).optional(),
});
