'use client';

import { useSearchParams } from 'next/navigation';
import { Banner } from '@/components/banner';
import { MESSAGES } from '@/lib/errors';

/** Login's banner for `?reason=expired|invalid` (DESIGN §3 SessionBanner, info tone). */
export function SessionBanner() {
  const reason = useSearchParams().get('reason');
  if (reason === 'expired') return <Banner tone="info">{MESSAGES.sessionExpired}</Banner>;
  if (reason === 'invalid') return <Banner tone="info">{MESSAGES.signedOut}</Banner>;
  return null;
}
