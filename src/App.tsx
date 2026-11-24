/**
 * @license
 * SPDX-License-Identifier: Apache-2.0
 */

import { User, onAuthStateChanged } from 'firebase/auth';
import { Suspense, lazy, useEffect, useRef, useState } from 'react';
import {
  CalendarDays,
  CheckCircle2,
  GraduationCap,
  LayoutDashboard,
  Lock,
  LogIn,
  NotebookPen,
  Target,
} from 'lucide-react';
import AccountCenterView from './components/AccountCenterView';
import BlogsView from './components/BlogsView';
import CalendarView from './components/CalendarView';
import ConfirmDialog from './components/ConfirmDialog';
import CourseDetailPage from './components/CourseDetailPage';
import CoursesView from './components/CoursesView';
import DailyJournalView from './components/DailyJournalView';
import DomainsView from './components/DomainsView';
import ErrorBoundary from './components/ErrorBoundary';
import FocusNoteStudyModal from './components/FocusNoteStudyModal';
import FocusView from './components/FocusView';
import Header, { ActiveTab } from './components/Header';
import LibraryView from './components/LibraryView';
import NotesJournalView from './components/NotesJournalView';
import OfflineIndicator from './components/OfflineIndicator';
import OverviewView from './components/OverviewView';
import PathsView from './components/PathsView';
import type { ActivePdfTarget } from './components/PDFViewerModal';
import PhotoGalleryView from './components/PhotoGalleryView';
import PublicHomeView from './components/PublicHomeView';
import ReflectionsView from './components/ReflectionsView';
import ReviewsView from './components/ReviewsView';
import SiteFooter from './components/SiteFooter';
import TaskFormModal from './components/TaskFormModal';
import TasksProjectsView from './components/TasksProjectsView';
import TwelveMonthPlanView from './components/TwelveMonthPlanView';
import WeeklyPlannerView from './components/WeeklyPlannerView';

const PDFViewerModal = lazy(() => import('./components/PDFViewerModal'));
import {
  ActivityLogEntry,
  BlogPost,
  BookNote,
  CalendarEvent,
  CourseStudyStage,
  CustomCategory,
  DEFAULT_HUB_CATEGORIES,
  DEFAULT_PUBLIC_SITE_CONFIG,
  DEFAULT_USER_PREFERENCES,
  DOMAINS,
  DailyJournalRecord,
  DentalCase,
  DomainId,
  DomainInfo,
  GrantedItemNote,
  GrantedWorkspaceData,
  INITIAL_BOOK_NOTES,
  INITIAL_COURSES,
  INITIAL_CUSTOM_CATEGORIES,
  INITIAL_MONTHS,
  INITIAL_QUARTERS,
  ImageFrameSpec,
  LearningHubId,
  LearningPath,
  MonthActivities,
  MonthPlan,
  MonthStatus,
  NoteCategoryType,
  PeriodReviewRecord,
  PersonalCourse,
  PersonalReflection,
  PinCollection,
  PinEntityType,
  PracticalProject,
  PublicPageId,
  PublicSiteConfig,
  QuarterInfo,
  ReadingLibraryItem,
  ReflectionColorKey,
  ReflectionMood,
  SmallTask,
  StudyHistoryEntry,
  StudyResource,
  UnifiedTask,
  UserPreferences,
  WeeklyMeeting,
  WeeklyPlanRecord,
  estimateReadingTimeMinutes,
  resolveCourseStudyStage,
  resolveLearningHubs,
  setActiveLearningHubs,
  toLocalDateKey,
} from './data/curriculumData';
import {
  OWNER_ADMIN_EMAIL,
  auth,
  completeGoogleRedirectIfAny,
  firebaseInitError,
  signInWithGoogle,
  signOutUser,
} from './firebase';
import { formatSupabaseErrorMessage } from './services/supabaseClient';
import {
  deleteCloudAttachment,
  rescueLocalAttachmentToCloud,
} from './utils/documentImportExport';
import {
  deleteBlogCoverStorage,
  deleteDentalCaseCoverStorage,
} from './utils/imageStorage';
import type {
  JournalNavAction,
  WorkspaceAnalyticsInput,
} from './utils/journalAnalytics';
import {
  CloudAttachmentItem,
  PublicCatalogData,
  UserProfileRecord,
  addGrantedItemNote,
  deleteBlogPostDoc,
  deleteBookNoteDoc,
  deleteCalendarEventDoc,
  deleteCourseDoc,
  deleteCustomCategoryDoc,
  deleteDentalCaseDoc,
  deleteDomainDoc,
  deleteGrantedItemNote,
  deleteHistoryEntryDoc,
  deleteLearningPathDoc,
  deleteMonthDoc,
  deletePinCollectionDoc,
  deletePracticalProjectDoc,
  deleteQuarterDoc,
  deleteReadingItemDoc,
  deleteReflectionDoc,
  deleteUnifiedTaskDoc,
  deleteWeeklyMeetingDoc,
  ensureUserDocumentAndSeed,
  ensureUserProfileExists,
  fetchGrantedWorkspaceForUser,
  fetchPublicCatalog,
  sanitizeId,
  saveActivityLogDoc,
  saveBlogPostDoc,
  saveBookNoteDoc,
  saveCalendarEventDoc,
  saveCourseDoc,
  saveCustomCategoryDoc,
  saveDailyJournalDoc,
  saveDentalCaseDoc,
  saveDomainDoc,
  saveHistoryEntryDoc,
  saveLearningPathDoc,
  saveMonthDoc,
  savePeriodReviewDoc,
  savePinCollectionDoc,
  savePracticalProjectDoc,
  savePublicSiteConfig,
  saveQuarterDoc,
  saveReadingItemDoc,
  saveReflectionDoc,
  saveUnifiedTaskDoc,
  saveUserPreferencesDoc,
  saveWeeklyMeetingDoc,
  saveWeeklyPlanDoc,
  subscribeCloudAttachments,
  subscribePublicSiteConfig,
  subscribeUserWorkspace,
} from './services/supabaseSync';
import { exportPlanToExcel } from './utils/excelExport';

function formatArabicDate(): string {
  try {
    return new Date().toLocaleDateString('ar-EG', {
      year: 'numeric',
      month: 'short',
      day: 'numeric',
    });
  } catch {
    return new Date().toISOString().slice(0, 10);
  }
}

function formatArabicDateTime(): string {
  try {
    return new Date().toLocaleString('ar-EG', {
      month: 'short',
      day: 'numeric',
      hour: '2-digit',
      minute: '2-digit',
    });
  } catch {
    return new Date().toISOString().slice(0, 16);
  }
}

const VALID_TABS: ActiveTab[] = [
  'overview',
  'focus',
  'plan',
  'domains',
  'courses',
  'paths',
  'library',
  'tasks',
  'journal',
  'daily_journal',
  'weekly_plan',
  'reviews',
  'reflections',
  'blogs',
  'gallery',
  'calendar',
  'account',
  'public',
];

const TAB_DISPLAY_LABELS: Record<ActiveTab, string> = {
  overview: 'لوحة المتابعة',
  focus: 'التركيز الحالي',
  plan: 'خطة الـ 12 شهرًا',
  domains: 'المحاور المعرفية',
  courses: 'الكورسات',
  paths: 'المسارات',
  library: 'المكتبة',
  tasks: 'المهام والمشاريع',
  journal: 'دفتر التلخيص',
  daily_journal: 'اليوميات التلقائية',
  weekly_plan: 'تخطيط الأسبوع',
  reviews: 'المراجعات الدورية',
  reflections: 'خواطري وتأملاتي',
  blogs: 'المدونة والمقالات',
  gallery: 'معرض الصور',
  calendar: 'التقويم',
  account: 'الإدارة والحساب',
  public: 'الواجهة العامة',
};

function checkIsAdminAccess(
  u: User | null,
  prof: UserProfileRecord | null
): boolean {
  if (!u) return false;
  if (prof?.role === 'admin' && prof?.approval_status === 'approved') {
    return true;
  }
  return Boolean(
    u.email &&
      u.emailVerified &&
      u.email.toLowerCase() === OWNER_ADMIN_EMAIL.toLowerCase()
  );
}

interface NavStepSnapshot {
  tab: ActiveTab;
  courseId: number | null;
  noteId: string | null;
  hubFilter: LearningHubId | 'all';
  coursesSection: 'courses' | 'dental_cases';
  label: string;
}

