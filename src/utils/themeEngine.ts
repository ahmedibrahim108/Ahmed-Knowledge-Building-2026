import {
  DEFAULT_THEME_CONFIG,
  ThemeBackgroundStyle,
  ThemeBorderStyle,
  ThemeConfig,
  ThemeContrastLevel,
  ThemeMode,
  ThemePresetId,
  ThemeSurfaceStyle,
} from '../data/curriculumData';

export const THEME_STORAGE_KEY = 'kb_theme_config_v1';
export const THEME_USER_STORAGE_PREFIX = 'kb_theme_config_user_';

export interface ThemeVariantPalette {
  bg: string;
  surface: string;
  surface2: string;
  elevated: string;
  card: string;
  popover: string;
  muted: string;
  fg: string;
  fg800: string;
  fg700: string;
  fg600: string;
  fg500: string;
  fg400: string;
  primary: string;
  secondary: string;
  accent: string;
  border: string;
  borderSubtle: string;
  borderStrong: string;
  input: string;
  success: string;
  warning: string;
  destructive: string;
  chartTrack: string;
  gradientBg?: string;
}

export interface ThemePresetDefinition {
  id: ThemePresetId;
  nameAr: string;
  nameEn: string;
  descriptionAr: string;
  recommendedMode: ThemeMode;
  light: ThemeVariantPalette;
  dark: ThemeVariantPalette;
}

export interface CuratedAccentPreset {
  id: string;
  labelAr: string;
  primary: string;
  secondary: string;
}

export interface CuratedSurfaceSwatch {
  id: string;
  labelAr: string;
  hex: string;
  mode: 'light' | 'dark';
}

export interface ResolvedThemeResult {
  config: ThemeConfig;
  effectiveMode: 'light' | 'dark';
  tokens: Record<string, string>;
  contrastReport: {
    textOnCanvas: number;
    textOnCard: number;
    primaryButtonRatio: number;
    primaryInkOnCard: number;
    meetsAA: boolean;
  };
}

