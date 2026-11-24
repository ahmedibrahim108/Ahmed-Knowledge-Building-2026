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

export type ThemeSyncStatus =
  | 'idle'
  | 'loading'
  | 'saving'
  | 'saved'
  | 'offline'
  | 'error';

interface ThemeContextValue {
  savedConfig: ThemeConfig;
  activeConfig: ThemeConfig;
  previewConfig: ThemeConfig | null;
  isPreviewing: boolean;
  osPrefersDark: boolean;
  effectiveMode: 'light' | 'dark';
  resolved: ResolvedThemeResult;
  isAuthenticated: boolean;
  syncStatus: ThemeSyncStatus;
  syncError: string | null;
  setPreviewConfig: (next: ThemeConfig | null) => void;
  applyTheme: (next: ThemeConfig) => void;
  setMode: (mode: ThemeMode) => void;
  setPreset: (preset: ThemePresetId) => void;
  commitPreview: () => void;
  discardPreview: () => void;
  resetToDefault: () => void;
  retryCloudSync: () => Promise<void>;
}

const ThemeContext = createContext<ThemeContextValue | null>(null);

interface ThemeProviderProps {
  children: ReactNode;
  userUid?: string | null;
  cloudLoading?: boolean;
  syncedThemeConfig?: ThemeConfig;
  cloudSyncError?: string | null;
  onPersistSyncedTheme?: (next: ThemeConfig) => Promise<void> | void;
}

function getSystemPrefersDark(): boolean {
  if (typeof window === 'undefined' || !window.matchMedia) return false;
  return window.matchMedia('(prefers-color-scheme: dark)').matches;
}

