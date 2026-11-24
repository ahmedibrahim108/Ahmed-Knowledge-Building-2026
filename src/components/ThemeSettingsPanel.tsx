import { useMemo, useState } from 'react';
import {
  Check,
  Contrast,
  Eye,
  Monitor,
  Moon,
  Palette,
  RotateCcw,
  Save,
  Sparkles,
  Sun,
  X,
} from 'lucide-react';
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
import { useTheme } from '../utils/ThemeContext';
import {
  CURATED_ACCENT_PALETTES,
  CURATED_BACKGROUND_SWATCHES,
  CURATED_SURFACE_SWATCHES,
  THEME_PRESETS,
  THEME_PRESET_ORDER,
  resolveThemeTokens,
} from '../utils/themeEngine';

interface ThemeSettingsPanelProps {
  canEdit?: boolean;
  onRequireAuth?: () => void;
}

export default function ThemeSettingsPanel({
  canEdit = true,
  onRequireAuth,
}: ThemeSettingsPanelProps) {
  const {
    savedConfig,
    activeConfig,
    isPreviewing,
    osPrefersDark,
    effectiveMode,
    resolved,
    setPreviewConfig,
    applyTheme,
    commitPreview,
    discardPreview,
    resetToDefault,
  } = useTheme();

  // Default to staging/preview-before-apply toggle OR direct live apply
  const [stageBeforeApply, setStageBeforeApply] = useState<boolean>(true);

  const updateDraft = (updater: (prev: ThemeConfig) => ThemeConfig) => {
    if (!canEdit && onRequireAuth) {
      // Theme still previews locally for any user, and persists in localStorage cleanly
    }
    const next = updater(activeConfig);
    if (stageBeforeApply) {
      setPreviewConfig(next);
    } else {
      applyTheme(next);
    }
  };

  const hasUnsavedChanges = useMemo(
    () => JSON.stringify(activeConfig) !== JSON.stringify(savedConfig),
    [activeConfig, savedConfig]
  );

  const isDefaultConfig = useMemo(
    () => JSON.stringify(activeConfig) === JSON.stringify(DEFAULT_THEME_CONFIG),
    [activeConfig]
  );

  const modeOptions: Array<{
    id: ThemeMode;
    label: string;
    hint: string;
    icon: typeof Sun;
  }> = [
    { id: 'light', label: 'الوضع الفاتح', hint: 'إضاءة نهارية واضحة', icon: Sun },
    { id: 'dark', label: 'الوضع الداكن', hint: 'إضاءة ليلية مريحة', icon: Moon },
    {
      id: 'system',
      label: 'تلقائي (النظام)',
      hint: osPrefersDark ? 'النظام الآن: داكن' : 'النظام الآن: فاتح',
      icon: Monitor,
    },
  ];

  const handleTogglePreset = (presetId: ThemePresetId) => {
    const presetDef = THEME_PRESETS[presetId];
    // Preserve 'system' if already selected, otherwise pick the preset's natural mode OR keep current explicit mode if user already switched intentionally
    const nextMode: ThemeMode =
      activeConfig.mode === 'system'
        ? 'system'
        : presetId === 'classic'
        ? 'light'
        : presetDef.recommendedMode;

    updateDraft((prev) => ({
      ...prev,
      preset: presetId,
      mode: nextMode,
      primaryAccentOverride: undefined,
      secondaryAccentOverride: undefined,
      backgroundOverride: undefined,
      surfaceOverride: undefined,
      borderOverride: undefined,
    }));
  };

  const currentPrimaryHex =
    activeConfig.primaryAccentOverride || resolved.tokens['--kb-primary'];
  const currentSecondaryHex =
    activeConfig.secondaryAccentOverride || resolved.tokens['--kb-secondary'];
  const currentBgHex = activeConfig.backgroundOverride || resolved.tokens['--kb-bg'];
  const currentSurfaceHex =
    activeConfig.surfaceOverride || resolved.tokens['--kb-card'];
  const currentBorderHex =
    activeConfig.borderOverride || resolved.tokens['--kb-border'];

  return (
    <div className="space-y-6">
      {/* Live Preview Sticky Action Bar */}
      {(isPreviewing || hasUnsavedChanges) && (
        <div
          role="status"
          aria-live="polite"
          className="sticky top-20 z-20 rounded-2xl border border-[#1E3A5F]/35 bg-white/95 backdrop-blur-md shadow-md px-4 py-3 flex flex-wrap items-center justify-between gap-3"
        >
          <div className="flex items-center gap-2.5 min-w-0">
            <span className="w-8 h-8 rounded-xl bg-[#1E3A5F]/10 text-[#1E3A5F] inline-flex items-center justify-center shrink-0">
              <Eye className="w-4 h-4" aria-hidden="true" />
            </span>
            <div className="min-w-0">
              <p className="text-xs sm:text-sm font-bold text-slate-900">
                معاينة حية نشطة على كامل التطبيق
              </p>
              <p className="text-[11px] text-slate-500">
                تستطيع تصفح جميع الصفحات للمعاينة الآن، ثم اضغط «تطبيق وحفظ الثيم» لتثبيته.
              </p>
            </div>
          </div>
          <div className="flex items-center gap-2 shrink-0">
            <button
              type="button"
              onClick={discardPreview}
              className="inline-flex items-center gap-1.5 px-3 py-1.5 min-h-[36px] text-xs font-semibold text-slate-700 bg-slate-100 hover:bg-slate-200 rounded-xl cursor-pointer whitespace-nowrap"
            >
              <X className="w-3.5 h-3.5" aria-hidden="true" />
              <span>تراجع عن المعاينة</span>
            </button>
            <button
              type="button"
              onClick={commitPreview}
              className="inline-flex items-center gap-1.5 px-4 py-1.5 min-h-[36px] text-xs font-semibold text-white bg-[#1E3A5F] hover:bg-[#162C49] rounded-xl cursor-pointer whitespace-nowrap"
            >
              <Save className="w-3.5 h-3.5" aria-hidden="true" />
              <span>تطبيق وحفظ الثيم</span>
            </button>
          </div>
        </div>
      )}

      {/* Top Header & Appearance Mode Selector */}
      <section className="bg-white border border-slate-200 rounded-2xl p-5 sm:p-6 space-y-5">
        <div className="flex flex-wrap items-start justify-between gap-4 pb-4 border-b border-slate-100">
          <div className="space-y-1">
            <div className="flex items-center gap-2">
              <Palette className="w-5 h-5 text-[#1E3A5F]" aria-hidden="true" />
              <h2 className="font-editorial text-xl sm:text-2xl font-bold text-slate-900">
                نظام المظهر والثيمات المتقدم
              </h2>
            </div>
            <p className="text-xs sm:text-sm text-slate-500 max-w-2xl leading-relaxed">
              اختر البيئة البصرية المناسبة للقراءة والتركيز، وخصص الألوان والأسطح والتباين، مع الحفاظ الكامل على ألوان بطاقات معرض اليوميات والخواطر.
            </p>
          </div>

          <div className="flex flex-wrap items-center gap-2">
            <label className="inline-flex items-center gap-2 px-3 py-1.5 rounded-xl border border-slate-200 bg-slate-50 text-xs font-medium text-slate-700 cursor-pointer select-none">
              <input
                type="checkbox"
                checked={stageBeforeApply}
                onChange={(e) => {
                  const checked = e.target.checked;
                  setStageBeforeApply(checked);
                  if (!checked && isPreviewing) {
                    commitPreview();
                  }
                }}
                className="rounded border-slate-300"
              />
              <span>معاينة قبل الحفظ</span>
            </label>

            <button
              type="button"
              disabled={isDefaultConfig}
              onClick={resetToDefault}
              className="inline-flex items-center gap-1.5 px-3 py-1.5 min-h-[34px] text-xs font-semibold text-slate-700 bg-slate-100 hover:bg-slate-200 rounded-xl cursor-pointer disabled:opacity-45 disabled:cursor-not-allowed whitespace-nowrap"
            >
              <RotateCcw className="w-3.5 h-3.5" aria-hidden="true" />
              <span>إعادة الافتراضي</span>
            </button>
          </div>
        </div>

        {/* Light / Dark / System Mode Switcher */}
        <div className="space-y-2.5">
          <div className="flex items-center justify-between gap-2">
            <span className="text-xs font-bold text-slate-800">
              وضع الإضاءة العام (Mode)
            </span>
            <span className="text-[11px] text-slate-500">
              المُفعّل حاليًا:{' '}
              <strong className="text-[#1E3A5F]">
                {effectiveMode === 'dark' ? 'الوضع الداكن' : 'الوضع الفاتح'}
              </strong>
            </span>
          </div>
          <div className="grid grid-cols-1 sm:grid-cols-3 gap-2.5">
            {modeOptions.map((m) => {
              const Icon = m.icon;
              const selected = activeConfig.mode === m.id;
              return (
                <button
                  key={m.id}
                  type="button"
                  onClick={() => updateDraft((prev) => ({ ...prev, mode: m.id }))}
                  className={`flex items-center gap-3 p-3.5 rounded-xl border text-right transition-all cursor-pointer ${
                    selected
                      ? 'border-[#1E3A5F] bg-[#F8FAFC] ring-2 ring-[#1E3A5F]/20'
                      : 'border-slate-200 bg-white hover:bg-slate-50'
                  }`}
                >
                  <span
                    className={`w-9 h-9 rounded-xl inline-flex items-center justify-center shrink-0 ${
                      selected
                        ? 'bg-[#1E3A5F] text-white'
                        : 'bg-slate-100 text-slate-600'
                    }`}
                  >
                    <Icon className="w-4 h-4" aria-hidden="true" />
                  </span>
                  <div className="min-w-0 flex-1">
                    <p className="text-xs sm:text-sm font-bold text-slate-900">
                      {m.label}
                    </p>
                    <p className="text-[11px] text-slate-500 truncate">{m.hint}</p>
                  </div>
                  {selected && (
                    <Check
                      className="w-4 h-4 text-[#1E3A5F] shrink-0"
                      aria-hidden="true"
                    />
                  )}
                </button>
              );
            })}
          </div>
        </div>
      </section>

      {/* Predefined Color Themes Grid */}
      <section className="bg-white border border-slate-200 rounded-2xl p-5 sm:p-6 space-y-4">
        <div className="flex flex-wrap items-center justify-between gap-2">
          <div>
            <h3 className="font-editorial text-lg sm:text-xl font-bold text-slate-900">
              الثيمات المصمّمة مسبقًا (Predefined Themes)
            </h3>
            <p className="text-xs text-slate-500">
              كل ثيم يحتوي على نسختين متوافقتين (فاتح وداكن) ويمكن التبديل بينهما بحرية.
            </p>
          </div>
        </div>

        <div className="grid grid-cols-1 sm:grid-cols-2 xl:grid-cols-3 gap-3.5">
          {THEME_PRESET_ORDER.map((presetId) => {
            const def = THEME_PRESETS[presetId];
            const isSelected = activeConfig.preset === presetId;
            const isSavedPreset = savedConfig.preset === presetId && !isPreviewing;
            const previewVariant =
              activeConfig.mode === 'system'
                ? osPrefersDark
                  ? def.dark
                  : def.light
                : activeConfig.mode === 'dark'
                ? def.dark
                : def.light;

            return (
              <button
                key={presetId}
                type="button"
                onClick={() => handleTogglePreset(presetId)}
                className={`group rounded-2xl border p-3.5 text-right transition-all cursor-pointer flex flex-col justify-between gap-3 ${
                  isSelected
                    ? 'border-[#1E3A5F] ring-2 ring-[#1E3A5F]/25 bg-[#F8FAFC]'
                    : 'border-slate-200 bg-white hover:border-slate-300'
                }`}
              >
                {/* Miniature UI Preview Swatch (isolated to preset's exact palette) */}
                <div
                  className="w-full rounded-xl border p-2.5 space-y-2 overflow-hidden"
                  style={{
                    background: previewVariant.gradientBg || previewVariant.bg,
                    borderColor: previewVariant.border,
                    color: previewVariant.fg,
                  }}
                >
                  <div className="flex items-center justify-between gap-2">
                    <div className="flex items-center gap-1.5">
                      <span
                        className="w-2.5 h-2.5 rounded-full"
                        style={{ backgroundColor: previewVariant.primary }}
                      />
                      <span
                        className="w-2.5 h-2.5 rounded-full"
                        style={{ backgroundColor: previewVariant.secondary }}
                      />
                      <span
                        className="h-2 w-12 rounded-full"
                        style={{ backgroundColor: previewVariant.fg, opacity: 0.75 }}
                      />
                    </div>
                    <span
                      className="text-[10px] font-semibold px-1.5 py-0.5 rounded-md"
                      style={{
                        backgroundColor: previewVariant.primary,
                        color: resolveThemeTokens(
                          { mode: effectiveMode, preset: presetId },
                          osPrefersDark
                        ).tokens['--kb-primary-fg'],
                      }}
                    >
                      {def.recommendedMode === 'dark' && activeConfig.mode !== 'light'
                        ? 'داكن'
                        : effectiveMode === 'dark'
                        ? 'داكن'
                        : 'فاتح'}
                    </span>
                  </div>

                  <div
                    className="rounded-lg border p-2 space-y-1.5"
                    style={{
                      backgroundColor: previewVariant.card,
                      borderColor: previewVariant.border,
                    }}
                  >
                    <div
                      className="h-2 w-3/4 rounded-full"
                      style={{ backgroundColor: previewVariant.fg, opacity: 0.85 }}
                    />
                    <div
                      className="h-1.5 w-1/2 rounded-full"
                      style={{ backgroundColor: previewVariant.fg600, opacity: 0.55 }}
                    />
                  </div>
                </div>

                {/* Preset Title & Metadata */}
                <div className="space-y-1">
                  <div className="flex items-center justify-between gap-2">
                    <div className="flex items-center gap-1.5 min-w-0">
                      <span className="text-sm font-bold text-slate-900 truncate">
                        {def.nameAr}
                      </span>
                      <span className="text-[10px] font-mono text-slate-400 shrink-0">
                        {def.nameEn}
                      </span>
                    </div>
                    {isSelected && (
                      <span className="inline-flex items-center gap-1 text-[11px] font-bold text-[#1E3A5F] shrink-0">
                        <Check className="w-3.5 h-3.5" aria-hidden="true" />
                        <span>{isSavedPreset ? 'نشط' : 'مُختار'}</span>
                      </span>
                    )}
                  </div>
                  <p className="text-[11px] text-slate-500 leading-relaxed">
                    {def.descriptionAr}
                  </p>
                </div>
              </button>
            );
          })}
        </div>
      </section>

      {/* Deep Theme Customization + Live Component Preview */}
      <div className="grid grid-cols-1 xl:grid-cols-12 gap-5 items-start">
        <section className="xl:col-span-7 bg-white border border-slate-200 rounded-2xl p-5 sm:p-6 space-y-5">
          <div className="flex items-center justify-between gap-2 pb-3 border-b border-slate-100">
            <div className="flex items-center gap-2">
              <Sparkles className="w-4 h-4 text-[#1E3A5F]" aria-hidden="true" />
              <h3 className="font-editorial text-lg font-bold text-slate-900">
                تخصيص الألوان والأسطح والتباين
              </h3>
            </div>
            {(activeConfig.primaryAccentOverride ||
              activeConfig.secondaryAccentOverride ||
              activeConfig.backgroundOverride ||
              activeConfig.surfaceOverride ||
              activeConfig.borderOverride) && (
              <button
                type="button"
                onClick={() =>
                  updateDraft((prev) => ({
                    ...prev,
                    primaryAccentOverride: undefined,
                    secondaryAccentOverride: undefined,
                    backgroundOverride: undefined,
                    surfaceOverride: undefined,
                    borderOverride: undefined,
                  }))
                }
                className="text-[11px] font-semibold text-[#1E3A5F] hover:underline cursor-pointer"
              >
                مسح التخصيصات اللونية
              </button>
            )}
          </div>

          {/* Curated Accent Pairs */}
          <div className="space-y-2">
            <span className="text-xs font-bold text-slate-800 block">
              لوحات ألوان التمييز المقترحة (Curated Accent Palettes)
            </span>
            <div className="grid grid-cols-2 sm:grid-cols-4 gap-2">
              {CURATED_ACCENT_PALETTES.map((pal) => {
                const isActive =
                  activeConfig.primaryAccentOverride?.toUpperCase() ===
                    pal.primary.toUpperCase() &&
                  activeConfig.secondaryAccentOverride?.toUpperCase() ===
                    pal.secondary.toUpperCase();
                return (
                  <button
                    key={pal.id}
                    type="button"
                    onClick={() =>
                      updateDraft((prev) => ({
                        ...prev,
                        primaryAccentOverride: pal.primary,
                        secondaryAccentOverride: pal.secondary,
                      }))
                    }
                    className={`flex items-center gap-2 px-2.5 py-2 rounded-xl border text-right cursor-pointer transition-colors ${
                      isActive
                        ? 'border-[#1E3A5F] bg-slate-50 ring-1 ring-[#1E3A5F]/25'
                        : 'border-slate-200 hover:bg-slate-50'
                    }`}
                  >
                    <span className="flex items-center -space-x-1 space-x-reverse shrink-0">
                      <span
                        className="w-4 h-4 rounded-full border border-white/70 shadow-2xs"
                        style={{ backgroundColor: pal.primary }}
                      />
                      <span
                        className="w-3.5 h-3.5 rounded-full border border-white/70"
                        style={{ backgroundColor: pal.secondary }}
                      />
                    </span>
                    <span className="text-[11px] font-semibold text-slate-800 truncate">
                      {pal.labelAr}
                    </span>
                  </button>
                );
              })}
            </div>
          </div>

          {/* Primary & Secondary Custom Color Pickers */}
          <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
            <div className="p-3 rounded-xl border border-slate-200 bg-slate-50 space-y-2">
              <div className="flex items-center justify-between gap-2">
                <label
                  htmlFor="kb-primary-picker"
                  className="text-xs font-bold text-slate-800"
                >
                  اللون الأساسي (Primary Accent)
                </label>
                {activeConfig.primaryAccentOverride && (
                  <button
                    type="button"
                    onClick={() =>
                      updateDraft((prev) => ({
                        ...prev,
                        primaryAccentOverride: undefined,
                      }))
                    }
                    className="text-[10px] font-semibold text-[#1E3A5F] hover:underline cursor-pointer"
                  >
                    استعادة
                  </button>
                )}
              </div>
              <div className="flex items-center gap-2.5">
                <input
                  id="kb-primary-picker"
                  type="color"
                  value={currentPrimaryHex}
                  onChange={(e) =>
                    updateDraft((prev) => ({
                      ...prev,
                      primaryAccentOverride: e.target.value.toUpperCase(),
                    }))
                  }
                  className="w-9 h-9 rounded-lg border border-slate-300 cursor-pointer bg-transparent p-0.5 shrink-0"
                />
                <span className="text-xs font-mono text-slate-600 tabular-nums">
                  {currentPrimaryHex}
                </span>
              </div>
            </div>

            <div className="p-3 rounded-xl border border-slate-200 bg-slate-50 space-y-2">
              <div className="flex items-center justify-between gap-2">
                <label
                  htmlFor="kb-secondary-picker"
                  className="text-xs font-bold text-slate-800"
                >
                  اللون الثانوي (Secondary Accent)
                </label>
                {activeConfig.secondaryAccentOverride && (
                  <button
                    type="button"
                    onClick={() =>
                      updateDraft((prev) => ({
                        ...prev,
                        secondaryAccentOverride: undefined,
                      }))
                    }
                    className="text-[10px] font-semibold text-[#1E3A5F] hover:underline cursor-pointer"
                  >
                    استعادة
                  </button>
                )}
              </div>
              <div className="flex items-center gap-2.5">
                <input
                  id="kb-secondary-picker"
                  type="color"
                  value={currentSecondaryHex}
                  onChange={(e) =>
                    updateDraft((prev) => ({
                      ...prev,
                      secondaryAccentOverride: e.target.value.toUpperCase(),
                    }))
                  }
                  className="w-9 h-9 rounded-lg border border-slate-300 cursor-pointer bg-transparent p-0.5 shrink-0"
                />
                <span className="text-xs font-mono text-slate-600 tabular-nums">
                  {currentSecondaryHex}
                </span>
              </div>
            </div>
          </div>

          {/* Background, Surface & Border Appearance Selectors */}
          <div className="grid grid-cols-1 sm:grid-cols-2 gap-4 pt-1">
            {/* Background Appearance */}
            <div className="space-y-2">
              <span className="text-xs font-bold text-slate-800 block">
                مظهر الخلفية العامة
              </span>
              <div className="grid grid-cols-2 gap-1.5">
                {(
                  [
                    { id: 'default', label: 'افتراضي' },
                    { id: 'flat', label: 'مسطح صافي' },
                    { id: 'tinted', label: 'مشبع باللون' },
                    { id: 'gradient', label: 'تدرج هادئ' },
                  ] as Array<{ id: ThemeBackgroundStyle; label: string }>
                ).map((opt) => {
                  const active = (activeConfig.backgroundStyle || 'default') === opt.id;
                  return (
                    <button
                      key={opt.id}
                      type="button"
                      onClick={() =>
                        updateDraft((prev) => ({
                          ...prev,
                          backgroundStyle: opt.id,
                        }))
                      }
                      className={`px-2.5 py-1.5 text-[11px] font-semibold rounded-lg border cursor-pointer ${
                        active
                          ? 'bg-[#1E3A5F] text-white border-[#1E3A5F]'
                          : 'bg-slate-50 text-slate-700 border-slate-200 hover:bg-slate-100'
                      }`}
                    >
                      {opt.label}
                    </button>
                  );
                })}
              </div>
              <div className="flex flex-wrap items-center gap-1.5 pt-1">
                {CURATED_BACKGROUND_SWATCHES.filter(
                  (s) => s.mode === effectiveMode
                ).map((sw) => (
                  <button
                    key={sw.id}
                    type="button"
                    title={sw.labelAr}
                    aria-label={`خلفية ${sw.labelAr}`}
                    onClick={() =>
                      updateDraft((prev) => ({
                        ...prev,
                        backgroundOverride: sw.hex,
                      }))
                    }
                    className={`w-6 h-6 rounded-full border cursor-pointer transition-transform hover:scale-105 ${
                      activeConfig.backgroundOverride === sw.hex
                        ? 'ring-2 ring-[#1E3A5F] ring-offset-1'
                        : 'border-slate-300'
                    }`}
                    style={{ backgroundColor: sw.hex }}
                  />
                ))}
                <input
                  type="color"
                  title="لون خلفية مخصص"
                  aria-label="تخصيص لون الخلفية"
                  value={currentBgHex}
                  onChange={(e) =>
                    updateDraft((prev) => ({
                      ...prev,
                      backgroundOverride: e.target.value.toUpperCase(),
                    }))
                  }
                  className="w-6 h-6 rounded-full border border-slate-300 cursor-pointer p-0 bg-transparent"
                />
              </div>
            </div>

            {/* Card / Surface Appearance */}
            <div className="space-y-2">
              <span className="text-xs font-bold text-slate-800 block">
                مظهر الأسطح والبطاقات
              </span>
              <div className="grid grid-cols-2 gap-1.5">
                {(
                  [
                    { id: 'default', label: 'افتراضي' },
                    { id: 'crisp', label: 'نقي واضح' },
                    { id: 'soft', label: 'ناعم هادئ' },
                    { id: 'elevated', label: 'بارز بظلال' },
                  ] as Array<{ id: ThemeSurfaceStyle; label: string }>
                ).map((opt) => {
                  const active = (activeConfig.surfaceStyle || 'default') === opt.id;
                  return (
                    <button
                      key={opt.id}
                      type="button"
                      onClick={() =>
                        updateDraft((prev) => ({
                          ...prev,
                          surfaceStyle: opt.id,
                        }))
                      }
                      className={`px-2.5 py-1.5 text-[11px] font-semibold rounded-lg border cursor-pointer ${
                        active
                          ? 'bg-[#1E3A5F] text-white border-[#1E3A5F]'
                          : 'bg-slate-50 text-slate-700 border-slate-200 hover:bg-slate-100'
                      }`}
                    >
                      {opt.label}
                    </button>
                  );
                })}
              </div>
              <div className="flex flex-wrap items-center gap-1.5 pt-1">
                {CURATED_SURFACE_SWATCHES.filter(
                  (s) => s.mode === effectiveMode
                ).map((sw) => (
                  <button
                    key={sw.id}
                    type="button"
                    title={sw.labelAr}
                    aria-label={`سطح ${sw.labelAr}`}
                    onClick={() =>
                      updateDraft((prev) => ({
                        ...prev,
                        surfaceOverride: sw.hex,
                      }))
                    }
                    className={`w-6 h-6 rounded-full border cursor-pointer transition-transform hover:scale-105 ${
                      activeConfig.surfaceOverride === sw.hex
                        ? 'ring-2 ring-[#1E3A5F] ring-offset-1'
                        : 'border-slate-300'
                    }`}
                    style={{ backgroundColor: sw.hex }}
                  />
                ))}
                <input
                  type="color"
                  title="لون بطاقات مخصص"
                  aria-label="تخصيص لون البطاقات والأسطح"
                  value={currentSurfaceHex}
                  onChange={(e) =>
                    updateDraft((prev) => ({
                      ...prev,
                      surfaceOverride: e.target.value.toUpperCase(),
                    }))
                  }
                  className="w-6 h-6 rounded-full border border-slate-300 cursor-pointer p-0 bg-transparent"
                />
              </div>
            </div>
          </div>

          {/* Border Appearance & Text Contrast */}
          <div className="grid grid-cols-1 sm:grid-cols-2 gap-4 pt-1 border-t border-slate-100">
            <div className="space-y-2">
              <div className="flex items-center justify-between gap-2">
                <span className="text-xs font-bold text-slate-800">
                  مظهر الحدود والفواصل
                </span>
                <input
                  type="color"
                  title="لون حدود مخصص"
                  aria-label="تخصيص لون الحدود"
                  value={currentBorderHex}
                  onChange={(e) =>
                    updateDraft((prev) => ({
                      ...prev,
                      borderOverride: e.target.value.toUpperCase(),
                    }))
                  }
                  className="w-5 h-5 rounded border border-slate-300 cursor-pointer p-0 bg-transparent"
                />
              </div>
              <div className="grid grid-cols-2 gap-1.5">
                {(
                  [
                    { id: 'default', label: 'افتراضي' },
                    { id: 'subtle', label: 'رقيق خفيف' },
                    { id: 'defined', label: 'محدد بارز' },
                    { id: 'minimal', label: 'شبه مخفي' },
                  ] as Array<{ id: ThemeBorderStyle; label: string }>
                ).map((opt) => {
                  const active = (activeConfig.borderStyle || 'default') === opt.id;
                  return (
                    <button
                      key={opt.id}
                      type="button"
                      onClick={() =>
                        updateDraft((prev) => ({
                          ...prev,
                          borderStyle: opt.id,
                        }))
                      }
                      className={`px-2.5 py-1.5 text-[11px] font-semibold rounded-lg border cursor-pointer ${
                        active
                          ? 'bg-[#1E3A5F] text-white border-[#1E3A5F]'
                          : 'bg-slate-50 text-slate-700 border-slate-200 hover:bg-slate-100'
                      }`}
                    >
                      {opt.label}
                    </button>
                  );
                })}
              </div>
            </div>

            <div className="space-y-2">
              <span className="text-xs font-bold text-slate-800 flex items-center gap-1.5">
                <Contrast className="w-3.5 h-3.5 text-[#1E3A5F]" aria-hidden="true" />
                <span>تباين النصوص (Text Contrast)</span>
              </span>
              <div className="grid grid-cols-3 gap-1.5">
                {(
                  [
                    { id: 'standard', label: 'متوازن' },
                    { id: 'high', label: 'عالٍ' },
                    { id: 'soft', label: 'هادئ' },
                  ] as Array<{ id: ThemeContrastLevel; label: string }>
                ).map((opt) => {
                  const active = (activeConfig.contrastLevel || 'standard') === opt.id;
                  return (
                    <button
                      key={opt.id}
                      type="button"
                      onClick={() =>
                        updateDraft((prev) => ({
                          ...prev,
                          contrastLevel: opt.id,
                        }))
                      }
                      className={`px-2.5 py-1.5 text-[11px] font-semibold rounded-lg border cursor-pointer ${
                        active
                          ? 'bg-[#1E3A5F] text-white border-[#1E3A5F]'
                          : 'bg-slate-50 text-slate-700 border-slate-200 hover:bg-slate-100'
                      }`}
                    >
                      {opt.label}
                    </button>
                  );
                })}
              </div>
              <p className="text-[11px] text-slate-500">
                يتم ضبط ألوان النصوص والأزرار تلقائيًا لضمان قابلية القراءة المريحة.
              </p>
            </div>
          </div>
        </section>

        {/* Interactive Live Component Showcase & Contrast Audit */}
        <aside className="xl:col-span-5 space-y-4">
          <div className="bg-white border border-slate-200 rounded-2xl p-5 space-y-4">
            <div className="flex items-center justify-between gap-2 pb-3 border-b border-slate-100">
              <h3 className="font-editorial text-lg font-bold text-slate-900">
                معاينة العناصر الحية
              </h3>
              <span
                className={`text-[11px] font-bold px-2 py-0.5 rounded-md border ${
                  resolved.contrastReport.meetsAA
                    ? 'bg-emerald-50 text-emerald-800 border-emerald-200'
                    : 'bg-amber-50 text-amber-800 border-amber-200'
                }`}
              >
                {resolved.contrastReport.meetsAA ? 'تباين WCAG AA مريح' : 'تباين مخصص'}
              </span>
            </div>

            {/* Simulated Canvas Block */}
            <div className="rounded-xl border border-slate-200 bg-[#F7F8FA] p-4 space-y-3">
              <div className="rounded-xl border border-slate-200 bg-white p-3.5 space-y-2.5 shadow-xs">
                <div className="flex items-center justify-between gap-2">
                  <span className="text-xs font-bold text-slate-900">
                    بطاقة مسار تعلّمي تجريبية
                  </span>
                  <span className="text-[11px] font-semibold text-[#1E3A5F]">
                    نشط الآن
                  </span>
                </div>
                <p className="text-xs text-slate-600 leading-relaxed">
                  هكذا تبدو البطاقات، العناوين، والنصوص الثانوية داخل لوحة المتابعة والمشاريع والكورسات.
                </p>
                <div className="flex flex-wrap items-center gap-2 pt-1">
                  <button
                    type="button"
                    className="px-3 py-1.5 text-xs font-semibold rounded-lg bg-[#1E3A5F] text-white"
                  >
                    إجراء رئيسي
                  </button>
                  <span
                    className="px-2.5 py-1 text-[11px] font-semibold rounded-lg"
                    style={{
                      backgroundColor: resolved.tokens['--kb-secondary-soft'],
                      color: resolved.tokens['--kb-secondary-ink'],
                    }}
                  >
                    وسم ثانوي
                  </span>
                  <span className="text-[11px] text-emerald-700 font-semibold">
                    مكتمل 82%
                  </span>
                </div>
              </div>

              {/* Protected Custom Journal Card Example */}
              <div
                data-custom-card-surface="light"
                className="rounded-xl border border-[#C9DFCF] bg-[#F2F7F3] p-3.5 space-y-1"
              >
                <div className="flex items-center justify-between gap-2">
                  <span className="text-[11px] font-bold text-slate-900">
                    بطاقة يومية مخصصة (محمية)
                  </span>
                  <span className="text-[10px] font-semibold text-emerald-800">
                    حفظ مستقل للون
                  </span>
                </div>
                <p className="text-[11px] text-slate-700 leading-relaxed">
                  تحتفظ بطاقات معرض اليوميات الملوّنة بألوانها الورقية وقابليتها للقراءة حتى عند تفعيل الثيم الداكن.
                </p>
              </div>
            </div>

            {/* Contrast Telemetry Bars */}
            <div className="grid grid-cols-2 gap-2.5 text-[11px] tabular-nums">
              <div className="p-2.5 rounded-xl bg-slate-50 border border-slate-200 flex items-center justify-between">
                <span className="text-slate-600">تباين النص/البطاقة</span>
                <strong className="text-slate-900">
                  {resolved.contrastReport.textOnCard.toFixed(1)}:1
                </strong>
              </div>
              <div className="p-2.5 rounded-xl bg-slate-50 border border-slate-200 flex items-center justify-between">
                <span className="text-slate-600">تباين الأزرار</span>
                <strong className="text-slate-900">
                  {resolved.contrastReport.primaryButtonRatio.toFixed(1)}:1
                </strong>
              </div>
            </div>
          </div>
        </aside>
      </div>
    </div>
  );
}