export const THEME_PRESETS: Record<ThemePresetId, ThemePresetDefinition> = {
  classic: {
    id: 'classic',
    nameAr: 'كلاسيكي فاتح',
    nameEn: 'Classic Light',
    descriptionAr: 'خلفيات بيضاء نقية وأسطح محايدة هادئة مع لمسة بنفسجية متوازنة للقراءة والتركيز.',
    recommendedMode: 'light',
    light: {
      bg: '#F8F9FC',
      surface: '#F1F3F8',
      surface2: '#E9EDF5',
      elevated: '#FFFFFF',
      card: '#FFFFFF',
      popover: '#FFFFFF',
      muted: '#F3F4F8',
      fg: '#0F172A',
      fg800: '#1E293B',
      fg700: '#334155',
      fg600: '#475569',
      fg500: '#64748B',
      fg400: '#94A3B8',
      primary: '#6D28D9',
      secondary: '#4F46E5',
      accent: '#7C3AED',
      border: '#E2E8F0',
      borderSubtle: '#F1F5F9',
      borderStrong: '#CBD5E1',
      input: '#FFFFFF',
      success: '#059669',
      warning: '#D97706',
      destructive: '#DC2626',
      chartTrack: '#E2E8F0',
    },
    dark: {
      bg: '#0C0F18',
      surface: '#141927',
      surface2: '#1C2235',
      elevated: '#1B2233',
      card: '#151B2B',
      popover: '#1B2233',
      muted: '#1B2234',
      fg: '#F1F5F9',
      fg800: '#E2E8F0',
      fg700: '#CBD5E1',
      fg600: '#A3B1C6',
      fg500: '#8896AE',
      fg400: '#64748B',
      primary: '#7C3AED',
      secondary: '#6366F1',
      accent: '#A78BFA',
      border: '#252E44',
      borderSubtle: '#1B2235',
      borderStrong: '#344160',
      input: '#111725',
      success: '#10B981',
      warning: '#F59E0B',
      destructive: '#EF4444',
      chartTrack: '#263047',
    },
  },
  midnight: {
    id: 'midnight',
    nameAr: 'منتصف الليل',
    nameEn: 'Midnight Dark',
    descriptionAr: 'أعماق كحلية وفحمية مريحة للعين مع تمييز واضح للبطاقات ولمسات لافندر ناعمة.',
    recommendedMode: 'dark',
    light: {
      bg: '#EEF2F8',
      surface: '#E4EAF4',
      surface2: '#DCE4F0',
      elevated: '#FFFFFF',
      card: '#FAFCFF',
      popover: '#FFFFFF',
      muted: '#E8EEF7',
      fg: '#0F172A',
      fg800: '#1E293B',
      fg700: '#334155',
      fg600: '#475569',
      fg500: '#64748B',
      fg400: '#94A3B8',
      primary: '#4338CA',
      secondary: '#6D28D9',
      accent: '#6366F1',
      border: '#D3DCEB',
      borderSubtle: '#E6ECF5',
      borderStrong: '#B6C4DC',
      input: '#FFFFFF',
      success: '#059669',
      warning: '#D97706',
      destructive: '#DC2626',
      chartTrack: '#D8E1EE',
    },
    dark: {
      bg: '#070B14',
      surface: '#0E1526',
      surface2: '#151F36',
      elevated: '#17223B',
      card: '#111A2E',
      popover: '#17223B',
      muted: '#162038',
      fg: '#EFF4FB',
      fg800: '#E2E9F5',
      fg700: '#C8D4E8',
      fg600: '#9FB0CC',
      fg500: '#7D90B0',
      fg400: '#5A6D8E',
      primary: '#7C5CFA',
      secondary: '#5B8DEF',
      accent: '#A78BFA',
      border: '#22304F',
      borderSubtle: '#17223B',
      borderStrong: '#33466F',
      input: '#0B1222',
      success: '#10B981',
      warning: '#F59E0B',
      destructive: '#EF4444',
      chartTrack: '#202D4A',
    },
  },
  forest: {
    id: 'forest',
    nameAr: 'الغابة الهادئة',
    nameEn: 'Forest',
    descriptionAr: 'درجات أخضر غابات طبيعية وأسطح محايدة مطمئنة تمنح أجواء دراسة عميقة وهادئة.',
    recommendedMode: 'dark',
    light: {
      bg: '#F2F6F3',
      surface: '#E6EFE9',
      surface2: '#DCE8E0',
      elevated: '#FFFFFF',
      card: '#FBFDFB',
      popover: '#FFFFFF',
      muted: '#EAF2EC',
      fg: '#0D2118',
      fg800: '#163024',
      fg700: '#274939',
      fg600: '#3D6351',
      fg500: '#557B69',
      fg400: '#7DA08F',
      primary: '#15803D',
      secondary: '#0F766E',
      accent: '#16A34A',
      border: '#CEE0D5',
      borderSubtle: '#E2EDE6',
      borderStrong: '#AAC7B5',
      input: '#FFFFFF',
      success: '#15803D',
      warning: '#B45309',
      destructive: '#DC2626',
      chartTrack: '#D3E3D8',
    },
    dark: {
      bg: '#07120D',
      surface: '#0D1E16',
      surface2: '#132A1F',
      elevated: '#163124',
      card: '#10241A',
      popover: '#152E22',
      muted: '#142B20',
      fg: '#ECF5F0',
      fg800: '#D8EBE0',
      fg700: '#B8D7C6',
      fg600: '#8FB8A3',
      fg500: '#6E9883',
      fg400: '#4E7562',
      primary: '#16A34A',
      secondary: '#0D9488',
      accent: '#34D399',
      border: '#1E3C2D',
      borderSubtle: '#142A1F',
      borderStrong: '#2D5843',
      input: '#0A1912',
      success: '#10B981',
      warning: '#F59E0B',
      destructive: '#EF4444',
      chartTrack: '#1E3A2C',
    },
  },
  lavender: {
    id: 'lavender',
    nameAr: 'اللافندر الإبداعي',
    nameEn: 'Lavender',
    descriptionAr: 'خلفية بنفسجية أنيقة مع تدرجات لطيفة ولمسات فايوليت ملهمة للتأمل والإبداع.',
    recommendedMode: 'dark',
    light: {
      bg: '#F6F4FC',
      surface: '#EDE8FA',
      surface2: '#E4DCF7',
      elevated: '#FFFFFF',
      card: '#FDFCFF',
      popover: '#FFFFFF',
      muted: '#EFEBFB',
      fg: '#1C1333',
      fg800: '#2A1E47',
      fg700: '#433368',
      fg600: '#5C4B84',
      fg500: '#76659E',
      fg400: '#9E90C2',
      primary: '#7C3AED',
      secondary: '#9333EA',
      accent: '#8B5CF6',
      border: '#DDD3F4',
      borderSubtle: '#ECE6FA',
      borderStrong: '#C3B2EA',
      input: '#FFFFFF',
      success: '#059669',
      warning: '#D97706',
      destructive: '#DC2626',
      chartTrack: '#E0D6F5',
      gradientBg:
        'radial-gradient(1200px circle at 85% -10%, rgba(139, 92, 246, 0.13), transparent 55%), radial-gradient(900px circle at 10% 105%, rgba(168, 85, 247, 0.09), transparent 50%), #F6F4FC',
    },
    dark: {
      bg: '#100B1D',
      surface: '#18112B',
      surface2: '#22193B',
      elevated: '#251C40',
      card: '#1B1430',
      popover: '#241B3E',
      muted: '#211838',
      fg: '#F3EEFC',
      fg800: '#E6DDF9',
      fg700: '#CFC0EE',
      fg600: '#AB9AD4',
      fg500: '#8A78B5',
      fg400: '#675690',
      primary: '#8B5CF6',
      secondary: '#A855F7',
      accent: '#C4B5FD',
      border: '#302452',
      borderSubtle: '#22193C',
      borderStrong: '#463575',
      input: '#140E24',
      success: '#10B981',
      warning: '#F59E0B',
      destructive: '#EF4444',
      chartTrack: '#2F2350',
      gradientBg:
        'radial-gradient(1100px circle at 85% -10%, rgba(139, 92, 246, 0.22), transparent 55%), radial-gradient(900px circle at 12% 105%, rgba(168, 85, 247, 0.15), transparent 50%), #100B1D',
    },
  },
  graphite: {
    id: 'graphite',
    nameAr: 'جرافيت احترافي',
    nameEn: 'Graphite',
    descriptionAr: 'رمادي فحمي متوازن وأسطح احترافية هادئة مع لمسة زرقاء صافية بأقل قدر من التشتيت.',
    recommendedMode: 'dark',
    light: {
      bg: '#F3F4F6',
      surface: '#E7E9ED',
      surface2: '#DCDFE6',
      elevated: '#FFFFFF',
      card: '#FFFFFF',
      popover: '#FFFFFF',
      muted: '#ECEEF2',
      fg: '#111827',
      fg800: '#1F2937',
      fg700: '#374151',
      fg600: '#4B5563',
      fg500: '#6B7280',
      fg400: '#9CA3AF',
      primary: '#2563EB',
      secondary: '#475569',
      accent: '#3B82F6',
      border: '#D8DCE3',
      borderSubtle: '#E8EBEF',
      borderStrong: '#BDC3CE',
      input: '#FFFFFF',
      success: '#059669',
      warning: '#D97706',
      destructive: '#DC2626',
      chartTrack: '#DCE0E7',
    },
    dark: {
      bg: '#111317',
      surface: '#181B20',
      surface2: '#20242B',
      elevated: '#232830',
      card: '#1A1D23',
      popover: '#22272F',
      muted: '#20242C',
      fg: '#F1F3F5',
      fg800: '#E2E5E9',
      fg700: '#C7CCD4',
      fg600: '#9EA5B1',
      fg500: '#7D8593',
      fg400: '#5C6370',
      primary: '#3B82F6',
      secondary: '#64748B',
      accent: '#60A5FA',
      border: '#2B303A',
      borderSubtle: '#20242C',
      borderStrong: '#3E4554',
      input: '#14171C',
      success: '#10B981',
      warning: '#F59E0B',
      destructive: '#EF4444',
      chartTrack: '#2A2F39',
    },
  },
  sepia: {
    id: 'sepia',
    nameAr: 'سيبيا دافئ',
    nameEn: 'Warm Sepia',
    descriptionAr: 'ورق كريمي وبيج دافئ (أو بني عميق ليلاً) مع لمسات كهرمانية مريحة للقراءة والتدوين الطويل.',
    recommendedMode: 'light',
    light: {
      bg: '#F6EFE2',
      surface: '#EDE2CE',
      surface2: '#E4D6BC',
      elevated: '#FCF8F0',
      card: '#FAF5EA',
      popover: '#FCF8F0',
      muted: '#EFE4D0',
      fg: '#2B2118',
      fg800: '#3B2E22',
      fg700: '#4F3F30',
      fg600: '#695643',
      fg500: '#826D58',
      fg400: '#A6907A',
      primary: '#B45309',
      secondary: '#92400E',
      accent: '#D97706',
      border: '#DFD0B7',
      borderSubtle: '#ECE1CE',
      borderStrong: '#C8B392',
      input: '#FCF8F0',
      success: '#15803D',
      warning: '#B45309',
      destructive: '#B91C1C',
      chartTrack: '#DFD2BC',
    },
    dark: {
      bg: '#14100C',
      surface: '#1D1711',
      surface2: '#271F17',
      elevated: '#2B2219',
      card: '#211A13',
      popover: '#2A2118',
      muted: '#251D15',
      fg: '#F3EAE0',
      fg800: '#E5D8C9',
      fg700: '#CEBFA9',
      fg600: '#AD9B84',
      fg500: '#8D7B65',
      fg400: '#6B5B48',
      primary: '#D97706',
      secondary: '#B45309',
      accent: '#F59E0B',
      border: '#382C20',
      borderSubtle: '#282017',
      borderStrong: '#524030',
      input: '#18130E',
      success: '#10B981',
      warning: '#F59E0B',
      destructive: '#EF4444',
      chartTrack: '#352A1F',
    },
  },
};

