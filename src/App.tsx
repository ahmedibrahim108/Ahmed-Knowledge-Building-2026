/**
 * @license
 * SPDX-License-Identifier: Apache-2.0
 */

import { User, onAuthStateChanged } from 'firebase/auth';
import { useEffect, useState } from 'react';
import { CheckCircle2, Lock, LogIn } from 'lucide-react';
import CalendarView from './components/CalendarView';
import CoursesView from './components/CoursesView';
import DomainsView from './components/DomainsView';
import Header, { ActiveTab } from './components/Header';
import NotesJournalView from './components/NotesJournalView';
import OfflineIndicator from './components/OfflineIndicator';
import OverviewView from './components/OverviewView';
import TwelveMonthPlanView from './components/TwelveMonthPlanView';
import {
  BookNote,
  CalendarEvent,
  CustomCategory,
  DEFAULT_USER_PREFERENCES,
  DOMAINS,
  DomainId,
  DomainInfo,
  INITIAL_BOOK_NOTES,
  INITIAL_COURSES,
  INITIAL_CUSTOM_CATEGORIES,
  INITIAL_MONTHS,
  INITIAL_QUARTERS,
  MonthActivities,
  MonthPlan,
  MonthStatus,
  NoteCategoryType,
  PersonalCourse,
  PersonalReflection,
  QuarterInfo,
  ReflectionMood,
  SmallTask,
  StudyHistoryEntry,
  StudyResource,
  UserPreferences,
} from './data/curriculumData';
import { auth, signInWithGoogle, signOutUser } from './firebase';
import {
  deleteBookNoteDoc,
  deleteCalendarEventDoc,
  deleteCourseDoc,
  deleteCustomCategoryDoc,
  deleteDomainDoc,
  deleteHistoryEntryDoc,
  deleteMonthDoc,
  deleteQuarterDoc,
  deleteReflectionDoc,
  ensureUserDocumentAndSeed,
  sanitizeId,
  saveBookNoteDoc,
  saveCalendarEventDoc,
  saveCourseDoc,
  saveCustomCategoryDoc,
  saveDomainDoc,
  saveHistoryEntryDoc,
  saveMonthDoc,
  saveQuarterDoc,
  saveReflectionDoc,
  saveUserPreferencesDoc,
  subscribeUserWorkspace,
} from './services/firestoreSync';
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

