import bcrypt from 'bcrypt';
import { env } from '../config/env';

export function hashPassword(password: string): Promise<string> {
  return bcrypt.hash(password, env.BCRYPT_ROUNDS);
}

// Hashed once, lazily, at the configured cost so a miss costs exactly as much as a real compare.
let dummyHash: Promise<string> | undefined;

/**
 * Compares against `hash`, or against a dummy hash when the account doesn't exist, so the response
 * time doesn't reveal whether an email is registered (TECHNICAL_REQUIREMENTS §5.2).
 */
export async function verifyPassword(password: string, hash: string | null): Promise<boolean> {
  if (hash === null) {
    dummyHash ??= bcrypt.hash('tidyr-timing-equalizer', env.BCRYPT_ROUNDS);
    await bcrypt.compare(password, await dummyHash);
    return false;
  }
  return bcrypt.compare(password, hash);
}