function parseAppRouteFromLocation(): {
  tab: ActiveTab;
  courseId: number | null;
  noteId: string | null;
  publicPage: PublicPageId;
} {
  if (typeof window === 'undefined') {
    return { tab: 'public', courseId: null, noteId: null, publicPage: 'home' };
  }
  const rawHash = window.location.hash.replace(/^#\/?/, '').trim();
  const rawPath = window.location.pathname.replace(/^\/+/, '').trim();
  const source = rawHash || rawPath;

  const publicSubMatch = source.match(/^public\/(reflections|blogs)\/?$/i);
  if (publicSubMatch) {
    return {
      tab: 'public',
      courseId: null,
      noteId: null,
      publicPage: publicSubMatch[1].toLowerCase() as PublicPageId,
    };
  }

  const courseMatch = source.match(/^courses\/(\d+)\/?$/i);
  if (courseMatch) {
    const id = parseInt(courseMatch[1], 10);
    if (!Number.isNaN(id) && id > 0) {
      return { tab: 'courses', courseId: id, noteId: null, publicPage: 'home' };
    }
  }

  const journalMatch = source.match(/^journal\/([^/]+)\/?$/i);
  if (journalMatch) {
    let decodedNoteId = journalMatch[1];
    try {
      decodedNoteId = decodeURIComponent(journalMatch[1]);
    } catch {
      decodedNoteId = journalMatch[1];
    }
    return {
      tab: 'journal',
      courseId: null,
      noteId: decodedNoteId,
      publicPage: 'home',
    };
  }

  const tabSegment = source.split('/')[0] as ActiveTab;
  if (VALID_TABS.includes(tabSegment)) {
    return { tab: tabSegment, courseId: null, noteId: null, publicPage: 'home' };
  }

  return { tab: 'public', courseId: null, noteId: null, publicPage: 'home' };
}

function safeScrollToTop() {
  if (typeof window === 'undefined') return;
  try {
    window.scrollTo({ top: 0, behavior: 'smooth' });
  } catch {
    try {
      window.scrollTo(0, 0);
    } catch {
      // Ignore in restricted mobile webviews
    }
  }
}

export default function App() {
  const initialRoute = parseAppRouteFromLocation();
  const [activeTab, setActiveTab] = useState<ActiveTab>(initialRoute.tab);
  const [quarters, setQuarters] = useState<QuarterInfo[]>(INITIAL_QUARTERS);
  const [months, setMonths] = useState<MonthPlan[]>(INITIAL_MONTHS);
  const [domains, setDomains] = useState<DomainInfo[]>(DOMAINS);
  const [courses, setCourses] = useState<PersonalCourse[]>(INITIAL_COURSES);
  const [bookNotes, setBookNotes] = useState<BookNote[]>(INITIAL_BOOK_NOTES);
  const [customCategories, setCustomCategories] = useState<CustomCategory[]>(
    INITIAL_CUSTOM_CATEGORIES
  );
  const [history, setHistory] = useState<StudyHistoryEntry[]>([]);
  const [reflections, setReflections] = useState<PersonalReflection[]>([]);
  const [blogPosts, setBlogPosts] = useState<BlogPost[]>([]);
  const [calendarEvents, setCalendarEvents] = useState<CalendarEvent[]>([]);
  const [learningPaths, setLearningPaths] = useState<LearningPath[]>([]);
  const [readingItems, setReadingItems] = useState<ReadingLibraryItem[]>([]);
  const [projects, setProjects] = useState<PracticalProject[]>([]);
  const [unifiedTasks, setUnifiedTasks] = useState<UnifiedTask[]>([]);
  const [dentalCases, setDentalCases] = useState<DentalCase[]>([]);
  const [weeklyMeetings, setWeeklyMeetings] = useState<WeeklyMeeting[]>([]);
  const [activityLogs, setActivityLogs] = useState<ActivityLogEntry[]>([]);
  const [dailyJournals, setDailyJournals] = useState<DailyJournalRecord[]>([]);
  const [periodReviews, setPeriodReviews] = useState<PeriodReviewRecord[]>([]);
  const [weeklyPlans, setWeeklyPlans] = useState<WeeklyPlanRecord[]>([]);
  const [pinCollections, setPinCollections] = useState<PinCollection[]>([]);
  const [quickTaskModal, setQuickTaskModal] = useState<{
    open: boolean;
    task: UnifiedTask | null;
  }>({ open: false, task: null });
  const [cloudAttachments, setCloudAttachments] = useState<CloudAttachmentItem[]>([]);
  const [preferences, setPreferences] = useState<UserPreferences>(
    DEFAULT_USER_PREFERENCES
  );
  const [activeBookNoteId, setActiveBookNoteId] = useState<string | null>(
    initialRoute.noteId
  );
  const [studyModalState, setStudyModalState] = useState<{
    noteId: string;
    startInEdit?: boolean;
  } | null>(() =>
    initialRoute.noteId ? { noteId: initialRoute.noteId, startInEdit: false } : null
  );
  const [selectedCourseId, setSelectedCourseId] = useState<number | null>(
    initialRoute.courseId
  );
  const [publicPage, setPublicPage] = useState<PublicPageId>(
    initialRoute.publicPage
  );
  const [activeHubFilter, setActiveHubFilter] = useState<
    LearningHubId | 'all'
  >('all');
  const [coursesSection, setCoursesSection] = useState<
    'courses' | 'dental_cases'
  >('courses');
  const [backStack, setBackStack] = useState<NavStepSnapshot[]>([]);
  const [forwardStack, setForwardStack] = useState<NavStepSnapshot[]>([]);
  const [accountInitialSubTab, setAccountInitialSubTab] = useState<
    'workspace' | 'users' | undefined
  >(undefined);
  const [activePdfTarget, setActivePdfTarget] =
    useState<ActivePdfTarget | null>(null);
  const [confirmResetOpen, setConfirmResetOpen] = useState(false);
  const [selectedMonthId, setSelectedMonthId] = useState<number>(1);
  const [domainFilter, setDomainFilter] = useState<DomainId | 'all'>('all');
  const [exportNotice, setExportNotice] = useState<string | null>(null);
  const [authPromptNotice, setAuthPromptNotice] = useState<string | null>(null);

  // Firebase Auth, RBAC & Public Catalog state
  const [user, setUser] = useState<User | null>(null);
  const [userProfile, setUserProfile] = useState<UserProfileRecord | null>(null);
  const [authReady, setAuthReady] = useState(false);
  const [syncingCloud, setSyncingCloud] = useState(false);
  const [authError, setAuthError] = useState<string | null>(null);
  const [isPreviewingPublic, setIsPreviewingPublic] = useState(false);
  const [syncRefreshTick, setSyncRefreshTick] = useState(0);
  const [publicSiteConfig, setPublicSiteConfig] = useState<PublicSiteConfig>(
    DEFAULT_PUBLIC_SITE_CONFIG
  );
  const [publicCatalog, setPublicCatalog] = useState<PublicCatalogData>({
    courses: [],
    learningPaths: [],
    readingItems: [],
    reflections: [],
    blogPosts: [],
  });
  const [loadingPublicCatalog, setLoadingPublicCatalog] = useState(false);
  const [grantedWorkspace, setGrantedWorkspace] =
    useState<GrantedWorkspaceData | null>(null);
  const [loadingGranted, setLoadingGranted] = useState(false);

  const isAdmin = checkIsAdminAccess(user, userProfile);
  const canEdit = isAdmin && !isPreviewingPublic;

  const buildCurrentSnapshot = (): NavStepSnapshot => {
    let label = TAB_DISPLAY_LABELS[activeTab] || 'لوحة المتابعة';
    if (activeTab === 'courses' && selectedCourseId !== null) {
      const targetCourse = courses.find((c) => c.id === selectedCourseId);
      label = targetCourse ? `كورس: ${targetCourse.title}` : `كورس #${selectedCourseId}`;
    } else if (activeTab === 'courses' && coursesSection === 'dental_cases') {
      label = 'حالات طب الأسنان';
    } else if (activeTab === 'journal' && activeBookNoteId) {
      const targetNote = bookNotes.find((bn) => bn.id === activeBookNoteId);
      label = targetNote ? `تلخيص: ${targetNote.bookTitle}` : 'صفحة التلخيص';
    }
    return {
      tab: activeTab,
      courseId: selectedCourseId,
      noteId: activeBookNoteId,
      hubFilter: activeHubFilter,
      coursesSection,
      label,
    };
  };

  const pushBackStep = () => {
    const snap = buildCurrentSnapshot();
    setForwardStack([]);
    setBackStack((prev) => {
      const last = prev[prev.length - 1];
      if (
        last &&
        last.tab === snap.tab &&
        last.courseId === snap.courseId &&
        last.noteId === snap.noteId &&
        last.coursesSection === snap.coursesSection
      ) {
        return prev;
      }
      return [...prev, snap].slice(-15);
    });
  };

  const syncLocationHash = (
    tab: ActiveTab,
    courseId: number | null,
    noteId: string | null,
    nextPublicPage?: PublicPageId
  ) => {
    if (typeof window === 'undefined') return;
    let targetHash = tab === 'overview' ? '#/' : `#/${tab}`;
    if (tab === 'public') {
      targetHash =
        nextPublicPage && nextPublicPage !== 'home'
          ? `#/public/${nextPublicPage}`
          : '#/public';
    } else if (tab === 'courses' && courseId !== null) {
      targetHash = `#/courses/${courseId}`;
    } else if (tab === 'journal' && noteId) {
      targetHash = `#/journal/${encodeURIComponent(noteId)}`;
    }
    if (window.location.hash !== targetHash) {
      try {
        window.history.pushState(null, '', targetHash);
      } catch {
        try {
          window.location.hash = targetHash;
        } catch {
          // Ignore in restricted history contexts
        }
      }
    }
  };

  const applyNavSnapshot = (snap: NavStepSnapshot) => {
    setActiveTab(snap.tab);
    setSelectedCourseId(snap.courseId);
    setActiveBookNoteId(snap.noteId);
    setStudyModalState(
      snap.noteId ? { noteId: snap.noteId, startInEdit: false } : null
    );
    setActiveHubFilter(snap.hubFilter);
    setCoursesSection(snap.coursesSection);
    syncLocationHash(snap.tab, snap.courseId, snap.noteId);
    safeScrollToTop();
  };

  const handleGoBack = () => {
    const currStep = buildCurrentSnapshot();
    if (backStack.length === 0) {
      if (selectedCourseId !== null) {
        setForwardStack((prev) => [...prev, currStep].slice(-15));
        setSelectedCourseId(null);
        syncLocationHash('courses', null, null);
      } else {
        setActiveTab('overview');
        syncLocationHash('overview', null, null);
      }
      safeScrollToTop();
      return;
    }
    const prevStep = backStack[backStack.length - 1];
    setBackStack((prev) => prev.slice(0, -1));
    setForwardStack((prev) => [...prev, currStep].slice(-15));
    applyNavSnapshot(prevStep);
  };

  const handleGoForward = () => {
    if (forwardStack.length === 0) return;
    const nextStep = forwardStack[forwardStack.length - 1];
    const currStep = buildCurrentSnapshot();
    setForwardStack((prev) => prev.slice(0, -1));
    setBackStack((prev) => [...prev, currStep].slice(-15));
    applyNavSnapshot(nextStep);
  };

  const navigateToTab = (tab: ActiveTab, recordStep = true) => {
    if (
      recordStep &&
      (activeTab !== tab ||
        selectedCourseId !== null ||
        (tab !== 'journal' && activeBookNoteId !== null))
    ) {
      pushBackStep();
    }
    setActiveTab(tab);
    setSelectedCourseId(null);
    setStudyModalState(null);
    if (tab !== 'journal') {
      setActiveBookNoteId(null);
    } else {
      // Clicking Journal in main nav opens the notebooks overview unless preserved
      setActiveBookNoteId(null);
    }
    if (tab !== 'courses') {
      setCoursesSection('courses');
    }
    syncLocationHash(
      tab,
      null,
      null,
      tab === 'public' ? publicPage : undefined
    );
  };

  const navigateToCourseRoute = (courseId: number) => {
    if (!(activeTab === 'courses' && selectedCourseId === courseId)) {
      pushBackStep();
    }
    setActiveTab('courses');
    setCoursesSection('courses');
    setSelectedCourseId(courseId);
    syncLocationHash('courses', courseId, null);
    safeScrollToTop();
  };

  const handleOpenDentalCases = () => {
    pushBackStep();
    setActiveHubFilter('dental_career');
    setCoursesSection('dental_cases');
    setSelectedCourseId(null);
    setActiveTab('courses');
    syncLocationHash('courses', null, null);
    safeScrollToTop();
  };

  useEffect(() => {
    const handleRouteSync = () => {
      const parsed = parseAppRouteFromLocation();
      if (window.location.hash || parsed.courseId !== null || parsed.noteId !== null) {
        setActiveTab(parsed.tab);
        setSelectedCourseId(parsed.courseId);
        if (parsed.tab === 'public') {
          setPublicPage(parsed.publicPage);
        }
        if (parsed.noteId !== null) {
          setActiveBookNoteId(parsed.noteId);
          setStudyModalState({ noteId: parsed.noteId, startInEdit: false });
        } else {
          setStudyModalState(null);
          if (parsed.tab !== 'journal') {
            setActiveBookNoteId(null);
          }
        }
      }
    };
    window.addEventListener('hashchange', handleRouteSync);
    window.addEventListener('popstate', handleRouteSync);
    return () => {
      window.removeEventListener('hashchange', handleRouteSync);
      window.removeEventListener('popstate', handleRouteSync);
    };
  }, []);

  const resetToDefaultView = (preserveRoute = false) => {
    setQuarters(INITIAL_QUARTERS);
    setMonths(INITIAL_MONTHS);
    setDomains(DOMAINS);
    setCourses(INITIAL_COURSES);
    setBookNotes(INITIAL_BOOK_NOTES);
    setCustomCategories(INITIAL_CUSTOM_CATEGORIES);
    setHistory([]);
    setReflections([]);
    setBlogPosts([]);
    setCalendarEvents([]);
    setLearningPaths([]);
    setReadingItems([]);
    setProjects([]);
    setUnifiedTasks([]);
    setDentalCases([]);
    setWeeklyMeetings([]);
    setActivityLogs([]);
    setDailyJournals([]);
    setPeriodReviews([]);
    setWeeklyPlans([]);
    setPinCollections([]);
    setQuickTaskModal({ open: false, task: null });
    setCloudAttachments([]);
    setPreferences(DEFAULT_USER_PREFERENCES);
    setActiveLearningHubs(DEFAULT_USER_PREFERENCES.customHubs);
    if (!preserveRoute) {
      setActiveBookNoteId(null);
      setSelectedCourseId(null);
      setBackStack([]);
      setForwardStack([]);
      setCoursesSection('courses');
    }
    setActiveHubFilter('all');
    setActivePdfTarget(null);
    setDomainFilter('all');
    setSelectedMonthId(1);
  };

  // Complete mobile Google redirect sign-in if returning from OAuth redirect
  useEffect(() => {
    void completeGoogleRedirectIfAny();
  }, []);

  // Subscribe to public homepage config and load public catalog
  const refreshPublicCatalog = async (catsOverride?: string[]) => {
    setLoadingPublicCatalog(true);
    try {
      const cats =
        catsOverride ?? publicSiteConfig.publicReflectionCategories ?? [];
      const cat = await fetchPublicCatalog(cats);
      setPublicCatalog(cat);
    } finally {
      setLoadingPublicCatalog(false);
    }
  };

  useEffect(() => {
    const unsubConfig = subscribePublicSiteConfig((cfg) => {
      setPublicSiteConfig(cfg);
      void fetchPublicCatalog(cfg.publicReflectionCategories ?? []).then(
        setPublicCatalog
      );
    });
    void refreshPublicCatalog();
    return () => {
      unsubConfig();
    };
  }, []);

  // Listen to Firebase Auth state & enforce strict RBAC before seeding or subscribing to private workspace
  useEffect(() => {
    if (!auth) {
      setAuthReady(true);
      setActiveTab('public');
      if (firebaseInitError) {
        setAuthError(firebaseInitError);
      }
      return;
    }

    let unsubWorkspace: (() => void) | null = null;
    let unsubAttachments: (() => void) | null = null;
    let isMounted = true;

    const unsubAuth = onAuthStateChanged(auth, async (nextUser) => {
      if (unsubWorkspace) {
        unsubWorkspace();
        unsubWorkspace = null;
      }
      if (unsubAttachments) {
        unsubAttachments();
        unsubAttachments = null;
      }

      // Always reset in-memory state first so switching accounts or signing out never bleeds prior account data
      resetToDefaultView(true);
      setUserProfile(null);
      setGrantedWorkspace(null);
      setLoadingGranted(false);
      setIsPreviewingPublic(false);
      setUser(nextUser);

      if (!nextUser) {
        setAuthReady(true);
        setActiveTab('public');
        setSelectedCourseId(null);
        setStudyModalState(null);
        void refreshPublicCatalog();
        return;
      }

      setSyncingCloud(true);
      setAuthError(null);
      setAuthPromptNotice(null);
      try {
        const profile = await ensureUserProfileExists(nextUser);
        if (!isMounted) return;
        setUserProfile(profile);

        const adminAllowed = checkIsAdminAccess(nextUser, profile);
        setAuthReady(true);

        if (!adminAllowed) {
          // Strict RBAC: Non-admin users never seed or access admin workspace data directly,
          // only public items plus explicitly granted read-only content for their account.
          setActiveTab('public');
          setSelectedCourseId(null);
          setStudyModalState(null);
          syncLocationHash('public', null, null);
          void refreshPublicCatalog();
          setLoadingGranted(true);
          fetchGrantedWorkspaceForUser(nextUser)
            .then((gw) => {
              if (isMounted) setGrantedWorkspace(gw);
            })
            .finally(() => {
              if (isMounted) setLoadingGranted(false);
            });
          return;
        }

        await ensureUserDocumentAndSeed(nextUser, {
          quarters: INITIAL_QUARTERS,
          months: INITIAL_MONTHS,
          domains: DOMAINS,
          courses: INITIAL_COURSES,
          bookNotes: INITIAL_BOOK_NOTES,
          customCategories: INITIAL_CUSTOM_CATEGORIES,
          history: [],
          preferences: DEFAULT_USER_PREFERENCES,
        });
        if (!isMounted) return;

        unsubAttachments = subscribeCloudAttachments(nextUser.uid, (items) => {
          setCloudAttachments(items);
        });
        unsubWorkspace = subscribeUserWorkspace(nextUser.uid, {
          onQuarters: (items) => {
            if (items.length > 0) setQuarters(items);
          },
          onMonths: (items) => {
            if (items.length > 0) setMonths(items);
          },
          onDomains: (items) => {
            if (items.length > 0) setDomains(items);
          },
          onCourses: (items) => {
            if (items.length > 0) setCourses(items);
          },
          onBookNotes: (items) => {
            setBookNotes(items);
          },
          onCustomCategories: (items) => {
            if (items.length > 0) setCustomCategories(items);
          },
          onHistory: (items) => {
            setHistory(items);
          },
          onPreferences: (prefs) => {
            setPreferences(prefs);
            setActiveLearningHubs(prefs.customHubs);
          },
          onReflections: (items) => {
            setReflections(items);
          },
          onBlogPosts: (items) => {
            setBlogPosts(items);
          },
          onCalendarEvents: (items) => {
            setCalendarEvents(items);
          },
          onLearningPaths: (items) => {
            setLearningPaths(items);
          },
          onReadingItems: (items) => {
            setReadingItems(items);
          },
          onProjects: (items) => {
            setProjects(items);
          },
          onUnifiedTasks: (items) => {
            setUnifiedTasks(items);
          },
          onDentalCases: (items) => {
            setDentalCases(items);
          },
          onWeeklyMeetings: (items) => {
            setWeeklyMeetings(items);
          },
          onActivityLogs: (items) => {
            setActivityLogs(items);
          },
          onDailyJournals: (items) => {
            setDailyJournals(items);
          },
          onPeriodReviews: (items) => {
            setPeriodReviews(items);
          },
          onWeeklyPlans: (items) => {
            setWeeklyPlans(items);
          },
          onPinCollections: (items) => {
            setPinCollections(items);
          },
        });

        setActiveTab((prev) => {
          if (prev === 'public') {
            syncLocationHash('overview', null, null);
            return 'overview';
          }
          return prev;
        });
      } catch (err) {
        if (!isMounted) return;
        setAuthReady(true);
        setAuthError(
          formatSupabaseErrorMessage(err, 'تعذرت المزامنة مع قاعدة البيانات.')
        );
      } finally {
        if (isMounted) setSyncingCloud(false);
      }
    });

    return () => {
      isMounted = false;
      unsubAuth();
      if (unsubWorkspace) unsubWorkspace();
      if (unsubAttachments) unsubAttachments();
    };
  }, [syncRefreshTick]);

  // Route guard: guests, non-admins, and public preview mode are locked strictly to public view
  useEffect(() => {
    if (!authReady) return;
    if (!isAdmin || isPreviewingPublic) {
      if (activeTab !== 'public') {
        setActiveTab('public');
        syncLocationHash('public', null, null);
      }
      if (selectedCourseId !== null) setSelectedCourseId(null);
      if (studyModalState !== null) setStudyModalState(null);
    }
  }, [authReady, isAdmin, isPreviewingPublic, activeTab, selectedCourseId, studyModalState]);

  // Automatically rescue stranded local-only IndexedDB attachments (or reconcile from cloudAttachments) to Supabase Storage
  const rescuedAttachmentKeysRef = useRef<Set<string>>(new Set());
  useEffect(() => {
    if (!user || !isAdmin) {
      rescuedAttachmentKeysRef.current.clear();
      return;
    }

    let cancelled = false;
    const runRescue = async () => {
      // 1) Courses resources
      for (const course of courses) {
        if (cancelled) return;
        let courseChanged = false;
        const nextResources = await Promise.all(
          (course.resources || []).map(async (res) => {
            const needsCloudSync =
              Boolean(res.attachmentName) &&
              (!res.storagePath || res.storagePath.startsWith('users/'));
            if (!needsCloudSync) return res;

            const safeId = res.id.replace(/[^a-zA-Z0-9_-]/g, '_').slice(0, 128);
            const cloudMatch = cloudAttachments.find(
              (a) => a.id === safeId || a.id === res.id
            );
            if (cloudMatch?.storagePath) {
              courseChanged = true;
              return {
                ...res,
                storagePath: cloudMatch.storagePath,
                downloadUrl: res.downloadUrl,
                mimeType: cloudMatch.mimeType || res.mimeType,
                sizeBytes: cloudMatch.sizeBytes || res.sizeBytes,
              };
            }

            const attemptKey = `course:${course.id}:${res.id}`;
            if (rescuedAttachmentKeysRef.current.has(attemptKey)) return res;
            rescuedAttachmentKeysRef.current.add(attemptKey);

            const rescued = await rescueLocalAttachmentToCloud(
              user.uid,
              res.id,
              res.attachmentName,
              res.extractedPreview
            );
            if (rescued?.uploadedToCloud && rescued.storagePath) {
              courseChanged = true;
              return {
                ...res,
                storagePath: rescued.storagePath,
                downloadUrl: rescued.downloadUrl || res.downloadUrl,
                mimeType: rescued.mimeType || res.mimeType,
                sizeBytes: rescued.sizeBytes || res.sizeBytes,
              };
            }
            return res;
          })
        );

        if (!cancelled && courseChanged) {
          const updatedCourse = { ...course, resources: nextResources };
          setCourses((prev) =>
            prev.map((c) => (c.id === course.id ? updatedCourse : c))
          );
          void saveCourseDoc(user.uid, updatedCourse);
        }
      }

      // 2) Monthly plan resources
      for (const month of months) {
        if (cancelled) return;
        let monthChanged = false;
        const nextResources = await Promise.all(
          (month.resources || []).map(async (res) => {
            const needsCloudSync =
              Boolean(res.attachmentName) &&
              (!res.storagePath || res.storagePath.startsWith('users/'));
            if (!needsCloudSync) return res;

            const safeId = res.id.replace(/[^a-zA-Z0-9_-]/g, '_').slice(0, 128);
            const cloudMatch = cloudAttachments.find(
              (a) => a.id === safeId || a.id === res.id
            );
            if (cloudMatch?.storagePath) {
              monthChanged = true;
              return {
                ...res,
                storagePath: cloudMatch.storagePath,
                downloadUrl: res.downloadUrl,
                mimeType: cloudMatch.mimeType || res.mimeType,
                sizeBytes: cloudMatch.sizeBytes || res.sizeBytes,
              };
            }

            const attemptKey = `month:${month.id}:${res.id}`;
            if (rescuedAttachmentKeysRef.current.has(attemptKey)) return res;
            rescuedAttachmentKeysRef.current.add(attemptKey);

            const rescued = await rescueLocalAttachmentToCloud(
              user.uid,
              res.id,
              res.attachmentName,
              res.extractedPreview
            );
            if (rescued?.uploadedToCloud && rescued.storagePath) {
              monthChanged = true;
              return {
                ...res,
                storagePath: rescued.storagePath,
                downloadUrl: rescued.downloadUrl || res.downloadUrl,
                mimeType: rescued.mimeType || res.mimeType,
                sizeBytes: rescued.sizeBytes || res.sizeBytes,
              };
            }
            return res;
          })
        );

        if (!cancelled && monthChanged) {
          const updatedMonth = { ...month, resources: nextResources };
          setMonths((prev) =>
            prev.map((m) => (m.id === month.id ? updatedMonth : m))
          );
          void saveMonthDoc(user.uid, updatedMonth);
        }
      }

      // 3) Reading library items
      for (const item of readingItems) {
        if (cancelled) return;
        const needsCloudSync =
          Boolean(item.attachmentName) &&
          (!item.storagePath || item.storagePath.startsWith('users/'));
        if (!needsCloudSync) continue;

        const targetResId = item.attachmentResourceId || item.id;
        const safeId = targetResId.replace(/[^a-zA-Z0-9_-]/g, '_').slice(0, 128);
        const cloudMatch = cloudAttachments.find(
          (a) => a.id === safeId || a.id === targetResId
        );
        if (cloudMatch?.storagePath) {
          const updatedItem: ReadingLibraryItem = {
            ...item,
            storagePath: cloudMatch.storagePath,
            downloadUrl: item.downloadUrl,
          };
          setReadingItems((prev) =>
            prev.map((i) => (i.id === item.id ? updatedItem : i))
          );
          void saveReadingItemDoc(user.uid, updatedItem);
          continue;
        }

        const attemptKey = `library:${item.id}:${targetResId}`;
        if (rescuedAttachmentKeysRef.current.has(attemptKey)) continue;
        rescuedAttachmentKeysRef.current.add(attemptKey);

        const rescued = await rescueLocalAttachmentToCloud(
          user.uid,
          targetResId,
          item.attachmentName
        );
        if (!cancelled && rescued?.uploadedToCloud && rescued.storagePath) {
          const updatedItem: ReadingLibraryItem = {
            ...item,
            attachmentResourceId: targetResId,
            storagePath: rescued.storagePath,
            downloadUrl: rescued.downloadUrl || item.downloadUrl,
          };
          setReadingItems((prev) =>
            prev.map((i) => (i.id === item.id ? updatedItem : i))
          );
          void saveReadingItemDoc(user.uid, updatedItem);
        }
      }

      // 4) Book/Lecture notes isolated resources
      for (const bn of bookNotes) {
        if (cancelled) return;
        let noteChanged = false;
        const nextResources = await Promise.all(
          (bn.resources || []).map(async (res) => {
            const needsCloudSync =
              Boolean(res.attachmentName) &&
              (!res.storagePath || res.storagePath.startsWith('users/'));
            if (!needsCloudSync) return res;

            const safeId = res.id.replace(/[^a-zA-Z0-9_-]/g, '_').slice(0, 128);
            const cloudMatch = cloudAttachments.find(
              (a) => a.id === safeId || a.id === res.id
            );
            if (cloudMatch?.storagePath) {
              noteChanged = true;
              return {
                ...res,
                storagePath: cloudMatch.storagePath,
                downloadUrl: res.downloadUrl,
                mimeType: cloudMatch.mimeType || res.mimeType,
                sizeBytes: cloudMatch.sizeBytes || res.sizeBytes,
              };
            }

            const attemptKey = `note:${bn.id}:${res.id}`;
            if (rescuedAttachmentKeysRef.current.has(attemptKey)) return res;
            rescuedAttachmentKeysRef.current.add(attemptKey);

            const rescued = await rescueLocalAttachmentToCloud(
              user.uid,
              res.id,
              res.attachmentName,
              res.extractedPreview
            );
            if (rescued?.uploadedToCloud && rescued.storagePath) {
              noteChanged = true;
              return {
                ...res,
                storagePath: rescued.storagePath,
                downloadUrl: rescued.downloadUrl || res.downloadUrl,
                mimeType: rescued.mimeType || res.mimeType,
                sizeBytes: rescued.sizeBytes || res.sizeBytes,
              };
            }
            return res;
          })
        );

        if (!cancelled && noteChanged) {
          const updatedNote = { ...bn, resources: nextResources };
          setBookNotes((prev) =>
            prev.map((n) => (n.id === bn.id ? updatedNote : n))
          );
          void saveBookNoteDoc(user.uid, updatedNote);
        }
      }
    };

    void runRescue();
    return () => {
      cancelled = true;
    };
  }, [user, isAdmin, courses, months, readingItems, bookNotes, cloudAttachments]);

  const handleGoogleSignIn = async () => {
    setAuthError(null);
    setAuthPromptNotice(null);
    try {
      await signInWithGoogle();
    } catch (err) {
      const msg =
        err instanceof Error ? err.message : 'تعذر تسجيل الدخول بحساب Google.';
      if (!msg.includes('popup-closed-by-user')) {
        setAuthError(
          'تعذر إتمام تسجيل الدخول. إذا كنت تفتح الموقع من داخل تطبيق (مثل واتساب أو تيليجرام)، افتح الرابط في Chrome أو Safari ثم سجّل الدخول.'
        );
      }
    }
  };

  const handleSignOut = async () => {
    setAuthError(null);
    await signOutUser();
  };

  const handleRequireAuth = () => {
    setAuthPromptNotice(
      'أنت تتصفح بوضع القراءة فقط. سجّل الدخول بحساب Google لإجراء التعديلات وحفظها في مساحتك الشخصية دون التأثير على حسابات الآخرين.'
    );
    safeScrollToTop();
  };

  const handleExportExcel = () => {
    exportPlanToExcel(months, courses, bookNotes, domains);
    setExportNotice(
      'تم إنشاء وتنزيل ملف Excel (خطة_ميزان_المعرفة_الدراسية.xlsx)'
    );
    window.setTimeout(() => {
      setExportNotice(null);
    }, 4000);
  };

  const recordActivityLog = (payload: {
    entityType: ActivityLogEntry['entityType'];
    entityId: string;
    action: ActivityLogEntry['action'];
    title: string;
    hubId?: LearningHubId;
    subtitle?: string;
    statusSnapshot?: string;
  }) => {
    if (!user || !isAdmin) return;
    const now = Date.now();
    const entry: ActivityLogEntry = {
      id: `act-${now}-${Math.floor(Math.random() * 10000)}`,
      dateKey: toLocalDateKey(new Date(now)),
      occurredAtMs: now,
      entityType: payload.entityType,
      entityId: payload.entityId,
      action: payload.action,
      title: payload.title,
      hubId: payload.hubId,
      subtitle: payload.subtitle,
      statusSnapshot: payload.statusSnapshot,
    };
    setActivityLogs((prev) => [entry, ...prev].slice(0, 600));
    void saveActivityLogDoc(user.uid, entry);
  };

  const recordHistory = (
    payload: Omit<StudyHistoryEntry, 'id' | 'timestampLabel' | 'createdAtMs'>
  ) => {
    if (!user || !isAdmin) return;
    const entry: StudyHistoryEntry = {
      ...payload,
      id: `hist-${Date.now()}-${Math.floor(Math.random() * 1000)}`,
      timestampLabel: formatArabicDateTime(),
      createdAtMs: Date.now(),
    };
    setHistory((prev) => [entry, ...prev].slice(0, 40));
    void saveHistoryEntryDoc(user.uid, entry);
  };

  const handleJumpToMonth = (monthId: number) => {
    setSelectedMonthId(monthId);
    setDomainFilter('all');
    navigateToTab('plan');
  };

  const handleFilterByDomain = (domainId: DomainId) => {
    setDomainFilter(domainId);
    const firstMatch = months.find(
      (m) =>
        m.foundational.domainId === domainId ||
        m.exploratory.domainId === domainId
    );
    if (firstMatch) {
      setSelectedMonthId(firstMatch.id);
    }
    navigateToTab('plan');
  };

  // --- Preferences CRUD ---
  const handleUpdatePreferences = (updates: Partial<UserPreferences>) => {
    if (!user || !isAdmin) {
      handleRequireAuth();
      return;
    }
    const nextPrefs: UserPreferences = { ...preferences, ...updates };
    setPreferences(nextPrefs);
    setActiveLearningHubs(nextPrefs.customHubs);
    void saveUserPreferencesDoc(user.uid, nextPrefs);
  };

  // --- Quarter CRUD ---
  const handleAddQuarter = (title: string, subtitle: string) => {
    if (!user || !isAdmin) {
      handleRequireAuth();
      return;
    }
    const nextNum =
      quarters.reduce((max, q) => Math.max(max, q.number), 0) + 1;
    const newQuarter: QuarterInfo = {
      id: `quarter-${nextNum}-${Date.now()}`,
      number: nextNum,
      title,
      subtitle,
    };
    setQuarters((prev) => [...prev, newQuarter]);
    void saveQuarterDoc(user.uid, newQuarter);
  };

  const handleUpdateQuarter = (id: string, updates: Partial<QuarterInfo>) => {
    if (!user || !isAdmin) {
      handleRequireAuth();
      return;
    }
    let updatedQuarter: QuarterInfo | null = null;
    setQuarters((prev) =>
      prev.map((q) => {
        if (q.id !== id) return q;
        updatedQuarter = { ...q, ...updates };
        return updatedQuarter;
      })
    );
    if (updatedQuarter && updates.title !== undefined) {
      const qNumber = (updatedQuarter as QuarterInfo).number;
      const newTitle = updates.title;
      setMonths((prev) =>
        prev.map((m) => {
          if (m.quarter !== qNumber) return m;
          const nextMonth = { ...m, quarterTitle: newTitle };
          void saveMonthDoc(user.uid, nextMonth);
          return nextMonth;
        })
      );
    }
    if (updatedQuarter) {
      void saveQuarterDoc(user.uid, updatedQuarter);
    }
  };

  const handleDeleteQuarter = (id: string) => {
    if (!user || !isAdmin) {
      handleRequireAuth();
      return;
    }
    setQuarters((prev) => prev.filter((q) => q.id !== id));
    void deleteQuarterDoc(user.uid, id);
  };

  // --- Month CRUD ---
  const handleAddMonth = (payload: {
    quarter: number;
    theme: string;
    foundationalTitle: string;
    foundationalAuthor: string;
    exploratoryTitle: string;
    exploratoryAuthor: string;
    courseId: number;
  }) => {
    if (!user || !isAdmin) {
      handleRequireAuth();
      return;
    }
    const nextId = months.reduce((max, m) => Math.max(max, m.id), 0) + 1;
    const qObj = quarters.find((q) => q.number === payload.quarter);
    const defaultDomainF = domains[0]?.id ?? 'islamic_thought';
    const defaultDomainE = domains[1]?.id ?? defaultDomainF;

    const newMonth: MonthPlan = {
      id: nextId,
      docId: `month-${nextId}-${Date.now()}`,
      quarter: payload.quarter,
      quarterTitle: qObj?.title ?? `المرحلة ${payload.quarter}`,
      theme: payload.theme,
      foundational: {
        title: payload.foundationalTitle,
        author: payload.foundationalAuthor,
        format: 'كتاب',
        domainId: defaultDomainF,
        pace: '30 صفحة أسبوعيًا',
        focus: 'تأسيس منهجي متدرج.',
      },
      exploratory: {
        title: payload.exploratoryTitle,
        author: payload.exploratoryAuthor,
        format: 'كتاب',
        domainId: defaultDomainE,
        pace: '25 صفحة أسبوعيًا',
        focus: 'توسيع الأفق المعرفي.',
      },
      courseId: payload.courseId,
      discussionPrompt: 'ما أبرز فكرة تستحق النقاش والتطبيق من هذه الوحدة؟',
      applicationTask: 'تلخيص أهم فكرتين وتطبيق إحداهما خلال الأسبوع.',
      activities: {
        reading: false,
        listening: false,
        summarizing: false,
        discussing: false,
      },
      status: 'not_started',
      notes: '',
      tasks: payload.foundationalTitle
        ? [
            {
              id: `m${nextId}-t1-${Date.now()}`,
              text: `البدء بقراءة ${payload.foundationalTitle} وتدوين الملاحظات الأولى.`,
              track: 'foundational',
              done: false,
              custom: true,
            },
          ]
        : [],
      resources: [],
    };

    setMonths((prev) => [...prev, newMonth]);
    setSelectedMonthId(newMonth.id);
    void saveMonthDoc(user.uid, newMonth);
    recordHistory({
      actionType: 'month',
      title: `أضفت الوحدة ${newMonth.id}: ${newMonth.theme}`,
      detail: newMonth.quarterTitle,
      targetTab: 'plan',
      targetMonthId: newMonth.id,
    });
  };

  const syncMonth = (updated: MonthPlan) => {
    if (user && isAdmin) void saveMonthDoc(user.uid, updated);
  };

  const handleUpdateMonth = (id: number, updates: Partial<MonthPlan>) => {
    if (!user || !isAdmin) {
      handleRequireAuth();
      return;
    }
    setMonths((prev) =>
      prev.map((m) => {
        if (m.id !== id) return m;
        const next = { ...m, ...updates };
        syncMonth(next);
        return next;
      })
    );
  };

  const handleDeleteMonth = (id: number) => {
    if (!user || !isAdmin) {
      handleRequireAuth();
      return;
    }
    const target = months.find((m) => m.id === id);
    const remaining = months.filter((m) => m.id !== id);
    setMonths(remaining);
    if (selectedMonthId === id && remaining.length > 0) {
      setSelectedMonthId(remaining[0].id);
    }
    if (target) {
      void deleteMonthDoc(user.uid, target.docId || `month-${target.id}`);
    }
  };

  const handleUpdateMonthStatus = (id: number, status: MonthStatus) => {
    if (!user || !isAdmin) {
      handleRequireAuth();
      return;
    }
    handleUpdateMonth(id, { status });
  };

  const handleToggleActivity = (id: number, key: keyof MonthActivities) => {
    if (!user || !isAdmin) {
      handleRequireAuth();
      return;
    }
    const targetMonth = months.find((m) => m.id === id);
    const willBeDone = targetMonth ? !targetMonth.activities[key] : false;
    const activityLabels: Record<keyof MonthActivities, string> = {
      reading: 'القراءة',
      listening: 'الاستماع',
      summarizing: 'التلخيص',
      discussing: 'النقاش والتطبيق',
    };

    setMonths((prev) =>
      prev.map((m) => {
        if (m.id !== id) return m;
        const updatedActivities = {
          ...m.activities,
          [key]: !m.activities[key],
        };
        const completedCount =
          Object.values(updatedActivities).filter(Boolean).length;
        let nextStatus = m.status;
        if (completedCount === 4) {
          nextStatus = 'completed';
        } else if (completedCount > 0 && m.status === 'not_started') {
          nextStatus = 'in_progress';
        }
        const next = {
          ...m,
          activities: updatedActivities,
          status: nextStatus,
        };
        syncMonth(next);
        return next;
      })
    );

    if (targetMonth && willBeDone) {
      recordHistory({
        actionType: 'month',
        title: `أتممت ركيزة «${activityLabels[key]}» في الوحدة ${targetMonth.id}`,
        detail: targetMonth.theme,
        targetTab: 'plan',
        targetMonthId: targetMonth.id,
      });
      recordActivityLog({
        entityType: 'month',
        entityId: String(targetMonth.id),
        action: 'completed',
        title: `أتممت ركيزة ${activityLabels[key]} في الوحدة ${targetMonth.id}: ${targetMonth.theme}`,
      });
    }
  };

  const handleUpdateMonthNotes = (id: number, notes: string) => {
    if (!user || !isAdmin) {
      handleRequireAuth();
      return;
    }
    handleUpdateMonth(id, { notes });
  };

  const handleUpdateTrackItem = (
    id: number,
    track: 'foundational' | 'exploratory',
    field: 'title' | 'author' | 'pace' | 'domainId' | 'format' | 'focus',
    value: string
  ) => {
    if (!user || !isAdmin) {
      handleRequireAuth();
      return;
    }
    setMonths((prev) =>
      prev.map((m) => {
        if (m.id !== id) return m;
        const next: MonthPlan = {
          ...m,
          [track]: {
            ...m[track],
            [field]: value,
          },
        };
        syncMonth(next);
        return next;
      })
    );
  };

  const handleToggleMonthTask = (monthId: number, taskId: string) => {
    if (!user || !isAdmin) {
      handleRequireAuth();
      return;
    }
    const targetMonth = months.find((m) => m.id === monthId);
    const targetTask = targetMonth?.tasks.find((t) => t.id === taskId);
    const willBeDone = targetTask ? !targetTask.done : false;

    setMonths((prev) =>
      prev.map((m) => {
        if (m.id !== monthId) return m;
        const next = {
          ...m,
          tasks: m.tasks.map((t) =>
            t.id === taskId ? { ...t, done: !t.done } : t
          ),
        };
        syncMonth(next);
        return next;
      })
    );

    const canonicalProjectId = `month:${monthId}:${taskId}`;
    setUnifiedTasks((prev) =>
      prev.map((ut) => {
        if (ut.projectId !== canonicalProjectId) return ut;
        const nextStatus: UnifiedTask['status'] = willBeDone ? 'done' : 'todo';
        if (ut.status === nextStatus) return ut;
        const nextUt = { ...ut, status: nextStatus };
        void saveUnifiedTaskDoc(user.uid, nextUt);
        return nextUt;
      })
    );

    if (targetMonth && targetTask && willBeDone) {
      recordHistory({
        actionType: 'month',
        title: `أنجزت مهمة في الوحدة ${targetMonth.id}: ${targetTask.text}`,
        detail: targetMonth.theme,
        targetTab: 'plan',
        targetMonthId: targetMonth.id,
      });
    }
  };

  const handleAddMonthTask = (
    monthId: number,
    text: string,
    track: SmallTask['track']
  ) => {
    if (!user || !isAdmin) {
      handleRequireAuth();
      return;
    }
    const newTask: SmallTask = {
      id: `m${monthId}-custom-${Date.now()}`,
      text,
      track,
      done: false,
      custom: true,
    };
    setMonths((prev) =>
      prev.map((m) => {
        if (m.id !== monthId) return m;
        const next = { ...m, tasks: [...m.tasks, newTask] };
        syncMonth(next);
        return next;
      })
    );
  };

  const handleDeleteMonthTask = (monthId: number, taskId: string) => {
    if (!user || !isAdmin) {
      handleRequireAuth();
      return;
    }
    setMonths((prev) =>
      prev.map((m) => {
        if (m.id !== monthId) return m;
        const next = {
          ...m,
          tasks: m.tasks.filter((t) => t.id !== taskId),
        };
        syncMonth(next);
        return next;
      })
    );
  };

  const handleAddMonthResource = (
    monthId: number,
    title: string,
    type: StudyResource['type'],
    note: string,
    extras?: {
      id?: string;
      externalUrl?: string;
      attachmentName?: string;
      extractedPreview?: string;
      storagePath?: string;
      downloadUrl?: string;
      mimeType?: string;
      sizeBytes?: number;
    }
  ) => {
    if (!user || !isAdmin) {
      handleRequireAuth();
      return;
    }
    const newRes: StudyResource = {
      id: extras?.id || `m${monthId}-res-${Date.now()}`,
      title,
      type,
      note,
      searchQuery: title,
      ...(extras?.externalUrl ? { externalUrl: extras.externalUrl } : {}),
      ...(extras?.attachmentName
        ? { attachmentName: extras.attachmentName }
        : {}),
      ...(extras?.extractedPreview
        ? { extractedPreview: extras.extractedPreview }
        : {}),
      ...(extras?.storagePath ? { storagePath: extras.storagePath } : {}),
      ...(extras?.downloadUrl ? { downloadUrl: extras.downloadUrl } : {}),
      ...(extras?.mimeType ? { mimeType: extras.mimeType } : {}),
      ...(typeof extras?.sizeBytes === 'number'
        ? { sizeBytes: extras.sizeBytes }
        : {}),
      custom: true,
    };
    setMonths((prev) =>
      prev.map((m) => {
        if (m.id !== monthId) return m;
        const next = { ...m, resources: [...m.resources, newRes] };
        syncMonth(next);
        return next;
      })
    );
  };

  const handleUpdateMonthResource = (
    monthId: number,
    resourceId: string,
    updates: Partial<StudyResource>
  ) => {
    if (!user || !isAdmin) {
      handleRequireAuth();
      return;
    }
    setMonths((prev) =>
      prev.map((m) => {
        if (m.id !== monthId) return m;
        const next = {
          ...m,
          resources: m.resources.map((r) =>
            r.id === resourceId ? { ...r, ...updates } : r
          ),
        };
        syncMonth(next);
        return next;
      })
    );
  };

  const handleDeleteMonthResource = (monthId: number, resourceId: string) => {
    if (!user || !isAdmin) {
      handleRequireAuth();
      return;
    }
    const existing = months
      .find((m) => m.id === monthId)
      ?.resources.find((r) => r.id === resourceId);
    if (existing) {
      void deleteCloudAttachment(user.uid, resourceId, existing.storagePath);
    }
    setMonths((prev) =>
      prev.map((m) => {
        if (m.id !== monthId) return m;
        const next = {
          ...m,
          resources: m.resources.filter((r) => r.id !== resourceId),
        };
        syncMonth(next);
        return next;
      })
    );
  };

  // --- Domain CRUD ---
  const handleAddDomain = (payload: Omit<DomainInfo, 'id' | 'order'>) => {
    if (!user || !isAdmin) {
      handleRequireAuth();
      return;
    }
    const newDomain: DomainInfo = {
      ...payload,
      id: sanitizeId(`domain_${Date.now()}`),
      order: domains.length,
    };
    setDomains((prev) => [...prev, newDomain]);
    void saveDomainDoc(user.uid, newDomain, newDomain.order ?? 0);
    recordHistory({
      actionType: 'domain',
      title: `أضفت محورًا معرفيًا: ${newDomain.title}`,
      detail: newDomain.subtitle,
      targetTab: 'domains',
    });
  };

  const handleUpdateDomain = (id: DomainId, updates: Partial<DomainInfo>) => {
    if (!user || !isAdmin) {
      handleRequireAuth();
      return;
    }
    setDomains((prev) =>
      prev.map((d, idx) => {
        if (d.id !== id) return d;
        const next = { ...d, ...updates };
        void saveDomainDoc(user.uid, next, next.order ?? idx);
        return next;
      })
    );
  };

  const handleDeleteDomain = (id: DomainId) => {
    if (!user || !isAdmin) {
      handleRequireAuth();
      return;
    }
    setDomains((prev) => prev.filter((d) => d.id !== id));
    void deleteDomainDoc(user.uid, id);
  };

  // --- Course CRUD ---
  const syncCourse = (updated: PersonalCourse) => {
    if (user && isAdmin) void saveCourseDoc(user.uid, updated);
  };

  const handleAddCourse = (payload: {
    title: string;
    hubId: LearningHubId;
    category: string;
    studyStage?: CourseStudyStage;
    scheduledPeriod?: string;
    instructor?: string;
    platform?: string;
    durationLabel?: string;
    startDate?: string;
    targetDate?: string;
    notes?: string;
    complementaryBook: string;
    bookAuthor: string;
    applicationMilestone: string;
    linkedMonths: number[];
  }) => {
    if (!user || !isAdmin) {
      handleRequireAuth();
      return;
    }
    const nextId = courses.reduce((max, c) => Math.max(max, c.id), 0) + 1;
    const stage: CourseStudyStage = payload.studyStage ?? 'in_progress';
    const newCourse: PersonalCourse = {
      id: nextId,
      docId: `course-${nextId}-${Date.now()}`,
      title: payload.title,
      hubId: payload.hubId,
      category: payload.category,
      studyStage: stage,
      scheduledPeriod: payload.scheduledPeriod ?? '',
      instructor: payload.instructor ?? '',
      platform: payload.platform ?? '',
      durationLabel: payload.durationLabel ?? '',
      startDate: payload.startDate ?? '',
      targetDate: payload.targetDate ?? '',
      notes: payload.notes ?? '',
      progressPct: stage === 'completed' ? 100 : 0,
      linkedMonths: payload.linkedMonths,
      complementaryBook: payload.complementaryBook,
      bookAuthor: payload.bookAuthor,
      applicationMilestone: payload.applicationMilestone,
      completed: stage === 'completed',
      resources: [],
      tasks: [],
    };
    setCourses((prev) => [...prev, newCourse]);
    syncCourse(newCourse);
    recordHistory({
      actionType: 'course',
      title: `أضفت كورس جديد: ${newCourse.title}`,
      detail: newCourse.category,
      targetTab: 'courses',
    });
    recordActivityLog({
      entityType: 'course',
      entityId: String(newCourse.id),
      action: 'created',
      title: newCourse.title,
      hubId: newCourse.hubId,
      subtitle: newCourse.category,
    });
  };

  const handleUpdateCourse = (
    id: number,
    updates: Partial<PersonalCourse>
  ) => {
    if (!user || !isAdmin) {
      handleRequireAuth();
      return;
    }
    setCourses((prev) =>
      prev.map((c) => {
        if (c.id !== id) return c;
        const next = { ...c, ...updates };
        syncCourse(next);
        if (updates.completed === true && !c.completed) {
          recordHistory({
            actionType: 'course',
            title: `أكملت تطبيق كورس: ${c.title}`,
            detail: c.category,
            targetTab: 'courses',
          });
          recordActivityLog({
            entityType: 'course',
            entityId: String(c.id),
            action: 'completed',
            title: c.title,
            hubId: next.hubId,
          });
        } else if (
          updates.progressPct !== undefined ||
          updates.studyStage !== undefined ||
          updates.listenCount !== undefined ||
          updates.reviewCount !== undefined
        ) {
          recordActivityLog({
            entityType: 'course',
            entityId: String(c.id),
            action: 'studied',
            title: c.title,
            hubId: next.hubId,
          });
        }
        return next;
      })
    );
  };

  const handleDeleteCourse = (id: number) => {
    if (!user || !isAdmin) {
      handleRequireAuth();
      return;
    }
    const target = courses.find((c) => c.id === id);
    setCourses((prev) => prev.filter((c) => c.id !== id));
    if (target) {
      for (const res of target.resources || []) {
        if (res.storagePath || res.attachmentName) {
          void deleteCloudAttachment(user.uid, res.id, res.storagePath);
        }
      }
      void deleteCourseDoc(user.uid, target.docId || `course-${target.id}`);
    }
  };

  const handleToggleCourseTask = (courseId: number, taskId: string) => {
    if (!user || !isAdmin) {
      handleRequireAuth();
      return;
    }
    const targetCourse = courses.find((c) => c.id === courseId);
    const targetTask = targetCourse?.tasks.find((t) => t.id === taskId);
    const willBeDone = targetTask ? !targetTask.done : false;

    setCourses((prev) =>
      prev.map((c) => {
        if (c.id !== courseId) return c;
        const nextTasks = c.tasks.map((t) =>
          t.id === taskId ? { ...t, done: !t.done } : t
        );
        const doneCount = nextTasks.filter((t) => t.done).length;
        const progressPct =
          nextTasks.length > 0
            ? Math.round((doneCount / nextTasks.length) * 100)
            : c.progressPct;
        const next = {
          ...c,
          tasks: nextTasks,
          progressPct,
        };
        syncCourse(next);
        return next;
      })
    );

    const canonicalProjectId = `course:${courseId}:${taskId}`;
    setUnifiedTasks((prev) =>
      prev.map((ut) => {
        if (ut.projectId !== canonicalProjectId) return ut;
        const nextStatus: UnifiedTask['status'] = willBeDone ? 'done' : 'todo';
        if (ut.status === nextStatus) return ut;
        const nextUt = { ...ut, status: nextStatus };
        void saveUnifiedTaskDoc(user.uid, nextUt);
        return nextUt;
      })
    );

    if (targetCourse && targetTask && willBeDone) {
      recordHistory({
        actionType: 'course',
        title: `أنجزت مهمة في ${targetCourse.title}: ${targetTask.text}`,
        detail: targetCourse.category,
        targetTab: 'courses',
      });
      recordActivityLog({
        entityType: 'course',
        entityId: String(targetCourse.id),
        action: 'studied',
        title: `${targetCourse.title} — ${targetTask.text}`,
        hubId: targetCourse.hubId,
      });
    }
  };

  const handleAddCourseTask = (courseId: number, text: string) => {
    if (!user || !isAdmin) {
      handleRequireAuth();
      return;
    }
    const newTask: SmallTask = {
      id: `c${courseId}-custom-${Date.now()}`,
      text,
      track: 'action',
      done: false,
      custom: true,
    };
    setCourses((prev) =>
      prev.map((c) => {
        if (c.id !== courseId) return c;
        const next = { ...c, tasks: [...c.tasks, newTask] };
        syncCourse(next);
        return next;
      })
    );
  };

  const handleDeleteCourseTask = (courseId: number, taskId: string) => {
    if (!user || !isAdmin) {
      handleRequireAuth();
      return;
    }
    setCourses((prev) =>
      prev.map((c) => {
        if (c.id !== courseId) return c;
        const next = {
          ...c,
          tasks: c.tasks.filter((t) => t.id !== taskId),
        };
        syncCourse(next);
        return next;
      })
    );
  };

  const handleAddCourseResource = (
    courseId: number,
    title: string,
    type: StudyResource['type'],
    note: string,
    extras?: {
      id?: string;
      externalUrl?: string;
      attachmentName?: string;
      extractedPreview?: string;
      storagePath?: string;
      downloadUrl?: string;
      mimeType?: string;
      sizeBytes?: number;
    }
  ) => {
    if (!user || !isAdmin) {
      handleRequireAuth();
      return;
    }
    const newRes: StudyResource = {
      id: extras?.id || `c${courseId}-res-${Date.now()}`,
      title,
      type,
      note,
      searchQuery: title,
      ...(extras?.externalUrl ? { externalUrl: extras.externalUrl } : {}),
      ...(extras?.attachmentName
        ? { attachmentName: extras.attachmentName }
        : {}),
      ...(extras?.extractedPreview
        ? { extractedPreview: extras.extractedPreview }
        : {}),
      ...(extras?.storagePath ? { storagePath: extras.storagePath } : {}),
      ...(extras?.downloadUrl ? { downloadUrl: extras.downloadUrl } : {}),
      ...(extras?.mimeType ? { mimeType: extras.mimeType } : {}),
      ...(typeof extras?.sizeBytes === 'number'
        ? { sizeBytes: extras.sizeBytes }
        : {}),
      custom: true,
    };
    setCourses((prev) =>
      prev.map((c) => {
        if (c.id !== courseId) return c;
        const next = { ...c, resources: [...c.resources, newRes] };
        syncCourse(next);
        return next;
      })
    );
  };

  const handleUpdateCourseResource = (
    courseId: number,
    resourceId: string,
    updates: Partial<StudyResource>
  ) => {
    if (!user || !isAdmin) {
      handleRequireAuth();
      return;
    }
    setCourses((prev) =>
      prev.map((c) => {
        if (c.id !== courseId) return c;
        const next = {
          ...c,
          resources: c.resources.map((r) =>
            r.id === resourceId ? { ...r, ...updates } : r
          ),
        };
        syncCourse(next);
        return next;
      })
    );
  };

  const handleDeleteCourseResource = (courseId: number, resourceId: string) => {
    if (!user || !isAdmin) {
      handleRequireAuth();
      return;
    }
    const existing = courses
      .find((c) => c.id === courseId)
      ?.resources.find((r) => r.id === resourceId);
    if (existing) {
      void deleteCloudAttachment(user.uid, resourceId, existing.storagePath);
    }
    setCourses((prev) =>
      prev.map((c) => {
        if (c.id !== courseId) return c;
        const next = {
          ...c,
          resources: c.resources.filter((r) => r.id !== resourceId),
        };
        syncCourse(next);
        return next;
      })
    );
  };

  // --- Structured Book / Course / Lecture Notes CRUD ---
  const handleAddStructuredNote = (payload: {
    hubId?: LearningHubId;
    noteType: NoteCategoryType;
    bookTitle: string;
    author: string;
    courseId?: number;
    courseTitle?: string;
    lectureTitle?: string;
    categoryLabel?: string;
    initialContent?: string;
    stayInCurrentView?: boolean;
  }): string | void => {
    if (!user || !isAdmin) {
      handleRequireAuth();
      return;
    }
    const newNote: BookNote = {
      id: `bn-${Date.now()}`,
      hubId: payload.hubId ?? 'knowledge',
      noteType: payload.noteType,
      bookTitle: payload.bookTitle,
      author: payload.author,
      courseId: payload.courseId ?? 0,
      courseTitle: payload.courseTitle ?? '',
      lectureTitle: payload.lectureTitle ?? '',
      categoryLabel: payload.categoryLabel ?? '',
      progressMarker: '',
      content: payload.initialContent ?? '',
      quotes: '',
      updatedAt: formatArabicDate(),
    };
    setBookNotes((prev) => [newNote, ...prev]);
    setActiveBookNoteId(newNote.id);
    setStudyModalState({ noteId: newNote.id, startInEdit: true });
    void saveBookNoteDoc(user.uid, newNote);

    const typeDesc =
      payload.noteType === 'course_lecture'
        ? `ملاحظة محاضرة في ${payload.courseTitle || 'كورس'}`
        : payload.noteType === 'general'
        ? 'ملاحظة عامة'
        : 'دفتر ملاحظات كتاب';

    recordHistory({
      actionType: 'note',
      title: `أنشأت ${typeDesc}: ${newNote.bookTitle}`,
      detail: newNote.lectureTitle || newNote.author,
      targetTab: 'journal',
      targetNoteId: newNote.id,
    });
    recordActivityLog({
      entityType: 'book_note',
      entityId: newNote.id,
      action: 'created',
      title: newNote.bookTitle,
      hubId: newNote.hubId,
      subtitle: newNote.lectureTitle || newNote.author,
    });
    return newNote.id;
  };

  const handleAddOrOpenBookNote = (
    bookTitle: string,
    author: string,
    initialContent?: string
  ) => {
    const existing = bookNotes.find(
      (bn) => bn.bookTitle.trim() === bookTitle.trim()
    );
    if (existing) {
      setActiveBookNoteId(existing.id);
      setStudyModalState({ noteId: existing.id, startInEdit: false });
      return;
    }

    if (!user || !isAdmin) {
      handleRequireAuth();
      return;
    }

    handleAddStructuredNote({
      hubId: 'knowledge',
      noteType: 'book',
      bookTitle,
      author,
      categoryLabel: customCategories[0]?.title ?? 'قراءات تأسيسية',
      initialContent,
      stayInCurrentView: true,
    });
  };

  const handleOpenCourseNote = (
    course: PersonalCourse,
    lectureTitle?: string,
    initialContent?: string
  ) => {
    const existing = !lectureTitle
      ? bookNotes.find(
          (bn) => bn.noteType === 'course_lecture' && bn.courseId === course.id
        )
      : undefined;
    if (existing) {
      setActiveBookNoteId(existing.id);
      setStudyModalState({ noteId: existing.id, startInEdit: false });
      return;
    }

    if (!user || !isAdmin) {
      handleRequireAuth();
      return;
    }

    handleAddStructuredNote({
      hubId: course.hubId || 'knowledge',
      noteType: 'course_lecture',
      bookTitle: lectureTitle
        ? `${course.title} — ${lectureTitle}`
        : `ملاحظات ${course.title}`,
      author: course.instructor || course.bookAuthor || '',
      courseId: course.id,
      courseTitle: course.title,
      lectureTitle: lectureTitle || 'المحاضرة 1',
      categoryLabel: course.category || 'محاضرات وتطبيق عملي',
      initialContent,
      stayInCurrentView: true,
    });
  };

  const handleOpenNoteById = (noteId: string, startInEdit = false) => {
    setActiveBookNoteId(noteId);
    setStudyModalState({ noteId, startInEdit });
  };

  const handleUpdateBookNote = (id: string, updates: Partial<BookNote>) => {
    if (!user || !isAdmin) {
      handleRequireAuth();
      return;
    }
    setBookNotes((prev) =>
      prev.map((bn) => {
        if (bn.id !== id) return bn;
        const next = { ...bn, ...updates, updatedAt: formatArabicDate() };
        void saveBookNoteDoc(user.uid, next);
        if (updates.content !== undefined || updates.reviewCount !== undefined || updates.listenCount !== undefined) {
          recordActivityLog({
            entityType: 'book_note',
            entityId: next.id,
            action: updates.reviewCount !== undefined ? 'reviewed' : 'updated',
            title: next.bookTitle,
            hubId: next.hubId,
          });
        }
        return next;
      })
    );
  };

  const handleDeleteBookNote = (id: string) => {
    if (!user || !isAdmin) {
      handleRequireAuth();
      return;
    }
    const targetNote = bookNotes.find((bn) => bn.id === id);
    if (targetNote?.resources) {
      for (const res of targetNote.resources) {
        if (res.storagePath || res.attachmentName) {
          void deleteCloudAttachment(user.uid, res.id, res.storagePath);
        }
      }
    }
    setBookNotes((prev) => {
      const next = prev.filter((bn) => bn.id !== id);
      if (activeBookNoteId === id) {
        setActiveBookNoteId(next[0]?.id ?? null);
      }
      return next;
    });
    if (studyModalState?.noteId === id) {
      setStudyModalState(null);
    }
    void deleteBookNoteDoc(user.uid, id);
  };

  // --- Personalized Custom Categories CRUD ---
  const handleAddCustomCategory = (
    title: string,
    description: string,
    color: CustomCategory['color'],
    hubId: CustomCategory['hubId'] = 'all'
  ) => {
    if (!user || !isAdmin) {
      handleRequireAuth();
      return;
    }
    const newCat: CustomCategory = {
      id: sanitizeId(`cat_${Date.now()}`),
      title,
      description,
      color,
      hubId,
      createdAtLabel: formatArabicDate(),
    };
    setCustomCategories((prev) => [newCat, ...prev]);
    void saveCustomCategoryDoc(user.uid, newCat);
    recordHistory({
      actionType: 'note',
      title: `أضفت تصنيفًا شخصيًا جديدًا: ${title}`,
      detail: description,
      targetTab: 'account',
    });
  };

  const handleDeleteCustomCategory = (id: string) => {
    if (!user || !isAdmin) {
      handleRequireAuth();
      return;
    }
    setCustomCategories((prev) => prev.filter((c) => c.id !== id));
    void deleteCustomCategoryDoc(user.uid, id);
  };

  const handleDeleteHistoryEntry = (id: string) => {
    if (!user || !isAdmin) {
      handleRequireAuth();
      return;
    }
    setHistory((prev) => prev.filter((h) => h.id !== id));
    void deleteHistoryEntryDoc(user.uid, id);
  };

  const handleClearHistory = () => {
    if (!user || !isAdmin) {
      handleRequireAuth();
      return;
    }
    for (const h of history) {
      void deleteHistoryEntryDoc(user.uid, h.id);
    }
    setHistory([]);
  };

  // --- Personal Reflections («خواطري») CRUD ---
  const handleAddReflection = (payload: {
    id?: string;
    title: string;
    content: string;
    moodTag: ReflectionMood;
    categoryTag?: string;
    colorKey?: ReflectionColorKey;
    isPublic?: boolean;
    imageUrl?: string;
    imageStoragePath?: string;
    imageFrame?: ImageFrameSpec;
  }): string | undefined => {
    if (!user || !isAdmin) {
      handleRequireAuth();
      return undefined;
    }
    const now = Date.now();
    const newId =
      payload.id || `refl-${now}-${Math.floor(Math.random() * 1000)}`;
    const newReflection: PersonalReflection = {
      id: newId,
      title: payload.title,
      content: payload.content,
      moodTag: payload.moodTag,
      categoryTag: payload.categoryTag || '',
      colorKey: payload.colorKey,
      isPublic: Boolean(payload.isPublic),
      pinned: false,
      imageUrl: payload.imageUrl,
      imageStoragePath: payload.imageStoragePath,
      imageFrame: payload.imageFrame,
      createdAtLabel: formatArabicDateTime(),
      createdAtMs: now,
    };
    setReflections((prev) => [newReflection, ...prev]);
    void saveReflectionDoc(user.uid, newReflection);
    recordHistory({
      actionType: 'note',
      title: `دوّنت خاطرة جديدة: ${payload.title || payload.moodTag}`,
      detail: `الوسم: ${payload.moodTag}`,
      targetTab: 'reflections',
    });
    recordActivityLog({
      entityType: 'reflection',
      entityId: newId,
      action: 'created',
      title: payload.title || payload.moodTag,
      subtitle: payload.moodTag,
    });
    return newId;
  };

  const handleUpdateReflection = (
    id: string,
    updates: Partial<PersonalReflection>
  ) => {
    if (!user || !isAdmin) {
      handleRequireAuth();
      return;
    }
    setReflections((prev) =>
      prev
        .map((r) => {
          if (r.id !== id) return r;
          const next = { ...r, ...updates };
          void saveReflectionDoc(user.uid, next);
          return next;
        })
        .sort((a, b) => {
          if (a.pinned !== b.pinned) return a.pinned ? -1 : 1;
          return b.createdAtMs - a.createdAtMs;
        })
    );
  };

  const handleDeleteReflection = (id: string) => {
    if (!user || !isAdmin) {
      handleRequireAuth();
      return;
    }
    setReflections((prev) => prev.filter((r) => r.id !== id));
    void deleteReflectionDoc(user.uid, id);
  };

  // --- Blog Posts («المدونة والمقالات») CRUD ---
  const handleAddBlogPost = (payload: {
    title: string;
    subtitle?: string;
    excerpt?: string;
    content: string;
    categoryLabel?: string;
    coverImageUrl?: string;
    coverStoragePath?: string;
    coverFrame?: ImageFrameSpec;
    isPublic?: boolean;
    pinned?: boolean;
  }): string | undefined => {
    if (!user || !isAdmin) {
      handleRequireAuth();
      return undefined;
    }
    const now = Date.now();
    const newId = `blog-${now}-${Math.floor(Math.random() * 1000)}`;
    const contentText = payload.content || '';
    const newPost: BlogPost = {
      id: newId,
      title: payload.title.trim(),
      subtitle: (payload.subtitle || '').trim(),
      excerpt: (payload.excerpt || '').trim(),
      content: contentText,
      categoryLabel: (payload.categoryLabel || 'مقال عام').trim(),
      coverImageUrl: payload.coverImageUrl || '',
      coverStoragePath: payload.coverStoragePath || '',
      coverFrame: payload.coverFrame,
      readingTimeMinutes: estimateReadingTimeMinutes(contentText),
      isPublic: payload.isPublic !== false,
      pinned: Boolean(payload.pinned),
      sortOrder: 0,
      createdAtLabel: formatArabicDate(),
      createdAtMs: now,
      updatedAtLabel: formatArabicDateTime(),
    };
    setBlogPosts((prev) => [newPost, ...prev]);
    void saveBlogPostDoc(user.uid, newPost);
    recordHistory({
      actionType: 'note',
      title: `نشرت مقالًا جديدًا: ${newPost.title}`,
      detail: newPost.categoryLabel || 'المدونة والمقالات',
      targetTab: 'blogs',
    });
    recordActivityLog({
      entityType: 'blog_post',
      entityId: newPost.id,
      action: 'created',
      title: newPost.title,
      subtitle: newPost.categoryLabel,
    });
    return newId;
  };

  const handleUpdateBlogPost = (id: string, updates: Partial<BlogPost>) => {
    if (!user || !isAdmin) {
      handleRequireAuth();
      return;
    }
    setBlogPosts((prev) =>
      prev
        .map((post) => {
          if (post.id !== id) return post;
          const nextContent =
            updates.content !== undefined ? updates.content : post.content;
          const next: BlogPost = {
            ...post,
            ...updates,
            readingTimeMinutes:
              updates.readingTimeMinutes ??
              estimateReadingTimeMinutes(nextContent),
            updatedAtLabel: formatArabicDateTime(),
          };
          void saveBlogPostDoc(user.uid, next);
          return next;
        })
        .sort((a, b) => {
          if (Boolean(a.pinned) !== Boolean(b.pinned)) return a.pinned ? -1 : 1;
          return b.createdAtMs - a.createdAtMs;
        })
    );
  };

  const handleDeleteBlogPost = (id: string) => {
    if (!user || !isAdmin) {
      handleRequireAuth();
      return;
    }
    const target = blogPosts.find((p) => p.id === id);
    setBlogPosts((prev) => prev.filter((p) => p.id !== id));
    if (target?.coverStoragePath) {
      void deleteBlogCoverStorage(target.coverStoragePath);
    }
    void deleteBlogPostDoc(user.uid, id);
  };

  // --- Calendar Events (Weekly & Monthly) CRUD ---
  const handleAddCalendarEvent = (payload: Omit<CalendarEvent, 'id'>) => {
    if (!user || !isAdmin) {
      handleRequireAuth();
      return;
    }
    const newEvent: CalendarEvent = {
      ...payload,
      id: `cal-${Date.now()}-${Math.floor(Math.random() * 1000)}`,
    };
    setCalendarEvents((prev) =>
      [...prev, newEvent].sort((a, b) => {
        if (a.dateKey !== b.dateKey) return a.dateKey.localeCompare(b.dateKey);
        return (a.timeSlot || '99:99').localeCompare(b.timeSlot || '99:99');
      })
    );
    void saveCalendarEventDoc(user.uid, newEvent);
    recordHistory({
      actionType: 'task',
      title: `أضفت موعدًا في التقويم: ${newEvent.title}`,
      detail: `${newEvent.dateKey} · ${newEvent.category}`,
      targetTab: 'calendar',
    });
    recordActivityLog({
      entityType: 'calendar_event',
      entityId: newEvent.id,
      action: 'created',
      title: newEvent.title,
      subtitle: `${newEvent.dateKey} · ${newEvent.category}`,
    });
  };

  const handleUpdateCalendarEvent = (
    id: string,
    updates: Partial<CalendarEvent>
  ) => {
    if (!user || !isAdmin) {
      handleRequireAuth();
      return;
    }
    setCalendarEvents((prev) =>
      prev.map((ev) => {
        if (ev.id !== id) return ev;
        const next = { ...ev, ...updates };
        void saveCalendarEventDoc(user.uid, next);
        return next;
      })
    );
  };

  const handleDeleteCalendarEvent = (id: string) => {
    if (!user || !isAdmin) {
      handleRequireAuth();
      return;
    }
    setCalendarEvents((prev) => prev.filter((ev) => ev.id !== id));
    void deleteCalendarEventDoc(user.uid, id);
  };

  // --- Learning Paths CRUD ---
  const handleAddLearningPath = (payload: Omit<LearningPath, 'id'>) => {
    if (!user || !isAdmin) {
      handleRequireAuth();
      return;
    }
    const newPath: LearningPath = {
      ...payload,
      id: `path-${Date.now()}-${Math.floor(Math.random() * 1000)}`,
    };
    setLearningPaths((prev) => [newPath, ...prev]);
    void saveLearningPathDoc(user.uid, newPath);
    recordHistory({
      actionType: 'course',
      title: `أنشأت مسار تعلّم: ${newPath.title}`,
      detail: newPath.categoryLabel,
      targetTab: 'paths',
    });
    recordActivityLog({
      entityType: 'learning_path',
      entityId: newPath.id,
      action: 'created',
      title: newPath.title,
      hubId: newPath.hubId,
      subtitle: newPath.categoryLabel,
    });
  };

  const handleUpdateLearningPath = (
    id: string,
    updates: Partial<LearningPath>
  ) => {
    if (!user || !isAdmin) {
      handleRequireAuth();
      return;
    }
    setLearningPaths((prev) =>
      prev.map((p) => {
        if (p.id !== id) return p;
        const next = { ...p, ...updates };
        void saveLearningPathDoc(user.uid, next);
        return next;
      })
    );
  };

  const handleDeleteLearningPath = (id: string) => {
    if (!user || !isAdmin) {
      handleRequireAuth();
      return;
    }
    setLearningPaths((prev) => prev.filter((p) => p.id !== id));
    void deleteLearningPathDoc(user.uid, id);
  };

  const handleTogglePathStage = (pathId: string, stageId: string) => {
    if (!user || !isAdmin) {
      handleRequireAuth();
      return;
    }
    const targetPath = learningPaths.find((p) => p.id === pathId);
    const targetStage = targetPath?.stages.find((s) => s.id === stageId);
    const willBeDone = targetStage ? !targetStage.done : false;

    setLearningPaths((prev) =>
      prev.map((p) => {
        if (p.id !== pathId) return p;
        const nextStages = p.stages.map((s) =>
          s.id === stageId ? { ...s, done: !s.done } : s
        );
        const doneCount = nextStages.filter((s) => s.done).length;
        const progressPct =
          nextStages.length > 0
            ? Math.round((doneCount / nextStages.length) * 100)
            : p.progressPct;
        const nextStatus: LearningPath['status'] =
          nextStages.length > 0 && doneCount === nextStages.length
            ? 'completed'
            : doneCount > 0
            ? 'in_progress'
            : p.status === 'completed'
            ? 'in_progress'
            : p.status;
        const next: LearningPath = {
          ...p,
          stages: nextStages,
          progressPct,
          status: nextStatus,
        };
        void saveLearningPathDoc(user.uid, next);
        return next;
      })
    );

    const canonicalProjectId = `path:${pathId}:${stageId}`;
    setUnifiedTasks((prev) =>
      prev.map((ut) => {
        if (ut.projectId !== canonicalProjectId) return ut;
        const nextStatus: UnifiedTask['status'] = willBeDone ? 'done' : 'todo';
        if (ut.status === nextStatus) return ut;
        const nextUt = { ...ut, status: nextStatus };
        void saveUnifiedTaskDoc(user.uid, nextUt);
        return nextUt;
      })
    );

    if (targetPath && targetStage && willBeDone) {
      recordHistory({
        actionType: 'task',
        title: `أنجزت مرحلة في مسار ${targetPath.title}: ${targetStage.title}`,
        detail: targetPath.categoryLabel,
        targetTab: 'paths',
      });
      recordActivityLog({
        entityType: 'learning_path',
        entityId: targetPath.id,
        action: 'completed',
        title: `${targetPath.title} — ${targetStage.title}`,
        hubId: targetPath.hubId,
      });
    }
  };

  // --- Reading Library CRUD ---
  const handleAddReadingItem = (payload: Omit<ReadingLibraryItem, 'id'>) => {
    if (!user || !isAdmin) {
      handleRequireAuth();
      return;
    }
    const newItem: ReadingLibraryItem = {
      ...payload,
      id: `lib-${Date.now()}-${Math.floor(Math.random() * 1000)}`,
    };
    setReadingItems((prev) => [newItem, ...prev]);
    void saveReadingItemDoc(user.uid, newItem);
    recordHistory({
      actionType: 'note',
      title: `أضفت إلى المكتبة: ${newItem.title}`,
      detail: newItem.categoryLabel,
      targetTab: 'library',
    });
    recordActivityLog({
      entityType: 'reading_item',
      entityId: newItem.id,
      action: 'created',
      title: newItem.title,
      hubId: newItem.hubId,
      subtitle: newItem.categoryLabel,
    });
  };

  const handleUpdateReadingItem = (
    id: string,
    updates: Partial<ReadingLibraryItem>
  ) => {
    if (!user || !isAdmin) {
      handleRequireAuth();
      return;
    }
    setReadingItems((prev) =>
      prev.map((item) => {
        if (item.id !== id) return item;
        const next = { ...item, ...updates };
        void saveReadingItemDoc(user.uid, next);
        if (
          updates.status === 'completed' ||
          updates.currentPage !== undefined ||
          updates.reviewCount !== undefined
        ) {
          recordActivityLog({
            entityType: 'reading_item',
            entityId: item.id,
            action: updates.status === 'completed' ? 'completed' : 'studied',
            title: next.title,
            hubId: next.hubId,
          });
        }
        return next;
      })
    );
  };

  const handleDeleteReadingItem = (id: string) => {
    if (!user || !isAdmin) {
      handleRequireAuth();
      return;
    }
    const existing = readingItems.find((item) => item.id === id);
    if (existing?.attachmentResourceId || existing?.storagePath) {
      void deleteCloudAttachment(
        user.uid,
        existing.attachmentResourceId,
        existing.storagePath
      );
    }
    setReadingItems((prev) => prev.filter((item) => item.id !== id));
    void deleteReadingItemDoc(user.uid, id);
  };

  // --- Practical Projects CRUD ---
  const handleAddProject = (payload: Omit<PracticalProject, 'id'>) => {
    if (!user || !isAdmin) {
      handleRequireAuth();
      return;
    }
    const newProj: PracticalProject = {
      ...payload,
      id: `proj-${Date.now()}-${Math.floor(Math.random() * 1000)}`,
    };
    setProjects((prev) => [newProj, ...prev]);
    void savePracticalProjectDoc(user.uid, newProj);
    recordHistory({
      actionType: 'task',
      title: `أضفت مشروعًا عمليًا: ${newProj.title}`,
      detail: newProj.categoryLabel,
      targetTab: 'tasks',
    });
    recordActivityLog({
      entityType: 'project',
      entityId: newProj.id,
      action: 'created',
      title: newProj.title,
      hubId: newProj.hubId,
      subtitle: newProj.categoryLabel,
    });
  };

  const handleUpdateProject = (
    id: string,
    updates: Partial<PracticalProject>
  ) => {
    if (!user || !isAdmin) {
      handleRequireAuth();
      return;
    }
    setProjects((prev) =>
      prev.map((p) => {
        if (p.id !== id) return p;
        const next = { ...p, ...updates };
        void savePracticalProjectDoc(user.uid, next);
        if (updates.status && updates.status !== p.status) {
          recordActivityLog({
            entityType: 'project',
            entityId: p.id,
            action: updates.status === 'completed' ? 'completed' : 'updated',
            title: next.title,
            hubId: next.hubId,
          });
        }
        return next;
      })
    );
  };

  const handleDeleteProject = (id: string) => {
    if (!user || !isAdmin) {
      handleRequireAuth();
      return;
    }
    setProjects((prev) => prev.filter((p) => p.id !== id));
    void deletePracticalProjectDoc(user.uid, id);
  };

  // --- Unified Tasks CRUD ---
  const handleAddUnifiedTask = (payload: Omit<UnifiedTask, 'id'>): string | undefined => {
    if (!user || !isAdmin) {
      handleRequireAuth();
      return undefined;
    }
    const newTask: UnifiedTask = {
      ...payload,
      id: `utask-${Date.now()}-${Math.floor(Math.random() * 1000)}`,
    };
    setUnifiedTasks((prev) => [newTask, ...prev]);
    void saveUnifiedTaskDoc(user.uid, newTask);
    recordHistory({
      actionType: 'task',
      title: `أضفت مهمة جديدة: ${newTask.title}`,
      detail: newTask.categoryLabel,
      targetTab: 'tasks',
    });
    recordActivityLog({
      entityType: 'task',
      entityId: newTask.id,
      action: 'created',
      title: newTask.title,
      hubId: newTask.hubId,
    });
    return newTask.id;
  };

  const handleUpdateUnifiedTask = (
    id: string,
    updates: Partial<UnifiedTask>
  ) => {
    if (!user || !isAdmin) {
      handleRequireAuth();
      return;
    }
    const existingTask = unifiedTasks.find((t) => t.id === id);

    setUnifiedTasks((prev) =>
      prev.map((t) => {
        if (t.id !== id) return t;
        const next = { ...t, ...updates };
        void saveUnifiedTaskDoc(user.uid, next);
        return next;
      })
    );

    if (existingTask && updates.status && updates.status !== existingTask.status) {
      recordActivityLog({
        entityType: 'task',
        entityId: existingTask.id,
        action:
          updates.status === 'done'
            ? 'completed'
            : updates.status === 'postponed'
            ? 'postponed'
            : 'updated',
        title: updates.title ?? existingTask.title,
        hubId: updates.hubId ?? existingTask.hubId,
      });
    }

    // Bidirectional status sync back to Course Task / Path Stage / Month Task
    const canonicalProjectId = updates.projectId ?? existingTask?.projectId;
    if (updates.status !== undefined && canonicalProjectId) {
      const isDone = updates.status === 'done';
      const parts = canonicalProjectId.split(':');
      if (parts[0] === 'course' && parts.length >= 3) {
        const courseId = Number(parts[1]);
        const cTaskId = parts.slice(2).join(':');
        setCourses((prev) =>
          prev.map((c) => {
            if (c.id !== courseId) return c;
            const target = c.tasks.find((ct) => ct.id === cTaskId);
            if (!target || target.done === isDone) return c;
            const nextTasks = c.tasks.map((ct) =>
              ct.id === cTaskId ? { ...ct, done: isDone } : ct
            );
            const doneCount = nextTasks.filter((ct) => ct.done).length;
            const progressPct =
              nextTasks.length > 0
                ? Math.round((doneCount / nextTasks.length) * 100)
                : c.progressPct;
            const nextCourse = { ...c, tasks: nextTasks, progressPct };
            syncCourse(nextCourse);
            return nextCourse;
          })
        );
      } else if (parts[0] === 'path' && parts.length >= 3) {
        const pathId = parts[1];
        const stageId = parts.slice(2).join(':');
        setLearningPaths((prev) =>
          prev.map((p) => {
            if (p.id !== pathId) return p;
            const target = p.stages.find((s) => s.id === stageId);
            if (!target || target.done === isDone) return p;
            const nextStages = p.stages.map((s) =>
              s.id === stageId ? { ...s, done: isDone } : s
            );
            const doneCount = nextStages.filter((s) => s.done).length;
            const progressPct =
              nextStages.length > 0
                ? Math.round((doneCount / nextStages.length) * 100)
                : p.progressPct;
            const nextStatus: LearningPath['status'] =
              nextStages.length > 0 && doneCount === nextStages.length
                ? 'completed'
                : doneCount > 0
                ? 'in_progress'
                : p.status === 'completed'
                ? 'in_progress'
                : p.status;
            const nextPath = {
              ...p,
              stages: nextStages,
              progressPct,
              status: nextStatus,
            };
            void saveLearningPathDoc(user.uid, nextPath);
            return nextPath;
          })
        );
      } else if (parts[0] === 'month' && parts.length >= 3) {
        const monthId = Number(parts[1]);
        const mTaskId = parts.slice(2).join(':');
        setMonths((prev) =>
          prev.map((m) => {
            if (m.id !== monthId) return m;
            const target = m.tasks.find((mt) => mt.id === mTaskId);
            if (!target || target.done === isDone) return m;
            const nextMonth = {
              ...m,
              tasks: m.tasks.map((mt) =>
                mt.id === mTaskId ? { ...mt, done: isDone } : mt
              ),
            };
            syncMonth(nextMonth);
            return nextMonth;
          })
        );
      }
    }
  };

  const handleDeleteUnifiedTask = (id: string) => {
    if (!user || !isAdmin) {
      handleRequireAuth();
      return;
    }
    setUnifiedTasks((prev) => prev.filter((t) => t.id !== id));
    void deleteUnifiedTaskDoc(user.uid, id);
  };

  // --- Dental Cases CRUD ---
  const handleAddDentalCase = (
    payload: Omit<DentalCase, 'id'>
  ): string | undefined => {
    if (!user || !isAdmin) {
      handleRequireAuth();
      return undefined;
    }
    const newId = `case-${Date.now()}-${Math.floor(Math.random() * 1000)}`;
    const newCase: DentalCase = {
      ...payload,
      id: newId,
      updatedAtLabel: formatArabicDate(),
    };
    setDentalCases((prev) => [newCase, ...prev]);
    void saveDentalCaseDoc(user.uid, newCase);
    recordHistory({
      actionType: 'course',
      title: `أضفت حالة أسنان: ${newCase.title}`,
      detail: newCase.specialty || 'ملف حالات الدنتال',
      targetTab: 'courses',
    });
    return newId;
  };

  const handleUpdateDentalCase = (
    id: string,
    updates: Partial<DentalCase>
  ) => {
    if (!user || !isAdmin) {
      handleRequireAuth();
      return;
    }
    setDentalCases((prev) =>
      prev.map((dc) => {
        if (dc.id !== id) return dc;
        const next: DentalCase = {
          ...dc,
          ...updates,
          updatedAtLabel: formatArabicDate(),
        };
        void saveDentalCaseDoc(user.uid, next);
        return next;
      })
    );
  };

  const handleDeleteDentalCase = (id: string) => {
    if (!user || !isAdmin) {
      handleRequireAuth();
      return;
    }
    const target = dentalCases.find((dc) => dc.id === id);
    setDentalCases((prev) => prev.filter((dc) => dc.id !== id));
    if (target?.coverStoragePath) {
      void deleteDentalCaseCoverStorage(target.coverStoragePath);
    }
    void deleteDentalCaseDoc(user.uid, id);
  };

  // --- Weekly Meetings CRUD ---
  const handleAddWeeklyMeeting = (payload: Omit<WeeklyMeeting, 'id'>) => {
    if (!user || !isAdmin) {
      handleRequireAuth();
      return;
    }
    const newMtg: WeeklyMeeting = {
      ...payload,
      id: `mtg-${Date.now()}-${Math.floor(Math.random() * 1000)}`,
    };
    setWeeklyMeetings((prev) => [...prev, newMtg]);
    void saveWeeklyMeetingDoc(user.uid, newMtg);
    recordHistory({
      actionType: 'task',
      title: `أضفت لقاءً أسبوعيًا: ${newMtg.title}`,
      detail: `${newMtg.startTime} · ${newMtg.isRecurringWeekly ? 'متكرر أسبوعيًا' : 'مرة واحدة'}`,
      targetTab: 'calendar',
    });
  };

  const handleUpdateWeeklyMeeting = (
    id: string,
    updates: Partial<WeeklyMeeting>
  ) => {
    if (!user || !isAdmin) {
      handleRequireAuth();
      return;
    }
    setWeeklyMeetings((prev) =>
      prev.map((m) => {
        if (m.id !== id) return m;
        const next = { ...m, ...updates };
        void saveWeeklyMeetingDoc(user.uid, next);
        return next;
      })
    );
  };

  const handleDeleteWeeklyMeeting = (id: string) => {
    if (!user || !isAdmin) {
      handleRequireAuth();
      return;
    }
    setWeeklyMeetings((prev) => prev.filter((m) => m.id !== id));
    void deleteWeeklyMeetingDoc(user.uid, id);
  };

  // --- Daily Journals, Weekly Plans, Periodic Reviews & Saved Pin Collections ---
  const handleSaveDailyJournal = (rec: DailyJournalRecord) => {
    if (!user || !isAdmin) {
      handleRequireAuth();
      return;
    }
    setDailyJournals((prev) => {
      const rest = prev.filter((j) => j.dateKey !== rec.dateKey);
      return [rec, ...rest].sort((a, b) => b.dateKey.localeCompare(a.dateKey));
    });
    void saveDailyJournalDoc(user.uid, rec);
  };

  const handleSavePeriodReview = (rev: PeriodReviewRecord) => {
    if (!user || !isAdmin) {
      handleRequireAuth();
      return;
    }
    setPeriodReviews((prev) => {
      const rest = prev.filter((r) => r.id !== rev.id);
      return [rev, ...rest].sort((a, b) =>
        b.periodStartKey.localeCompare(a.periodStartKey)
      );
    });
    void savePeriodReviewDoc(user.uid, rev);
  };

  const handleSaveWeeklyPlan = (plan: WeeklyPlanRecord) => {
    if (!user || !isAdmin) {
      handleRequireAuth();
      return;
    }
    setWeeklyPlans((prev) => {
      const rest = prev.filter((p) => p.weekKey !== plan.weekKey);
      return [plan, ...rest].sort((a, b) =>
        b.weekStartKey.localeCompare(a.weekStartKey)
      );
    });
    void saveWeeklyPlanDoc(user.uid, plan);
  };

  const handleSavePinCollection = (col: PinCollection) => {
    if (!user || !isAdmin) {
      handleRequireAuth();
      return;
    }
    setPinCollections((prev) => {
      const exists = prev.some((c) => c.id === col.id);
      return exists
        ? prev.map((c) => (c.id === col.id ? col : c))
        : [...prev, col];
    });
    void savePinCollectionDoc(user.uid, col);
  };

  const handleDeletePinCollection = (colId: string) => {
    if (!user || !isAdmin) {
      handleRequireAuth();
      return;
    }
    setPinCollections((prev) => prev.filter((c) => c.id !== colId));
    if (preferences.activeFocusPinCollectionId === colId) {
      handleUpdatePreferences({ activeFocusPinCollectionId: undefined });
    }
    void deletePinCollectionDoc(user.uid, colId);
  };

  const handleTogglePinEntity = (
    collectionId: string,
    entityType: PinEntityType,
    entityId: string
  ) => {
    if (!user || !isAdmin) {
      handleRequireAuth();
      return;
    }
    const now = Date.now();
    setPinCollections((prev) =>
      prev.map((col) => {
        if (col.id !== collectionId) return col;
        const exists = col.items.some(
          (it) => it.entityType === entityType && it.entityId === entityId
        );
        const nextItems = exists
          ? col.items.filter(
              (it) => !(it.entityType === entityType && it.entityId === entityId)
            )
          : [...col.items, { entityType, entityId, addedAtMs: now }];
        const nextCol: PinCollection = {
          ...col,
          items: nextItems,
          updatedAtMs: now,
        };
        void savePinCollectionDoc(user.uid, nextCol);
        return nextCol;
      })
    );
  };

  const handleQuickCreatePinCollection = (
    title: string,
    entityType: PinEntityType,
    entityId: string
  ) => {
    if (!user || !isAdmin) {
      handleRequireAuth();
      return;
    }
    const now = Date.now();
    const nextCol: PinCollection = {
      id: `pin_${now}_${Math.floor(Math.random() * 1000)}`,
      title: title.trim(),
      colorKey: 'navy',
      items: [{ entityType, entityId, addedAtMs: now }],
      sortOrder: pinCollections.length,
      createdAtMs: now,
      updatedAtMs: now,
    };
    setPinCollections((prev) => [...prev, nextCol]);
    void savePinCollectionDoc(user.uid, nextCol);
  };

  const handleSelectFocusPinCollection = (id: string | null) => {
    if (!user || !isAdmin) {
      handleRequireAuth();
      return;
    }
    handleUpdatePreferences({ activeFocusPinCollectionId: id ?? undefined });
  };

  const handleJournalOpenEntity = (action: JournalNavAction) => {
    switch (action.type) {
      case 'course':
        navigateToCourseRoute(action.courseId);
        break;
      case 'note':
        handleOpenNoteById(action.noteId, false);
        break;
      case 'task': {
        const targetTask = unifiedTasks.find((t) => t.id === action.taskId);
        if (targetTask) {
          setQuickTaskModal({ open: true, task: targetTask });
        } else {
          navigateToTab('tasks');
        }
        break;
      }
      case 'project':
        navigateToTab('tasks');
        break;
      case 'path':
        navigateToTab('paths');
        break;
      case 'book':
        navigateToTab('library');
        break;
      case 'reflection':
        navigateToTab('reflections');
        break;
      case 'blog':
        navigateToTab('blogs');
        break;
      case 'calendar':
        navigateToTab('calendar');
        break;
      case 'month':
        handleJumpToMonth(action.monthId);
        break;
    }
  };

  const analyticsInput: WorkspaceAnalyticsInput = {
    courses,
    bookNotes,
    reflections,
    blogPosts,
    unifiedTasks,
    projects,
    learningPaths,
    readingItems,
    calendarEvents,
    weeklyMeetings,
    dentalCases,
    months,
    activityLogs,
    hubs: resolveLearningHubs(preferences.customHubs),
  };

  const handleResetPlan = () => {
    if (!user || !isAdmin) {
      handleRequireAuth();
      return;
    }
    resetToDefaultView();
    // Sync defaults back to user's private workspace
    for (const q of INITIAL_QUARTERS) void saveQuarterDoc(user.uid, q);
    for (const m of INITIAL_MONTHS) void saveMonthDoc(user.uid, m);
    DOMAINS.forEach((d, idx) => void saveDomainDoc(user.uid, d, idx));
    for (const c of INITIAL_COURSES) void saveCourseDoc(user.uid, c);
    for (const bn of INITIAL_BOOK_NOTES) void saveBookNoteDoc(user.uid, bn);
    for (const cat of INITIAL_CUSTOM_CATEGORIES) {
      void saveCustomCategoryDoc(user.uid, cat);
    }
    void saveUserPreferencesDoc(user.uid, DEFAULT_USER_PREFERENCES);
  };

  return (
    <div className="min-h-screen flex flex-col bg-[#F7F8FA] text-slate-900">
      <Header
        activeTab={isAdmin && !isPreviewingPublic ? activeTab : 'public'}
        onSelectTab={(tab) => {
          if (tab === 'public') {
            setIsPreviewingPublic(true);
            setPublicPage('home');
            void refreshPublicCatalog();
            navigateToTab('public', false);
          } else {
            setIsPreviewingPublic(false);
            navigateToTab(tab);
          }
        }}
        user={user}
        authReady={authReady}
        isAdmin={isAdmin}
        isPreviewingPublic={isPreviewingPublic}
        onTogglePreviewPublic={() => {
          const next = !isPreviewingPublic;
          setIsPreviewingPublic(next);
          if (next) {
            setPublicPage('home');
            void refreshPublicCatalog();
            navigateToTab('public', false);
          } else {
            navigateToTab('overview', false);
          }
        }}
        syncingCloud={syncingCloud}
        onGoogleSignIn={handleGoogleSignIn}
        onSignOut={handleSignOut}
        focusCoursesCount={
          courses.filter((c) => resolveCourseStudyStage(c) === 'focus_now')
            .length
        }
        monthsCount={months.length}
        domainsCount={domains.length}
        coursesCount={courses.length}
        pathsCount={learningPaths.length}
        libraryCount={readingItems.length}
        tasksCount={unifiedTasks.length}
        notesCount={bookNotes.length}
        reflectionsCount={reflections.length}
        blogsCount={blogPosts.length}
        pinnedNavTabs={preferences.pinnedNavTabs}
        publicPage={publicPage}
        onSelectPublicPage={(page) => {
          setPublicPage(page);
          if (isAdmin && !isPreviewingPublic && activeTab !== 'public') {
            setIsPreviewingPublic(true);
            void refreshPublicCatalog();
            setActiveTab('public');
          }
          syncLocationHash('public', null, null, page);
          safeScrollToTop();
        }}
        showPublicReflections={
          publicSiteConfig.visibilityFlags?.showReflections !== false
        }
        showPublicBlogs={
          publicSiteConfig.visibilityFlags?.showBlogs !== false
        }
        canGoBack={backStack.length > 0 || selectedCourseId !== null}
        canGoForward={forwardStack.length > 0}
        backLabel={
          backStack.length > 0
            ? backStack[backStack.length - 1].label
            : selectedCourseId !== null
            ? 'قائمة الكورسات'
            : undefined
        }
        forwardLabel={
          forwardStack.length > 0
            ? forwardStack[forwardStack.length - 1].label
            : undefined
        }
        onGoBack={handleGoBack}
        onGoForward={handleGoForward}
      />

      {/* Auth Prompt Notice when a read-only trigger is fired */}
      {authReady && authPromptNotice && isAdmin && (
        <div className="max-w-[1280px] w-full mx-auto px-4 sm:px-8 pt-4">
          <div className="flex items-center justify-between gap-3 px-4 py-3 bg-white border border-slate-200 rounded-xl text-xs text-slate-700">
            <div className="flex items-center gap-2">
              <Lock className="w-4 h-4 text-[#1E3A5F] shrink-0" aria-hidden="true" />
              <span>{authPromptNotice}</span>
            </div>
            <button
              type="button"
              onClick={() => setAuthPromptNotice(null)}
              className="text-xs font-medium text-[#1E3A5F] hover:underline cursor-pointer"
            >
              إغلاق
            </button>
          </div>
        </div>
      )}

      {authError && (
        <div className="max-w-[1280px] w-full mx-auto px-4 sm:px-8 pt-4">
          <div className="flex items-center justify-between gap-3 px-4 py-3 bg-red-50 border border-red-200 rounded-lg text-xs text-red-800">
            <span>{authError}</span>
            <button
              type="button"
              onClick={() => setAuthError(null)}
              className="font-medium hover:underline cursor-pointer"
            >
              إغلاق
            </button>
          </div>
        </div>
      )}

      {exportNotice && (
        <div
          role="status"
          aria-live="polite"
          className="max-w-[1280px] w-full mx-auto px-4 sm:px-8 pt-4"
        >
          <div className="flex items-center justify-between gap-3 px-4 py-3 bg-emerald-50 border border-emerald-200 rounded-lg text-xs sm:text-sm text-emerald-900">
            <div className="flex items-center gap-2">
              <CheckCircle2
                className="w-4 h-4 text-emerald-700 shrink-0"
                aria-hidden="true"
              />
              <span>{exportNotice}</span>
            </div>
            <button
              type="button"
              onClick={() => setExportNotice(null)}
              className="text-xs font-medium text-emerald-800 hover:underline cursor-pointer"
            >
              إغلاق
            </button>
          </div>
        </div>
      )}

      <main className="flex-1 max-w-[1280px] w-full mx-auto px-3 sm:px-8 py-5 sm:py-8 pb-24 lg:pb-10 overflow-x-hidden">

        <ErrorBoundary
          inline
          key={`${activeTab}-${selectedCourseId ?? ''}`}
          fallbackTitle="تعذّر عرض هذه الصفحة مؤقتًا"
          onReset={() =>
            navigateToTab(isAdmin && !isPreviewingPublic ? 'overview' : 'public', false)
          }
        >
        {(!isAdmin || isPreviewingPublic || activeTab === 'public') ? (
          <PublicHomeView
            siteConfig={publicSiteConfig}
            publicPage={publicPage}
            onChangePublicPage={(page) => {
              setPublicPage(page);
              syncLocationHash('public', null, null, page);
              safeScrollToTop();
            }}
            publicCourses={
              isAdmin && isPreviewingPublic
                ? courses.filter((c) => c.isPublic)
                : publicCatalog.courses
            }
            publicPaths={
              isAdmin && isPreviewingPublic
                ? learningPaths.filter((p) => p.isPublic)
                : publicCatalog.learningPaths
            }
            publicBooks={
              isAdmin && isPreviewingPublic
                ? readingItems.filter((b) => b.isPublic)
                : publicCatalog.readingItems
            }
            publicReflections={
              isAdmin && isPreviewingPublic
                ? reflections.filter(
                    (r) =>
                      Boolean(r.isPublic) ||
                      (Boolean(r.categoryTag) &&
                        (
                          publicSiteConfig.publicReflectionCategories ?? []
                        ).includes(r.categoryTag!))
                  )
                : publicCatalog.reflections
            }
            publicBlogs={
              isAdmin && isPreviewingPublic
                ? blogPosts.filter((b) => b.isPublic)
                : publicCatalog.blogPosts
            }
            grantedWorkspace={isAdmin ? null : grantedWorkspace}
            loadingGranted={loadingGranted}
            loadingCatalog={loadingPublicCatalog}
            user={user}
            isAdmin={isAdmin}
            userProfile={userProfile}
            authError={authError}
            onGoogleSignIn={handleGoogleSignIn}
            onSignOut={handleSignOut}
            onReturnToAdmin={
              isAdmin
                ? () => {
                    setIsPreviewingPublic(false);
                    navigateToTab('overview', false);
                  }
                : undefined
            }
            onOpenPdf={setActivePdfTarget}
            onAddGrantedItemNote={
              user && !isAdmin
                ? async (targetType: GrantedItemNote['targetType'], targetId: string, content: string) => {
                    const ownerUid =
                      publicSiteConfig.ownerId ||
                      grantedWorkspace?.grants[0]?.ownerId ||
                      '';
                    if (!ownerUid) {
                      throw new Error('تعذر تحديد مالك المحتوى لحفظ الملاحظة.');
                    }
                    const saved = await addGrantedItemNote({
                      ownerId: ownerUid,
                      authorUid: user.uid,
                      authorEmail: user.email || '',
                      authorName:
                        user.displayName ||
                        userProfile?.display_name ||
                        user.email ||
                        'حساب مشارك',
                      targetType,
                      targetId,
                      content,
                      isAdminReply: false,
                      createdAtLabel: formatArabicDate(),
                      createdAtMs: Date.now(),
                    });
                    setGrantedWorkspace((prev) =>
                      prev
                        ? {
                            ...prev,
                            itemNotes: [saved, ...(prev.itemNotes ?? [])],
                          }
                        : prev
                    );
                  }
                : undefined
            }
            onDeleteGrantedItemNote={
              user && !isAdmin
                ? async (noteId: string) => {
                    await deleteGrantedItemNote(noteId);
                    setGrantedWorkspace((prev) =>
                      prev
                        ? {
                            ...prev,
                            itemNotes: (prev.itemNotes ?? []).filter(
                              (n) => n.id !== noteId
                            ),
                          }
                        : prev
                    );
                  }
                : undefined
            }
          />
        ) : (
          <>
        {activeTab === 'overview' && (
          <OverviewView
            user={user}
            canEdit={canEdit}
            onRequireAuth={handleRequireAuth}
            voiceDialect={preferences.voiceDialect}
            preferences={preferences}
            onUpdatePreferences={handleUpdatePreferences}
            quarters={quarters}
            months={months}
            domains={domains}
            courses={courses}
            bookNotes={bookNotes}
            learningPaths={learningPaths}
            readingItems={readingItems}
            projects={projects}
            unifiedTasks={unifiedTasks}
            dentalCases={dentalCases}
            customCategories={customCategories}
            history={history}
            reflections={reflections}
            calendarEvents={calendarEvents}
            weeklyMeetings={weeklyMeetings}
            cloudAttachments={cloudAttachments}
            onGoogleSignIn={handleGoogleSignIn}
            onNavigateTab={navigateToTab}
            onSelectHub={(hub, targetTab) => {
              setActiveHubFilter(hub);
              navigateToTab(targetTab);
            }}
            onSelectCourse={(courseId) => navigateToCourseRoute(courseId)}
            onJumpToMonth={handleJumpToMonth}
            onFilterByDomain={handleFilterByDomain}
            onOpenNoteById={handleOpenNoteById}
            onOpenDentalCases={handleOpenDentalCases}
            onOpenPdf={setActivePdfTarget}
            onAddUnifiedTask={handleAddUnifiedTask}
            onUpdateUnifiedTask={handleUpdateUnifiedTask}
            onDeleteUnifiedTask={handleDeleteUnifiedTask}
            onAddWeeklyMeeting={handleAddWeeklyMeeting}
            onUpdateWeeklyMeeting={handleUpdateWeeklyMeeting}
            onDeleteWeeklyMeeting={handleDeleteWeeklyMeeting}
            onAddCustomCategory={handleAddCustomCategory}
            onDeleteCustomCategory={handleDeleteCustomCategory}
            onDeleteHistoryEntry={handleDeleteHistoryEntry}
            onAddReflection={handleAddReflection}
            onUpdateReflection={handleUpdateReflection}
            onDeleteReflection={handleDeleteReflection}
            onPreviewPublicSite={() => {
              setIsPreviewingPublic(true);
              void refreshPublicCatalog();
              navigateToTab('public', false);
            }}
            onOpenPermissions={() => {
              setAccountInitialSubTab('users');
              navigateToTab('account');
            }}
            pinCollections={pinCollections}
            activeFocusPinCollectionId={preferences.activeFocusPinCollectionId ?? null}
            onSelectFocusPinCollection={handleSelectFocusPinCollection}
            onSavePinCollection={handleSavePinCollection}
            onDeletePinCollection={handleDeletePinCollection}
            weeklyPlans={weeklyPlans}
          />
        )}

        {activeTab === 'focus' && (
          <FocusView
            canEdit={canEdit}
            onRequireAuth={handleRequireAuth}
            courses={courses}
            dentalCases={dentalCases}
            unifiedTasks={unifiedTasks}
            onSelectCourse={(courseId) => navigateToCourseRoute(courseId)}
            onUpdateCourse={handleUpdateCourse}
            onUpdateUnifiedTask={handleUpdateUnifiedTask}
            onNavigateTab={navigateToTab}
            onOpenDentalCases={handleOpenDentalCases}
          />
        )}

        {activeTab === 'plan' && (
          <TwelveMonthPlanView
            uid={user?.uid}
            canEdit={canEdit}
            onRequireAuth={handleRequireAuth}
            voiceDialect={preferences.voiceDialect}
            quarters={quarters}
            months={months}
            domains={domains}
            courses={courses}
            selectedMonthId={selectedMonthId}
            domainFilter={domainFilter}
            onSelectMonth={setSelectedMonthId}
            onChangeDomainFilter={setDomainFilter}
            onOpenPdf={setActivePdfTarget}
            onAddQuarter={handleAddQuarter}
            onUpdateQuarter={handleUpdateQuarter}
            onDeleteQuarter={handleDeleteQuarter}
            onAddMonth={handleAddMonth}
            onUpdateMonth={handleUpdateMonth}
            onDeleteMonth={handleDeleteMonth}
            onUpdateMonthStatus={handleUpdateMonthStatus}
            onToggleActivity={handleToggleActivity}
            onUpdateMonthNotes={handleUpdateMonthNotes}
            onUpdateTrackItem={handleUpdateTrackItem}
            onToggleMonthTask={handleToggleMonthTask}
            onAddMonthTask={handleAddMonthTask}
            onDeleteMonthTask={handleDeleteMonthTask}
            onAddMonthResource={handleAddMonthResource}
            onUpdateMonthResource={handleUpdateMonthResource}
            onDeleteMonthResource={handleDeleteMonthResource}
            onOpenBookNote={handleAddOrOpenBookNote}
            customReadingModes={preferences.customReadingModes}
            onUpdateReadingModes={(nextModes) =>
              handleUpdatePreferences({ customReadingModes: nextModes })
            }
          />
        )}

        {activeTab === 'domains' && (
          <DomainsView
            canEdit={canEdit}
            domains={domains}
            months={months}
            onFilterMonthsByDomain={handleFilterByDomain}
            onAddDomain={handleAddDomain}
            onUpdateDomain={handleUpdateDomain}
            onDeleteDomain={handleDeleteDomain}
          />
        )}

        {activeTab === 'courses' && selectedCourseId !== null && (
          <CourseDetailPage
            uid={user?.uid}
            canEdit={canEdit}
            onRequireAuth={handleRequireAuth}
            course={courses.find((c) => c.id === selectedCourseId) ?? null}
            requestedCourseId={selectedCourseId}
            preferences={preferences}
            onUpdatePreferences={handleUpdatePreferences}
            hubCategories={preferences.hubCategories ?? DEFAULT_HUB_CATEGORIES}
            courseNotes={(() => {
              const target = courses.find((c) => c.id === selectedCourseId);
              if (!target) return [];
              return bookNotes.filter(
                (bn) =>
                  bn.courseId === target.id ||
                  (bn.noteType === 'course_lecture' &&
                    bn.courseTitle === target.title)
              );
            })()}
            linkedProjects={projects.filter(
              (p) => p.linkedCourseId === selectedCourseId
            )}
            linkedUnifiedTasks={(() => {
              const target = courses.find((c) => c.id === selectedCourseId);
              if (!target) return [];
              return unifiedTasks.filter(
                (t) =>
                  t.linkedCourseId === target.id ||
                  t.projectId === `course:${target.id}` ||
                  t.projectId?.startsWith(`course:${target.id}:`) ||
                  (t.linkedLabel &&
                    t.linkedLabel.trim().toLowerCase() ===
                      target.title.trim().toLowerCase())
              );
            })()}
            linkedPaths={learningPaths.filter((p) =>
              p.linkedCourseIds.includes(selectedCourseId)
            )}
            allCourses={courses}
            allLearningPaths={learningPaths}
            readingItems={readingItems}
            allProjects={projects}
            allMonths={months}
            onBack={handleGoBack}
            onOpenPdf={setActivePdfTarget}
            onUpdateCourse={handleUpdateCourse}
            onDeleteCourse={handleDeleteCourse}
            onToggleCourseTask={handleToggleCourseTask}
            onAddCourseTask={handleAddCourseTask}
            onDeleteCourseTask={handleDeleteCourseTask}
            onAddCourseResource={handleAddCourseResource}
            onUpdateCourseResource={handleUpdateCourseResource}
            onDeleteCourseResource={handleDeleteCourseResource}
            onJumpToMonth={handleJumpToMonth}
            onOpenPaths={() => navigateToTab('paths')}
            onOpenTasksTab={() => navigateToTab('tasks')}
            onOpenCalendar={() => navigateToTab('calendar')}
            onOpenNoteById={handleOpenNoteById}
            onAddStructuredNote={handleAddStructuredNote}
            onUpdateBookNote={handleUpdateBookNote}
            onDeleteBookNote={handleDeleteBookNote}
            onUpdateUnifiedTask={handleUpdateUnifiedTask}
            onAddUnifiedTask={handleAddUnifiedTask}
            onDeleteUnifiedTask={handleDeleteUnifiedTask}
            pinCollections={pinCollections}
            onTogglePinEntity={handleTogglePinEntity}
            onQuickCreatePinCollection={handleQuickCreatePinCollection}
          />
        )}

        {activeTab === 'courses' && selectedCourseId === null && (
          <CoursesView
            uid={user?.uid}
            canEdit={canEdit}
            onRequireAuth={handleRequireAuth}
            courses={courses}
            bookNotes={bookNotes}
            dentalCases={dentalCases}
            learningPaths={learningPaths}
            readingItems={readingItems}
            projects={projects}
            onSelectCourse={(courseId) => navigateToCourseRoute(courseId)}
            activeHubFilter={activeHubFilter}
            onChangeHubFilter={setActiveHubFilter}
            hubCategories={preferences.hubCategories ?? DEFAULT_HUB_CATEGORIES}
            activeSection={coursesSection}
            onChangeSection={setCoursesSection}
            onAddCourse={handleAddCourse}
            onUpdateCourse={handleUpdateCourse}
            onDeleteCourse={handleDeleteCourse}
            onOpenCourseNote={handleOpenCourseNote}
            onAddUnifiedTask={handleAddUnifiedTask}
            onAddDentalCase={handleAddDentalCase}
            onUpdateDentalCase={handleUpdateDentalCase}
            onDeleteDentalCase={handleDeleteDentalCase}
            pinCollections={pinCollections}
            activeFocusPinCollectionId={preferences.activeFocusPinCollectionId ?? null}
            onSelectFocusPinCollection={handleSelectFocusPinCollection}
            onSavePinCollection={handleSavePinCollection}
            onDeletePinCollection={handleDeletePinCollection}
            onTogglePinEntity={handleTogglePinEntity}
            onQuickCreatePinCollection={handleQuickCreatePinCollection}
          />
        )}

        {activeTab === 'paths' && (
          <PathsView
            canEdit={canEdit}
            onRequireAuth={handleRequireAuth}
            paths={learningPaths}
            courses={courses}
            readingItems={readingItems}
            projects={projects}
            unifiedTasks={unifiedTasks}
            hubCategories={preferences.hubCategories ?? DEFAULT_HUB_CATEGORIES}
            activeHubFilter={activeHubFilter}
            onChangeHubFilter={setActiveHubFilter}
            onAddPath={handleAddLearningPath}
            onUpdatePath={handleUpdateLearningPath}
            onDeletePath={handleDeleteLearningPath}
            onTogglePathStage={handleTogglePathStage}
            onAddUnifiedTask={handleAddUnifiedTask}
            onUpdateUnifiedTask={handleUpdateUnifiedTask}
            onDeleteUnifiedTask={handleDeleteUnifiedTask}
            onOpenCourse={(courseId) => navigateToCourseRoute(courseId)}
            onOpenCalendar={() => navigateToTab('calendar')}
            onOpenTasks={() => navigateToTab('tasks')}
            customReadingModes={preferences.customReadingModes}
            onUpdateReadingModes={(nextModes) =>
              handleUpdatePreferences({ customReadingModes: nextModes })
            }
            pinCollections={pinCollections}
            activeFocusPinCollectionId={preferences.activeFocusPinCollectionId ?? null}
            onSelectFocusPinCollection={handleSelectFocusPinCollection}
            onSavePinCollection={handleSavePinCollection}
            onDeletePinCollection={handleDeletePinCollection}
            onTogglePinEntity={handleTogglePinEntity}
            onQuickCreatePinCollection={handleQuickCreatePinCollection}
          />
        )}

        {activeTab === 'library' && (
          <LibraryView
            uid={user?.uid}
            canEdit={canEdit}
            onRequireAuth={handleRequireAuth}
            items={readingItems}
            cloudAttachments={cloudAttachments}
            courses={courses}
            learningPaths={learningPaths}
            projects={projects}
            unifiedTasks={unifiedTasks}
            months={months}
            hubCategories={preferences.hubCategories ?? DEFAULT_HUB_CATEGORIES}
            activeHubFilter={activeHubFilter}
            onChangeHubFilter={setActiveHubFilter}
            onAddItem={handleAddReadingItem}
            onUpdateItem={handleUpdateReadingItem}
            onDeleteItem={handleDeleteReadingItem}
            onAddUnifiedTask={handleAddUnifiedTask}
            onUpdateUnifiedTask={handleUpdateUnifiedTask}
            onDeleteUnifiedTask={handleDeleteUnifiedTask}
            onOpenCalendar={() => navigateToTab('calendar')}
            onOpenTasksTab={() => navigateToTab('tasks')}
            onOpenPdf={setActivePdfTarget}
            customReadingModes={preferences.customReadingModes}
            onUpdateReadingModes={(nextModes) =>
              handleUpdatePreferences({ customReadingModes: nextModes })
            }
          />
        )}

        {activeTab === 'tasks' && (
          <TasksProjectsView
            canEdit={canEdit}
            onRequireAuth={handleRequireAuth}
            unifiedTasks={unifiedTasks}
            projects={projects}
            months={months}
            courses={courses}
            learningPaths={learningPaths}
            readingItems={readingItems}
            hubCategories={preferences.hubCategories ?? DEFAULT_HUB_CATEGORIES}
            activeHubFilter={activeHubFilter}
            onChangeHubFilter={setActiveHubFilter}
            onAddUnifiedTask={handleAddUnifiedTask}
            onUpdateUnifiedTask={handleUpdateUnifiedTask}
            onDeleteUnifiedTask={handleDeleteUnifiedTask}
            onAddProject={handleAddProject}
            onUpdateProject={handleUpdateProject}
            onDeleteProject={handleDeleteProject}
            onToggleMonthTask={handleToggleMonthTask}
            onToggleCourseTask={handleToggleCourseTask}
            onTogglePathStage={handleTogglePathStage}
            onJumpToMonth={handleJumpToMonth}
            onOpenCourse={(courseId) => navigateToCourseRoute(courseId)}
            onOpenPath={() => navigateToTab('paths')}
            onOpenCalendar={() => navigateToTab('calendar')}
            statusOrder={preferences.taskStatusOrder}
            onChangeStatusOrder={(nextOrder) =>
              handleUpdatePreferences({ taskStatusOrder: nextOrder })
            }
            pinCollections={pinCollections}
            activeFocusPinCollectionId={preferences.activeFocusPinCollectionId ?? null}
            onSelectFocusPinCollection={handleSelectFocusPinCollection}
            onSavePinCollection={handleSavePinCollection}
            onDeletePinCollection={handleDeletePinCollection}
            onTogglePinEntity={handleTogglePinEntity}
            onQuickCreatePinCollection={handleQuickCreatePinCollection}
          />
        )}

        {activeTab === 'journal' && (
          <NotesJournalView
            uid={user?.uid}
            canEdit={canEdit}
            onRequireAuth={handleRequireAuth}
            preferences={preferences}
            onUpdatePreferences={handleUpdatePreferences}
            months={months}
            courses={courses}
            customCategories={customCategories}
            bookNotes={bookNotes}
            activeBookNoteId={activeBookNoteId}
            onSelectBookNote={(id) => {
              if (id) {
                handleOpenNoteById(id, false);
              } else {
                setActiveBookNoteId(null);
                setStudyModalState(null);
                syncLocationHash('journal', null, null);
              }
            }}
            onOpenFocusStudy={(noteId, startInEdit) =>
              handleOpenNoteById(noteId, Boolean(startInEdit))
            }
            activeHubFilter={activeHubFilter}
            onChangeHubFilter={setActiveHubFilter}
            hubCategories={preferences.hubCategories ?? DEFAULT_HUB_CATEGORIES}
            onOpenPdf={setActivePdfTarget}
            showExcelExport={preferences.showExcelExport !== false}
            onAddStructuredNote={handleAddStructuredNote}
            onUpdateBookNote={handleUpdateBookNote}
            onDeleteBookNote={handleDeleteBookNote}
            onUpdateMonthNotes={handleUpdateMonthNotes}
            onLogVoiceNote={(title) =>
              recordHistory({
                actionType: 'voice',
                title: `سجّلت ملاحظة صوتية في: ${title}`,
                detail: 'تفريغ صوتي مباشر باللغة العربية',
                targetTab: 'journal',
              })
            }
            onExportExcel={handleExportExcel}
            pinCollections={pinCollections}
            activeFocusPinCollectionId={preferences.activeFocusPinCollectionId ?? null}
            onSelectFocusPinCollection={handleSelectFocusPinCollection}
            onSavePinCollection={handleSavePinCollection}
            onDeletePinCollection={handleDeletePinCollection}
            onTogglePinEntity={handleTogglePinEntity}
            onQuickCreatePinCollection={handleQuickCreatePinCollection}
          />
        )}

        {activeTab === 'daily_journal' && (
          <DailyJournalView
            analyticsInput={analyticsInput}
            dailyJournals={dailyJournals}
            canEdit={canEdit}
            uid={user?.uid}
            preferences={preferences}
            onUpdatePreferences={handleUpdatePreferences}
            onRequireAuth={handleRequireAuth}
            onSaveDailyJournal={handleSaveDailyJournal}
            onOpenEntity={handleJournalOpenEntity}
            hubs={resolveLearningHubs(preferences.customHubs)}
          />
        )}

        {activeTab === 'weekly_plan' && (
          <WeeklyPlannerView
            unifiedTasks={unifiedTasks}
            courses={courses}
            weeklyPlans={weeklyPlans}
            hubs={resolveLearningHubs(preferences.customHubs)}
            canEdit={canEdit}
            onRequireAuth={handleRequireAuth}
            onSaveWeeklyPlan={handleSaveWeeklyPlan}
            onUpdateUnifiedTask={handleUpdateUnifiedTask}
            onAddUnifiedTask={(task) => handleAddUnifiedTask(task) || ''}
            onOpenTaskModal={(task) =>
              setQuickTaskModal({ open: true, task })
            }
          />
        )}

        {activeTab === 'reviews' && (
          <ReviewsView
            analyticsInput={analyticsInput}
            periodReviews={periodReviews}
            weeklyPlans={weeklyPlans}
            canEdit={canEdit}
            onRequireAuth={handleRequireAuth}
            onSavePeriodReview={handleSavePeriodReview}
            onOpenEntity={handleJournalOpenEntity}
          />
        )}

        {activeTab === 'reflections' && (
          <ReflectionsView
            uid={user?.uid}
            canEdit={canEdit}
            onRequireAuth={handleRequireAuth}
            reflections={reflections}
            reflectionCategories={preferences.reflectionCategories}
            publicReflectionCategories={
              publicSiteConfig.publicReflectionCategories ?? []
            }
            voiceDialect={preferences.voiceDialect}
            onAddReflection={handleAddReflection}
            onUpdateReflection={handleUpdateReflection}
            onDeleteReflection={handleDeleteReflection}
            onSaveCategories={(nextCats) =>
              handleUpdatePreferences({ reflectionCategories: nextCats })
            }
            onTogglePublicCategory={async (cat, makePublic) => {
              if (!user || !isAdmin) return;
              const prev = publicSiteConfig.publicReflectionCategories ?? [];
              const nextCats = makePublic
                ? Array.from(new Set([...prev, cat]))
                : prev.filter((c) => c !== cat);
              const nextCfg: PublicSiteConfig = {
                ...publicSiteConfig,
                publicReflectionCategories: nextCats,
                updatedAtMs: Date.now(),
              };
              setPublicSiteConfig(nextCfg);
              await savePublicSiteConfig(user.uid, nextCfg);
              void refreshPublicCatalog(nextCats);
            }}
          />
        )}

        {activeTab === 'blogs' && (
          <BlogsView
            uid={user?.uid}
            canEdit={canEdit}
            onRequireAuth={handleRequireAuth}
            posts={blogPosts}
            voiceDialect={preferences.voiceDialect}
            readAloudVoice={preferences.readAloudVoice}
            readAloudSpeed={preferences.readAloudSpeed}
            onAddPost={handleAddBlogPost}
            onUpdatePost={handleUpdateBlogPost}
            onDeletePost={handleDeleteBlogPost}
          />
        )}

        {activeTab === 'gallery' && (
          <PhotoGalleryView
            uid={user?.uid}
            canEdit={canEdit}
            onRequireAuth={handleRequireAuth}
            preferences={preferences}
            onUpdatePreferences={handleUpdatePreferences}
          />
        )}

        {activeTab === 'calendar' && (
          <CalendarView
            uid={user?.uid}
            canEdit={canEdit}
            onRequireAuth={handleRequireAuth}
            events={calendarEvents}
            months={months}
            courses={courses}
            learningPaths={learningPaths}
            readingItems={readingItems}
            unifiedTasks={unifiedTasks}
            projects={projects}
            weeklyMeetings={weeklyMeetings}
            preferences={preferences}
            onUpdatePreferences={handleUpdatePreferences}
            onAddEvent={handleAddCalendarEvent}
            onUpdateEvent={handleUpdateCalendarEvent}
            onDeleteEvent={handleDeleteCalendarEvent}
            onAddUnifiedTask={handleAddUnifiedTask}
            onUpdateUnifiedTask={handleUpdateUnifiedTask}
            onDeleteUnifiedTask={handleDeleteUnifiedTask}
            onUpdateWeeklyMeeting={handleUpdateWeeklyMeeting}
            onToggleCourseTask={handleToggleCourseTask}
            onTogglePathStage={handleTogglePathStage}
            onToggleMonthTask={handleToggleMonthTask}
            onJumpToMonth={handleJumpToMonth}
            onOpenMeetingsSection={() => {
              navigateToTab('account');
            }}
          />
        )}

        {activeTab === 'account' && (
          <AccountCenterView
            uid={user?.uid}
            canEdit={canEdit}
            onRequireAuth={handleRequireAuth}
            voiceDialect={preferences.voiceDialect}
            preferences={preferences}
            onUpdatePreferences={handleUpdatePreferences}
            onNavigateTab={navigateToTab}
            quarters={quarters}
            months={months}
            domains={domains}
            courses={courses}
            learningPaths={learningPaths}
            readingItems={readingItems}
            bookNotesCount={bookNotes.length}
            selectedMonthId={selectedMonthId}
            domainFilter={domainFilter}
            onSelectMonth={setSelectedMonthId}
            onChangeDomainFilter={setDomainFilter}
            onOpenPdf={setActivePdfTarget}
            onAddQuarter={handleAddQuarter}
            onUpdateQuarter={handleUpdateQuarter}
            onDeleteQuarter={handleDeleteQuarter}
            onAddMonth={handleAddMonth}
            onUpdateMonth={handleUpdateMonth}
            onDeleteMonth={handleDeleteMonth}
            onUpdateMonthStatus={handleUpdateMonthStatus}
            onToggleActivity={handleToggleActivity}
            onUpdateMonthNotes={handleUpdateMonthNotes}
            onUpdateTrackItem={handleUpdateTrackItem}
            onToggleMonthTask={handleToggleMonthTask}
            onAddMonthTask={handleAddMonthTask}
            onDeleteMonthTask={handleDeleteMonthTask}
            onAddMonthResource={handleAddMonthResource}
            onUpdateMonthResource={handleUpdateMonthResource}
            onDeleteMonthResource={handleDeleteMonthResource}
            onOpenBookNote={handleAddOrOpenBookNote}
            onLogMonthStudyMetric={(id, metric) => {
              const target = months.find((m) => m.id === id);
              if (!target) return;
              if (metric === 'review') {
                handleUpdateMonth(id, { reviewCount: (target.reviewCount ?? 0) + 1 });
              } else {
                handleUpdateMonth(id, { listenCount: (target.listenCount ?? 0) + 1 });
              }
            }}
            onAddDomain={handleAddDomain}
            onUpdateDomain={handleUpdateDomain}
            onDeleteDomain={handleDeleteDomain}
            weeklyMeetings={weeklyMeetings}
            onAddWeeklyMeeting={handleAddWeeklyMeeting}
            onUpdateWeeklyMeeting={handleUpdateWeeklyMeeting}
            onDeleteWeeklyMeeting={handleDeleteWeeklyMeeting}
            onAddUnifiedTask={(task) => handleAddUnifiedTask(task) || ''}
            onOpenCalendar={() => navigateToTab('calendar')}
            customCategories={customCategories}
            onAddCustomCategory={handleAddCustomCategory}
            onDeleteCustomCategory={handleDeleteCustomCategory}
            history={history}
            onClearHistory={handleClearHistory}
            onNavigateFromHistory={(entry) => {
              if (entry.targetNoteId) {
                handleOpenNoteById(entry.targetNoteId, false);
              } else if (entry.targetMonthId) {
                handleJumpToMonth(entry.targetMonthId);
              } else if (entry.targetTab) {
                navigateToTab(entry.targetTab as ActiveTab);
              }
            }}
            onResetWorkspace={handleResetPlan}
            onForceSync={() => {
              setSyncRefreshTick((t) => t + 1);
            }}
            publicSiteConfig={publicSiteConfig}
            onSavePublicSiteConfig={async (nextCfg) => {
              if (!user || !isAdmin) return;
              await savePublicSiteConfig(user.uid, nextCfg);
              setPublicSiteConfig(nextCfg);
              void refreshPublicCatalog(
                nextCfg.publicReflectionCategories ?? []
              );
            }}
            onToggleCoursePublic={(docId, isPub) => {
              const target = courses.find((c) => c.docId === docId);
              if (target) handleUpdateCourse(target.id, { isPublic: isPub });
            }}
            onTogglePathPublic={(pathId, isPub) => {
              handleUpdateLearningPath(pathId, { isPublic: isPub });
            }}
            onToggleBookPublic={(bookId, isPub) => {
              handleUpdateReadingItem(bookId, { isPublic: isPub });
            }}
            onPreviewPublicSite={() => {
              setIsPreviewingPublic(true);
              setPublicPage('home');
              void refreshPublicCatalog();
              navigateToTab('public', false);
            }}
            bookNotesForExcel={bookNotes}
            bookNotes={bookNotes}
            reflections={reflections}
            reflectionCategories={preferences.reflectionCategories}
            onToggleReflectionPublic={(id, isPub) => {
              handleUpdateReflection(id, { isPublic: isPub });
            }}
            blogPosts={blogPosts}
            onToggleBlogPublic={(id, isPub) => {
              handleUpdateBlogPost(id, { isPublic: isPub });
            }}
            customReadingModes={preferences.customReadingModes}
            onUpdateReadingModes={(nextModes) =>
              handleUpdatePreferences({ customReadingModes: nextModes })
            }
            initialSubTab={accountInitialSubTab}
            onConsumeInitialSubTab={() => setAccountInitialSubTab(undefined)}
          />
        )}
          </>
        )}
        </ErrorBoundary>
      </main>

      <SiteFooter
        siteConfig={publicSiteConfig}
        isAdmin={isAdmin}
        canEdit={canEdit}
        showExcelExport={preferences.showExcelExport !== false}
        onExportExcel={handleExportExcel}
        onOpenContact={() => {
          setIsPreviewingPublic(true);
          setPublicPage('home');
          void refreshPublicCatalog();
          navigateToTab('public', false);
          window.setTimeout(() => {
            document
              .getElementById('contact-us-section')
              ?.scrollIntoView({ behavior: 'smooth', block: 'start' });
          }, 120);
        }}
        onOpenPublicPreview={() => {
          setIsPreviewingPublic(true);
          setPublicPage('home');
          void refreshPublicCatalog();
          navigateToTab('public', false);
        }}
        onRequestReset={() => setConfirmResetOpen(true)}
      />

      <TaskFormModal
        open={quickTaskModal.open}
        onClose={() => setQuickTaskModal({ open: false, task: null })}
        initialTask={quickTaskModal.task}
        courses={courses}
        learningPaths={learningPaths}
        readingItems={readingItems}
        projects={projects}
        hubCategories={preferences.hubCategories ?? DEFAULT_HUB_CATEGORIES}
        onSubmit={(payload, existingId) => {
          if (existingId) {
            handleUpdateUnifiedTask(existingId, payload);
          } else {
            handleAddUnifiedTask(payload);
          }
        }}
        onDelete={handleDeleteUnifiedTask}
      />

      <ConfirmDialog
        open={confirmResetOpen}
        title="استعادة الخطة الافتراضية"
        message="سيتم إعادة ضبط خطة الـ 12 شهرًا والمحاور الافتراضية دون حذف خواطرك أو مساراتك الإضافية. هل تريد المتابعة؟"
        confirmLabel="استعادة الافتراضي"
        destructive={false}
        onCancel={() => setConfirmResetOpen(false)}
        onConfirm={() => {
          setConfirmResetOpen(false);
          handleResetPlan();
        }}
      />

      {studyModalState && (
        <ErrorBoundary inline onReset={() => setStudyModalState(null)}>
          <FocusNoteStudyModal
            note={
              bookNotes.find((bn) => bn.id === studyModalState.noteId) ?? null
            }
            startInEdit={studyModalState.startInEdit}
            uid={user?.uid}
            canEdit={canEdit}
            preferences={preferences}
            months={months}
            courses={courses}
            customCategories={customCategories}
            hubCategories={preferences.hubCategories ?? DEFAULT_HUB_CATEGORIES}
            showExcelExport={preferences.showExcelExport !== false}
            onClose={() => {
              setStudyModalState(null);
              setActiveBookNoteId(null);
              if (
                typeof window !== 'undefined' &&
                window.location.hash.startsWith('#/journal/')
              ) {
                syncLocationHash(activeTab, selectedCourseId, null);
              }
            }}
            onRequireAuth={handleRequireAuth}
            onUpdatePreferences={handleUpdatePreferences}
            onUpdateBookNote={handleUpdateBookNote}
            onDeleteBookNote={handleDeleteBookNote}
            onOpenPdf={setActivePdfTarget}
            onLogVoiceNote={(title) =>
              recordHistory({
                actionType: 'voice',
                title: `سجّلت ملاحظة صوتية في: ${title}`,
                detail: 'تفريغ صوتي مباشر باللغة العربية',
                targetTab: 'journal',
              })
            }
          />
        </ErrorBoundary>
      )}

      {activePdfTarget && (
        <ErrorBoundary inline onReset={() => setActivePdfTarget(null)}>
          <Suspense fallback={null}>
            <PDFViewerModal
              uid={user?.uid}
              target={activePdfTarget}
              onClose={() => setActivePdfTarget(null)}
            />
          </Suspense>
        </ErrorBoundary>
      )}

      <OfflineIndicator />

      {/* Mobile-First Thumb-Friendly Bottom Navigation Bar (Admin Workspace Only) */}
      {isAdmin && !isPreviewingPublic && (
        <nav
          aria-label="التنقل السريع على الهاتف"
          className="lg:hidden fixed bottom-0 inset-x-0 z-30 bg-white/95 backdrop-blur-md border-t border-slate-200 mobile-safe-bottom"
        >
          <div className="grid grid-cols-5 max-w-lg mx-auto">
            {(
              [
                { id: 'overview', label: 'الرئيسية', icon: LayoutDashboard },
                { id: 'focus', label: 'التركيز', icon: Target },
                { id: 'courses', label: 'الكورسات', icon: GraduationCap },
                { id: 'journal', label: 'التلخيص', icon: NotebookPen },
                { id: 'calendar', label: 'التقويم', icon: CalendarDays },
              ] as const
            ).map((item) => {
              const Icon = item.icon;
              const active = activeTab === item.id;
              return (
                <button
                  key={item.id}
                  type="button"
                  onClick={() => {
                    navigateToTab(item.id);
                    safeScrollToTop();
                  }}
                  className={`flex flex-col items-center justify-center gap-0.5 py-2 min-h-[54px] text-[10px] font-medium transition-colors cursor-pointer ${
                    active
                      ? 'text-[#1E3A5F] font-bold'
                      : 'text-slate-500 hover:text-slate-800'
                  }`}
                >
                  <Icon
                    className={`w-4 h-4 ${active ? 'text-[#1E3A5F]' : 'text-slate-400'}`}
                    aria-hidden="true"
                  />
                  <span>{item.label}</span>
                </button>
              );
            })}
          </div>
        </nav>
      )}
    </div>
  );
}
