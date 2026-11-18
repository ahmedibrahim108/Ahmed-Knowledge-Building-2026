/**
 * @license
 * SPDX-License-Identifier: Apache-2.0
 */

import { User, onAuthStateChanged } from 'firebase/auth';
import { useEffect, useRef, useState } from 'react';
import { CheckCircle2 } from 'lucide-react';
import CoursesView from './components/CoursesView';
import DomainsView from './components/DomainsView';
import Header, { ActiveTab } from './components/Header';
import NotesJournalView from './components/NotesJournalView';
import OverviewView from './components/OverviewView';
import TwelveMonthPlanView from './components/TwelveMonthPlanView';
import {
  BookNote,
  CustomCategory,
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
  QuarterInfo,
  SmallTask,
  StudyHistoryEntry,
  StudyResource,
} from './data/curriculumData';
import { auth, signInWithGoogle, signOutUser } from './firebase';
import {
  deleteBookNoteDoc,
  deleteCourseDoc,
  deleteCustomCategoryDoc,
  deleteDomainDoc,
  deleteHistoryEntryDoc,
  deleteMonthDoc,
  deleteQuarterDoc,
  ensureUserDocumentAndSeed,
  sanitizeId,
  saveBookNoteDoc,
  saveCourseDoc,
  saveCustomCategoryDoc,
  saveDomainDoc,
  saveHistoryEntryDoc,
  saveMonthDoc,
  saveQuarterDoc,
  subscribeUserWorkspace,
} from './services/firestoreSync';
import { exportPlanToExcel } from './utils/excelExport';

const STORAGE_QUARTERS_KEY = 'balanced_plan_quarters_v1';
const STORAGE_MONTHS_KEY = 'balanced_plan_months_v2';
const STORAGE_DOMAINS_KEY = 'balanced_plan_domains_v1';
const STORAGE_COURSES_KEY = 'balanced_plan_courses_v2';
const STORAGE_BOOK_NOTES_KEY = 'balanced_plan_book_notes_v1';
const STORAGE_CATEGORIES_KEY = 'balanced_plan_categories_v1';
const STORAGE_HISTORY_KEY = 'balanced_plan_history_v1';

function loadQuarters(): QuarterInfo[] {
  try {
    const raw = localStorage.getItem(STORAGE_QUARTERS_KEY);
    if (!raw) return INITIAL_QUARTERS;
    const parsed = JSON.parse(raw) as QuarterInfo[];
    return Array.isArray(parsed) && parsed.length > 0
      ? parsed
      : INITIAL_QUARTERS;
  } catch {
    return INITIAL_QUARTERS;
  }
}

function loadMonths(): MonthPlan[] {
  try {
    const raw = localStorage.getItem(STORAGE_MONTHS_KEY);
    if (!raw) return INITIAL_MONTHS;
    const parsed = JSON.parse(raw) as Partial<MonthPlan>[];
    if (Array.isArray(parsed) && parsed.length > 0) {
      return parsed.map((saved, idx) => {
        const fallback = INITIAL_MONTHS[idx] ?? INITIAL_MONTHS[0];
        return {
          ...fallback,
          ...saved,
          docId: saved.docId || `month-${saved.id ?? idx + 1}`,
          tasks:
            Array.isArray(saved.tasks) && saved.tasks.length > 0
              ? saved.tasks
              : fallback.tasks,
          resources:
            Array.isArray(saved.resources) && saved.resources.length > 0
              ? saved.resources
              : fallback.resources,
        } as MonthPlan;
      });
    }
    return INITIAL_MONTHS;
  } catch {
    return INITIAL_MONTHS;
  }
}

function loadDomains(): DomainInfo[] {
  try {
    const raw = localStorage.getItem(STORAGE_DOMAINS_KEY);
    if (!raw) return DOMAINS;
    const parsed = JSON.parse(raw) as DomainInfo[];
    return Array.isArray(parsed) && parsed.length > 0 ? parsed : DOMAINS;
  } catch {
    return DOMAINS;
  }
}

