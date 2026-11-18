/**
 * @license
 * SPDX-License-Identifier: Apache-2.0
 */

import { useEffect, useState } from 'react';
import { CheckCircle2 } from 'lucide-react';
import CoursesView from './components/CoursesView';
import DomainsView from './components/DomainsView';
import Header, { ActiveTab } from './components/Header';
import NotesJournalView from './components/NotesJournalView';
import OverviewView from './components/OverviewView';
import TwelveMonthPlanView from './components/TwelveMonthPlanView';
import {
  BookNote,
  DomainId,
  INITIAL_BOOK_NOTES,
  INITIAL_COURSES,
  INITIAL_MONTHS,
  MonthActivities,
  MonthPlan,
  MonthStatus,
  PersonalCourse,
  SmallTask,
  StudyResource,
} from './data/curriculumData';
import { exportPlanToExcel } from './utils/excelExport';

const STORAGE_MONTHS_KEY = 'balanced_plan_months_v2';
const STORAGE_COURSES_KEY = 'balanced_plan_courses_v2';
const STORAGE_BOOK_NOTES_KEY = 'balanced_plan_book_notes_v1';

function loadMonths(): MonthPlan[] {
  try {
    const raw = localStorage.getItem(STORAGE_MONTHS_KEY);
    if (!raw) return INITIAL_MONTHS;
    const parsed = JSON.parse(raw) as Partial<MonthPlan>[];
    if (Array.isArray(parsed) && parsed.length === 12) {
      return INITIAL_MONTHS.map((initial, idx) => {
        const saved = parsed[idx];
        return {
          ...initial,
          ...saved,
          tasks:
            Array.isArray(saved?.tasks) && saved.tasks.length > 0
              ? saved.tasks
              : initial.tasks,
          resources:
            Array.isArray(saved?.resources) && saved.resources.length > 0
              ? saved.resources
              : initial.resources,
        };
      });
    }
    return INITIAL_MONTHS;
  } catch {
    return INITIAL_MONTHS;
  }
}