export const THEME_PRESET_ORDER: ThemePresetId[] = [
  'classic',
  'midnight',
  'forest',
  'lavender',
  'graphite',
  'sepia',
];

export const CURATED_ACCENT_PALETTES: CuratedAccentPreset[] = [
  { id: 'violet', labelAr: 'بنفسجي كلاسيكي', primary: '#6D28D9', secondary: '#4F46E5' },
  { id: 'lavender', labelAr: 'لافندر ناعم', primary: '#7C5CFA', secondary: '#A855F7' },
  { id: 'navy', labelAr: 'كحلي أصيل', primary: '#1E3A5F', secondary: '#2563EB' },
  { id: 'ocean', labelAr: 'أزرق جرافيت', primary: '#2563EB', secondary: '#0284C7' },
  { id: 'forest', labelAr: 'أخضر الغابة', primary: '#15803D', secondary: '#0F766E' },
  { id: 'emerald', labelAr: 'زمردي مشرق', primary: '#059669', secondary: '#10B981' },
  { id: 'amber', labelAr: 'كهرماني دافئ', primary: '#B45309', secondary: '#D97706' },
  { id: 'rose', labelAr: 'قرمزي هادئ', primary: '#BE123C', secondary: '#9333EA' },
];

export const CURATED_BACKGROUND_SWATCHES: CuratedSurfaceSwatch[] = [
  { id: 'pure-snow', labelAr: 'أبيض ثلجي', hex: '#F9FAFB', mode: 'light' },
  { id: 'warm-ivory', labelAr: 'عاجي دافئ', hex: '#F6EFE2', mode: 'light' },
  { id: 'sage-mist', labelAr: 'ضباب عشبي', hex: '#F2F6F3', mode: 'light' },
  { id: 'cool-slate', labelAr: 'سماوي هادئ', hex: '#EEF2F8', mode: 'light' },
  { id: 'deep-abyss', labelAr: 'كحلي ليلي', hex: '#070B14', mode: 'dark' },
  { id: 'carbon-dark', labelAr: 'فحمي عميق', hex: '#111317', mode: 'dark' },
  { id: 'pine-night', labelAr: 'ليل الغابة', hex: '#07120D', mode: 'dark' },
  { id: 'plum-night', labelAr: 'بنفسجي داكن', hex: '#100B1D', mode: 'dark' },
];