function loadCourses(): PersonalCourse[] {
  try {
    const raw = localStorage.getItem(STORAGE_COURSES_KEY);
    if (!raw) return INITIAL_COURSES;
    const parsed = JSON.parse(raw) as Partial<PersonalCourse>[];
    if (Array.isArray(parsed) && parsed.length > 0) {
      return parsed.map((saved, idx) => {
        const fallback = INITIAL_COURSES[idx] ?? INITIAL_COURSES[0];
        return {
          ...fallback,
          ...saved,
          docId: saved.docId || `course-${saved.id ?? idx + 1}`,
          resources:
            Array.isArray(saved.resources) && saved.resources.length > 0
              ? saved.resources
              : fallback.resources,
          tasks:
            Array.isArray(saved.tasks) && saved.tasks.length > 0
              ? saved.tasks
              : fallback.tasks,
        } as PersonalCourse;
      });
    }
    return INITIAL_COURSES;
  } catch {
    return INITIAL_COURSES;
  }
}

function loadBookNotes(): BookNote[] {
  try {
    const raw = localStorage.getItem(STORAGE_BOOK_NOTES_KEY);
    if (!raw) return INITIAL_BOOK_NOTES;
    const parsed = JSON.parse(raw) as BookNote[];
    return Array.isArray(parsed) ? parsed : INITIAL_BOOK_NOTES;
  } catch {
    return INITIAL_BOOK_NOTES;
  }
}

function loadCustomCategories(): CustomCategory[] {
  try {
    const raw = localStorage.getItem(STORAGE_CATEGORIES_KEY);
    if (!raw) return INITIAL_CUSTOM_CATEGORIES;
    const parsed = JSON.parse(raw) as CustomCategory[];
    return Array.isArray(parsed) && parsed.length > 0
      ? parsed
      : INITIAL_CUSTOM_CATEGORIES;
  } catch {
    return INITIAL_CUSTOM_CATEGORIES;
  }
}

