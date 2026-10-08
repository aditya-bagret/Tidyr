'use client';

import {
  CircleCheckIcon,
  InfoIcon,
  Loader2Icon,
  OctagonXIcon,
  TriangleAlertIcon,
} from 'lucide-react';
import type { CSSProperties } from 'react';
import { Toaster as Sonner, type ToasterProps } from 'sonner';

// DESIGN §3 Toast: success / error / info, 4 s. Light theme only for now (DESIGN §2.1).
function Toaster(props: ToasterProps) {
  return (
    <Sonner
      theme="light"
      duration={4000}
      className="toaster group"
      icons={{
        success: <CircleCheckIcon className="size-4 text-success-600" />,
        info: <InfoIcon className="size-4 text-info-600" />,
        warning: <TriangleAlertIcon className="size-4 text-warning-600" />,
        error: <OctagonXIcon className="size-4 text-danger-600" />,
        loading: <Loader2Icon className="size-4 animate-spin" />,
      }}
      style={
        {
          '--normal-bg': 'var(--tidyr-neutral-0)',
          '--normal-text': 'var(--tidyr-neutral-900)',
          '--normal-border': 'var(--tidyr-neutral-200)',
          '--border-radius': 'var(--tidyr-radius-md)',
        } as CSSProperties
      }
      {...props}
    />
  );
}

export { Toaster };
