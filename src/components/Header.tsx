import { useEffect, useMemo, useRef, useState } from 'react';
import { User } from 'firebase/auth';
import {
  ArrowLeft,
  ArrowRight,
  BarChart3,
  BookOpenText,
  CalendarClock,
  CalendarHeart,
  Check,
  ChevronDown,
  Cloud,
  Eye,
  Feather,
  Images,
  LayoutDashboard,
  LogIn,
  LogOut,
  Monitor,
  Moon,
  NotebookPen,
  Palette,
  RefreshCw,
  Search,
  Settings2,
  Sun,
} from 'lucide-react';
import {
  DEFAULT_PINNED_NAV_TABS,
  NAV_PINNABLE_TABS_META,
  PublicPageId,
  ThemeMode,
} from '../data/curriculumData';
import { useTheme } from '../utils/ThemeContext';
import { THEME_PRESETS, THEME_PRESET_ORDER } from '../utils/themeEngine';
import BrandMark from './BrandMark';
import PWAInstallButton from './PWAInstallButton';

export type ActiveTab =
  | 'overview'
  | 'focus'
  | 'plan'
  | 'domains'
  | 'courses'
  | 'paths'
  | 'library'
  | 'journal'
  | 'daily_journal'
  | 'weekly_plan'
  | 'reviews'
  | 'reflections'
  | 'blogs'
  | 'gallery'
  | 'tasks'
  | 'calendar'
  | 'account'
  | 'public';

interface HeaderProps {
  activeTab: ActiveTab;
  onSelectTab: (tab: ActiveTab) => void;
  user: User | null;
  authReady: boolean;
  isAdmin: boolean;
  isPreviewingPublic?: boolean;
  onTogglePreviewPublic?: () => void;
  syncingCloud: boolean;
  onGoogleSignIn: () => void;
  onSignOut: () => void;
  focusCoursesCount?: number;
  monthsCount?: number;
  domainsCount: number;
  coursesCount: number;
  pathsCount?: number;
  libraryCount?: number;
  tasksCount?: number;
  notesCount: number;
  reflectionsCount?: number;
  blogsCount?: number;
  pinnedNavTabs?: string[];
  publicPage?: PublicPageId;
  onSelectPublicPage?: (page: PublicPageId) => void;
  showPublicReflections?: boolean;
  showPublicBlogs?: boolean;
  canGoBack?: boolean;
  canGoForward?: boolean;
  backLabel?: string;
  forwardLabel?: string;
  onGoBack?: () => void;
  onGoForward?: () => void;
  onOpenAdvancedSearch?: () => void;
  onOpenThemeSettings?: () => void;
}

