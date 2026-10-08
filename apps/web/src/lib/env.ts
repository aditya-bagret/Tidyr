import { z } from 'zod';

// Next inlines NEXT_PUBLIC_* only when the property is written out literally.
const parsed = z.url({ protocol: /^https?$/ }).safeParse(process.env.NEXT_PUBLIC_API_URL);

if (!parsed.success) {
  throw new Error(
    'NEXT_PUBLIC_API_URL must be an http(s) URL, e.g. http://localhost:4000/api (see apps/web/.env.example)',
  );
}

export const API_URL = parsed.data;
export const API_ORIGIN = new URL(API_URL).origin;