function loadCourses(): PersonalCourse[] {
  try {
    const raw = localStorage.getItem(STORAGE_COURSES_KEY);
    if (!raw) return INITIAL_COURSES;
    const parsed = JSON.parse(raw) as Partial<PersonalCourse>[];
    if (Array.isArray(parsed) && parsed.length === 6) {
      return INITIAL_COURSES.map((initial, idx) => {
        const saved = parsed[idx];
        return {
          ...initial,
          ...saved,
          resources:
            Array.isArray(saved?.resources) && saved.resources.length > 0
              ? saved.resources
              : initial.resources,
          tasks:
            Array.isArray(saved?.tasks) && saved.tasks.length > 0
              ? saved.tasks
              : initial.tasks,
        };
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
    if (Array.isArray(parsed)) {
      return parsed;
    }
    return INITIAL_BOOK_NOTES;
  } catch {
    return INITIAL_BOOK_NOTES;
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

export default function App() {
  const [activeTab, setActiveTab] = useState<ActiveTab>('overview');
  const [months, setMonths] = useState<MonthPlan[]>(loadMonths);
  const [courses, setCourses] = useState<PersonalCourse[]>(loadCourses);
  const [bookNotes, setBookNotes] = useState<BookNote[]>(loadBookNotes);
  const [activeBookNoteId, setActiveBookNoteId] = useState<string | null>(
    () => loadBookNotes()[0]?.id ?? null
  );
  const [selectedMonthId, setSelectedMonthId] = useState<number>(1);
  const [domainFilter, setDomainFilter] = useState<DomainId | 'all'>('all');
  const [exportNotice, setExportNotice] = useState<string | null>(null);

  useEffect(() => {
    try {
      localStorage.setItem(STORAGE_MONTHS_KEY, JSON.stringify(months));
    } catch {
      // Ignore storage quota errors
    }
  }, [months]);

  useEffect(() => {
    try {
      localStorage.setItem(STORAGE_COURSES_KEY, JSON.stringify(courses));
    } catch {
      // Ignore storage quota errors
    }
  }, [courses]);

  useEffect(() => {
    try {
      localStorage.setItem(STORAGE_BOOK_NOTES_KEY, JSON.stringify(bookNotes));
    } catch {
      // Ignore storage quota errors
    }
  }, [bookNotes]);

  const handleExportExcel = () => {
    exportPlanToExcel(months, courses, bookNotes);
    setExportNotice(
      'تم إنشاء وتنزيل ملف Excel (خطة_بناء_العقل_المتوازن_12_شهرا.xlsx)'
    );
    window.setTimeout(() => {
      setExportNotice(null);
    }, 4000);
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

  const handleUpdateMonthStatus = (id: number, status: MonthStatus) => {
    setMonths((prev) =>
      prev.map((m) => (m.id === id ? { ...m, status } : m))
    );
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
        return {
          ...m,
          activities: updatedActivities,
          status: nextStatus,
        };
      })
    );
  };

  const handleUpdateMonthNotes = (id: number, notes: string) => {
    setMonths((prev) =>
      prev.map((m) => (m.id === id ? { ...m, notes } : m))
    );
  };

  const handleUpdateTrackItem = (
    id: number,
    track: 'foundational' | 'exploratory',
    field: 'title' | 'author' | 'pace',
    value: string
  ) => {
    setMonths((prev) =>
      prev.map((m) => {
        if (m.id !== id) return m;
        return {
          ...m,
          [track]: {
            ...m[track],
            [field]: value,
          },
        };
      })
    );
  };

  const handleToggleMonthTask = (monthId: number, taskId: string) => {
    setMonths((prev) =>
      prev.map((m) => {
        if (m.id !== monthId) return m;
        return {
          ...m,
          tasks: m.tasks.map((t) =>
            t.id === taskId ? { ...t, done: !t.done } : t
          ),
        };
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
      prev.map((m) =>
        m.id === monthId ? { ...m, tasks: [...m.tasks, newTask] } : m
      )
    );
  };

  const handleDeleteMonthTask = (monthId: number, taskId: string) => {
    setMonths((prev) =>
      prev.map((m) =>
        m.id === monthId
          ? { ...m, tasks: m.tasks.filter((t) => t.id !== taskId) }
          : m
      )
    );
  };

  const handleUpdateCourse = (
    id: number,
    updates: Partial<PersonalCourse>
  ) => {
    setCourses((prev) =>
      prev.map((c) => (c.id === id ? { ...c, ...updates } : c))
    );
  };

  const handleToggleCourseTask = (courseId: number, taskId: string) => {
    setCourses((prev) =>
      prev.map((c) =>
        c.id === courseId
          ? {
              ...c,
              tasks: c.tasks.map((t) =>
                t.id === taskId ? { ...t, done: !t.done } : t
              ),
            }
          : c
      )
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
      prev.map((c) =>
        c.id === courseId ? { ...c, tasks: [...c.tasks, newTask] } : c
      )
    );
  };

  const handleDeleteCourseTask = (courseId: number, taskId: string) => {
    setCourses((prev) =>
      prev.map((c) =>
        c.id === courseId
          ? { ...c, tasks: c.tasks.filter((t) => t.id !== taskId) }
          : c
      )
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
      prev.map((c) =>
        c.id === courseId ? { ...c, resources: [...c.resources, newRes] } : c
      )
    );
  };

  const handleDeleteCourseResource = (courseId: number, resourceId: string) => {
    setCourses((prev) =>
      prev.map((c) =>
        c.id === courseId
          ? { ...c, resources: c.resources.filter((r) => r.id !== resourceId) }
          : c
      )
    );
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

    const newNote: BookNote = {
      id: `bn-${Date.now()}`,
      bookTitle,
      author,
      progressMarker: '',
      content: '',
      quotes: '',
      updatedAt: formatArabicDate(),
    };
    setBookNotes((prev) => [newNote, ...prev]);
    setActiveBookNoteId(newNote.id);
    setActiveTab('journal');
  };

  const handleUpdateBookNote = (id: string, updates: Partial<BookNote>) => {
    setBookNotes((prev) =>
      prev.map((bn) =>
        bn.id === id
          ? { ...bn, ...updates, updatedAt: formatArabicDate() }
          : bn
      )
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
  };

  const handleResetPlan = () => {
    setMonths(INITIAL_MONTHS);
    setCourses(INITIAL_COURSES);
    setBookNotes(INITIAL_BOOK_NOTES);
    setActiveBookNoteId(INITIAL_BOOK_NOTES[0]?.id ?? null);
    setDomainFilter('all');
    setSelectedMonthId(1);
    localStorage.removeItem(STORAGE_MONTHS_KEY);
    localStorage.removeItem(STORAGE_COURSES_KEY);
    localStorage.removeItem(STORAGE_BOOK_NOTES_KEY);
  };

  return (
    <div className="min-h-screen flex flex-col bg-[#F7F8FA] text-slate-900">
      <Header
        activeTab={activeTab}
        onSelectTab={setActiveTab}
        onExportExcel={handleExportExcel}
      />

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
            months={months}
            courses={courses}
            onNavigateTab={setActiveTab}
            onJumpToMonth={handleJumpToMonth}
            onExportExcel={handleExportExcel}
          />
        )}

        {activeTab === 'plan' && (
          <TwelveMonthPlanView
            months={months}
            courses={courses}
            selectedMonthId={selectedMonthId}
            domainFilter={domainFilter}
            onSelectMonth={setSelectedMonthId}
            onChangeDomainFilter={setDomainFilter}
            onUpdateMonthStatus={handleUpdateMonthStatus}
            onToggleActivity={handleToggleActivity}
            onUpdateMonthNotes={handleUpdateMonthNotes}
            onUpdateTrackItem={handleUpdateTrackItem}
            onToggleMonthTask={handleToggleMonthTask}
            onAddMonthTask={handleAddMonthTask}
            onDeleteMonthTask={handleDeleteMonthTask}
            onOpenBookNote={handleAddOrOpenBookNote}
          />
        )}

        {activeTab === 'domains' && (
          <DomainsView
            months={months}
            onFilterMonthsByDomain={handleFilterByDomain}
          />
        )}

        {activeTab === 'courses' && (
          <CoursesView
            courses={courses}
            onUpdateCourse={handleUpdateCourse}
            onToggleCourseTask={handleToggleCourseTask}
            onAddCourseTask={handleAddCourseTask}
            onDeleteCourseTask={handleDeleteCourseTask}
            onAddCourseResource={handleAddCourseResource}
            onDeleteCourseResource={handleDeleteCourseResource}
            onJumpToMonth={handleJumpToMonth}
          />
        )}

        {activeTab === 'journal' && (
          <NotesJournalView
            months={months}
            bookNotes={bookNotes}
            activeBookNoteId={activeBookNoteId}
            onSelectBookNote={setActiveBookNoteId}
            onAddBookNote={handleAddOrOpenBookNote}
            onUpdateBookNote={handleUpdateBookNote}
            onDeleteBookNote={handleDeleteBookNote}
            onUpdateMonthNotes={handleUpdateMonthNotes}
            onExportExcel={handleExportExcel}
          />
        )}
      </main>

      <footer className="border-t border-slate-200 bg-white mt-auto">
        <div className="max-w-[1280px] mx-auto px-4 sm:px-8 py-5 flex flex-col sm:flex-row items-center justify-between gap-4 text-xs text-slate-500">
          <p>
            ميزان المعرفة · خطة 12 شهرًا المتوازنة (قراءة · استماع · تلخيص · مناقشة وتطبيق)
          </p>
          <div className="flex items-center gap-4">
            <button
              type="button"
              onClick={handleExportExcel}
              className="text-slate-700 font-medium hover:text-[#1E3A5F] hover:underline cursor-pointer"
            >
              تنزيل ملف Excel
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