export default function Header({
  activeTab,
  onSelectTab,
  user,
  authReady,
  isAdmin,
  isPreviewingPublic = false,
  onTogglePreviewPublic,
  syncingCloud,
  onGoogleSignIn,
  onSignOut,
  focusCoursesCount = 0,
  monthsCount = 0,
  domainsCount,
  coursesCount,
  pathsCount = 0,
  libraryCount = 0,
  tasksCount = 0,
  notesCount,
  reflectionsCount = 0,
  blogsCount = 0,
  pinnedNavTabs,
  publicPage = 'home',
  onSelectPublicPage,
  showPublicReflections = true,
  showPublicBlogs = true,
  canGoBack = false,
  canGoForward = false,
  backLabel,
  forwardLabel,
  onGoBack,
  onGoForward,
  onOpenAdvancedSearch,
  onOpenThemeSettings,
}: HeaderProps) {
  const showAdminNav = isAdmin && !isPreviewingPublic;
  const [reloading, setReloading] = useState(false);
  const { activeConfig, effectiveMode, applyTheme, setMode } = useTheme();
  const [themeMenuOpen, setThemeMenuOpen] = useState(false);

  const navItems: Array<{ id: ActiveTab; label: string }> = useMemo(() => {
    if (!showAdminNav) {
      return [];
    }
    const pinnedSet = new Set(
      pinnedNavTabs && pinnedNavTabs.length > 0
        ? pinnedNavTabs
        : DEFAULT_PINNED_NAV_TABS
    );

    const dynamicItems: Array<{ id: ActiveTab; label: string }> = [
      { id: 'overview', label: 'لوحة المتابعة' },
    ];

    for (const meta of NAV_PINNABLE_TABS_META) {
      if (!pinnedSet.has(meta.id)) continue;
      dynamicItems.push({ id: meta.id, label: meta.label });
    }

    dynamicItems.push({ id: 'account', label: 'الإدارة والحساب' });
    return dynamicItems;
  }, [showAdminNav, pinnedNavTabs]);

  const publicNavItems: Array<{ id: PublicPageId; label: string }> = useMemo(() => {
    const list: Array<{ id: PublicPageId; label: string }> = [
      { id: 'home', label: 'الرئيسية' },
    ];
    if (showPublicReflections) {
      list.push({ id: 'reflections', label: 'خواطري وتأملاتي' });
    }
    if (showPublicBlogs) {
      list.push({ id: 'blogs', label: 'المدونة والمقالات' });
    }
    return list;
  }, [showPublicReflections, showPublicBlogs]);

  const [menuOpen, setMenuOpen] = useState(false);
  const menuRef = useRef<HTMLDivElement | null>(null);

  useEffect(() => {
    const handleClickOutside = (e: MouseEvent) => {
      if (menuRef.current && !menuRef.current.contains(e.target as Node)) {
        setMenuOpen(false);
        setThemeMenuOpen(false);
      }
    };
    document.addEventListener('mousedown', handleClickOutside);
    return () => document.removeEventListener('mousedown', handleClickOutside);
  }, []);

  const userInitial =
    (user?.displayName || user?.email || 'م').trim().charAt(0).toUpperCase();

  const handleHardReload = () => {
    if (typeof window === 'undefined') return;
    setReloading(true);
    window.setTimeout(() => {
      window.location.reload();
    }, 120);
  };

  return (
    <header className="sticky top-0 z-30 bg-white/95 backdrop-blur-sm border-b border-slate-200">
      {/* Subtle, Non-Intrusive Top Utility Bar (Back · Forward · Reload · Mobile App · Desktop Standalone App) */}
      <div className="bg-slate-50/90 border-b border-slate-100">
        <div className="max-w-[1280px] mx-auto px-3 sm:px-6 h-8 flex items-center justify-between gap-2 text-[11px] text-slate-500">
          <span className="hidden sm:inline truncate">
            منصة ميزان المعرفة · قراءة هادئة وتعلّم متوازن
          </span>
          <div className="flex items-center gap-1 sm:gap-1.5 mr-auto sm:mr-0 overflow-x-auto no-scrollbar">
            {onGoBack && onGoForward && (
              <>
                <div className="inline-flex items-center gap-0.5 shrink-0">
                  <button
                    type="button"
                    disabled={!canGoBack}
                    onClick={onGoBack}
                    title={backLabel ? `رجوع إلى: ${backLabel}` : 'رجوع للخلف'}
                    aria-label={backLabel ? `رجوع إلى ${backLabel}` : 'رجوع للخلف'}
                    className="inline-flex items-center gap-1 px-1.5 py-0.5 h-6 text-[11px] font-medium text-slate-600 hover:text-[#1E3A5F] hover:bg-slate-200/60 rounded transition-colors whitespace-nowrap shrink-0 cursor-pointer disabled:opacity-35 disabled:hover:bg-transparent disabled:cursor-not-allowed"
                  >
                    <ArrowRight className="w-3.5 h-3.5" aria-hidden="true" />
                    <span className="hidden md:inline">السابق</span>
                  </button>
                  <button
                    type="button"
                    disabled={!canGoForward}
                    onClick={onGoForward}
                    title={forwardLabel ? `تقدم إلى: ${forwardLabel}` : 'تقدم للأمام'}
                    aria-label={forwardLabel ? `تقدم إلى ${forwardLabel}` : 'تقدم للأمام'}
                    className="inline-flex items-center gap-1 px-1.5 py-0.5 h-6 text-[11px] font-medium text-slate-600 hover:text-[#1E3A5F] hover:bg-slate-200/60 rounded transition-colors whitespace-nowrap shrink-0 cursor-pointer disabled:opacity-35 disabled:hover:bg-transparent disabled:cursor-not-allowed"
                  >
                    <ArrowLeft className="w-3.5 h-3.5" aria-hidden="true" />
                    <span className="hidden md:inline">التالي</span>
                  </button>
                </div>
                <span className="text-slate-300 select-none" aria-hidden="true">
                  |
                </span>
              </>
            )}

            <button
              type="button"
              onClick={handleHardReload}
              title="إعادة تحميل الصفحة لتحديث البيانات والنسخة"
              className="inline-flex items-center gap-1 px-2 py-0.5 h-6 text-[11px] font-medium text-slate-600 hover:text-[#1E3A5F] hover:bg-slate-200/60 rounded transition-colors whitespace-nowrap shrink-0 cursor-pointer"
            >
              <RefreshCw
                className={`w-3 h-3 ${reloading ? 'animate-spin' : ''}`}
                aria-hidden="true"
              />
              <span>تحديث الصفحة</span>
            </button>

            <span className="text-slate-300 select-none" aria-hidden="true">
              |
            </span>

            <PWAInstallButton variant="utility-mobile" />
            <PWAInstallButton variant="utility-desktop" />
          </div>
        </div>
      </div>

      <div className="max-w-[1280px] mx-auto px-3 sm:px-6 h-13 sm:h-15 flex items-center justify-between gap-2 sm:gap-3">
        {/* Zone 1: Brand Wordmark + Custom Emblem */}
        <button
          type="button"
          onClick={() => {
            if (showAdminNav) {
              onSelectTab('overview');
            } else {
              onSelectPublicPage?.('home');
              onSelectTab('public');
            }
          }}
          className="inline-flex items-center gap-2 whitespace-nowrap shrink-0 cursor-pointer focus-visible:outline-2 focus-visible:outline-offset-4 focus-visible:outline-[#1E3A5F]"
        >
          <BrandMark className="w-7 h-7 sm:w-8 sm:h-8 shrink-0" />
          <span className="font-editorial text-lg sm:text-2xl font-bold text-slate-900 tracking-tight">
            ميزان المعرفة
          </span>
        </button>

        {/* Zone 2: Horizontal Scroll-Safe Desktop Navigation */}
        {showAdminNav ? (
          <nav
            aria-label="التنقل الرئيسي"
            className="hidden lg:flex items-center gap-3.5 xl:gap-4 h-full overflow-x-auto no-scrollbar"
          >
            {navItems.map((item) => {
              const isActive = activeTab === item.id;
              return (
                <button
                  key={item.id}
                  type="button"
                  onClick={() => onSelectTab(item.id)}
                  className={`relative h-full inline-flex items-center text-[13px] font-medium transition-colors duration-150 whitespace-nowrap shrink-0 cursor-pointer focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-[#1E3A5F] ${
                    isActive
                      ? 'text-[#1E3A5F] font-semibold'
                      : 'text-slate-600 hover:text-slate-900'
                  }`}
                >
                  {item.label}
                  {isActive && (
                    <span
                      aria-hidden="true"
                      className="absolute bottom-0 inset-x-0 h-0.5 bg-[#1E3A5F]"
                    />
                  )}
                </button>
              );
            })}
          </nav>
        ) : (
          <nav
            aria-label="صفحات الموقع العام"
            className="hidden md:flex items-center gap-5 h-full"
          >
            {publicNavItems.map((pItem) => {
              const isActive = publicPage === pItem.id;
              return (
                <button
                  key={pItem.id}
                  type="button"
                  onClick={() => {
                    onSelectPublicPage?.(pItem.id);
                    onSelectTab('public');
                  }}
                  className={`relative h-full inline-flex items-center text-sm font-medium transition-colors whitespace-nowrap shrink-0 cursor-pointer ${
                    isActive
                      ? 'text-[#1E3A5F] font-semibold'
                      : 'text-slate-600 hover:text-slate-900'
                  }`}
                >
                  {pItem.label}
                  {isActive && (
                    <span
                      aria-hidden="true"
                      className="absolute bottom-0 inset-x-0 h-0.5 bg-[#1E3A5F]"
                    />
                  )}
                </button>
              );
            })}
          </nav>
        )}

        {/* Zone 3: Global Search · Public Preview · User Account */}
        <div className="flex items-center gap-2 shrink-0 relative" ref={menuRef}>
          {onOpenAdvancedSearch && (
            <button
              type="button"
              onClick={onOpenAdvancedSearch}
              title="بحث متقدم في كل المنصة (Ctrl+K)"
              aria-label="بحث متقدم في كل المنصة"
              className="inline-flex items-center gap-1.5 px-2.5 sm:px-3 py-1.5 min-h-[34px] text-xs font-semibold text-slate-700 hover:text-[#1E3A5F] bg-[#F7F8FA] hover:bg-slate-100 border border-slate-200 rounded-lg transition-colors whitespace-nowrap shrink-0 cursor-pointer focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-[#1E3A5F]"
            >
              <Search className="w-3.5 h-3.5 text-[#1E3A5F]" aria-hidden="true" />
              <span className="hidden sm:inline">بحث</span>
              <span className="hidden xl:inline text-[10px] font-mono text-slate-400">
                Ctrl+K
              </span>
            </button>
          )}

          {/* Quick Theme & Mode Switcher (Available for All Visitors & Admin) */}
          <div className="relative shrink-0">
            <button
              type="button"
              onClick={() => {
                setThemeMenuOpen((v) => !v);
                setMenuOpen(false);
              }}
              aria-expanded={themeMenuOpen}
              aria-label="تغيير المظهر والثيم"
              title="تبديل المظهر (فاتح / داكن / الثيمات)"
              className={`inline-flex items-center gap-1.5 px-2.5 py-1.5 min-h-[34px] text-xs font-semibold rounded-lg border transition-colors whitespace-nowrap shrink-0 cursor-pointer focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-[#1E3A5F] ${
                themeMenuOpen
                  ? 'bg-[#1E3A5F] text-white border-[#1E3A5F]'
                  : 'bg-[#F7F8FA] text-slate-700 hover:text-[#1E3A5F] hover:bg-slate-100 border-slate-200'
              }`}
            >
              {effectiveMode === 'dark' ? (
                <Moon className="w-3.5 h-3.5 shrink-0" aria-hidden="true" />
              ) : (
                <Sun className="w-3.5 h-3.5 shrink-0" aria-hidden="true" />
              )}
              <span className="hidden xl:inline">المظهر</span>
            </button>

            {themeMenuOpen && (
              <div className="absolute left-0 top-full mt-2 w-72 bg-white border border-slate-200 rounded-2xl shadow-xl p-3 z-50 space-y-3 text-right">
                <div className="flex items-center justify-between gap-2 pb-2 border-b border-slate-100">
                  <span className="text-xs font-bold text-slate-900 inline-flex items-center gap-1.5">
                    <Palette className="w-3.5 h-3.5 text-[#1E3A5F]" aria-hidden="true" />
                    <span>المظهر السريع</span>
                  </span>
                  <span className="text-[10px] font-semibold text-slate-500">
                    {THEME_PRESETS[activeConfig.preset]?.nameAr}
                  </span>
                </div>

                {/* Mode Pills */}
                <div className="grid grid-cols-3 gap-1 p-1 bg-slate-100 rounded-xl">
                  {(
                    [
                      { id: 'light', label: 'فاتح', icon: Sun },
                      { id: 'dark', label: 'داكن', icon: Moon },
                      { id: 'system', label: 'النظام', icon: Monitor },
                    ] as Array<{ id: ThemeMode; label: string; icon: typeof Sun }>
                  ).map((m) => {
                    const Icon = m.icon;
                    const active = activeConfig.mode === m.id;
                    return (
                      <button
                        key={m.id}
                        type="button"
                        onClick={() => setMode(m.id)}
                        className={`inline-flex items-center justify-center gap-1 py-1.5 px-2 text-[11px] font-semibold rounded-lg cursor-pointer transition-colors ${
                          active
                            ? 'bg-white text-[#1E3A5F] shadow-2xs'
                            : 'text-slate-600 hover:text-slate-900'
                        }`}
                      >
                        <Icon className="w-3 h-3" aria-hidden="true" />
                        <span>{m.label}</span>
                      </button>
                    );
                  })}
                </div>

                {/* 6 Preset Quick Picker */}
                <div className="grid grid-cols-2 gap-1.5">
                  {THEME_PRESET_ORDER.map((presetId) => {
                    const def = THEME_PRESETS[presetId];
                    const selected = activeConfig.preset === presetId;
                    const swatchPalette =
                      effectiveMode === 'dark' ? def.dark : def.light;
                    return (
                      <button
                        key={presetId}
                        type="button"
                        onClick={() => {
                          const nextMode: ThemeMode =
                            activeConfig.mode === 'system'
                              ? 'system'
                              : presetId === 'classic'
                              ? 'light'
                              : def.recommendedMode;
                          applyTheme({
                            ...activeConfig,
                            preset: presetId,
                            mode: nextMode,
                            primaryAccentOverride: undefined,
                            secondaryAccentOverride: undefined,
                            backgroundOverride: undefined,
                            surfaceOverride: undefined,
                            borderOverride: undefined,
                          });
                        }}
                        className={`flex items-center justify-between gap-1.5 px-2.5 py-2 rounded-xl border text-right cursor-pointer transition-colors ${
                          selected
                            ? 'border-[#1E3A5F] bg-[#F8FAFC]'
                            : 'border-slate-200 hover:bg-slate-50'
                        }`}
                      >
                        <span className="flex items-center gap-1.5 min-w-0">
                          <span
                            className="w-4 h-4 rounded-full border shrink-0 flex items-center justify-center"
                            style={{
                              backgroundColor: swatchPalette.bg,
                              borderColor: swatchPalette.primary,
                            }}
                          >
                            <span
                              className="w-2 h-2 rounded-full"
                              style={{ backgroundColor: swatchPalette.primary }}
                            />
                          </span>
                          <span className="text-[11px] font-semibold text-slate-800 truncate">
                            {def.nameAr}
                          </span>
                        </span>
                        {selected && (
                          <Check className="w-3 h-3 text-[#1E3A5F] shrink-0" aria-hidden="true" />
                        )}
                      </button>
                    );
                  })}
                </div>

                {onOpenThemeSettings && isAdmin && (
                  <button
                    type="button"
                    onClick={() => {
                      setThemeMenuOpen(false);
                      onOpenThemeSettings();
                    }}
                    className="w-full py-2 px-3 rounded-xl bg-[#F0F4F9] hover:bg-[#E3ECF6] text-[#1E3A5F] text-xs font-semibold flex items-center justify-center gap-1.5 cursor-pointer transition-colors"
                  >
                    <Palette className="w-3.5 h-3.5" aria-hidden="true" />
                    <span>تخصيص كامل للألوان والتباين</span>
                  </button>
                )}
              </div>
            )}
          </div>
          {isAdmin && onTogglePreviewPublic && (
            <button
              type="button"
              onClick={onTogglePreviewPublic}
              className={`hidden md:inline-flex items-center gap-1.5 px-2.5 py-1.5 min-h-[34px] text-xs font-semibold rounded-lg border cursor-pointer transition-colors whitespace-nowrap shrink-0 ${
                isPreviewingPublic
                  ? 'bg-[#1E3A5F] text-white border-[#1E3A5F]'
                  : 'bg-[#F7F8FA] text-[#1E3A5F] border-slate-200 hover:bg-slate-100'
              }`}
              title={
                isPreviewingPublic ? 'العودة للوحة الإدارة' : 'معاينة الموقع العام'
              }
            >
              <Eye className="w-3.5 h-3.5" aria-hidden="true" />
              <span>{isPreviewingPublic ? 'لوحة الإدارة' : 'الموقع العام'}</span>
            </button>
          )}

          {!authReady ? (
            <span className="text-xs text-slate-400 px-3 py-2">
              جاري التحقق...
            </span>
          ) : user ? (
            <>
              <button
                type="button"
                onClick={() => setMenuOpen((v) => !v)}
                aria-expanded={menuOpen}
                className="inline-flex items-center gap-2 px-2.5 py-1.5 min-h-[36px] rounded-lg border border-slate-200 bg-slate-50 hover:bg-slate-100 transition-colors cursor-pointer whitespace-nowrap shrink-0"
              >
                {user.photoURL ? (
                  <img
                    src={user.photoURL}
                    alt=""
                    referrerPolicy="no-referrer"
                    className="w-6.5 h-6.5 rounded-full object-cover border border-slate-200 shrink-0"
                  />
                ) : (
                  <span className="w-6.5 h-6.5 rounded-full bg-[#1E3A5F] text-white text-xs font-semibold inline-flex items-center justify-center shrink-0">
                    {userInitial}
                  </span>
                )}
                <div className="hidden sm:flex flex-col items-start text-right leading-tight max-w-[110px]">
                  <span className="text-xs font-semibold text-slate-900 truncate w-full">
                    {user.displayName || 'حسابي'}
                  </span>
                  <span className="inline-flex items-center gap-1 text-[10px] text-emerald-700">
                    <Cloud className="w-2.5 h-2.5" aria-hidden="true" />
                    <span>
                      {isAdmin
                        ? syncingCloud
                          ? 'جاري المزامنة...'
                          : 'مسؤول'
                        : 'حساب عام'}
                    </span>
                  </span>
                </div>
                <ChevronDown
                  className="w-3.5 h-3.5 text-slate-500 shrink-0"
                  aria-hidden="true"
                />
              </button>

              {menuOpen && (
                <div className="absolute left-0 top-full mt-2 w-64 bg-white border border-slate-200 rounded-xl shadow-lg py-2 z-50">
                  <div className="px-4 py-2.5 border-b border-slate-100 space-y-0.5">
                    <p className="text-xs font-semibold text-slate-900 truncate">
                      {user.displayName || 'مستخدم ميزان المعرفة'}
                    </p>
                    <p className="text-[11px] text-slate-500 truncate">
                      {user.email}
                    </p>
                  </div>

                  {isAdmin && (
                    <div className="py-1">
                      <button
                        type="button"
                        onClick={() => {
                          onSelectTab('overview');
                          setMenuOpen(false);
                        }}
                        className="w-full px-4 py-2 text-right text-xs font-medium text-slate-700 hover:bg-slate-50 flex items-center gap-2 cursor-pointer"
                      >
                        <LayoutDashboard
                          className="w-3.5 h-3.5 text-[#1E3A5F]"
                          aria-hidden="true"
                        />
                        <span>لوحة المتابعة والمحاور</span>
                      </button>
                      <button
                        type="button"
                        onClick={() => {
                          onSelectTab('daily_journal');
                          setMenuOpen(false);
                        }}
                        className="w-full px-4 py-2 text-right text-xs font-medium text-slate-700 hover:bg-slate-50 flex items-center gap-2 cursor-pointer"
                      >
                        <CalendarHeart
                          className="w-3.5 h-3.5 text-[#1E3A5F]"
                          aria-hidden="true"
                        />
                        <span>اليوميات التلقائية</span>
                      </button>
                      <button
                        type="button"
                        onClick={() => {
                          onSelectTab('weekly_plan');
                          setMenuOpen(false);
                        }}
                        className="w-full px-4 py-2 text-right text-xs font-medium text-slate-700 hover:bg-slate-50 flex items-center gap-2 cursor-pointer"
                      >
                        <CalendarClock
                          className="w-3.5 h-3.5 text-[#1E3A5F]"
                          aria-hidden="true"
                        />
                        <span>تخطيط الأسبوع</span>
                      </button>
                      <button
                        type="button"
                        onClick={() => {
                          onSelectTab('reviews');
                          setMenuOpen(false);
                        }}
                        className="w-full px-4 py-2 text-right text-xs font-medium text-slate-700 hover:bg-slate-50 flex items-center gap-2 cursor-pointer"
                      >
                        <BarChart3
                          className="w-3.5 h-3.5 text-[#1E3A5F]"
                          aria-hidden="true"
                        />
                        <span>المراجعات الدورية</span>
                      </button>
                      <button
                        type="button"
                        onClick={() => {
                          onSelectTab('blogs');
                          setMenuOpen(false);
                        }}
                        className="w-full px-4 py-2 text-right text-xs font-medium text-slate-700 hover:bg-slate-50 flex items-center gap-2 cursor-pointer"
                      >
                        <BookOpenText
                          className="w-3.5 h-3.5 text-[#1E3A5F]"
                          aria-hidden="true"
                        />
                        <span>المدونة والمقالات</span>
                      </button>
                      <button
                        type="button"
                        onClick={() => {
                          onSelectTab('reflections');
                          setMenuOpen(false);
                        }}
                        className="w-full px-4 py-2 text-right text-xs font-medium text-slate-700 hover:bg-slate-50 flex items-center gap-2 cursor-pointer"
                      >
                        <Feather
                          className="w-3.5 h-3.5 text-[#1E3A5F]"
                          aria-hidden="true"
                        />
                        <span>خواطري وتأملاتي</span>
                      </button>
                      <button
                        type="button"
                        onClick={() => {
                          onSelectTab('gallery');
                          setMenuOpen(false);
                        }}
                        className="w-full px-4 py-2 text-right text-xs font-medium text-slate-700 hover:bg-slate-50 flex items-center gap-2 cursor-pointer"
                      >
                        <Images
                          className="w-3.5 h-3.5 text-[#1E3A5F]"
                          aria-hidden="true"
                        />
                        <span>معرض الصور</span>
                      </button>
                      <button
                        type="button"
                        onClick={() => {
                          onSelectTab('journal');
                          setMenuOpen(false);
                        }}
                        className="w-full px-4 py-2 text-right text-xs font-medium text-slate-700 hover:bg-slate-50 flex items-center gap-2 cursor-pointer"
                      >
                        <NotebookPen
                          className="w-3.5 h-3.5 text-[#1E3A5F]"
                          aria-hidden="true"
                        />
                        <span>دفتر التلخيص والنوتس</span>
                      </button>
                      <button
                        type="button"
                        onClick={() => {
                          onSelectTab('account');
                          setMenuOpen(false);
                        }}
                        className="w-full px-4 py-2 text-right text-xs font-medium text-slate-700 hover:bg-slate-50 flex items-center gap-2 cursor-pointer"
                      >
                        <Settings2
                          className="w-3.5 h-3.5 text-[#1E3A5F]"
                          aria-hidden="true"
                        />
                        <span>مركز الحساب والإدارة</span>
                      </button>
                      {onTogglePreviewPublic && (
                        <button
                          type="button"
                          onClick={() => {
                            onTogglePreviewPublic();
                            setMenuOpen(false);
                          }}
                          className="w-full px-4 py-2 text-right text-xs font-medium text-[#1E3A5F] hover:bg-slate-50 flex items-center gap-2 cursor-pointer"
                        >
                          <Eye className="w-3.5 h-3.5" aria-hidden="true" />
                          <span>
                            {isPreviewingPublic
                              ? 'العودة للوحة الإدارة'
                              : 'معاينة الموقع العام للزوار'}
                          </span>
                        </button>
                      )}
                    </div>
                  )}

                  <div className="pt-1 border-t border-slate-100">
                    <button
                      type="button"
                      onClick={() => {
                        setMenuOpen(false);
                        onSignOut();
                      }}
                      className="w-full px-4 py-2 text-right text-xs font-medium text-red-700 hover:bg-red-50 flex items-center gap-2 cursor-pointer"
                    >
                      <LogOut className="w-3.5 h-3.5" aria-hidden="true" />
                      <span>تسجيل الخروج</span>
                    </button>
                  </div>
                </div>
              )}
            </>
          ) : (
            <button
              type="button"
              onClick={onGoogleSignIn}
              className="inline-flex items-center gap-1.5 sm:gap-2 px-3 sm:px-4 py-2 min-h-[36px] text-xs sm:text-sm font-medium text-white bg-[#1E3A5F] rounded-lg hover:bg-[#162C49] transition-colors duration-150 whitespace-nowrap shrink-0 cursor-pointer focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-[#1E3A5F]"
            >
              <LogIn className="w-4 h-4 shrink-0" aria-hidden="true" />
              <span className="sm:hidden">دخول Google</span>
              <span className="hidden sm:inline">دخول بحساب Google</span>
            </button>
          )}
        </div>
      </div>

      {/* Tablet / Mobile Scrollable Secondary Nav */}
      {showAdminNav ? (
        <nav
          aria-label="تنقل الجوال والتابلت"
          className="lg:hidden border-t border-slate-100 px-3 py-1 flex items-center gap-3 overflow-x-auto no-scrollbar snap-x"
        >
          {navItems.map((item) => {
            const isActive = activeTab === item.id;
            return (
              <button
                key={item.id}
                type="button"
                onClick={() => onSelectTab(item.id)}
                className={`snap-start px-2 py-2 min-h-[38px] text-xs font-medium whitespace-nowrap shrink-0 border-b-2 transition-colors cursor-pointer ${
                  isActive
                    ? 'border-[#1E3A5F] text-[#1E3A5F] font-semibold'
                    : 'border-transparent text-slate-600'
                }`}
              >
                {item.label}
              </button>
            );
          })}
        </nav>
      ) : (
        <nav
          aria-label="تنقل الموقع العام على الجوال"
          className="md:hidden border-t border-slate-100 px-3 py-1 flex items-center gap-4 overflow-x-auto no-scrollbar"
        >
          {publicNavItems.map((pItem) => {
            const isActive = publicPage === pItem.id;
            return (
              <button
                key={pItem.id}
                type="button"
                onClick={() => {
                  onSelectPublicPage?.(pItem.id);
                  onSelectTab('public');
                }}
                className={`px-2 py-1.5 min-h-[36px] text-xs font-medium whitespace-nowrap shrink-0 border-b-2 transition-colors cursor-pointer ${
                  isActive
                    ? 'border-[#1E3A5F] text-[#1E3A5F] font-semibold'
                    : 'border-transparent text-slate-600'
                }`}
              >
                {pItem.label}
              </button>
            );
          })}
        </nav>
      )}
    </header>
  );
}