export default function App() {
  const [activeTab, setActiveTab] = useState<ActiveTab>('overview');
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
  const [calendarEvents, setCalendarEvents] = useState<CalendarEvent[]>([]);
  const [preferences, setPreferences] = useState<UserPreferences>(
    DEFAULT_USER_PREFERENCES
  );
  const [activeBookNoteId, setActiveBookNoteId] = useState<string | null>(
    () => INITIAL_BOOK_NOTES[0]?.id ?? null
  );
  const [selectedMonthId, setSelectedMonthId] = useState<number>(1);
  const [domainFilter, setDomainFilter] = useState<DomainId | 'all'>('all');
  const [exportNotice, setExportNotice] = useState<string | null>(null);
  const [authPromptNotice, setAuthPromptNotice] = useState<string | null>(null);

  // Firebase Auth & Sync state
  const [user, setUser] = useState<User | null>(null);
  const [authReady, setAuthReady] = useState(false);
  const [syncingCloud, setSyncingCloud] = useState(false);
  const [authError, setAuthError] = useState<string | null>(null);

  const canEdit = Boolean(user);

  const resetToDefaultView = () => {
    setQuarters(INITIAL_QUARTERS);
    setMonths(INITIAL_MONTHS);
    setDomains(DOMAINS);
    setCourses(INITIAL_COURSES);
    setBookNotes(INITIAL_BOOK_NOTES);
    setCustomCategories(INITIAL_CUSTOM_CATEGORIES);
    setHistory([]);
    setReflections([]);
    setCalendarEvents([]);
    setPreferences(DEFAULT_USER_PREFERENCES);
    setActiveBookNoteId(INITIAL_BOOK_NOTES[0]?.id ?? null);
    setDomainFilter('all');
    setSelectedMonthId(1);
  };

  // Listen to Firebase Auth state & attach strict per-user Firestore workspace listeners ONLY when authenticated
  useEffect(() => {
    let unsubWorkspace: (() => void) | null = null;

    const unsubAuth = onAuthStateChanged(auth, async (nextUser) => {
      setUser(nextUser);
      setAuthReady(true);

      if (unsubWorkspace) {
        unsubWorkspace();
        unsubWorkspace = null;
      }

      // Always reset in-memory state first so switching accounts or signing out never bleeds prior account data
      resetToDefaultView();

      if (nextUser) {
        setSyncingCloud(true);
        setAuthError(null);
        setAuthPromptNotice(null);
        try {
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
            },
            onReflections: (items) => {
              setReflections(items);
            },
            onCalendarEvents: (items) => {
              setCalendarEvents(items);
            },
          });
        } catch (err) {
          setAuthError(
            err instanceof Error
              ? err.message
              : 'تعذرت المزامنة مع قاعدة البيانات.'
          );
        } finally {
          setSyncingCloud(false);
        }
      }
    });

    return () => {
      unsubAuth();
      if (unsubWorkspace) unsubWorkspace();
    };
  }, []);

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
          'تعذر إتمام تسجيل الدخول. تأكد من السماح بالنوافذ المنبثقة.'
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
    window.scrollTo({ top: 0, behavior: 'smooth' });
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

  const recordHistory = (
    payload: Omit<StudyHistoryEntry, 'id' | 'timestampLabel' | 'createdAtMs'>
  ) => {
    if (!user) return;
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
    setActiveTab('plan');
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
    setActiveTab('plan');
  };

  // --- Preferences CRUD ---
  const handleUpdatePreferences = (updates: Partial<UserPreferences>) => {
    if (!user) {
      handleRequireAuth();
      return;
    }
    const nextPrefs: UserPreferences = { ...preferences, ...updates };
    setPreferences(nextPrefs);
    void saveUserPreferencesDoc(user.uid, nextPrefs);
  };

  // --- Quarter CRUD ---
  const handleAddQuarter = (title: string, subtitle: string) => {
    if (!user) {
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
    if (!user) {
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
    if (!user) {
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
    if (!user) {
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
      tasks: [
        {
          id: `m${nextId}-t1-${Date.now()}`,
          text: `البدء بقراءة ${payload.foundationalTitle} وتدوين الملاحظات الأولى.`,
          track: 'foundational',
          done: false,
          custom: true,
        },
      ],
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
    if (user) void saveMonthDoc(user.uid, updated);
  };

  const handleUpdateMonth = (id: number, updates: Partial<MonthPlan>) => {
    if (!user) {
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
    if (!user) {
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
    if (!user) {
      handleRequireAuth();
      return;
    }
    handleUpdateMonth(id, { status });
  };

  const handleToggleActivity = (id: number, key: keyof MonthActivities) => {
    if (!user) {
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
    }
  };

  const handleUpdateMonthNotes = (id: number, notes: string) => {
    if (!user) {
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
    if (!user) {
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
    if (!user) {
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
    if (!user) {
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
    if (!user) {
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
    }
  ) => {
    if (!user) {
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

  const handleDeleteMonthResource = (monthId: number, resourceId: string) => {
    if (!user) {
      handleRequireAuth();
      return;
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
    if (!user) {
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
    if (!user) {
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
    if (!user) {
      handleRequireAuth();
      return;
    }
    setDomains((prev) => prev.filter((d) => d.id !== id));
    void deleteDomainDoc(user.uid, id);
  };

  // --- Course CRUD ---
  const syncCourse = (updated: PersonalCourse) => {
    if (user) void saveCourseDoc(user.uid, updated);
  };

  const handleAddCourse = (payload: {
    title: string;
    category: string;
    complementaryBook: string;
    bookAuthor: string;
    applicationMilestone: string;
    linkedMonths: number[];
  }) => {
    if (!user) {
      handleRequireAuth();
      return;
    }
    const nextId = courses.reduce((max, c) => Math.max(max, c.id), 0) + 1;
    const newCourse: PersonalCourse = {
      id: nextId,
      docId: `course-${nextId}-${Date.now()}`,
      title: payload.title,
      category: payload.category,
      linkedMonths: payload.linkedMonths,
      complementaryBook: payload.complementaryBook,
      bookAuthor: payload.bookAuthor,
      applicationMilestone: payload.applicationMilestone,
      completed: false,
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
  };

  const handleUpdateCourse = (
    id: number,
    updates: Partial<PersonalCourse>
  ) => {
    if (!user) {
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
        }
        return next;
      })
    );
  };

  const handleDeleteCourse = (id: number) => {
    if (!user) {
      handleRequireAuth();
      return;
    }
    const target = courses.find((c) => c.id === id);
    setCourses((prev) => prev.filter((c) => c.id !== id));
    if (target) {
      void deleteCourseDoc(user.uid, target.docId || `course-${target.id}`);
    }
  };

  const handleToggleCourseTask = (courseId: number, taskId: string) => {
    if (!user) {
      handleRequireAuth();
      return;
    }
    const targetCourse = courses.find((c) => c.id === courseId);
    const targetTask = targetCourse?.tasks.find((t) => t.id === taskId);
    const willBeDone = targetTask ? !targetTask.done : false;

    setCourses((prev) =>
      prev.map((c) => {
        if (c.id !== courseId) return c;
        const next = {
          ...c,
          tasks: c.tasks.map((t) =>
            t.id === taskId ? { ...t, done: !t.done } : t
          ),
        };
        syncCourse(next);
        return next;
      })
    );

    if (targetCourse && targetTask && willBeDone) {
      recordHistory({
        actionType: 'course',
        title: `أنجزت مهمة في ${targetCourse.title}: ${targetTask.text}`,
        detail: targetCourse.category,
        targetTab: 'courses',
      });
    }
  };

  const handleAddCourseTask = (courseId: number, text: string) => {
    if (!user) {
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
    if (!user) {
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
    }
  ) => {
    if (!user) {
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

  const handleDeleteCourseResource = (courseId: number, resourceId: string) => {
    if (!user) {
      handleRequireAuth();
      return;
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
    noteType: NoteCategoryType;
    bookTitle: string;
    author: string;
    courseId?: number;
    courseTitle?: string;
    lectureTitle?: string;
    categoryLabel?: string;
    initialContent?: string;
  }) => {
    if (!user) {
      handleRequireAuth();
      return;
    }
    const newNote: BookNote = {
      id: `bn-${Date.now()}`,
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
    setActiveTab('journal');
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
      setActiveTab('journal');
      return;
    }

    if (!user) {
      handleRequireAuth();
      return;
    }

    handleAddStructuredNote({
      noteType: 'book',
      bookTitle,
      author,
      categoryLabel: customCategories[0]?.title ?? 'قراءات تأسيسية',
      initialContent,
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
      setActiveTab('journal');
      return;
    }

    if (!user) {
      handleRequireAuth();
      return;
    }

    handleAddStructuredNote({
      noteType: 'course_lecture',
      bookTitle: lectureTitle
        ? `${course.title} — ${lectureTitle}`
        : `ملاحظات ${course.title}`,
      author: course.bookAuthor || 'محاضر الكورس',
      courseId: course.id,
      courseTitle: course.title,
      lectureTitle: lectureTitle || 'المحاضرة 1',
      categoryLabel: 'محاضرات وتطبيق عملي',
      initialContent,
    });
  };

  const handleOpenNoteById = (noteId: string) => {
    setActiveBookNoteId(noteId);
    setActiveTab('journal');
  };

  const handleUpdateBookNote = (id: string, updates: Partial<BookNote>) => {
    if (!user) {
      handleRequireAuth();
      return;
    }
    setBookNotes((prev) =>
      prev.map((bn) => {
        if (bn.id !== id) return bn;
        const next = { ...bn, ...updates, updatedAt: formatArabicDate() };
        void saveBookNoteDoc(user.uid, next);
        return next;
      })
    );
  };

  const handleDeleteBookNote = (id: string) => {
    if (!user) {
      handleRequireAuth();
      return;
    }
    setBookNotes((prev) => {
      const next = prev.filter((bn) => bn.id !== id);
      if (activeBookNoteId === id) {
        setActiveBookNoteId(next[0]?.id ?? null);
      }
      return next;
    });
    void deleteBookNoteDoc(user.uid, id);
  };

  // --- Personalized Custom Categories CRUD ---
  const handleAddCustomCategory = (
    title: string,
    description: string,
    color: CustomCategory['color']
  ) => {
    if (!user) {
      handleRequireAuth();
      return;
    }
    const newCat: CustomCategory = {
      id: sanitizeId(`cat_${Date.now()}`),
      title,
      description,
      color,
      createdAtLabel: formatArabicDate(),
    };
    setCustomCategories((prev) => [newCat, ...prev]);
    void saveCustomCategoryDoc(user.uid, newCat);
    recordHistory({
      actionType: 'note',
      title: `أضفت تصنيفًا شخصيًا جديدًا: ${title}`,
      detail: description,
      targetTab: 'overview',
    });
  };

  const handleDeleteCustomCategory = (id: string) => {
    if (!user) {
      handleRequireAuth();
      return;
    }
    setCustomCategories((prev) => prev.filter((c) => c.id !== id));
    void deleteCustomCategoryDoc(user.uid, id);
  };

  const handleDeleteHistoryEntry = (id: string) => {
    if (!user) {
      handleRequireAuth();
      return;
    }
    setHistory((prev) => prev.filter((h) => h.id !== id));
    void deleteHistoryEntryDoc(user.uid, id);
  };

  // --- Personal Reflections («خواطري») CRUD ---
  const handleAddReflection = (payload: {
    title: string;
    content: string;
    moodTag: ReflectionMood;
  }) => {
    if (!user) {
      handleRequireAuth();
      return;
    }
    const now = Date.now();
    const newReflection: PersonalReflection = {
      id: `refl-${now}-${Math.floor(Math.random() * 1000)}`,
      title: payload.title,
      content: payload.content,
      moodTag: payload.moodTag,
      pinned: false,
      createdAtLabel: formatArabicDateTime(),
      createdAtMs: now,
    };
    setReflections((prev) => [newReflection, ...prev]);
    void saveReflectionDoc(user.uid, newReflection);
    recordHistory({
      actionType: 'note',
      title: `دوّنت خاطرة جديدة: ${payload.title || payload.moodTag}`,
      detail: `الوسم: ${payload.moodTag}`,
      targetTab: 'overview',
    });
  };

  const handleUpdateReflection = (
    id: string,
    updates: Partial<PersonalReflection>
  ) => {
    if (!user) {
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
    if (!user) {
      handleRequireAuth();
      return;
    }
    setReflections((prev) => prev.filter((r) => r.id !== id));
    void deleteReflectionDoc(user.uid, id);
  };

  // --- Calendar Events (Weekly & Monthly) CRUD ---
  const handleAddCalendarEvent = (payload: Omit<CalendarEvent, 'id'>) => {
    if (!user) {
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
  };

  const handleUpdateCalendarEvent = (
    id: string,
    updates: Partial<CalendarEvent>
  ) => {
    if (!user) {
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
    if (!user) {
      handleRequireAuth();
      return;
    }
    setCalendarEvents((prev) => prev.filter((ev) => ev.id !== id));
    void deleteCalendarEventDoc(user.uid, id);
  };

  const handleResetPlan = () => {
    if (!user) {
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
        activeTab={activeTab}
        onSelectTab={setActiveTab}
        user={user}
        authReady={authReady}
        syncingCloud={syncingCloud}
        onGoogleSignIn={handleGoogleSignIn}
        onSignOut={handleSignOut}
        monthsCount={months.length}
        domainsCount={domains.length}
        coursesCount={courses.length}
        notesCount={bookNotes.length}
      />

      {/* Read-Only Guest Mode Banner */}
      {authReady && !user && (
        <div className="max-w-[1280px] w-full mx-auto px-4 sm:px-8 pt-4">
          <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-3 px-4 py-3 bg-white border border-slate-200 rounded-xl text-xs text-slate-700">
            <div className="flex items-start sm:items-center gap-2.5">
              <Lock
                className="w-4 h-4 text-[#1E3A5F] shrink-0 mt-0.5 sm:mt-0"
                aria-hidden="true"
              />
              <span className="leading-relaxed">
                {authPromptNotice ||
                  'وضع التصفح (للقراءة فقط): يمكنك استعراض الخطة كاملة. لتخصيص خطتك أو إضافة محاور وكورسات وملاحظات في حسابك الشخصي فقط دون التأثير على الآخرين، سجّل الدخول بحساب Google.'}
              </span>
            </div>
            <button
              type="button"
              onClick={handleGoogleSignIn}
              className="inline-flex items-center justify-center gap-1.5 px-3.5 py-2 text-xs font-semibold text-white bg-[#1E3A5F] hover:bg-[#162C49] rounded-lg transition-colors whitespace-nowrap shrink-0 cursor-pointer"
            >
              <LogIn className="w-3.5 h-3.5" aria-hidden="true" />
              <span>دخول بحساب Google</span>
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

      <main className="flex-1 max-w-[1280px] w-full mx-auto px-4 sm:px-8 py-8">
        {activeTab === 'overview' && (
          <OverviewView
            user={user}
            canEdit={canEdit}
            onRequireAuth={handleRequireAuth}
            voiceDialect={preferences.voiceDialect}
            quarters={quarters}
            months={months}
            domains={domains}
            courses={courses}
            bookNotes={bookNotes}
            customCategories={customCategories}
            history={history}
            reflections={reflections}
            onGoogleSignIn={handleGoogleSignIn}
            onNavigateTab={setActiveTab}
            onJumpToMonth={handleJumpToMonth}
            onFilterByDomain={handleFilterByDomain}
            onOpenNoteById={handleOpenNoteById}
            onAddCustomCategory={handleAddCustomCategory}
            onDeleteCustomCategory={handleDeleteCustomCategory}
            onDeleteHistoryEntry={handleDeleteHistoryEntry}
            onAddReflection={handleAddReflection}
            onUpdateReflection={handleUpdateReflection}
            onDeleteReflection={handleDeleteReflection}
          />
        )}

        {activeTab === 'plan' && (
          <TwelveMonthPlanView
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
            onDeleteMonthResource={handleDeleteMonthResource}
            onOpenBookNote={handleAddOrOpenBookNote}
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

        {activeTab === 'courses' && (
          <CoursesView
            canEdit={canEdit}
            courses={courses}
            onAddCourse={handleAddCourse}
            onUpdateCourse={handleUpdateCourse}
            onDeleteCourse={handleDeleteCourse}
            onToggleCourseTask={handleToggleCourseTask}
            onAddCourseTask={handleAddCourseTask}
            onDeleteCourseTask={handleDeleteCourseTask}
            onAddCourseResource={handleAddCourseResource}
            onDeleteCourseResource={handleDeleteCourseResource}
            onJumpToMonth={handleJumpToMonth}
            onOpenCourseNote={handleOpenCourseNote}
          />
        )}

        {activeTab === 'journal' && (
          <NotesJournalView
            canEdit={canEdit}
            onRequireAuth={handleRequireAuth}
            preferences={preferences}
            onUpdatePreferences={handleUpdatePreferences}
            months={months}
            courses={courses}
            customCategories={customCategories}
            bookNotes={bookNotes}
            activeBookNoteId={activeBookNoteId}
            onSelectBookNote={setActiveBookNoteId}
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
          />
        )}

        {activeTab === 'calendar' && (
          <CalendarView
            canEdit={canEdit}
            onRequireAuth={handleRequireAuth}
            events={calendarEvents}
            months={months}
            courses={courses}
            onAddEvent={handleAddCalendarEvent}
            onUpdateEvent={handleUpdateCalendarEvent}
            onDeleteEvent={handleDeleteCalendarEvent}
            onJumpToMonth={handleJumpToMonth}
          />
        )}
      </main>

      <footer className="border-t border-slate-200 bg-white mt-auto">
        <div className="max-w-[1280px] mx-auto px-4 sm:px-8 py-5 flex flex-col sm:flex-row items-center justify-between gap-4 text-xs text-slate-500">
          <p>
            ميزان المعرفة · خطة الدراسة العامة المتوازنة (قراءة · استماع · تلخيص · مناقشة وتطبيق)
          </p>
          <div className="flex items-center gap-4">
            <button
              type="button"
              onClick={handleExportExcel}
              className="text-slate-700 font-medium hover:text-[#1E3A5F] hover:underline cursor-pointer"
            >
              تنزيل نسخة Excel
            </button>
            {canEdit && (
              <>
                <span aria-hidden="true">·</span>
                <button
                  type="button"
                  onClick={handleResetPlan}
                  className="text-slate-500 hover:text-slate-800 hover:underline cursor-pointer"
                >
                  استعادة الخطة الافتراضية
                </button>
              </>
            )}
          </div>
        </div>
      </footer>

      <OfflineIndicator />
    </div>
  );
}