export const CURATED_SURFACE_SWATCHES: CuratedSurfaceSwatch[] = [
  { id: 'crisp-white', labelAr: 'أبيض ناصع', hex: '#FFFFFF', mode: 'light' },
  { id: 'cream-paper', labelAr: 'ورق كريمي', hex: '#FAF5EA', mode: 'light' },
  { id: 'soft-ice', labelAr: 'سطح ثلجي', hex: '#F8FAFC', mode: 'light' },
  { id: 'midnight-card', labelAr: 'كحلي البطاقات', hex: '#111A2E', mode: 'dark' },
  { id: 'graphite-card', labelAr: 'جرافيت ناعم', hex: '#1A1D23', mode: 'dark' },
  { id: 'forest-card', labelAr: 'أخضر داكن', hex: '#10241A', mode: 'dark' },
  { id: 'walnut-card', labelAr: 'جوزي دافئ', hex: '#211A13', mode: 'dark' },
];

// --- Color Math & WCAG Accessibility Helpers ---

const HEX_RE = /^#([0-9a-fA-F]{3}|[0-9a-fA-F]{6})$/;

export function normalizeHex(input?: string): string | undefined {
  if (!input || typeof input !== 'string') return undefined;
  const trimmed = input.trim();
  if (!HEX_RE.test(trimmed)) return undefined;
  if (trimmed.length === 4) {
    const r = trimmed[1];
    const g = trimmed[2];
    const b = trimmed[3];
    return `#${r}${r}${g}${g}${b}${b}`.toUpperCase();
  }
  return trimmed.toUpperCase();
}

export function hexToRgb(hex: string): { r: number; g: number; b: number } {
  const clean = normalizeHex(hex) ?? '#1E3A5F';
  return {
    r: parseInt(clean.slice(1, 3), 16),
    g: parseInt(clean.slice(3, 5), 16),
    b: parseInt(clean.slice(5, 7), 16),
  };
}

export function rgbToHex(r: number, g: number, b: number): string {
  const clamp = (n: number) => Math.max(0, Math.min(255, Math.round(n)));
  const toHex = (n: number) => clamp(n).toString(16).padStart(2, '0').toUpperCase();
  return `#${toHex(r)}${toHex(g)}${toHex(b)}`;
}

export function mixHex(hexA: string, hexB: string, weightB: number): string {
  const w = Math.max(0, Math.min(1, weightB));
  const a = hexToRgb(hexA);
  const b = hexToRgb(hexB);
  return rgbToHex(
    a.r * (1 - w) + b.r * w,
    a.g * (1 - w) + b.g * w,
    a.b * (1 - w) + b.b * w
  );
}