export function ThemeProvider({
  children,
  userUid,
  cloudLoading = false,
  syncedThemeConfig,
  cloudSyncError,
  onPersistSyncedTheme,
}: ThemeProviderProps) {
  const [osPrefersDark, setOsPrefersDark] = useState<boolean>(getSystemPrefersDark);
  const [savedConfig, setSavedConfig] = useState<ThemeConfig>(
    () => loadStoredThemeConfig(userUid) ?? DEFAULT_THEME_CONFIG
  );
  const [previewConfig, setPreviewConfig] = useState<ThemeConfig | null>(null);
  const [syncStatus, setSyncStatus] = useState<ThemeSyncStatus>('idle');
  const [syncError, setSyncError] = useState<string | null>(null);

  const hasMountedRef = useRef(false);
  const activeUidRef = useRef<string | null | undefined>(userUid);
  const inFlightSavesRef = useRef(0);
  const mutationVersionRef = useRef(0);
  const pendingOfflineConfigRef = useRef<ThemeConfig | null>(null);
  const persistCallbackRef = useRef(onPersistSyncedTheme);

  persistCallbackRef.current = onPersistSyncedTheme;
  activeUidRef.current = userUid;

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

  // Rehydrate cleanly when authenticated UID changes or signs out
  useEffect(() => {
    setPreviewConfig(null);
    pendingOfflineConfigRef.current = null;
    inFlightSavesRef.current = 0;

    if (!userUid) {
      setSyncStatus('idle');
      setSyncError(null);
      const localDevice = loadStoredThemeConfig(null);
      if (localDevice) {
        setSavedConfig(localDevice);
      }
      return;
    }

    const userLocal = loadStoredThemeConfig(userUid);
    if (userLocal) {
      setSavedConfig(userLocal);
    }
    setSyncStatus(cloudLoading ? 'loading' : 'idle');
    setSyncError(cloudSyncError ?? null);
  }, [userUid]);

  // Reflect external cloud fetch loading/error state when idle
  useEffect(() => {
    if (!userUid) return;
    if (inFlightSavesRef.current > 0 || pendingOfflineConfigRef.current) return;
    if (cloudLoading) {
      setSyncStatus('loading');
      setSyncError(null);
    } else if (cloudSyncError) {
      setSyncStatus('error');
      setSyncError(cloudSyncError);
    } else if (syncedThemeConfig) {
      setSyncStatus((prev) => (prev === 'loading' ? 'saved' : prev));
    }
  }, [userUid, cloudLoading, cloudSyncError, syncedThemeConfig]);

  // Cloud preferences become authoritative once synchronized (guarded against races)
  useEffect(() => {
    if (!userUid || !syncedThemeConfig) return;
    // Never let a stale cloud snapshot overwrite an active local save or pending offline write
    if (inFlightSavesRef.current > 0 || pendingOfflineConfigRef.current !== null) {
      return;
    }
    const clean = sanitizeThemeConfig(syncedThemeConfig);
    setSavedConfig((prev) => {
      if (JSON.stringify(prev) === JSON.stringify(clean)) {
        return prev;
      }
      saveStoredThemeConfig(clean, userUid);
      return clean;
    });
    setSyncStatus('saved');
    setSyncError(null);
  }, [syncedThemeConfig, userUid]);

  const persistToCloud = useCallback(
    async (clean: ThemeConfig, expectedUid: string | null | undefined, version: number) => {
      const persistFn = persistCallbackRef.current;
      if (!expectedUid || !persistFn) {
        return;
      }

      if (typeof navigator !== 'undefined' && navigator.onLine === false) {
        pendingOfflineConfigRef.current = clean;
        setSyncStatus('offline');
        setSyncError('تم حفظ المظهر محليًا الآن، وسيتم مزامنته سحابيًا فور عودة الاتصال بالإنترنت.');
        return;
      }

      inFlightSavesRef.current += 1;
      setSyncStatus('saving');
      setSyncError(null);
      try {
        await persistFn(clean);
        if (activeUidRef.current !== expectedUid) return;
        if (mutationVersionRef.current === version) {
          pendingOfflineConfigRef.current = null;
          setSyncStatus('saved');
          setSyncError(null);
        }
      } catch (err) {
        if (activeUidRef.current !== expectedUid) return;
        const offline = typeof navigator !== 'undefined' && navigator.onLine === false;
        const msg =
          err instanceof Error
            ? err.message
            : 'تعذر حفظ المظهر على السحابة حاليًا، تم الاحتفاظ به محليًا على هذا الجهاز.';
        pendingOfflineConfigRef.current = clean;
        if (mutationVersionRef.current === version) {
          setSyncStatus(offline ? 'offline' : 'error');
          setSyncError(
            offline
              ? 'تم حفظ المظهر محليًا الآن، وسيتم مزامنته سحابيًا فور عودة الاتصال بالإنترنت.'
              : msg
          );
        }
      } finally {
        inFlightSavesRef.current = Math.max(0, inFlightSavesRef.current - 1);
      }
    },
    []
  );

  // Auto-retry pending offline theme save when browser reconnects
  useEffect(() => {
    if (typeof window === 'undefined') return;
    const onOnline = () => {
      const pending = pendingOfflineConfigRef.current;
      const uid = activeUidRef.current;
      if (pending && uid && persistCallbackRef.current) {
        const nextVersion = ++mutationVersionRef.current;
        void persistToCloud(pending, uid, nextVersion);
      }
    };
    window.addEventListener('online', onOnline);
    return () => window.removeEventListener('online', onOnline);
  }, [persistToCloud]);

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
      const version = ++mutationVersionRef.current;
      const uid = activeUidRef.current;
      setPreviewConfig(null);
      setSavedConfig(clean);
      saveStoredThemeConfig(clean, uid);
      if (uid && persistCallbackRef.current) {
        void persistToCloud(clean, uid, version);
      }
    },
    [persistToCloud]
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

  const retryCloudSync = useCallback(async () => {
    const uid = activeUidRef.current;
    if (!uid || !persistCallbackRef.current) return;
    const cfg = pendingOfflineConfigRef.current ?? savedConfig;
    const version = ++mutationVersionRef.current;
    await persistToCloud(cfg, uid, version);
  }, [persistToCloud, savedConfig]);

  const value = useMemo<ThemeContextValue>(
    () => ({
      savedConfig,
      activeConfig,
      previewConfig,
      isPreviewing: previewConfig !== null,
      osPrefersDark,
      effectiveMode: resolved.effectiveMode,
      resolved,
      isAuthenticated: Boolean(userUid),
      syncStatus,
      syncError,
      setPreviewConfig,
      applyTheme,
      setMode,
      setPreset,
      commitPreview,
      discardPreview,
      resetToDefault,
      retryCloudSync,
    }),
    [
      savedConfig,
      activeConfig,
      previewConfig,
      osPrefersDark,
      resolved,
      userUid,
      syncStatus,
      syncError,
      applyTheme,
      setMode,
      setPreset,
      commitPreview,
      discardPreview,
      resetToDefault,
      retryCloudSync,
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
