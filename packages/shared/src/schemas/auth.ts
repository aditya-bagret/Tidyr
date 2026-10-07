import { z } from 'zod';
import { trimmedString } from './common';

// bcrypt silently ignores everything past 72 bytes, so the limit is on UTF-8 bytes, not characters.
export const PASSWORD_MAX_BYTES = 72;

function utf8ByteLength(value: string): number {
  return new TextEncoder().encode(value).length;
}

const passwordMaxBytes = (value: string) => utf8ByteLength(value) <= PASSWORD_MAX_BYTES;
const PASSWORD_TOO_LONG = 'Too long (accented letters and emoji count as more than one)';

export const emailSchema = z
  .string()
  .trim()
  .toLowerCase()
  .max(255, { error: 'Must be at most 255 characters' })
  .pipe(z.email({ error: 'Enter a valid email' }));

/** Register-time policy (TECHNICAL_REQUIREMENTS §5.4). Never trimmed: spaces are part of a password. */
export const newPasswordSchema = z
  .string()
  .min(8, { error: 'Must be at least 8 characters' })
  .refine(passwordMaxBytes, { error: PASSWORD_TOO_LONG })
  .regex(/\p{L}/u, { error: 'Must include a letter' })
  .regex(/\d/, { error: 'Must include a number' });

export const registerSchema = z.object({
  fullName: trimmedString(2, 100),
  email: emailSchema,
  password: newPasswordSchema,
});
export type RegisterInput = z.infer<typeof registerSchema>;

/** Client-side form only: the API never receives `confirmPassword`. */
export const registerFormSchema = registerSchema
  .extend({ confirmPassword: z.string() })
  .refine((value) => value.password === value.confirmPassword, {
    error: 'Passwords do not match',
    path: ['confirmPassword'],
  });
export type RegisterFormInput = z.infer<typeof registerFormSchema>;

// Login doesn't re-check the policy: older passwords must still work and the error must stay generic.
export const loginSchema = z.object({
  email: emailSchema,
  password: z
    .string()
    .min(1, { error: 'Required' })
    .refine(passwordMaxBytes, { error: PASSWORD_TOO_LONG }),
});
export type LoginInput = z.infer<typeof loginSchema>;

export const refreshSchema = z.object({
  refreshToken: z.string().min(1, { error: 'Required' }).max(256),
});
export type RefreshInput = z.infer<typeof refreshSchema>;