export function hexToRgba(hex: string, alpha: number): string {
  const { r, g, b } = hexToRgb(hex);
  const a = Math.max(0, Math.min(1, alpha));
  return `rgba(${r}, ${g}, ${b}, ${a.toFixed(3)})`;
}

export function getRelativeLuminance(hex: string): number {
  const { r, g, b } = hexToRgb(hex);
  const linearize = (v: number) => {
    const c = v / 255;
    return c <= 0.03928 ? c / 12.92 : Math.pow((c + 0.055) / 1.055, 2.4);
  };
  return 0.2126 * linearize(r) + 0.7152 * linearize(g) + 0.0722 * linearize(b);
}

export function getContrastRatio(hexA: string, hexB: string): number {
  const l1 = getRelativeLuminance(hexA);
  const l2 = getRelativeLuminance(hexB);
  const lighter = Math.max(l1, l2);
  const darker = Math.min(l1, l2);
  return (lighter + 0.05) / (darker + 0.05);
}

export function getAccessibleTextOnColor(bgHex: string): string {
  const whiteRatio = getContrastRatio('#FFFFFF', bgHex);
  const darkRatio = getContrastRatio('#090D16', bgHex);
  return whiteRatio >= darkRatio ? '#FFFFFF' : '#090D16';
}

/**
 * Ensures an accent color used as foreground TEXT/ICON on a surface reaches >= targetRatio (default 4.5).
 * Gently shifts luminance toward white (in dark mode) or black (in light mode) while preserving hue.
 */
export function ensureContrastAgainst(
  fgHex: string,
  bgHex: string,
  targetRatio = 4.6
): string {
  const current = getContrastRatio(fgHex, bgHex);
  if (current >= targetRatio) return fgHex;
  const bgLum = getRelativeLuminance(bgHex);
  const targetMix = bgLum < 0.35 ? '#FFFFFF' : '#0A0E17';
  let best = fgHex;
  for (let step = 0.06; step <= 0.92; step += 0.06) {
    const candidate = mixHex(fgHex, targetMix, step);
    best = candidate;
    if (getContrastRatio(candidate, bgHex) >= targetRatio) {
      return candidate;
    }
  }
  return best;
}

/**
 * Ensures solid primary button fill has >= 4.5 contrast with its chosen text color.
 */
export function ensureButtonContrast(
  bgHex: string
): { fill: string; fg: string; ratio: number } {
  const directFg = getAccessibleTextOnColor(bgHex);
  const directRatio = getContrastRatio(bgHex, directFg);
  if (directRatio >= 4.5) {
    return { fill: bgHex, fg: directFg, ratio: directRatio };
  }
  // Nudge toward darker or lighter depending on which yields >=4.5 faster
  const target = directFg === '#FFFFFF' ? '#090D16' : '#FFFFFF';
  for (let step = 0.05; step <= 0.6; step += 0.05) {
    const candidate = mixHex(bgHex, target, step);
    const r = getContrastRatio(candidate, directFg);
    if (r >= 4.5) {
      return { fill: candidate, fg: directFg, ratio: r };
    }
  }
  return { fill: bgHex, fg: directFg, ratio: directRatio };
}

export function sanitizeThemeConfig(raw: unknown): ThemeConfig {
  if (!raw || typeof raw !== 'object') return { ...DEFAULT_THEME_CONFIG };
  const obj = raw as Record<string, unknown>;

  const mode: ThemeMode =
    obj.mode === 'light' || obj.mode === 'dark' || obj.mode === 'system'
      ? obj.mode
      : DEFAULT_THEME_CONFIG.mode;

  const preset: ThemePresetId =
    obj.preset === 'classic' ||
    obj.preset === 'midnight' ||
    obj.preset === 'forest' ||
    obj.preset === 'lavender' ||
    obj.preset === 'graphite' ||
    obj.preset === 'sepia'
      ? obj.preset
      : DEFAULT_THEME_CONFIG.preset;

  const backgroundStyle: ThemeBackgroundStyle =
    obj.backgroundStyle === 'flat' ||
    obj.backgroundStyle === 'tinted' ||
    obj.backgroundStyle === 'gradient' ||
    obj.backgroundStyle === 'default'
      ? obj.backgroundStyle
      : 'default';

  const surfaceStyle: ThemeSurfaceStyle =
    obj.surfaceStyle === 'crisp' ||
    obj.surfaceStyle === 'soft' ||
    obj.surfaceStyle === 'elevated' ||
    obj.surfaceStyle === 'default'
      ? obj.surfaceStyle
      : 'default';

  const borderStyle: ThemeBorderStyle =
    obj.borderStyle === 'subtle' ||
    obj.borderStyle === 'defined' ||
    obj.borderStyle === 'minimal' ||
    obj.borderStyle === 'default'
      ? obj.borderStyle
      : 'default';

  const contrastLevel: ThemeContrastLevel =
    obj.contrastLevel === 'high' ||
    obj.contrastLevel === 'soft' ||
    obj.contrastLevel === 'standard'
      ? obj.contrastLevel
      : 'standard';

  const primaryAccentOverride = normalizeHex(
    typeof obj.primaryAccentOverride === 'string'
      ? obj.primaryAccentOverride
      : undefined
  );
  const secondaryAccentOverride = normalizeHex(
    typeof obj.secondaryAccentOverride === 'string'
      ? obj.secondaryAccentOverride
      : undefined
  );
  const backgroundOverride = normalizeHex(
    typeof obj.backgroundOverride === 'string' ? obj.backgroundOverride : undefined
  );
  const surfaceOverride = normalizeHex(
    typeof obj.surfaceOverride === 'string' ? obj.surfaceOverride : undefined
  );
  const borderOverride = normalizeHex(
    typeof obj.borderOverride === 'string' ? obj.borderOverride : undefined
  );

  return {
    mode,
    preset,
    backgroundStyle,
    surfaceStyle,
    borderStyle,
    contrastLevel,
    ...(primaryAccentOverride ? { primaryAccentOverride } : {}),
    ...(secondaryAccentOverride ? { secondaryAccentOverride } : {}),
    ...(backgroundOverride ? { backgroundOverride } : {}),
    ...(surfaceOverride ? { surfaceOverride } : {}),
    ...(borderOverride ? { borderOverride } : {}),
  };
}

