import { useEffect, useRef, useState } from 'react';
import { User } from 'firebase/auth';
import {
  ChevronDown,
  Cloud,
  Eye,
  Feather,
  LayoutDashboard,
  LogIn,
  LogOut,
  NotebookPen,
  Settings2,
} from 'lucide-react';
import BrandMark from './BrandMark';

export type ActiveTab =
  | 'overview'
  | 'focus'
  | 'plan'
  | 'domains'
  | 'courses'
  | 'paths'
  | 'library'
  | 'tasks'
  | 'journal'
  | 'reflections'
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
  coursesCount,
  pathsCount = 0,
  libraryCount = 0,
  tasksCount = 0,
  notesCount,
  reflectionsCount = 0,
}: HeaderProps) {
  const showAdminNav = isAdmin && !isPreviewingPublic;

  const navItems: Array<{ id: ActiveTab; label: string }> = showAdminNav
    ? [
        { id: 'overview', label: 'لوحة المتابعة' },
        { id: 'focus', label: `التركيز (${focusCoursesCount})` },
        { id: 'courses', label: `الكورسات (${coursesCount})` },
        { id: 'paths', label: `المسارات (${pathsCount})` },
        { id: 'library', label: `المكتبة (${libraryCount})` },
        { id: 'journal', label: `التلخيص (${notesCount})` },
        { id: 'reflections', label: `خواطري (${reflectionsCount})` },
        { id: 'tasks', label: `المهام (${tasksCount})` },
        { id: 'calendar', label: 'التقويم' },
        { id: 'account', label: 'الإدارة والحساب' },
      ]
    : [{ id: 'public', label: 'الواجهة العامة' }];

  const [menuOpen, setMenuOpen] = useState(false);
  const menuRef = useRef<HTMLDivElement | null>(null);

  useEffect(() => {
    const handleClickOutside = (e: MouseEvent) => {
      if (menuRef.current && !menuRef.current.contains(e.target as Node)) {
        setMenuOpen(false);
      }
    };
    document.addEventListener('mousedown', handleClickOutside);
    return () => document.removeEventListener('mousedown', handleClickOutside);
  }, []);

  const userInitial =
    (user?.displayName || user?.email || 'م').trim().charAt(0).toUpperCase();

  return (
    <header className="sticky top-0 z-30 bg-white/95 backdrop-blur-sm border-b border-slate-200">
      <div className="max-w-[1280px] mx-auto px-3 sm:px-6 h-14 sm:h-16 flex items-center justify-between gap-2 sm:gap-3">
        {/* Zone 1: Brand Wordmark + Custom Emblem */}
        <button
          type="button"
          onClick={() => onSelectTab(showAdminNav ? 'overview' : 'public')}
          className="inline-flex items-center gap-2 whitespace-nowrap shrink-0 cursor-pointer focus-visible:outline-2 focus-visible:outline-offset-4 focus-visible:outline-[#1E3A5F]"
        >
          <BrandMark className="w-7 h-7 sm:w-8 sm:h-8 shrink-0" />
          <span className="font-editorial text-lg sm:text-2xl font-bold text-slate-900 tracking-tight">
            ميزان المعرفة
          </span>
        </button>

        {/* Zone 2: Horizontal Scroll-Safe Desktop Navigation */}
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

        {/* Zone 3: User Account / Google Auth Control */}
        <div className="flex items-center gap-2 shrink-0 relative" ref={menuRef}>
          {isAdmin && onTogglePreviewPublic && (
            <button
              type="button"
              onClick={onTogglePreviewPublic}
              className={`hidden md:inline-flex items-center gap-1.5 px-2.5 py-1.5 min-h-[36px] text-xs font-semibold rounded-lg border cursor-pointer transition-colors ${
                isPreviewingPublic
                  ? 'bg-[#1E3A5F] text-white border-[#1E3A5F]'
                  : 'bg-[#F7F8FA] text-[#1E3A5F] border-slate-200 hover:bg-slate-100'
              }`}
              title={isPreviewingPublic ? 'العودة للوحة الإدارة' : 'معاينة الموقع العام'}
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
                className="inline-flex items-center gap-2 px-2.5 py-1.5 min-h-[38px] rounded-lg border border-slate-200 bg-slate-50 hover:bg-slate-100 transition-colors cursor-pointer whitespace-nowrap shrink-0"
              >
                {user.photoURL ? (
                  <img
                    src={user.photoURL}
                    alt=""
                    referrerPolicy="no-referrer"
                    className="w-7 h-7 rounded-full object-cover border border-slate-200 shrink-0"
                  />
                ) : (
                  <span className="w-7 h-7 rounded-full bg-[#1E3A5F] text-white text-xs font-semibold inline-flex items-center justify-center shrink-0">
                    {userInitial}
                  </span>
                )}
                <div className="hidden sm:flex flex-col items-start text-right leading-tight max-w-[115px]">
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
                        className="w-full px-4 py-2.5 text-right text-xs font-medium text-slate-700 hover:bg-slate-50 flex items-center gap-2 cursor-pointer"
                      >
                        <LayoutDashboard className="w-3.5 h-3.5 text-[#1E3A5F]" aria-hidden="true" />
                        <span>لوحة المتابعة والمحاور</span>
                      </button>
                      <button
                        type="button"
                        onClick={() => {
                          onSelectTab('reflections');
                          setMenuOpen(false);
                        }}
                        className="w-full px-4 py-2.5 text-right text-xs font-medium text-slate-700 hover:bg-slate-50 flex items-center gap-2 cursor-pointer"
                      >
                        <Feather className="w-3.5 h-3.5 text-[#1E3A5F]" aria-hidden="true" />
                        <span>خواطري وتأملاتي ({reflectionsCount})</span>
                      </button>
                      <button
                        type="button"
                        onClick={() => {
                          onSelectTab('journal');
                          setMenuOpen(false);
                        }}
                        className="w-full px-4 py-2.5 text-right text-xs font-medium text-slate-700 hover:bg-slate-50 flex items-center gap-2 cursor-pointer"
                      >
                        <NotebookPen className="w-3.5 h-3.5 text-[#1E3A5F]" aria-hidden="true" />
                        <span>دفتر التلخيص والنوتس</span>
                      </button>
                      <button
                        type="button"
                        onClick={() => {
                          onSelectTab('account');
                          setMenuOpen(false);
                        }}
                        className="w-full px-4 py-2.5 text-right text-xs font-medium text-slate-700 hover:bg-slate-50 flex items-center gap-2 cursor-pointer"
                      >
                        <Settings2 className="w-3.5 h-3.5 text-[#1E3A5F]" aria-hidden="true" />
                        <span>مركز الحساب والإدارة</span>
                      </button>
                      {onTogglePreviewPublic && (
                        <button
                          type="button"
                          onClick={() => {
                            onTogglePreviewPublic();
                            setMenuOpen(false);
                          }}
                          className="w-full px-4 py-2.5 text-right text-xs font-medium text-[#1E3A5F] hover:bg-slate-50 flex items-center gap-2 cursor-pointer"
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
                      className="w-full px-4 py-2.5 text-right text-xs font-medium text-red-700 hover:bg-red-50 flex items-center gap-2 cursor-pointer"
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
              className="inline-flex items-center gap-1.5 sm:gap-2 px-3 sm:px-4 py-2 min-h-[38px] text-xs sm:text-sm font-medium text-white bg-[#1E3A5F] rounded-lg hover:bg-[#162C49] transition-colors duration-150 whitespace-nowrap shrink-0 cursor-pointer focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-[#1E3A5F]"
            >
              <LogIn className="w-4 h-4 shrink-0" aria-hidden="true" />
              <span className="sm:hidden">دخول Google</span>
              <span className="hidden sm:inline">دخول بحساب Google</span>
            </button>
          )}
        </div>
      </div>

      {/* Tablet / Mobile Scrollable Secondary Nav */}
      {showAdminNav && (
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
                className={`snap-start px-2 py-2 min-h-[40px] text-xs font-medium whitespace-nowrap shrink-0 border-b-2 transition-colors ${
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
      )}
    </header>
  );
}
