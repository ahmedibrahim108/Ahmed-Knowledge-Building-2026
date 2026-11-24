import {
  ReactNode,
  createContext,
  useCallback,
  useContext,
  useEffect,
  useLayoutEffect,
  useMemo,
  useRef,
  useState,
} from 'react';
import {
  DEFAULT_THEME_CONFIG,
  ThemeConfig,
  ThemeMode,
  ThemePresetId,
} from '../data/curriculumData';
import {
  ResolvedThemeResult,
  applyThemeToDocument,
  loadStoredThemeConfig,
  resolveThemeTokens,
  sanitizeThemeConfig,
  saveStoredThemeConfig,
} from './themeEngine';

interface ThemeContextValue {
  savedConfig: ThemeConfig;
  activeConfig: ThemeConfig;
  previewConfig: ThemeConfig | null;
  isPreviewing: boolean;
  osPrefersDark: boolean;
  effectiveMode: 'light' | 'dark';
  resolved: ResolvedThemeResult;
  setPreviewConfig: (next: ThemeConfig | null) => void;
  applyTheme: (next: ThemeConfig) => void;
  setMode: (mode: ThemeMode) => void;
  setPreset: (preset: ThemePresetId) => void;
  commitPreview: () => void;
  discardPreview: () => void;
  resetToDefault: () => void;
}

const ThemeContext = createContext<ThemeContextValue | null>(null);

interface ThemeProviderProps {
  children: ReactNode;
  userUid?: string | null;
  syncedThemeConfig?: ThemeConfig;
  onPersistSyncedTheme?: (next: ThemeConfig) => void;
}

function getSystemPrefersDark(): boolean {
  if (typeof window === 'undefined' || !window.matchMedia) return false;
  return window.matchMedia('(prefers-color-scheme: dark)').matches;
}

export function ThemeProvider({
  children,
  userUid,
  syncedThemeConfig,
  onPersistSyncedTheme,
}: ThemeProviderProps) {
  const [osPrefersDark, setOsPrefersDark] = useState<boolean>(getSystemPrefersDark);
  const [savedConfig, setSavedConfig] = useState<ThemeConfig>(
    () => loadStoredThemeConfig(userUid) ?? DEFAULT_THEME_CONFIG
  );
  const [previewConfig, setPreviewConfig] = useState<ThemeConfig | null>(null);
  const hasMountedRef = useRef(false);

  // Track OS prefers-color-scheme live
  useEffect(() => {
    if (typeof window === 'undefined' || !window.matchMedia) return;
    const mq = window.matchMedia('(prefers-color-scheme: dark)');
    setOsPrefersDark(mq.matches);
    const onChange = (e: MediaQueryListEvent) => {
      setOsPrefersDark(e.matches);
    };
    mq.addEventListener('change', onChange);
    return () => mq.removeEventListener('change', onChange);
  }, []);

  // Rehydrate user-scoped local theme when authenticated UID changes
  useEffect(() => {
    if (!userUid) return;
    const userLocal = loadStoredThemeConfig(userUid);
    if (userLocal) {
      setSavedConfig(userLocal);
    }
  }, [userUid]);

  // Sync from cloud UserPreferences when loaded/updated
  useEffect(() => {
    if (!syncedThemeConfig) return;
    const clean = sanitizeThemeConfig(syncedThemeConfig);
    setSavedConfig((prev) => {
      if (JSON.stringify(prev) === JSON.stringify(clean)) return prev;
      saveStoredThemeConfig(clean, userUid);
      return clean;
    });
  }, [syncedThemeConfig, userUid]);

  const activeConfig = previewConfig ?? savedConfig;

  const resolved = useMemo(
    () => resolveThemeTokens(activeConfig, osPrefersDark),
    [activeConfig, osPrefersDark]
  );

  useLayoutEffect(() => {
    const animate = hasMountedRef.current;
    hasMountedRef.current = true;
    applyThemeToDocument(activeConfig, osPrefersDark, { animate });
  }, [activeConfig, osPrefersDark]);

  const applyTheme = useCallback(
    (next: ThemeConfig) => {
      const clean = sanitizeThemeConfig(next);
      setPreviewConfig(null);
      setSavedConfig(clean);
      saveStoredThemeConfig(clean, userUid);
      onPersistSyncedTheme?.(clean);
    },
    [onPersistSyncedTheme, userUid]
  );

  const setMode = useCallback(
    (mode: ThemeMode) => {
      const base = previewConfig ?? savedConfig;
      const next: ThemeConfig = { ...base, mode };
      if (previewConfig) {
        setPreviewConfig(next);
      } else {
        applyTheme(next);
      }
    },
    [applyTheme, previewConfig, savedConfig]
  );

  const setPreset = useCallback(
    (preset: ThemePresetId) => {
      const base = previewConfig ?? savedConfig;
      const next: ThemeConfig = {
        ...base,
        preset,
        // Reset custom overrides when switching full preset cleanly unless user is explicitly customizing after
        primaryAccentOverride: undefined,
        secondaryAccentOverride: undefined,
        backgroundOverride: undefined,
        surfaceOverride: undefined,
        borderOverride: undefined,
      };
      if (previewConfig) {
        setPreviewConfig(next);
      } else {
        applyTheme(next);
      }
    },
    [applyTheme, previewConfig, savedConfig]
  );

  const commitPreview = useCallback(() => {
    if (!previewConfig) return;
    applyTheme(previewConfig);
  }, [applyTheme, previewConfig]);

  const discardPreview = useCallback(() => {
    setPreviewConfig(null);
  }, []);

  const resetToDefault = useCallback(() => {
    applyTheme({ ...DEFAULT_THEME_CONFIG });
  }, [applyTheme]);

  const value = useMemo<ThemeContextValue>(
    () => ({
      savedConfig,
      activeConfig,
      previewConfig,
      isPreviewing: previewConfig !== null,
      osPrefersDark,
      effectiveMode: resolved.effectiveMode,
      resolved,
      setPreviewConfig,
      applyTheme,
      setMode,
      setPreset,
      commitPreview,
      discardPreview,
      resetToDefault,
    }),
    [
      savedConfig,
      activeConfig,
      previewConfig,
      osPrefersDark,
      resolved,
      applyTheme,
      setMode,
      setPreset,
      commitPreview,
      discardPreview,
      resetToDefault,
    ]
  );

  return <ThemeContext.Provider value={value}>{children}</ThemeContext.Provider>;
}

export function useTheme(): ThemeContextValue {
  const ctx = useContext(ThemeContext);
  if (!ctx) {
    throw new Error('useTheme must be used inside ThemeProvider');
  }
  return ctx;
}