export function resolveEffectiveMode(
  mode: ThemeMode,
  osPrefersDark: boolean
): 'light' | 'dark' {
  if (mode === 'system') return osPrefersDark ? 'dark' : 'light';
  return mode;
}

export function resolveThemeTokens(
  rawConfig: ThemeConfig | undefined,
  osPrefersDark: boolean
): ResolvedThemeResult {
  const config = sanitizeThemeConfig(rawConfig);
  const effectiveMode = resolveEffectiveMode(config.mode, osPrefersDark);
  const presetDef = THEME_PRESETS[config.preset] || THEME_PRESETS.classic;
  const base = effectiveMode === 'dark' ? { ...presetDef.dark } : { ...presetDef.light };

  // 1) Accent overrides
  const rawPrimary = config.primaryAccentOverride || base.primary;
  const rawSecondary = config.secondaryAccentOverride || base.secondary;
  const btn = ensureButtonContrast(rawPrimary);
  const primary = btn.fill;
  const primaryFg = btn.fg;
  const secondaryBtn = ensureButtonContrast(rawSecondary);
  const secondary = secondaryBtn.fill;
  const secondaryFg = secondaryBtn.fg;

  // 2) Background override & style
  let bg = config.backgroundOverride || base.bg;
  // Guard: if user picked a light backgroundOverride while in dark mode (or vice versa), adapt luminance gently OR keep user override if intentionally set for current mode
  if (config.backgroundOverride) {
    const lum = getRelativeLuminance(config.backgroundOverride);
    if (effectiveMode === 'dark' && lum > 0.45) {
      bg = mixHex(base.bg, config.backgroundOverride, 0.22);
    } else if (effectiveMode === 'light' && lum < 0.22) {
      bg = mixHex(base.bg, config.backgroundOverride, 0.22);
    }
  }

  if (config.backgroundStyle === 'tinted') {
    bg = mixHex(bg, primary, effectiveMode === 'dark' ? 0.08 : 0.05);
  } else if (config.backgroundStyle === 'flat') {
    bg = mixHex(bg, effectiveMode === 'dark' ? '#0F1115' : '#FFFFFF', 0.25);
  }

  // 3) Surface / Card overrides & style
  let card = config.surfaceOverride || base.card;
  if (config.surfaceOverride) {
    const lum = getRelativeLuminance(config.surfaceOverride);
    if (effectiveMode === 'dark' && lum > 0.45) {
      card = mixHex(base.card, config.surfaceOverride, 0.24);
    } else if (effectiveMode === 'light' && lum < 0.22) {
      card = mixHex(base.card, config.surfaceOverride, 0.24);
    }
  }

  let surface = base.surface;
  let surface2 = base.surface2;
  let elevated = base.elevated;

  if (config.surfaceStyle === 'crisp') {
    card = effectiveMode === 'dark' ? mixHex(bg, '#FFFFFF', 0.05) : '#FFFFFF';
    surface = mixHex(bg, card, 0.45);
  } else if (config.surfaceStyle === 'soft') {
    card = mixHex(bg, card, 0.65);
    surface = mixHex(bg, primary, effectiveMode === 'dark' ? 0.06 : 0.04);
  } else if (config.surfaceStyle === 'elevated') {
    card = effectiveMode === 'dark' ? mixHex(base.card, '#FFFFFF', 0.04) : '#FFFFFF';
    elevated = effectiveMode === 'dark' ? mixHex(card, '#FFFFFF', 0.05) : '#FFFFFF';
  }

  // 4) Border override & style
  let border = config.borderOverride || base.border;
  if (config.borderOverride) {
    const lum = getRelativeLuminance(config.borderOverride);
    if (effectiveMode === 'dark' && lum > 0.65) {
      border = mixHex(base.border, config.borderOverride, 0.45);
    }
  }

  if (config.borderStyle === 'subtle') {
    border = mixHex(card, border, 0.58);
  } else if (config.borderStyle === 'defined') {
    border = mixHex(border, base.fg, effectiveMode === 'dark' ? 0.22 : 0.16);
  } else if (config.borderStyle === 'minimal') {
    border = mixHex(card, border, 0.34);
  }

  const borderSubtle = mixHex(card, border, 0.55);
  const borderStrong = mixHex(border, base.fg, effectiveMode === 'dark' ? 0.22 : 0.18);

  // 5) Text contrast level
  let fg = base.fg;
  let fg800 = base.fg800;
  let fg700 = base.fg700;
  let fg600 = base.fg600;
  let fg500 = base.fg500;
  let fg400 = base.fg400;

  if (config.contrastLevel === 'high') {
    fg = effectiveMode === 'dark' ? '#FFFFFF' : '#020617';
    fg800 = effectiveMode === 'dark' ? '#F8FAFC' : '#0F172A';
    fg700 = effectiveMode === 'dark' ? '#E2E8F0' : '#1E293B';
    fg600 = effectiveMode === 'dark' ? '#CBD5E1' : '#334155';
    fg500 = effectiveMode === 'dark' ? '#94A3B8' : '#475569';
    border = mixHex(border, fg, effectiveMode === 'dark' ? 0.24 : 0.2);
  } else if (config.contrastLevel === 'soft') {
    fg = mixHex(base.fg, card, 0.09);
    fg800 = mixHex(base.fg800, card, 0.1);
    fg700 = mixHex(base.fg700, card, 0.1);
    fg600 = mixHex(base.fg600, card, 0.08);
    fg500 = mixHex(base.fg500, card, 0.06);
  }

  // Guarantee primary text & secondary text >= 4.5 on card & bg
  const primaryInk = ensureContrastAgainst(
    config.primaryAccentOverride || base.accent || primary,
    card,
    4.6
  );
  const secondaryInk = ensureContrastAgainst(
    config.secondaryAccentOverride || secondary,
    card,
    4.6
  );

  const primaryHover =
    effectiveMode === 'dark'
      ? mixHex(primary, '#FFFFFF', 0.12)
      : mixHex(primary, '#000000', 0.14);

  const primarySoft = hexToRgba(primaryInk, effectiveMode === 'dark' ? 0.16 : 0.09);
  const primarySoftHover = hexToRgba(primaryInk, effectiveMode === 'dark' ? 0.24 : 0.15);
  const secondarySoft = hexToRgba(secondaryInk, effectiveMode === 'dark' ? 0.15 : 0.09);

  // Canvas background (supports gradient)
  let canvasCss = bg;
  if (config.backgroundStyle === 'gradient') {
    canvasCss = `radial-gradient(1050px circle at 85% -8%, ${hexToRgba(
      primaryInk,
      effectiveMode === 'dark' ? 0.16 : 0.08
    )}, transparent 56%), radial-gradient(850px circle at 10% 105%, ${hexToRgba(
      secondaryInk,
      effectiveMode === 'dark' ? 0.12 : 0.06
    )}, transparent 52%), ${bg}`;
  } else if (
    config.backgroundStyle === 'default' &&
    base.gradientBg &&
    !config.backgroundOverride
  ) {
    canvasCss = base.gradientBg;
  }

  const inputBg =
    config.surfaceOverride || config.surfaceStyle
      ? mixHex(bg, card, effectiveMode === 'dark' ? 0.5 : 0.85)
      : base.input;

  const popover = elevated;
  const muted = surface;

  const shadowCard =
    config.surfaceStyle === 'elevated'
      ? effectiveMode === 'dark'
        ? '0 10px 30px -12px rgba(0, 0, 0, 0.55)'
        : '0 8px 24px -10px rgba(15, 23, 42, 0.1)'
      : effectiveMode === 'dark'
      ? '0 4px 18px -8px rgba(0, 0, 0, 0.4)'
      : '0 1px 3px rgba(15, 23, 42, 0.04)';

  const glassHeader = hexToRgba(card, effectiveMode === 'dark' ? 0.88 : 0.94);
  const glassSubbar = hexToRgba(surface, effectiveMode === 'dark' ? 0.85 : 0.92);

  const tokens: Record<string, string> = {
    '--kb-bg': bg,
    '--kb-canvas-bg': canvasCss,
    '--kb-surface': surface,
    '--kb-surface-2': surface2,
    '--kb-elevated': elevated,
    '--kb-card': card,
    '--kb-popover': popover,
    '--kb-muted': muted,
    '--kb-fg': fg,
    '--kb-fg-800': fg800,
    '--kb-fg-700': fg700,
    '--kb-fg-600': fg600,
    '--kb-fg-500': fg500,
    '--kb-fg-400': fg400,
    '--kb-primary': primary,
    '--kb-primary-hover': primaryHover,
    '--kb-primary-fg': primaryFg,
    '--kb-primary-ink': primaryInk,
    '--kb-primary-soft': primarySoft,
    '--kb-primary-soft-hover': primarySoftHover,
    '--kb-primary-ring': hexToRgba(primaryInk, 0.3),
    '--kb-primary-border': hexToRgba(primaryInk, effectiveMode === 'dark' ? 0.42 : 0.28),
    '--kb-secondary': secondary,
    '--kb-secondary-fg': secondaryFg,
    '--kb-secondary-ink': secondaryInk,
    '--kb-secondary-soft': secondarySoft,
    '--kb-accent': primaryInk,
    '--kb-border': border,
    '--kb-border-subtle': borderSubtle,
    '--kb-border-strong': borderStrong,
    '--kb-input': inputBg,
    '--kb-ring': primaryInk,
    '--kb-success': base.success,
    '--kb-warning': base.warning,
    '--kb-destructive': base.destructive,
    '--kb-chart-track': base.chartTrack,
    '--kb-glass-header': glassHeader,
    '--kb-glass-subbar': glassSubbar,
    '--kb-shadow-card': shadowCard,
  };

  const textOnCanvas = getContrastRatio(fg, bg);
  const textOnCard = getContrastRatio(fg, card);
  const primaryInkOnCard = getContrastRatio(primaryInk, card);

  return {
    config,
    effectiveMode,
    tokens,
    contrastReport: {
      textOnCanvas,
      textOnCard,
      primaryButtonRatio: btn.ratio,
      primaryInkOnCard,
      meetsAA:
        textOnCanvas >= 4.5 &&
        textOnCard >= 4.5 &&
        btn.ratio >= 4.5 &&
        primaryInkOnCard >= 4.5,
    },
  };
}

