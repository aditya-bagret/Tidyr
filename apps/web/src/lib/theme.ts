import { colors, layout, radius, shadows } from '@tidyr/shared';
import type { CSSProperties } from 'react';

type Shadow = (typeof shadows)[keyof typeof shadows];

function hexToRgb(hex: string): string {
  const value = Number.parseInt(hex.slice(1), 16);
  return `${(value >> 16) & 255} ${(value >> 8) & 255} ${value & 255}`;
}

function toBoxShadow({ offsetX, offsetY, blur, color, opacity }: Shadow): string {
  return `${offsetX}px ${offsetY}px ${blur}px rgb(${hexToRgb(color)} / ${opacity})`;
}

/**
 * The shared design tokens as `--tidyr-*` CSS variables. `globals.css` maps Tailwind's theme onto
 * them, so the tokens in `@tidyr/shared` stay the only place a colour value is written.
 */
export function themeVariables(): CSSProperties {
  const vars: Record<string, string> = {};
  for (const [group, shades] of Object.entries(colors)) {
    for (const [shade, hex] of Object.entries(shades)) {
      vars[`--tidyr-${group}-${shade}`] = hex;
    }
  }
  for (const [name, px] of Object.entries(radius)) {
    vars[`--tidyr-radius-${name}`] = `${px}px`;
  }
  for (const [name, shadow] of Object.entries(shadows)) {
    vars[`--tidyr-shadow-${name}`] = toBoxShadow(shadow);
  }
  vars['--tidyr-content-max-width'] = `${layout.contentMaxWidth}px`;
  return vars;
}
