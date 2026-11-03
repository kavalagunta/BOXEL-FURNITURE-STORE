/**
 * Admin-controlled typography. Each font is self-hosted and only downloaded when selected.
 * Values are applied as CSS variables on <html>, so the whole site updates instantly.
 */
export const FONTS = {
  'albert-sans': { label: 'Albert Sans — geometric, matches the logo', family: "'Albert Sans Variable'", load: () => import('@fontsource-variable/albert-sans/wght.css') },
  inter: { label: 'Inter — very crisp on screens', family: "'Inter Variable'", load: () => import('@fontsource-variable/inter/wght.css') },
  manrope: { label: 'Manrope — modern and rounded', family: "'Manrope Variable'", load: () => import('@fontsource-variable/manrope/wght.css') },
  'plus-jakarta-sans': { label: 'Plus Jakarta Sans — warm and premium', family: "'Plus Jakarta Sans Variable'", load: () => import('@fontsource-variable/plus-jakarta-sans/wght.css') },
  'dm-sans': { label: 'DM Sans — clean and friendly', family: "'DM Sans Variable'", load: () => import('@fontsource-variable/dm-sans/wght.css') },
};

export const DEFAULT_TYPOGRAPHY = { font: 'albert-sans', baseSize: 16, headingWeight: 400, bodyWeight: 420 };

const FALLBACK = "ui-sans-serif, system-ui, -apple-system, 'Segoe UI', Roboto, sans-serif";
const clamp = (n, min, max, d) => (Number.isFinite(Number(n)) && Number(n) ? Math.min(max, Math.max(min, Number(n))) : d);

export function readTypography(s = {}) {
  return {
    font: FONTS[s.typography_font] ? s.typography_font : DEFAULT_TYPOGRAPHY.font,
    baseSize: clamp(s.typography_base_size, 14, 20, DEFAULT_TYPOGRAPHY.baseSize),
    headingWeight: clamp(s.typography_heading_weight, 300, 700, DEFAULT_TYPOGRAPHY.headingWeight),
    bodyWeight: clamp(s.typography_body_weight, 350, 600, DEFAULT_TYPOGRAPHY.bodyWeight),
  };
}

export const fontStack = (key) => `${(FONTS[key] || FONTS['albert-sans']).family}, ${FALLBACK}`;

/** Loads the font file, then swaps the CSS variables so text never flashes in a half-loaded face. */
export async function applyTypography(t, target = document.documentElement) {
  const font = FONTS[t.font] || FONTS['albert-sans'];
  try {
    await font.load();
    await document.fonts?.load(`${t.bodyWeight} 1em ${font.family}`);
  } catch {
    /* fall back to the system stack below */
  }
  target.style.setProperty('--app-font', fontStack(t.font));
  target.style.setProperty('--base-size', String(t.baseSize));
  target.style.setProperty('--heading-weight', String(t.headingWeight));
  target.style.setProperty('--body-weight', String(t.bodyWeight));
}
