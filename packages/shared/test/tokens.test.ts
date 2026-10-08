import { describe, expect, it } from 'vitest';
import { PROJECT_STATUS_STYLE, TASK_STATUS_STYLE, type LozengeStyle } from '../src';

// WCAG 2.x relative luminance and contrast ratio.
function luminance(hex: string): number {
  const [r, g, b] = [1, 3, 5].map((start) => {
    const channel = Number.parseInt(hex.slice(start, start + 2), 16) / 255;
    return channel <= 0.03928 ? channel / 12.92 : ((channel + 0.055) / 1.055) ** 2.4;
  }) as [number, number, number];
  return 0.2126 * r + 0.7152 * g + 0.0722 * b;
}

function contrast(a: string, b: string): number {
  const [light, dark] = [luminance(a), luminance(b)].sort((x, y) => y - x) as [number, number];
  return (light + 0.05) / (dark + 0.05);
}

describe('status lozenge contrast (T-SH-17)', () => {
  const styles: [string, LozengeStyle][] = [
    ...Object.entries(PROJECT_STATUS_STYLE).map(([s, style]): [string, LozengeStyle] => [
      `project ${s}`,
      style,
    ]),
    ...Object.entries(TASK_STATUS_STYLE).map(([s, style]): [string, LozengeStyle] => [
      `task ${s}`,
      style,
    ]),
  ];

  it('computes the reference ratio', () => {
    expect(contrast('#FFFFFF', '#000000')).toBeCloseTo(21, 5);
  });

  it.each(styles)('%s text meets WCAG AA (4.5:1) on its background', (_, style) => {
    expect(contrast(style.text, style.background)).toBeGreaterThanOrEqual(4.5);
  });
});