let transitionTimer: number | null = null;

export function applyThemeToDocument(
  rawConfig: ThemeConfig | undefined,
  osPrefersDark: boolean,
  options?: { animate?: boolean }
): ResolvedThemeResult {
  const result = resolveThemeTokens(rawConfig, osPrefersDark);
  if (typeof document === 'undefined') return result;

  const root = document.documentElement;
  const shouldAnimate =
    Boolean(options?.animate) &&
    typeof window !== 'undefined' &&
    !window.matchMedia?.('(prefers-reduced-motion: reduce)').matches;

  if (shouldAnimate) {
    root.classList.add('kb-theme-animating');
    if (transitionTimer !== null) {
      window.clearTimeout(transitionTimer);
    }
    transitionTimer = window.setTimeout(() => {
      root.classList.remove('kb-theme-animating');
      transitionTimer = null;
    }, 280);
  }

  root.setAttribute('data-kb-themed', 'true');
  root.setAttribute('data-theme-mode', result.effectiveMode);
  root.setAttribute('data-theme-preset', result.config.preset);
  root.style.colorScheme = result.effectiveMode;

  for (const [k, v] of Object.entries(result.tokens)) {
    root.style.setProperty(k, v);
  }

  const themeMeta = document.querySelector('meta[name="theme-color"]');
  if (themeMeta) {
    themeMeta.setAttribute(
      'content',
      result.effectiveMode === 'dark' ? result.tokens['--kb-bg'] : result.tokens['--kb-primary']
    );
  }

  return result;
}

export function loadStoredThemeConfig(uid?: string | null): ThemeConfig | null {
  if (typeof window === 'undefined') return null;
  try {
    if (uid) {
      const userRaw = window.localStorage.getItem(`${THEME_USER_STORAGE_PREFIX}${uid}`);
      if (userRaw) {
        return sanitizeThemeConfig(JSON.parse(userRaw));
      }
    }
    const raw = window.localStorage.getItem(THEME_STORAGE_KEY);
    if (!raw) return null;
    return sanitizeThemeConfig(JSON.parse(raw));
  } catch {
    return null;
  }
}

export function saveStoredThemeConfig(config: ThemeConfig, uid?: string | null): void {
  if (typeof window === 'undefined') return;
  try {
    const clean = sanitizeThemeConfig(config);
    const serialized = JSON.stringify(clean);
    window.localStorage.setItem(THEME_STORAGE_KEY, serialized);
    if (uid) {
      window.localStorage.setItem(`${THEME_USER_STORAGE_PREFIX}${uid}`, serialized);
    }
  } catch {
    // Storage quota or private browsing restriction
  }
}