function loadHistory(): StudyHistoryEntry[] {
  try {
    const raw = localStorage.getItem(STORAGE_HISTORY_KEY);
    if (!raw) return [];
    const parsed = JSON.parse(raw) as StudyHistoryEntry[];
    return Array.isArray(parsed) ? parsed : [];
  } catch {
    return [];
  }
}

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
  const [quarters, setQuarters] = useState<QuarterInfo[]>(loadQuarters);
  const [months, setMonths] = useState<MonthPlan[]>(loadMonths);
  const [domains, setDomains] = useState<DomainInfo[]>(loadDomains);
  const [courses, setCourses] = useState<PersonalCourse[]>(loadCourses);
  const [bookNotes, setBookNotes] = useState<BookNote[]>(loadBookNotes);
  const [customCategories, setCustomCategories] =
    useState<CustomCategory[]>(loadCustomCategories);
  const [history, setHistory] = useState<StudyHistoryEntry[]>(loadHistory);
  const [activeBookNoteId, setActiveBookNoteId] = useState<string | null>(
    () => loadBookNotes()[0]?.id ?? null
  );
  const [selectedMonthId, setSelectedMonthId] = useState<number>(1);
  const [domainFilter, setDomainFilter] = useState<DomainId | 'all'>('all');
  const [exportNotice, setExportNotice] = useState<string | null>(null);

  // Firebase Auth & Sync state
  const [user, setUser] = useState<User | null>(null);
  const [authReady, setAuthReady] = useState(false);
  const [syncingCloud, setSyncingCloud] = useState(false);
  const [authError, setAuthError] = useState<string | null>(null);

  const localStateRef = useRef({
    quarters,
    months,
    domains,
    courses,
    bookNotes,
    customCategories,
    history,
  });
  localStateRef.current = {
    quarters,
    months,
    domains,
    courses,
    bookNotes,
    customCategories,
    history,
  };

  // LocalStorage persistence
  useEffect(() => {
    try {
      localStorage.setItem(STORAGE_QUARTERS_KEY, JSON.stringify(quarters));
    } catch {
      // ignore
    }
  }, [quarters]);

  useEffect(() => {
    try {
      localStorage.setItem(STORAGE_MONTHS_KEY, JSON.stringify(months));
    } catch {
      // ignore
    }
  }, [months]);

  useEffect(() => {
    try {
      localStorage.setItem(STORAGE_DOMAINS_KEY, JSON.stringify(domains));
    } catch {
      // ignore
    }
  }, [domains]);

  useEffect(() => {
    try {
      localStorage.setItem(STORAGE_COURSES_KEY, JSON.stringify(courses));
    } catch {
      // ignore
    }
  }, [courses]);

  useEffect(() => {
    try {
      localStorage.setItem(STORAGE_BOOK_NOTES_KEY, JSON.stringify(bookNotes));
    } catch {
      // ignore
    }
  }, [bookNotes]);

  useEffect(() => {
    try {
      localStorage.setItem(
        STORAGE_CATEGORIES_KEY,
        JSON.stringify(customCategories)
      );
    } catch {
      // ignore
    }
  }, [customCategories]);

  useEffect(() => {
    try {
      localStorage.setItem(STORAGE_HISTORY_KEY, JSON.stringify(history));
    } catch {
      // ignore
    }
  }, [history]);

  // Listen to Firebase Auth state & attach Firestore listeners ONLY when authenticated
  useEffect(() => {
    let unsubWorkspace: (() => void) | null = null;

    const unsubAuth = onAuthStateChanged(auth, async (nextUser) => {
      setUser(nextUser);
      setAuthReady(true);

      if (unsubWorkspace) {
        unsubWorkspace();
        unsubWorkspace = null;
      }

      if (nextUser) {
        setSyncingCloud(true);
        setAuthError(null);
        try {
          await ensureUserDocumentAndSeed(nextUser, localStateRef.current);
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
    try {
      await signInWithGoogle();
    } catch (err) {
      const msg =
        err instanceof Error ? err.message : 'تعذر تسجيل الدخول بحساب Google.';
      if (!msg.includes('popup-closed-by-user')) {
        setAuthError('تعذر إتمام تسجيل الدخول. تأكد من السماح بالنوافذ المنبثقة.');
      }
    }
  };

  const handleSignOut = async () => {
    setAuthError(null);
    await signOutUser();
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
    const entry: StudyHistoryEntry = {
      ...payload,
      id: `hist-${Date.now()}-${Math.floor(Math.random() * 1000)}`,
      timestampLabel: formatArabicDateTime(),
      createdAtMs: Date.now(),
    };
    setHistory((prev) => [entry, ...prev].slice(0, 40));
    if (user) void saveHistoryEntryDoc(user.uid, entry);
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

  // --- Quarter CRUD ---
  const handleAddQuarter = (title: string, subtitle: string) => {
    const nextNum =
      quarters.reduce((max, q) => Math.max(max, q.number), 0) + 1;
    const newQuarter: QuarterInfo = {
      id: `quarter-${nextNum}-${Date.now()}`,
      number: nextNum,
      title,
      subtitle,
    };
    setQuarters((prev) => [...prev, newQuarter]);
    if (user) void saveQuarterDoc(user.uid, newQuarter);
  };

  const handleUpdateQuarter = (id: string, updates: Partial<QuarterInfo>) => {
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
          if (user) void saveMonthDoc(user.uid, nextMonth);
          return nextMonth;
        })
      );
    }
    if (user && updatedQuarter) {
      void saveQuarterDoc(user.uid, updatedQuarter);
    }
  };

  const handleDeleteQuarter = (id: string) => {
    setQuarters((prev) => prev.filter((q) => q.id !== id));
    if (user) void deleteQuarterDoc(user.uid, id);
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
    const nextId = months.reduce((max, m) => Math.max(max, m.id), 0) + 1;
    const qObj = quarters.find((q) => q.number === payload.quarter);
    const defaultDomainF = domains[0]?.id ?? 'islamic_thought';
    const defaultDomainE = domains[1]?.id ?? defaultDomainF;

    const newMonth: MonthPlan = {
      id: nextId,
      docId: `month-${nextId}-${Date.now()}`,
      quarter: payload.quarter,
      quarterTitle: qObj?.title ?? `الربع ${payload.quarter}`,
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
      discussionPrompt: 'ما أبرز فكرة تستحق النقاش والتطبيق من هذا الشهر؟',
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
    if (user) void saveMonthDoc(user.uid, newMonth);
  };

  const syncMonth = (updated: MonthPlan) => {
    if (user) void saveMonthDoc(user.uid, updated);
  };

  const handleUpdateMonth = (id: number, updates: Partial<MonthPlan>) => {
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
    const target = months.find((m) => m.id === id);
    const remaining = months.filter((m) => m.id !== id);
    setMonths(remaining);
    if (selectedMonthId === id && remaining.length > 0) {
      setSelectedMonthId(remaining[0].id);
    }
    if (user && target) {
      void deleteMonthDoc(user.uid, target.docId || `month-${target.id}`);
    }
  };

  const handleUpdateMonthStatus = (id: number, status: MonthStatus) => {
    handleUpdateMonth(id, { status });
  };

  const handleToggleActivity = (id: number, key: keyof MonthActivities) => {
    setMonths((prev) =>
      prev.map((m) => {
        if (m.id !== id) return m;
        const updatedActivities = {
          ...m.activities,
          [key]: !m.activities[key],
        };
        const completedCount = Object.values(updatedActivities).filter(Boolean).length;
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
  };

  const handleUpdateMonthNotes = (id: number, notes: string) => {
    handleUpdateMonth(id, { notes });
  };

  const handleUpdateTrackItem = (
    id: number,
    track: 'foundational' | 'exploratory',
    field: 'title' | 'author' | 'pace' | 'domainId' | 'format' | 'focus',
    value: string
  ) => {
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
  };

  const handleAddMonthTask = (
    monthId: number,
    text: string,
    track: SmallTask['track']
  ) => {
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
    note: string
  ) => {
    const newRes: StudyResource = {
      id: `m${monthId}-res-${Date.now()}`,
      title,
      type,
      note,
      searchQuery: title,
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
    const newDomain: DomainInfo = {
      ...payload,
      id: sanitizeId(`domain_${Date.now()}`),
      order: domains.length,
    };
    setDomains((prev) => [...prev, newDomain]);
    if (user) void saveDomainDoc(user.uid, newDomain, newDomain.order ?? 0);
    recordHistory({
      actionType: 'domain',
      title: `أضفت محورًا معرفيًا: ${newDomain.title}`,
      detail: newDomain.subtitle,
      targetTab: 'domains',
    });
  };

  const handleUpdateDomain = (id: DomainId, updates: Partial<DomainInfo>) => {
    setDomains((prev) =>
      prev.map((d, idx) => {
        if (d.id !== id) return d;
        const next = { ...d, ...updates };
        if (user) void saveDomainDoc(user.uid, next, next.order ?? idx);
        return next;
      })
    );
  };

  const handleDeleteDomain = (id: DomainId) => {
    setDomains((prev) => prev.filter((d) => d.id !== id));
    if (user) void deleteDomainDoc(user.uid, id);
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
    const target = courses.find((c) => c.id === id);
    setCourses((prev) => prev.filter((c) => c.id !== id));
    if (user && target) {
      void deleteCourseDoc(user.uid, target.docId || `course-${target.id}`);
    }
  };

  const handleToggleCourseTask = (courseId: number, taskId: string) => {
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
  };

  const handleAddCourseTask = (courseId: number, text: string) => {
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
    note: string
  ) => {
    const newRes: StudyResource = {
      id: `c${courseId}-res-${Date.now()}`,
      title,
      type,
      note,
      searchQuery: title,
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
  }) => {
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
      content: '',
      quotes: '',
      updatedAt: formatArabicDate(),
    };
    setBookNotes((prev) => [newNote, ...prev]);
    setActiveBookNoteId(newNote.id);
    setActiveTab('journal');
    if (user) void saveBookNoteDoc(user.uid, newNote);

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

  const handleAddOrOpenBookNote = (bookTitle: string, author: string) => {
    const existing = bookNotes.find(
      (bn) => bn.bookTitle.trim() === bookTitle.trim()
    );
    if (existing) {
      setActiveBookNoteId(existing.id);
      setActiveTab('journal');
      return;
    }

    handleAddStructuredNote({
      noteType: 'book',
      bookTitle,
      author,
      categoryLabel: customCategories[0]?.title ?? 'قراءات تأسيسية',
    });
  };

  const handleOpenCourseNote = (course: PersonalCourse) => {
    handleAddStructuredNote({
      noteType: 'course_lecture',
      bookTitle: `ملاحظات ${course.title}`,
      author: course.bookAuthor || 'محاضر الكورس',
      courseId: course.id,
      courseTitle: course.title,
      lectureTitle: 'المحاضرة 1',
      categoryLabel: 'محاضرات وتطبيق عملي',
    });
  };

  const handleOpenNoteById = (noteId: string) => {
    setActiveBookNoteId(noteId);
    setActiveTab('journal');
  };

  const handleUpdateBookNote = (id: string, updates: Partial<BookNote>) => {
    setBookNotes((prev) =>
      prev.map((bn) => {
        if (bn.id !== id) return bn;
        const next = { ...bn, ...updates, updatedAt: formatArabicDate() };
        if (user) void saveBookNoteDoc(user.uid, next);
        return next;
      })
    );
  };

  const handleDeleteBookNote = (id: string) => {
    setBookNotes((prev) => {
      const next = prev.filter((bn) => bn.id !== id);
      if (activeBookNoteId === id) {
        setActiveBookNoteId(next[0]?.id ?? null);
      }
      return next;
    });
    if (user) void deleteBookNoteDoc(user.uid, id);
  };

  // --- Personalized Custom Categories CRUD ---
  const handleAddCustomCategory = (
    title: string,
    description: string,
    color: CustomCategory['color']
  ) => {
    const newCat: CustomCategory = {
      id: sanitizeId(`cat_${Date.now()}`),
      title,
      description,
      color,
      createdAtLabel: formatArabicDate(),
    };
    setCustomCategories((prev) => [newCat, ...prev]);
    if (user) void saveCustomCategoryDoc(user.uid, newCat);
    recordHistory({
      actionType: 'note',
      title: `أضفت تصنيفًا شخصيًا جديدًا: ${title}`,
      detail: description,
      targetTab: 'overview',
    });
  };

  const handleDeleteCustomCategory = (id: string) => {
    setCustomCategories((prev) => prev.filter((c) => c.id !== id));
    if (user) void deleteCustomCategoryDoc(user.uid, id);
  };

  const handleDeleteHistoryEntry = (id: string) => {
    setHistory((prev) => prev.filter((h) => h.id !== id));
    if (user) void deleteHistoryEntryDoc(user.uid, id);
  };

  const handleResetPlan = () => {
    setQuarters(INITIAL_QUARTERS);
    setMonths(INITIAL_MONTHS);
    setDomains(DOMAINS);
    setCourses(INITIAL_COURSES);
    setBookNotes(INITIAL_BOOK_NOTES);
    setCustomCategories(INITIAL_CUSTOM_CATEGORIES);
    setActiveBookNoteId(INITIAL_BOOK_NOTES[0]?.id ?? null);
    setDomainFilter('all');
    setSelectedMonthId(1);
    localStorage.removeItem(STORAGE_QUARTERS_KEY);
    localStorage.removeItem(STORAGE_MONTHS_KEY);
    localStorage.removeItem(STORAGE_DOMAINS_KEY);
    localStorage.removeItem(STORAGE_COURSES_KEY);
    localStorage.removeItem(STORAGE_BOOK_NOTES_KEY);
    localStorage.removeItem(STORAGE_CATEGORIES_KEY);
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
      />

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
            months={months}
            domains={domains}
            courses={courses}
            bookNotes={bookNotes}
            customCategories={customCategories}
            history={history}
            onGoogleSignIn={handleGoogleSignIn}
            onNavigateTab={setActiveTab}
            onJumpToMonth={handleJumpToMonth}
            onFilterByDomain={handleFilterByDomain}
            onOpenNoteById={handleOpenNoteById}
            onAddCustomCategory={handleAddCustomCategory}
            onDeleteCustomCategory={handleDeleteCustomCategory}
            onDeleteHistoryEntry={handleDeleteHistoryEntry}
          />
        )}

        {activeTab === 'plan' && (
          <TwelveMonthPlanView
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
            <span aria-hidden="true">·</span>
            <button
              type="button"
              onClick={handleResetPlan}
              className="text-slate-500 hover:text-slate-800 hover:underline cursor-pointer"
            >
              استعادة الخطة الافتراضية
            </button>
          </div>
        </div>
      </footer>
    </div>
  );
}
