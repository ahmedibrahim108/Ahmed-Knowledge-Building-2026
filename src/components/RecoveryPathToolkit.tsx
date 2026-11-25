import { useEffect, useMemo, useRef, useState } from 'react';
import {
  ArrowDown,
  ArrowUp,
  BookOpen,
  Calendar,
  Check,
  CheckCircle2,
  ChevronLeft,
  ChevronRight,
  Copy,
  Download,
  Edit3,
  ExternalLink,
  FileText,
  HandHeart,
  HeartHandshake,
  Layers,
  Moon,
  NotebookPen,
  Plus,
  Printer,
  RotateCcw,
  Share2,
  Sparkles,
  Trash2,
  Users,
} from 'lucide-react';
import {
  ActivityLogEntry,
  LearningHubId,
  LearningPath,
  NightlyInventoryEntry,
  NightlyInventoryQuestion,
  PersonalCourse,
  ReadingLibraryItem,
  RecoveryMeeting,
  RecoveryMeetingType,
  RecoveryPathWorkspace,
  RecoveryResourceItem,
  RecoveryResourceKind,
  RecoveryServiceItem,
  RecoveryServiceItemKind,
  RecoveryToolItem,
  getTodayDateKey,
} from '../data/curriculumData';
import {
  DEFAULT_NIGHTLY_INVENTORY_QUESTIONS,
  STARTER_RECOVERY_TOOLS,
  buildNightlyInventoryPrintHtml,
  buildWhatsAppShareUrl,
  formatNightlyInventoryText,
  loadLocalRecoveryWorkspace,
  resolveBestRecoveryWorkspace,
  sanitizeRecoveryHttpUrl,
  saveLocalRecoveryWorkspace,
} from '../utils/recoveryPathStorage';
import BidiText from './BidiText';

type RecoverySectionTab =
  | 'meetings'
  | 'tools'
  | 'inventory'
  | 'service'
  | 'resources';

export interface RecoveryDailyLogPayload {
  entityType: ActivityLogEntry['entityType'];
  entityId: string;
  action: ActivityLogEntry['action'];
  title: string;
  subtitle?: string;
  hubId?: LearningHubId;
  dateKey?: string;
}

interface RecoveryPathToolkitProps {
  uid?: string;
  canEdit: boolean;
  path: LearningPath;
  cloudWorkspace?: RecoveryPathWorkspace;
  onSaveWorkspace?: (pathId: string, nextWorkspace: RecoveryPathWorkspace) => void;
  activityLogs?: ActivityLogEntry[];
  onLogRecoveryActivity?: (payload: RecoveryDailyLogPayload) => boolean;
  courses: PersonalCourse[];
  readingItems: ReadingLibraryItem[];
  onToggleLinkedCourse: (courseId: number) => void;
  onOpenCourse: (courseId: number) => void;
  onOpenLibrary?: () => void;
}

const SERVICE_KIND_LABELS: Record<RecoveryServiceItemKind, string> = {
  space: 'مساحة خدمة',
  commitment: 'التزام',
  task: 'مهمة خدمة',
  note: 'ملاحظة',
  resource: 'مورد / رابط',
};

const RESOURCE_KIND_LABELS: Record<RecoveryResourceKind, string> = {
  workshop: 'ورشة عمل',
  book_article: 'كتاب / مقال',
  media: 'صوت / فيديو',
  link: 'رابط / مرجع',
};

const TOOL_CATEGORY_OPTIONS = [
  'الامتنان',
  'الجرد',
  'التأمل',
  'الخطوات',
  'الدعاء',
  'القراءة',
  'التواصل',
  'أخرى',
];

function shiftDateKey(dateKey: string, deltaDays: number): string {
  const parts = dateKey.split('-').map(Number);
  if (parts.length !== 3 || parts.some((n) => !Number.isFinite(n))) {
    return getTodayDateKey();
  }
  const dt = new Date(parts[0], parts[1] - 1, parts[2]);
  dt.setDate(dt.getDate() + deltaDays);
  const y = dt.getFullYear();
  const m = String(dt.getMonth() + 1).padStart(2, '0');
  const d = String(dt.getDate()).padStart(2, '0');
  return `${y}-${m}-${d}`;
}

export default function RecoveryPathToolkit({
  uid,
  canEdit,
  path,
  cloudWorkspace,
  onSaveWorkspace,
  activityLogs = [],
  onLogRecoveryActivity,
  courses,
  readingItems,
  onToggleLinkedCourse,
  onOpenCourse,
  onOpenLibrary,
}: RecoveryPathToolkitProps) {
  const [activeTab, setActiveTab] = useState<RecoverySectionTab>('meetings');

  const initialWorkspace = useMemo(() => {
    const local = loadLocalRecoveryWorkspace(uid, path.id);
    return resolveBestRecoveryWorkspace(path.id, cloudWorkspace, local);
  }, [uid, path.id]);

  const [workspace, setWorkspace] = useState<RecoveryPathWorkspace>(initialWorkspace);
  const workspaceRef = useRef<RecoveryPathWorkspace>(workspace);
  workspaceRef.current = workspace;

  const autosaveTimerRef = useRef<number | null>(null);
  const lastSavedSnapshotRef = useRef<number>(initialWorkspace.updatedAtMs);

  // Sync if cloudWorkspace arrives newer from another device or initial hydration
  useEffect(() => {
    const local = loadLocalRecoveryWorkspace(uid, path.id);
    const resolved = resolveBestRecoveryWorkspace(path.id, cloudWorkspace, local);
    if (resolved.updatedAtMs > workspaceRef.current.updatedAtMs) {
      setWorkspace(resolved);
      saveLocalRecoveryWorkspace(uid, resolved);
      lastSavedSnapshotRef.current = resolved.updatedAtMs;
    }
  }, [uid, path.id, cloudWorkspace]);

  const commitWorkspace = (
    updater: (prev: RecoveryPathWorkspace) => RecoveryPathWorkspace,
    options?: { debounce?: boolean }
  ) => {
    setWorkspace((prev) => {
      const nextRaw = updater(prev);
      const next: RecoveryPathWorkspace = {
        ...nextRaw,
        pathId: path.id,
        updatedAtMs: Date.now(),
      };
      workspaceRef.current = next;
      saveLocalRecoveryWorkspace(uid, next);

      if (autosaveTimerRef.current !== null) {
        window.clearTimeout(autosaveTimerRef.current);
        autosaveTimerRef.current = null;
      }

      if (canEdit && onSaveWorkspace) {
        if (options?.debounce) {
          autosaveTimerRef.current = window.setTimeout(() => {
            autosaveTimerRef.current = null;
            onSaveWorkspace(path.id, workspaceRef.current);
            lastSavedSnapshotRef.current = workspaceRef.current.updatedAtMs;
          }, 450);
        } else {
          onSaveWorkspace(path.id, next);
          lastSavedSnapshotRef.current = next.updatedAtMs;
        }
      }
      return next;
    });
  };

  useEffect(() => {
    return () => {
      if (autosaveTimerRef.current !== null) {
        window.clearTimeout(autosaveTimerRef.current);
        autosaveTimerRef.current = null;
        if (canEdit && onSaveWorkspace) {
          onSaveWorkspace(path.id, workspaceRef.current);
        }
      }
    };
  }, [canEdit, onSaveWorkspace, path.id]);

  // Helper to check if an activity already exists in Daily Log for dateKey
  const isLoggedOnDate = (
    entityType: ActivityLogEntry['entityType'],
    entityId: string,
    dateKey: string
  ) =>
    activityLogs.some(
      (a) =>
        a.dateKey === dateKey &&
        a.entityType === entityType &&
        a.entityId === entityId
    );

  // Brief inline feedback banner
  const [feedbackMsg, setFeedbackMsg] = useState<string | null>(null);
  const showFeedback = (msg: string) => {
    setFeedbackMsg(msg);
    window.setTimeout(() => {
      setFeedbackMsg((cur) => (cur === msg ? null : cur));
    }, 3200);
  };

  // =========================================================================
  // 1. MEETINGS STATE
  // =========================================================================
  const [showMeetingForm, setShowMeetingForm] = useState(false);
  const [editingMeetingId, setEditingMeetingId] = useState<string | null>(null);
  const [meetingName, setMeetingName] = useState('');
  const [meetingSchedule, setMeetingSchedule] = useState('');
  const [meetingType, setMeetingType] = useState<RecoveryMeetingType>('أونلاين');
  const [meetingLocation, setMeetingLocation] = useState('');
  const [meetingNotes, setMeetingNotes] = useState('');
  const [attendanceDateKey, setAttendanceDateKey] = useState(() =>
    getTodayDateKey()
  );
  const [attendanceNoteByMtg, setAttendanceNoteByMtg] = useState<
    Record<string, string>
  >({});

  const resetMeetingForm = () => {
    setEditingMeetingId(null);
    setMeetingName('');
    setMeetingSchedule('');
    setMeetingType('أونلاين');
    setMeetingLocation('');
    setMeetingNotes('');
    setShowMeetingForm(false);
  };

  const handleSaveMeeting = (e: React.FormEvent) => {
    e.preventDefault();
    if (!canEdit || !meetingName.trim()) return;
    const cleanName = meetingName.trim();
    const cleanSchedule = meetingSchedule.trim();
    const cleanLoc = meetingLocation.trim();
    const cleanNotes = meetingNotes.trim();

    if (editingMeetingId) {
      commitWorkspace((prev) => ({
        ...prev,
        meetings: prev.meetings.map((m) =>
          m.id === editingMeetingId
            ? {
                ...m,
                name: cleanName,
                schedule: cleanSchedule,
                meetingType,
                locationOrLink: cleanLoc || undefined,
                notes: cleanNotes || undefined,
              }
            : m
        ),
      }));
      showFeedback('تم تحديث بيانات الاجتماع');
    } else {
      const newMeeting: RecoveryMeeting = {
        id: `rmtg-${Date.now()}-${Math.floor(Math.random() * 1000)}`,
        name: cleanName,
        schedule: cleanSchedule,
        meetingType,
        locationOrLink: cleanLoc || undefined,
        notes: cleanNotes || undefined,
        createdAtMs: Date.now(),
      };
      commitWorkspace((prev) => ({
        ...prev,
        meetings: [newMeeting, ...prev.meetings],
      }));
      showFeedback('تمت إضافة الاجتماع إلى مسار التعافي');
    }
    resetMeetingForm();
  };

  const handleStartEditMeeting = (m: RecoveryMeeting) => {
    setEditingMeetingId(m.id);
    setMeetingName(m.name);
    setMeetingSchedule(m.schedule);
    setMeetingType(m.meetingType);
    setMeetingLocation(m.locationOrLink || '');
    setMeetingNotes(m.notes || '');
    setShowMeetingForm(true);
  };

  const handleDeleteMeeting = (id: string) => {
    if (!canEdit) return;
    commitWorkspace((prev) => ({
      ...prev,
      meetings: prev.meetings.filter((m) => m.id !== id),
    }));
  };

  const handleConfirmMeetingAttendance = (meeting: RecoveryMeeting) => {
    if (!canEdit) return;
    const targetDate = attendanceDateKey || getTodayDateKey();
    const alreadyAttended = workspace.attendanceLogs.some(
      (a) => a.meetingId === meeting.id && a.dateKey === targetDate
    );
    if (alreadyAttended) {
      showFeedback(`تم تسجيل حضور «${meeting.name}» مسبقًا بتاريخ ${targetDate}`);
      return;
    }

    const noteText = (attendanceNoteByMtg[meeting.id] || '').trim();
    const newAttendance = {
      id: `ratt-${Date.now()}-${Math.floor(Math.random() * 1000)}`,
      meetingId: meeting.id,
      meetingName: meeting.name,
      dateKey: targetDate,
      note: noteText || undefined,
      attendedAtMs: Date.now(),
    };

    commitWorkspace((prev) => ({
      ...prev,
      attendanceLogs: [newAttendance, ...prev.attendanceLogs],
    }));

    setAttendanceNoteByMtg((prev) => ({ ...prev, [meeting.id]: '' }));

    let logged = false;
    if (onLogRecoveryActivity) {
      logged = onLogRecoveryActivity({
        entityType: 'meeting',
        entityId: `recovery-meeting:${path.id}:${meeting.id}`,
        action: 'completed',
        title: `حضور اجتماع: ${meeting.name}`,
        subtitle: `مسار ${path.title}${meeting.schedule ? ` · ${meeting.schedule}` : ''}`,
        hubId: path.hubId,
        dateKey: targetDate,
      });
    }

    showFeedback(
      logged
        ? `تم تأكيد الحضور وتسجيله في السجل اليومي (${targetDate})`
        : `تم تأكيد الحضور وحفظه في سجل الاجتماعات (${targetDate})`
    );
  };

  const handleDeleteAttendanceRecord = (attendanceId: string) => {
    if (!canEdit) return;
    commitWorkspace((prev) => ({
      ...prev,
      attendanceLogs: prev.attendanceLogs.filter((a) => a.id !== attendanceId),
    }));
  };

  // =========================================================================
  // 2. RECOVERY TOOLS STATE
  // =========================================================================
  const [showToolForm, setShowToolForm] = useState(false);
  const [editingToolId, setEditingToolId] = useState<string | null>(null);
  const [toolTitle, setToolTitle] = useState('');
  const [toolCategory, setToolCategory] = useState('الامتنان');
  const [toolCadence, setToolCadence] = useState('يومي');
  const [toolDesc, setToolDesc] = useState('');
  const [practiceDateKey, setPracticeDateKey] = useState(() => getTodayDateKey());
  const [logToolToJournal, setLogToolToJournal] = useState(true);
  const [practiceNoteByTool, setPracticeNoteByTool] = useState<
    Record<string, string>
  >({});

  const resetToolForm = () => {
    setEditingToolId(null);
    setToolTitle('');
    setToolCategory('الامتنان');
    setToolCadence('يومي');
    setToolDesc('');
    setShowToolForm(false);
  };

  const sortedTools = useMemo(
    () => [...workspace.tools].sort((a, b) => a.sortOrder - b.sortOrder),
    [workspace.tools]
  );

  const handleSaveTool = (e: React.FormEvent) => {
    e.preventDefault();
    if (!canEdit || !toolTitle.trim()) return;
    const cleanTitle = toolTitle.trim();
    if (editingToolId) {
      commitWorkspace((prev) => ({
        ...prev,
        tools: prev.tools.map((t) =>
          t.id === editingToolId
            ? {
                ...t,
                title: cleanTitle,
                category: toolCategory,
                cadence: toolCadence.trim() || undefined,
                description: toolDesc.trim() || undefined,
              }
            : t
        ),
      }));
      showFeedback('تم تحديث أداة التعافي');
    } else {
      const nextTool: RecoveryToolItem = {
        id: `rtool-${Date.now()}-${Math.floor(Math.random() * 1000)}`,
        title: cleanTitle,
        category: toolCategory,
        cadence: toolCadence.trim() || undefined,
        description: toolDesc.trim() || undefined,
        sortOrder: workspace.tools.length,
        createdAtMs: Date.now(),
      };
      commitWorkspace((prev) => ({
        ...prev,
        tools: [...prev.tools, nextTool],
      }));
      showFeedback('تمت إضافة أداة التعافي');
    }
    resetToolForm();
  };

  const handleQuickAddStarterTool = (preset: {
    title: string;
    category: string;
    description: string;
    cadence: string;
  }) => {
    if (!canEdit) return;
    const exists = workspace.tools.some(
      (t) => t.title.trim() === preset.title.trim()
    );
    if (exists) return;
    const nextTool: RecoveryToolItem = {
      id: `rtool-${Date.now()}-${Math.floor(Math.random() * 1000)}`,
      title: preset.title,
      category: preset.category,
      description: preset.description,
      cadence: preset.cadence,
      sortOrder: workspace.tools.length,
      createdAtMs: Date.now(),
    };
    commitWorkspace((prev) => ({
      ...prev,
      tools: [...prev.tools, nextTool],
    }));
    showFeedback(`تمت إضافة «${preset.title}»`);
  };

  const handleMoveTool = (idx: number, dir: -1 | 1) => {
    if (!canEdit) return;
    const targetIdx = idx + dir;
    if (targetIdx < 0 || targetIdx >= sortedTools.length) return;
    const reordered = [...sortedTools];
    const [moved] = reordered.splice(idx, 1);
    reordered.splice(targetIdx, 0, moved);
    const normalized = reordered.map((t, i) => ({ ...t, sortOrder: i }));
    commitWorkspace((prev) => ({ ...prev, tools: normalized }));
  };

  const handleDeleteTool = (id: string) => {
    if (!canEdit) return;
    commitWorkspace((prev) => ({
      ...prev,
      tools: prev.tools.filter((t) => t.id !== id),
    }));
  };

  const handleRecordPractice = (tool: RecoveryToolItem) => {
    if (!canEdit) return;
    const targetDate = practiceDateKey || getTodayDateKey();
    const noteText = (practiceNoteByTool[tool.id] || '').trim();
    const shouldLog = logToolToJournal && Boolean(onLogRecoveryActivity);

    let recordedInJournal = false;
    if (shouldLog && onLogRecoveryActivity) {
      recordedInJournal = onLogRecoveryActivity({
        entityType: 'learning_path',
        entityId: `recovery-tool:${path.id}:${tool.id}`,
        action: 'completed',
        title: `ممارسة أداة التعافي: ${tool.title}`,
        subtitle: noteText
          ? `${tool.category} · ${noteText}`
          : `مسار ${path.title} · ${tool.category}`,
        hubId: path.hubId,
        dateKey: targetDate,
      });
    }

    const logItem = {
      id: `rprac-${Date.now()}-${Math.floor(Math.random() * 1000)}`,
      toolId: tool.id,
      toolTitle: tool.title,
      dateKey: targetDate,
      note: noteText || undefined,
      loggedToDailyJournal: recordedInJournal,
      practicedAtMs: Date.now(),
    };

    commitWorkspace((prev) => ({
      ...prev,
      practiceLogs: [logItem, ...prev.practiceLogs],
    }));

    setPracticeNoteByTool((prev) => ({ ...prev, [tool.id]: '' }));
    showFeedback(
      recordedInJournal
        ? `تم تسجيل ممارسة «${tool.title}» وإدراجها في السجل اليومي`
        : `تم تسجيل ممارسة «${tool.title}»`
    );
  };

  // =========================================================================
  // 3. NIGHTLY INVENTORY STATE (Strictly private; never pushed to Daily Log)
  // =========================================================================
  const [inventoryDateKey, setInventoryDateKey] = useState(() =>
    getTodayDateKey()
  );
  const [editingQuestions, setEditingQuestions] = useState(false);
  const [newQuestionText, setNewQuestionText] = useState('');
  const [newQuestionHint, setNewQuestionHint] = useState('');
  const [copiedInventory, setCopiedInventory] = useState(false);
  const [showPastInventories, setShowPastInventories] = useState(false);

  const sortedQuestions = useMemo(
    () =>
      [...workspace.inventoryQuestions].sort(
        (a, b) => a.sortOrder - b.sortOrder
      ),
    [workspace.inventoryQuestions]
  );

  const currentInventoryEntry: NightlyInventoryEntry | undefined =
    workspace.inventoryEntries[inventoryDateKey];

  const savedInventoryDates = useMemo(() => {
    return Object.values(workspace.inventoryEntries)
      .filter((entry) => {
        const hasAns = Object.values(entry.answers || {}).some((v) =>
          Boolean(v && v.trim())
        );
        return hasAns || Boolean(entry.generalNote && entry.generalNote.trim());
      })
      .sort((a, b) => b.dateKey.localeCompare(a.dateKey));
  }, [workspace.inventoryEntries]);

  const handleInventoryAnswerChange = (questionId: string, val: string) => {
    if (!canEdit) return;
    commitWorkspace(
      (prev) => {
        const existing: NightlyInventoryEntry = prev.inventoryEntries[
          inventoryDateKey
        ] || {
          dateKey: inventoryDateKey,
          answers: {},
          updatedAtMs: Date.now(),
        };
        return {
          ...prev,
          inventoryEntries: {
            ...prev.inventoryEntries,
            [inventoryDateKey]: {
              ...existing,
              answers: {
                ...existing.answers,
                [questionId]: val,
              },
              updatedAtMs: Date.now(),
            },
          },
        };
      },
      { debounce: true }
    );
  };

  const handleInventoryGeneralNoteChange = (val: string) => {
    if (!canEdit) return;
    commitWorkspace(
      (prev) => {
        const existing: NightlyInventoryEntry = prev.inventoryEntries[
          inventoryDateKey
        ] || {
          dateKey: inventoryDateKey,
          answers: {},
          updatedAtMs: Date.now(),
        };
        return {
          ...prev,
          inventoryEntries: {
            ...prev.inventoryEntries,
            [inventoryDateKey]: {
              ...existing,
              generalNote: val,
              updatedAtMs: Date.now(),
            },
          },
        };
      },
      { debounce: true }
    );
  };

  const handleAddInventoryQuestion = (e: React.FormEvent) => {
    e.preventDefault();
    if (!canEdit || !newQuestionText.trim()) return;
    const newQ: NightlyInventoryQuestion = {
      id: `inv-q-${Date.now()}-${Math.floor(Math.random() * 1000)}`,
      prompt: newQuestionText.trim(),
      helperHint: newQuestionHint.trim() || undefined,
      sortOrder: sortedQuestions.length,
    };
    commitWorkspace((prev) => ({
      ...prev,
      inventoryQuestions: [...prev.inventoryQuestions, newQ],
    }));
    setNewQuestionText('');
    setNewQuestionHint('');
    showFeedback('تمت إضافة سؤال جديد للجرد الليلي');
  };

  const handleEditQuestionPrompt = (qId: string, prompt: string) => {
    if (!canEdit) return;
    commitWorkspace(
      (prev) => ({
        ...prev,
        inventoryQuestions: prev.inventoryQuestions.map((q) =>
          q.id === qId ? { ...q, prompt } : q
        ),
      }),
      { debounce: true }
    );
  };

  const handleMoveQuestion = (idx: number, dir: -1 | 1) => {
    if (!canEdit) return;
    const targetIdx = idx + dir;
    if (targetIdx < 0 || targetIdx >= sortedQuestions.length) return;
    const list = [...sortedQuestions];
    const [item] = list.splice(idx, 1);
    list.splice(targetIdx, 0, item);
    const normalized = list.map((q, i) => ({ ...q, sortOrder: i }));
    commitWorkspace((prev) => ({ ...prev, inventoryQuestions: normalized }));
  };

  const handleDeleteQuestion = (qId: string) => {
    if (!canEdit) return;
    commitWorkspace((prev) => ({
      ...prev,
      inventoryQuestions: prev.inventoryQuestions.filter((q) => q.id !== qId),
    }));
  };

  const handleResetDefaultQuestions = () => {
    if (!canEdit) return;
    commitWorkspace((prev) => ({
      ...prev,
      inventoryQuestions: DEFAULT_NIGHTLY_INVENTORY_QUESTIONS.map((q) => ({
        ...q,
      })),
    }));
    showFeedback('تمت استعادة الأسئلة الافتراضية للجرد الليلي');
  };

  const formattedInventoryText = useMemo(
    () =>
      formatNightlyInventoryText(
        inventoryDateKey,
        sortedQuestions,
        currentInventoryEntry,
        path.title
      ),
    [inventoryDateKey, sortedQuestions, currentInventoryEntry, path.title]
  );

  const handleCopyInventory = async () => {
    try {
      await navigator.clipboard.writeText(formattedInventoryText);
      setCopiedInventory(true);
      window.setTimeout(() => setCopiedInventory(false), 2500);
    } catch {
      showFeedback('تعذر النسخ التلقائي — يمكنك استخدام تنزيل الملف النصي');
    }
  };

  const handleDownloadInventoryTxt = () => {
    const blob = new Blob(['\uFEFF' + formattedInventoryText], {
      type: 'text/plain;charset=utf-8',
    });
    const url = URL.createObjectURL(blob);
    const a = document.createElement('a');
    a.href = url;
    a.download = `الجرد-الليلي-${inventoryDateKey}.txt`;
    document.body.appendChild(a);
    a.click();
    document.body.removeChild(a);
    window.setTimeout(() => URL.revokeObjectURL(url), 1000);
  };

  const handleExportInventoryPdf = () => {
    const html = buildNightlyInventoryPrintHtml(
      inventoryDateKey,
      sortedQuestions,
      currentInventoryEntry,
      path.title
    );
    const iframe = document.createElement('iframe');
    iframe.style.position = 'fixed';
    iframe.style.right = '0';
    iframe.style.bottom = '0';
    iframe.style.width = '0';
    iframe.style.height = '0';
    iframe.style.border = '0';
    iframe.setAttribute('aria-hidden', 'true');
    iframe.srcdoc = html;
    iframe.onload = () => {
      try {
        iframe.contentWindow?.focus();
        iframe.contentWindow?.print();
      } catch {
        // Fallback: download HTML if print blocked in embedded sandbox
        const blob = new Blob([html], { type: 'text/html;charset=utf-8' });
        const url = URL.createObjectURL(blob);
        const a = document.createElement('a');
        a.href = url;
        a.download = `الجرد-الليلي-${inventoryDateKey}.html`;
        document.body.appendChild(a);
        a.click();
        document.body.removeChild(a);
        window.setTimeout(() => URL.revokeObjectURL(url), 1000);
      }
      window.setTimeout(() => {
        if (iframe.parentNode) {
          iframe.parentNode.removeChild(iframe);
        }
      }, 2000);
    };
    document.body.appendChild(iframe);
  };

  const handleNativeShareInventory = async () => {
    if (typeof navigator === 'undefined' || !navigator.share) return;
    try {
      await navigator.share({
        title: `الجرد الليلي — ${inventoryDateKey}`,
        text: formattedInventoryText,
      });
    } catch {
      // User cancelled share sheet
    }
  };

  // =========================================================================
  // 4. SERVICE STATE
  // =========================================================================
  const [showServiceForm, setShowServiceForm] = useState(false);
  const [serviceKind, setServiceKind] =
    useState<RecoveryServiceItemKind>('commitment');
  const [serviceTitle, setServiceTitle] = useState('');
  const [serviceSpaceName, setServiceSpaceName] = useState('');
  const [serviceDetail, setServiceDetail] = useState('');
  const [serviceLinkUrl, setServiceLinkUrl] = useState('');
  const [serviceNotes, setServiceNotes] = useState('');
  const [serviceFilter, setServiceFilter] = useState<'all' | RecoveryServiceItemKind>('all');
  const [logServiceOnComplete, setLogServiceOnComplete] = useState(true);

  const handleAddServiceItem = (e: React.FormEvent) => {
    e.preventDefault();
    if (!canEdit || !serviceTitle.trim()) return;
    const item: RecoveryServiceItem = {
      id: `rsrv-${Date.now()}-${Math.floor(Math.random() * 1000)}`,
      kind: serviceKind,
      title: serviceTitle.trim(),
      spaceName: serviceSpaceName.trim() || undefined,
      scheduleOrDetail: serviceDetail.trim() || undefined,
      linkUrl: sanitizeRecoveryHttpUrl(serviceLinkUrl.trim()) || undefined,
      notes: serviceNotes.trim() || undefined,
      completed: false,
      createdAtMs: Date.now(),
    };
    commitWorkspace((prev) => ({
      ...prev,
      serviceItems: [item, ...prev.serviceItems],
    }));
    setServiceTitle('');
    setServiceSpaceName('');
    setServiceDetail('');
    setServiceLinkUrl('');
    setServiceNotes('');
    setShowServiceForm(false);
    showFeedback('تمت إضافة عنصر الخدمة');
  };

  const handleToggleServiceComplete = (item: RecoveryServiceItem) => {
    if (!canEdit) return;
    const nextDone = !item.completed;
    const today = getTodayDateKey();
    commitWorkspace((prev) => ({
      ...prev,
      serviceItems: prev.serviceItems.map((s) =>
        s.id === item.id
          ? {
              ...s,
              completed: nextDone,
              completedDateKey: nextDone ? today : undefined,
              completedAtMs: nextDone ? Date.now() : undefined,
            }
          : s
      ),
    }));

    if (nextDone && logServiceOnComplete && onLogRecoveryActivity) {
      const logged = onLogRecoveryActivity({
        entityType: 'learning_path',
        entityId: `recovery-service:${path.id}:${item.id}`,
        action: 'completed',
        title: `نشاط خدمة: ${item.title}`,
        subtitle: item.spaceName
          ? `مسار ${path.title} · ${item.spaceName}`
          : `مسار ${path.title} · ${SERVICE_KIND_LABELS[item.kind]}`,
        hubId: path.hubId,
        dateKey: today,
      });
      if (logged) {
        showFeedback(`تم إتمام الخدمة وتسجيلها في السجل اليومي`);
      }
    }
  };

  const handleDeleteServiceItem = (id: string) => {
    if (!canEdit) return;
    commitWorkspace((prev) => ({
      ...prev,
      serviceItems: prev.serviceItems.filter((s) => s.id !== id),
    }));
  };

  const filteredServiceItems = useMemo(() => {
    if (serviceFilter === 'all') return workspace.serviceItems;
    return workspace.serviceItems.filter((s) => s.kind === serviceFilter);
  }, [workspace.serviceItems, serviceFilter]);

  // =========================================================================
  // 5. COURSES & RECOVERY RESOURCES STATE
  // =========================================================================
  const [showResourceForm, setShowResourceForm] = useState(false);
  const [resKind, setResKind] = useState<RecoveryResourceKind>('workshop');
  const [resTitle, setResTitle] = useState('');
  const [resUrl, setResUrl] = useState('');
  const [resNotes, setResNotes] = useState('');
  const [logResourceOnComplete, setLogResourceOnComplete] = useState(true);

  const linkedCourses = useMemo(
    () => courses.filter((c) => path.linkedCourseIds.includes(c.id)),
    [courses, path.linkedCourseIds]
  );

  const linkedReadingItems = useMemo(
    () =>
      readingItems.filter((item) =>
        workspace.linkedReadingIds.includes(item.id)
      ),
    [readingItems, workspace.linkedReadingIds]
  );

  const handleToggleLinkedReading = (readingId: string) => {
    if (!canEdit) return;
    commitWorkspace((prev) => {
      const exists = prev.linkedReadingIds.includes(readingId);
      return {
        ...prev,
        linkedReadingIds: exists
          ? prev.linkedReadingIds.filter((id) => id !== readingId)
          : [...prev.linkedReadingIds, readingId],
      };
    });
  };

  const handleAddCustomResource = (e: React.FormEvent) => {
    e.preventDefault();
    if (!canEdit || !resTitle.trim()) return;
    const item: RecoveryResourceItem = {
      id: `rres-${Date.now()}-${Math.floor(Math.random() * 1000)}`,
      kind: resKind,
      title: resTitle.trim(),
      url: sanitizeRecoveryHttpUrl(resUrl.trim()) || undefined,
      notes: resNotes.trim() || undefined,
      completed: false,
      createdAtMs: Date.now(),
    };
    commitWorkspace((prev) => ({
      ...prev,
      customResources: [item, ...prev.customResources],
    }));
    setResTitle('');
    setResUrl('');
    setResNotes('');
    setShowResourceForm(false);
    showFeedback('تمت إضافة المورد إلى مسار التعافي');
  };

  const handleToggleCustomResourceComplete = (res: RecoveryResourceItem) => {
    if (!canEdit) return;
    const nextDone = !res.completed;
    const today = getTodayDateKey();
    commitWorkspace((prev) => ({
      ...prev,
      customResources: prev.customResources.map((r) =>
        r.id === res.id
          ? {
              ...r,
              completed: nextDone,
              completedDateKey: nextDone ? today : undefined,
              completedAtMs: nextDone ? Date.now() : undefined,
            }
          : r
      ),
    }));

    if (nextDone && logResourceOnComplete && onLogRecoveryActivity) {
      const logged = onLogRecoveryActivity({
        entityType: 'learning_path',
        entityId: `recovery-resource:${path.id}:${res.id}`,
        action: 'completed',
        title: `إتمام مورد تعافي: ${res.title}`,
        subtitle: `مسار ${path.title} · ${RESOURCE_KIND_LABELS[res.kind]}`,
        hubId: path.hubId,
        dateKey: today,
      });
      if (logged) {
        showFeedback('تم إتمام المورد وتسجيله في السجل اليومي');
      }
    }
  };

  const handleDeleteCustomResource = (id: string) => {
    if (!canEdit) return;
    commitWorkspace((prev) => ({
      ...prev,
      customResources: prev.customResources.filter((r) => r.id !== id),
    }));
  };

  const handleLogLinkedCourseSession = (course: PersonalCourse) => {
    if (!canEdit || !onLogRecoveryActivity) return;
    const today = getTodayDateKey();
    const logged = onLogRecoveryActivity({
      entityType: 'course',
      entityId: String(course.id),
      action: 'studied',
      title: course.title,
      subtitle: `مسار ${path.title}`,
      hubId: course.hubId || path.hubId,
      dateKey: today,
    });
    showFeedback(
      logged
        ? `تم تسجيل نشاط الكورس «${course.title}» في السجل اليومي`
        : `الكورس «${course.title}» مسجّل بالفعل في سجل اليوم`
    );
  };

  const handleLogLinkedReadingSession = (item: ReadingLibraryItem) => {
    if (!canEdit || !onLogRecoveryActivity) return;
    const today = getTodayDateKey();
    const logged = onLogRecoveryActivity({
      entityType: 'reading_item',
      entityId: item.id,
      action: 'studied',
      title: item.title,
      subtitle: `مسار ${path.title}`,
      hubId: item.hubId || path.hubId,
      dateKey: today,
    });
    showFeedback(
      logged
        ? `تم تسجيل قراءة «${item.title}» في السجل اليومي`
        : `قراءة «${item.title}» مسجّلة بالفعل في سجل اليوم`
    );
  };

  // Tab navigation definition
  const tabs: Array<{
    id: RecoverySectionTab;
    label: string;
    countLabel: string;
    icon: typeof Users;
  }> = [
    {
      id: 'meetings',
      label: 'الاجتماعات',
      countLabel: `${workspace.meetings.length}`,
      icon: Users,
    },
    {
      id: 'tools',
      label: 'أدوات التعافي',
      countLabel: `${workspace.tools.length}`,
      icon: Sparkles,
    },
    {
      id: 'inventory',
      label: 'الجرد الليلي',
      countLabel: `${savedInventoryDates.length}`,
      icon: Moon,
    },
    {
      id: 'service',
      label: 'الخدمة',
      countLabel: `${workspace.serviceItems.length}`,
      icon: HandHeart,
    },
    {
      id: 'resources',
      label: 'الكورسات والموارد',
      countLabel: `${
        linkedCourses.length +
        linkedReadingItems.length +
        workspace.customResources.length
      }`,
      icon: BookOpen,
    },
  ];

  const todayKey = getTodayDateKey();
  const todayMeetingsAttended = workspace.attendanceLogs.filter(
    (a) => a.dateKey === todayKey
  ).length;
  const todayPracticesCount = workspace.practiceLogs.filter(
    (p) => p.dateKey === todayKey
  ).length;

  return (
    <section
      aria-label="أدوات مسار التعافي المدمجة"
      className="bg-slate-50/70 border border-slate-200 rounded-xl p-4 sm:p-6 space-y-5"
    >
      {/* Header */}
      <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-3 border-b border-slate-200 pb-4">
        <div className="space-y-1">
          <div className="flex items-center gap-2 text-[#1E3A5F]">
            <HeartHandshake className="w-5 h-5 shrink-0" aria-hidden="true" />
            <h2 className="text-base sm:text-lg font-bold text-slate-900">
              أدوات مسار التعافي المدمجة
            </h2>
          </div>
          <p className="text-xs text-slate-600 leading-relaxed">
            مساحة عملية خاصة بمسار «{path.title}» لمتابعة الاجتماعات، أدوات التعافي اليومية، الجرد الليلي الخاص، الخدمة، والموارد المرتبطة.
          </p>
        </div>

        <div className="flex flex-wrap items-center gap-3 text-xs text-slate-600 tabular-nums shrink-0">
          <span className="px-2.5 py-1 bg-white border border-slate-200 rounded-lg">
            حضور اليوم: <strong className="text-slate-900">{todayMeetingsAttended}</strong>
          </span>
          <span className="px-2.5 py-1 bg-white border border-slate-200 rounded-lg">
            ممارسات اليوم: <strong className="text-slate-900">{todayPracticesCount}</strong>
          </span>
        </div>
      </div>

      {/* Inline Feedback Notice */}
      {feedbackMsg && (
        <div
          role="status"
          className="px-3.5 py-2.5 bg-emerald-50 border border-emerald-200 rounded-lg text-xs font-medium text-emerald-800 flex items-center justify-between gap-2"
        >
          <span className="flex items-center gap-1.5">
            <CheckCircle2 className="w-4 h-4 shrink-0" aria-hidden="true" />
            {feedbackMsg}
          </span>
        </div>
      )}

      {/* Navigation Tabs */}
      <div
        role="tablist"
        aria-label="أقسام التعافي"
        className="flex flex-wrap items-center gap-1.5 bg-white border border-slate-200 rounded-xl p-1.5"
      >
        {tabs.map((tab) => {
          const Icon = tab.icon;
          const active = activeTab === tab.id;
          return (
            <button
              key={tab.id}
              type="button"
              role="tab"
              aria-selected={active}
              onClick={() => setActiveTab(tab.id)}
              className={`inline-flex items-center gap-1.5 px-3 py-2 min-h-[38px] text-xs font-semibold rounded-lg transition-colors cursor-pointer whitespace-nowrap ${
                active
                  ? 'bg-[#1E3A5F] text-white'
                  : 'text-slate-600 hover:bg-slate-100 hover:text-slate-900'
              }`}
            >
              <Icon className="w-3.5 h-3.5 shrink-0" aria-hidden="true" />
              <span>{tab.label}</span>
              <span
                className={`text-[11px] tabular-nums px-1.5 py-0.5 rounded ${
                  active
                    ? 'bg-white/20 text-white'
                    : 'bg-slate-100 text-slate-600'
                }`}
              >
                {tab.countLabel}
              </span>
            </button>
          );
        })}
      </div>

      {/* =================================================================== */}
      {/* TAB 1: MEETINGS                                                     */}
      {/* =================================================================== */}
      {activeTab === 'meetings' && (
        <div className="space-y-4">
          <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-3">
            <div className="flex flex-wrap items-center gap-2 text-xs text-slate-600">
              <span>تاريخ تأكيد الحضور:</span>
              <input
                type="date"
                value={attendanceDateKey}
                onChange={(e) =>
                  setAttendanceDateKey(e.target.value || getTodayDateKey())
                }
                className="px-2.5 py-1.5 text-xs bg-white border border-slate-300 rounded-lg tabular-nums"
              />
            </div>

            {canEdit && (
              <button
                type="button"
                onClick={() => {
                  if (showMeetingForm) {
                    resetMeetingForm();
                  } else {
                    setShowMeetingForm(true);
                  }
                }}
                className="inline-flex items-center justify-center gap-1.5 px-3.5 py-2 min-h-[38px] text-xs font-semibold text-white bg-[#1E3A5F] hover:bg-[#162C49] rounded-lg cursor-pointer shrink-0"
              >
                <Plus className="w-3.5 h-3.5" aria-hidden="true" />
                <span>{showMeetingForm ? 'إلغاء' : 'إضافة اجتماع تعافي'}</span>
              </button>
            )}
          </div>

          {showMeetingForm && canEdit && (
            <form
              onSubmit={handleSaveMeeting}
              className="bg-white border border-slate-200 rounded-xl p-4 space-y-3"
            >
              <h3 className="text-sm font-bold text-slate-900">
                {editingMeetingId ? 'تعديل بيانات الاجتماع' : 'اجتماع تعافي جديد'}
              </h3>
              <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
                <label className="block text-xs font-medium text-slate-700">
                  اسم الاجتماع (مطلوب)
                  <input
                    type="text"
                    required
                    value={meetingName}
                    onChange={(e) => setMeetingName(e.target.value)}
                    placeholder="مثلاً: اجتماع التعافي الأسبوعي"
                    className="mt-1 w-full px-3 py-2 text-xs bg-slate-50 border border-slate-300 rounded-lg"
                  />
                </label>
                <label className="block text-xs font-medium text-slate-700">
                  الموعد / الجدول المتكرر
                  <input
                    type="text"
                    value={meetingSchedule}
                    onChange={(e) => setMeetingSchedule(e.target.value)}
                    placeholder="مثلاً: السبت والثلاثاء · 8:30 مساءً"
                    className="mt-1 w-full px-3 py-2 text-xs bg-slate-50 border border-slate-300 rounded-lg"
                  />
                </label>
                <label className="block text-xs font-medium text-slate-700">
                  طبيعة الاجتماع
                  <select
                    value={meetingType}
                    onChange={(e) =>
                      setMeetingType(e.target.value as RecoveryMeetingType)
                    }
                    className="mt-1 w-full px-3 py-2 text-xs bg-slate-50 border border-slate-300 rounded-lg"
                  >
                    <option value="أونلاين">أونلاين</option>
                    <option value="حضوري">حضوري</option>
                    <option value="مختلط">مختلط</option>
                  </select>
                </label>
                <label className="block text-xs font-medium text-slate-700">
                  المكان أو الرابط (اختياري)
                  <input
                    type="text"
                    value={meetingLocation}
                    onChange={(e) => setMeetingLocation(e.target.value)}
                    placeholder="https://... أو اسم القاعة/المكان"
                    className="mt-1 w-full px-3 py-2 text-xs bg-slate-50 border border-slate-300 rounded-lg"
                  />
                </label>
              </div>
              <label className="block text-xs font-medium text-slate-700">
                تفاصيل أو ملاحظات (اختياري)
                <textarea
                  rows={2}
                  value={meetingNotes}
                  onChange={(e) => setMeetingNotes(e.target.value)}
                  placeholder="تنسيق الاجتماع، كلمة المرور، أو أي تفاصيل مهمة..."
                  className="mt-1 w-full px-3 py-2 text-xs bg-slate-50 border border-slate-300 rounded-lg"
                />
              </label>
              <div className="flex justify-end gap-2">
                <button
                  type="button"
                  onClick={resetMeetingForm}
                  className="px-3.5 py-2 text-xs font-medium text-slate-700 bg-slate-100 hover:bg-slate-200 rounded-lg cursor-pointer"
                >
                  إلغاء
                </button>
                <button
                  type="submit"
                  className="px-4 py-2 text-xs font-semibold text-white bg-[#1E3A5F] hover:bg-[#162C49] rounded-lg cursor-pointer"
                >
                  {editingMeetingId ? 'حفظ التعديلات' : 'حفظ الاجتماع'}
                </button>
              </div>
            </form>
          )}

          {workspace.meetings.length === 0 ? (
            <div className="bg-white border border-dashed border-slate-200 rounded-xl p-6 text-center space-y-1.5">
              <Users className="w-7 h-7 text-slate-400 mx-auto" aria-hidden="true" />
              <p className="text-sm font-semibold text-slate-800">
                لم تُضف اجتماعات تعافي بعد
              </p>
              <p className="text-xs text-slate-500">
                أضف اجتماعاتك الثابتة لمتابعة حضورها وتوثيقه تلقائيًا في السجل اليومي.
              </p>
            </div>
          ) : (
            <div className="grid grid-cols-1 md:grid-cols-2 gap-3">
              {workspace.meetings.map((m) => {
                const count = workspace.attendanceLogs.filter(
                  (a) => a.meetingId === m.id
                ).length;
                const attendedOnSelected = workspace.attendanceLogs.some(
                  (a) =>
                    a.meetingId === m.id && a.dateKey === attendanceDateKey
                );
                const isSafeLink = m.locationOrLink
                  ? sanitizeRecoveryHttpUrl(m.locationOrLink)
                  : '';

                return (
                  <article
                    key={m.id}
                    className="bg-white border border-slate-200 rounded-xl p-4 flex flex-col justify-between gap-3"
                  >
                    <div className="space-y-2">
                      <div className="flex items-start justify-between gap-2">
                        <div className="space-y-0.5 min-w-0">
                          <h3 className="text-sm font-bold text-slate-900">
                            <BidiText text={m.name} />
                          </h3>
                          <p className="text-xs text-slate-500">
                            {m.meetingType}
                            {m.schedule ? ` · ${m.schedule}` : ''}
                          </p>
                        </div>
                        <span className="text-[11px] font-semibold text-slate-600 tabular-nums shrink-0">
                          {count} حضور
                        </span>
                      </div>

                      {m.locationOrLink && (
                        <div className="text-xs text-slate-600 break-words">
                          {isSafeLink ? (
                            <a
                              href={isSafeLink}
                              target="_blank"
                              rel="noopener noreferrer"
                              className="inline-flex items-center gap-1 text-[#1E3A5F] hover:underline font-medium"
                            >
                              <ExternalLink className="w-3 h-3" aria-hidden="true" />
                              <span>رابط الاجتماع</span>
                            </a>
                          ) : (
                            <span>المكان: {m.locationOrLink}</span>
                          )}
                        </div>
                      )}

                      {m.notes && (
                        <p className="text-xs text-slate-600 leading-relaxed whitespace-pre-wrap">
                          <BidiText text={m.notes} />
                        </p>
                      )}
                    </div>

                    {canEdit && (
                      <div className="space-y-2 pt-2 border-t border-slate-100">
                        {!attendedOnSelected && (
                          <input
                            type="text"
                            value={attendanceNoteByMtg[m.id] || ''}
                            onChange={(e) =>
                              setAttendanceNoteByMtg((prev) => ({
                                ...prev,
                                [m.id]: e.target.value,
                              }))
                            }
                            placeholder="ملاحظة حضور مختصرة (اختياري)..."
                            className="w-full px-2.5 py-1.5 text-xs bg-slate-50 border border-slate-200 rounded-lg"
                          />
                        )}
                        <div className="flex flex-wrap items-center justify-between gap-2">
                          <button
                            type="button"
                            disabled={attendedOnSelected}
                            onClick={() => handleConfirmMeetingAttendance(m)}
                            className={`inline-flex items-center gap-1.5 px-3 py-1.5 min-h-[34px] text-xs font-semibold rounded-lg cursor-pointer ${
                              attendedOnSelected
                                ? 'bg-emerald-50 text-emerald-800 border border-emerald-200 cursor-default'
                                : 'bg-[#1E3A5F] text-white hover:bg-[#162C49]'
                            }`}
                          >
                            <Check className="w-3.5 h-3.5" aria-hidden="true" />
                            <span>
                              {attendedOnSelected
                                ? `تم تأكيد الحضور (${attendanceDateKey})`
                                : 'تأكيد الحضور'}
                            </span>
                          </button>

                          <div className="flex items-center gap-1">
                            <button
                              type="button"
                              onClick={() => handleStartEditMeeting(m)}
                              aria-label={`تعديل ${m.name}`}
                              className="p-1.5 text-slate-400 hover:text-slate-700 hover:bg-slate-100 rounded-md cursor-pointer"
                            >
                              <Edit3 className="w-3.5 h-3.5" aria-hidden="true" />
                            </button>
                            <button
                              type="button"
                              onClick={() => handleDeleteMeeting(m.id)}
                              aria-label={`حذف ${m.name}`}
                              className="p-1.5 text-slate-400 hover:text-red-600 hover:bg-red-50 rounded-md cursor-pointer"
                            >
                              <Trash2 className="w-3.5 h-3.5" aria-hidden="true" />
                            </button>
                          </div>
                        </div>
                      </div>
                    )}
                  </article>
                );
              })}
            </div>
          )}

          {/* Attendance History */}
          {workspace.attendanceLogs.length > 0 && (
            <div className="bg-white border border-slate-200 rounded-xl p-4 space-y-2.5">
              <div className="flex items-center justify-between gap-2">
                <h3 className="text-xs font-bold text-slate-900">
                  سجل حضور الاجتماعات ({workspace.attendanceLogs.length})
                </h3>
              </div>
              <div className="divide-y divide-slate-100 max-h-56 overflow-y-auto thin-scrollbar">
                {workspace.attendanceLogs.slice(0, 40).map((att) => {
                  const syncedInDaily = isLoggedOnDate(
                    'meeting',
                    `recovery-meeting:${path.id}:${att.meetingId}`,
                    att.dateKey
                  );
                  return (
                    <div
                      key={att.id}
                      className="py-2 flex items-center justify-between gap-2 text-xs"
                    >
                      <div className="min-w-0 space-y-0.5">
                        <p className="font-semibold text-slate-800 truncate">
                          {att.meetingName}
                        </p>
                        <p className="text-[11px] text-slate-500 tabular-nums">
                          {att.dateKey}
                          {att.note ? ` · ${att.note}` : ''}
                          {syncedInDaily ? ' · مسجّل في السجل اليومي' : ''}
                        </p>
                      </div>
                      {canEdit && (
                        <button
                          type="button"
                          onClick={() => handleDeleteAttendanceRecord(att.id)}
                          aria-label="حذف سجل الحضور"
                          className="p-1 text-slate-400 hover:text-red-600 rounded cursor-pointer shrink-0"
                        >
                          <Trash2 className="w-3.5 h-3.5" aria-hidden="true" />
                        </button>
                      )}
                    </div>
                  );
                })}
              </div>
            </div>
          )}
        </div>
      )}

      {/* =================================================================== */}
      {/* TAB 2: RECOVERY TOOLS                                               */}
      {/* =================================================================== */}
      {activeTab === 'tools' && (
        <div className="space-y-4">
          <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-3">
            <div className="flex flex-wrap items-center gap-3 text-xs text-slate-600">
              <label className="inline-flex items-center gap-1.5">
                <span>تاريخ الممارسة:</span>
                <input
                  type="date"
                  value={practiceDateKey}
                  onChange={(e) =>
                    setPracticeDateKey(e.target.value || getTodayDateKey())
                  }
                  className="px-2.5 py-1.5 text-xs bg-white border border-slate-300 rounded-lg tabular-nums"
                />
              </label>
              <label className="inline-flex items-center gap-1.5 cursor-pointer select-none">
                <input
                  type="checkbox"
                  checked={logToolToJournal}
                  onChange={(e) => setLogToolToJournal(e.target.checked)}
                  className="rounded border-slate-300 text-[#1E3A5F]"
                />
                <span>تسجيل الممارسة في السجل اليومي تلقائيًا</span>
              </label>
            </div>

            {canEdit && (
              <button
                type="button"
                onClick={() => {
                  if (showToolForm) {
                    resetToolForm();
                  } else {
                    setShowToolForm(true);
                  }
                }}
                className="inline-flex items-center justify-center gap-1.5 px-3.5 py-2 min-h-[38px] text-xs font-semibold text-white bg-[#1E3A5F] hover:bg-[#162C49] rounded-lg cursor-pointer shrink-0"
              >
                <Plus className="w-3.5 h-3.5" aria-hidden="true" />
                <span>{showToolForm ? 'إلغاء' : 'إضافة أداة تعافي'}</span>
              </button>
            )}
          </div>

          {showToolForm && canEdit && (
            <form
              onSubmit={handleSaveTool}
              className="bg-white border border-slate-200 rounded-xl p-4 space-y-3"
            >
              <h3 className="text-sm font-bold text-slate-900">
                {editingToolId ? 'تعديل أداة التعافي' : 'أداة تعافي جديدة'}
              </h3>
              <div className="grid grid-cols-1 sm:grid-cols-3 gap-3">
                <label className="block text-xs font-medium text-slate-700 sm:col-span-2">
                  اسم الأداة أو الممارسة (مطلوب)
                  <input
                    type="text"
                    required
                    value={toolTitle}
                    onChange={(e) => setToolTitle(e.target.value)}
                    placeholder="مثلاً: قائمة الامتنان اليومية أو وقفة تنفس"
                    className="mt-1 w-full px-3 py-2 text-xs bg-slate-50 border border-slate-300 rounded-lg"
                  />
                </label>
                <label className="block text-xs font-medium text-slate-700">
                  التصنيف
                  <select
                    value={toolCategory}
                    onChange={(e) => setToolCategory(e.target.value)}
                    className="mt-1 w-full px-3 py-2 text-xs bg-slate-50 border border-slate-300 rounded-lg"
                  >
                    {TOOL_CATEGORY_OPTIONS.map((opt) => (
                      <option key={opt} value={opt}>
                        {opt}
                      </option>
                    ))}
                  </select>
                </label>
              </div>
              <div className="grid grid-cols-1 sm:grid-cols-3 gap-3">
                <label className="block text-xs font-medium text-slate-700">
                  التكرار المعتاد
                  <input
                    type="text"
                    value={toolCadence}
                    onChange={(e) => setToolCadence(e.target.value)}
                    placeholder="يومي / عند الضيق"
                    className="mt-1 w-full px-3 py-2 text-xs bg-slate-50 border border-slate-300 rounded-lg"
                  />
                </label>
                <label className="block text-xs font-medium text-slate-700 sm:col-span-2">
                  وصف مختصر (اختياري)
                  <input
                    type="text"
                    value={toolDesc}
                    onChange={(e) => setToolDesc(e.target.value)}
                    placeholder="كيف تمارس هذه الأداة عمليًا؟"
                    className="mt-1 w-full px-3 py-2 text-xs bg-slate-50 border border-slate-300 rounded-lg"
                  />
                </label>
              </div>
              <div className="flex justify-end gap-2">
                <button
                  type="button"
                  onClick={resetToolForm}
                  className="px-3.5 py-2 text-xs font-medium text-slate-700 bg-slate-100 rounded-lg cursor-pointer"
                >
                  إلغاء
                </button>
                <button
                  type="submit"
                  className="px-4 py-2 text-xs font-semibold text-white bg-[#1E3A5F] rounded-lg cursor-pointer"
                >
                  {editingToolId ? 'حفظ التعديل' : 'إضافة الأداة'}
                </button>
              </div>
            </form>
          )}

          {/* Quick-Add Starter Tools (if any preset not yet added) */}
          {canEdit &&
            STARTER_RECOVERY_TOOLS.some(
              (p) => !workspace.tools.some((t) => t.title.trim() === p.title)
            ) && (
              <div className="bg-white border border-slate-200 rounded-xl p-3.5 space-y-2">
                <p className="text-[11px] font-semibold text-slate-600">
                  إضافة سريعة لأدوات تعافي شائعة:
                </p>
                <div className="flex flex-wrap gap-1.5">
                  {STARTER_RECOVERY_TOOLS.filter(
                    (p) =>
                      !workspace.tools.some((t) => t.title.trim() === p.title)
                  ).map((preset) => (
                    <button
                      key={preset.title}
                      type="button"
                      onClick={() => handleQuickAddStarterTool(preset)}
                      className="inline-flex items-center gap-1 px-2.5 py-1 text-[11px] font-medium text-[#1E3A5F] bg-slate-50 hover:bg-slate-100 border border-slate-200 rounded-lg cursor-pointer"
                    >
                      <Plus className="w-3 h-3" aria-hidden="true" />
                      <span>{preset.title}</span>
                    </button>
                  ))}
                </div>
              </div>
            )}

          {sortedTools.length === 0 ? (
            <div className="bg-white border border-dashed border-slate-200 rounded-xl p-6 text-center space-y-1.5">
              <Sparkles className="w-7 h-7 text-slate-400 mx-auto" aria-hidden="true" />
              <p className="text-sm font-semibold text-slate-800">
                نظّم أدوات التعافي الخاصة بك هنا
              </p>
              <p className="text-xs text-slate-500">
                اختر من الأدوات الشائعة أعلاه أو أضف ممارساتك الخاصة وسجّل تطبيقها يوميًا.
              </p>
            </div>
          ) : (
            <div className="space-y-2.5">
              {sortedTools.map((tool, idx) => {
                const countTotal = workspace.practiceLogs.filter(
                  (p) => p.toolId === tool.id
                ).length;
                const countSelectedDate = workspace.practiceLogs.filter(
                  (p) => p.toolId === tool.id && p.dateKey === practiceDateKey
                ).length;

                return (
                  <article
                    key={tool.id}
                    className="bg-white border border-slate-200 rounded-xl p-4 space-y-2.5"
                  >
                    <div className="flex flex-col sm:flex-row sm:items-start justify-between gap-2">
                      <div className="space-y-1 min-w-0">
                        <div className="flex flex-wrap items-center gap-2">
                          <h3 className="text-sm font-bold text-slate-900">
                            <BidiText text={tool.title} />
                          </h3>
                          <span className="text-[11px] font-medium text-slate-500">
                            {tool.category}
                            {tool.cadence ? ` · ${tool.cadence}` : ''}
                          </span>
                        </div>
                        {tool.description && (
                          <p className="text-xs text-slate-600 leading-relaxed">
                            <BidiText text={tool.description} />
                          </p>
                        )}
                      </div>

                      <div className="flex items-center gap-2 text-[11px] text-slate-600 tabular-nums shrink-0">
                        <span>
                          إجمالي: <strong className="text-slate-900">{countTotal}</strong>
                        </span>
                        {countSelectedDate > 0 && (
                          <span className="px-2 py-0.5 bg-emerald-50 text-emerald-800 border border-emerald-200 rounded-md font-semibold">
                            تم اليوم ({countSelectedDate})
                          </span>
                        )}
                      </div>
                    </div>

                    {canEdit && (
                      <div className="flex flex-col sm:flex-row sm:items-center gap-2 pt-2 border-t border-slate-100">
                        <input
                          type="text"
                          value={practiceNoteByTool[tool.id] || ''}
                          onChange={(e) =>
                            setPracticeNoteByTool((prev) => ({
                              ...prev,
                              [tool.id]: e.target.value,
                            }))
                          }
                          placeholder="ملاحظة مختصرة عن الممارسة (اختياري)..."
                          className="flex-1 min-w-0 px-2.5 py-1.5 text-xs bg-slate-50 border border-slate-200 rounded-lg"
                        />
                        <div className="flex items-center justify-end gap-1.5 shrink-0">
                          <button
                            type="button"
                            onClick={() => handleRecordPractice(tool)}
                            className="inline-flex items-center gap-1.5 px-3 py-1.5 min-h-[34px] text-xs font-semibold text-white bg-[#1E3A5F] hover:bg-[#162C49] rounded-lg cursor-pointer"
                          >
                            <Check className="w-3.5 h-3.5" aria-hidden="true" />
                            <span>تسجيل ممارسة</span>
                          </button>
                          <button
                            type="button"
                            disabled={idx === 0}
                            onClick={() => handleMoveTool(idx, -1)}
                            aria-label="تحريك لأعلى"
                            className="p-1.5 text-slate-400 hover:text-slate-700 disabled:opacity-30 cursor-pointer"
                          >
                            <ArrowUp className="w-3.5 h-3.5" aria-hidden="true" />
                          </button>
                          <button
                            type="button"
                            disabled={idx === sortedTools.length - 1}
                            onClick={() => handleMoveTool(idx, 1)}
                            aria-label="تحريك لأسفل"
                            className="p-1.5 text-slate-400 hover:text-slate-700 disabled:opacity-30 cursor-pointer"
                          >
                            <ArrowDown className="w-3.5 h-3.5" aria-hidden="true" />
                          </button>
                          <button
                            type="button"
                            onClick={() => {
                              setEditingToolId(tool.id);
                              setToolTitle(tool.title);
                              setToolCategory(tool.category);
                              setToolCadence(tool.cadence || '');
                              setToolDesc(tool.description || '');
                              setShowToolForm(true);
                            }}
                            aria-label={`تعديل ${tool.title}`}
                            className="p-1.5 text-slate-400 hover:text-slate-700 rounded-md cursor-pointer"
                          >
                            <Edit3 className="w-3.5 h-3.5" aria-hidden="true" />
                          </button>
                          <button
                            type="button"
                            onClick={() => handleDeleteTool(tool.id)}
                            aria-label={`حذف ${tool.title}`}
                            className="p-1.5 text-slate-400 hover:text-red-600 rounded-md cursor-pointer"
                          >
                            <Trash2 className="w-3.5 h-3.5" aria-hidden="true" />
                          </button>
                        </div>
                      </div>
                    )}
                  </article>
                );
              })}
            </div>
          )}

          {/* Practice History */}
          {workspace.practiceLogs.length > 0 && (
            <div className="bg-white border border-slate-200 rounded-xl p-4 space-y-2">
              <h3 className="text-xs font-bold text-slate-900">
                سجل الممارسات الأخيرة ({workspace.practiceLogs.length})
              </h3>
              <div className="divide-y divide-slate-100 max-h-52 overflow-y-auto thin-scrollbar">
                {workspace.practiceLogs.slice(0, 40).map((log) => (
                  <div
                    key={log.id}
                    className="py-2 flex items-center justify-between gap-2 text-xs"
                  >
                    <div className="min-w-0 space-y-0.5">
                      <p className="font-semibold text-slate-800 truncate">
                        {log.toolTitle}
                      </p>
                      <p className="text-[11px] text-slate-500 tabular-nums">
                        {log.dateKey}
                        {log.note ? ` · ${log.note}` : ''}
                        {log.loggedToDailyJournal ? ' · في السجل اليومي' : ''}
                      </p>
                    </div>
                    {canEdit && (
                      <button
                        type="button"
                        onClick={() =>
                          commitWorkspace((prev) => ({
                            ...prev,
                            practiceLogs: prev.practiceLogs.filter(
                              (p) => p.id !== log.id
                            ),
                          }))
                        }
                        aria-label="حذف سجل الممارسة"
                        className="p-1 text-slate-400 hover:text-red-600 cursor-pointer shrink-0"
                      >
                        <Trash2 className="w-3.5 h-3.5" aria-hidden="true" />
                      </button>
                    )}
                  </div>
                ))}
              </div>
            </div>
          )}
        </div>
      )}

      {/* =================================================================== */}
      {/* TAB 3: NIGHTLY INVENTORY (PRIVATE TO RECOVERY PATH)                 */}
      {/* =================================================================== */}
      {activeTab === 'inventory' && (
        <div className="space-y-4">
          {/* Privacy & Date Navigation Toolbar */}
          <div className="bg-white border border-slate-200 rounded-xl p-4 space-y-3">
            <div className="flex flex-col lg:flex-row lg:items-center justify-between gap-3">
              <div className="flex flex-wrap items-center gap-2">
                <button
                  type="button"
                  onClick={() =>
                    setInventoryDateKey((d) => shiftDateKey(d, -1))
                  }
                  aria-label="اليوم السابق"
                  className="p-2 text-slate-600 bg-slate-50 hover:bg-slate-100 border border-slate-200 rounded-lg cursor-pointer"
                >
                  <ChevronRight className="w-4 h-4" aria-hidden="true" />
                </button>
                <input
                  type="date"
                  value={inventoryDateKey}
                  onChange={(e) =>
                    setInventoryDateKey(e.target.value || getTodayDateKey())
                  }
                  className="px-3 py-1.5 text-xs font-semibold bg-slate-50 border border-slate-300 rounded-lg tabular-nums"
                />
                <button
                  type="button"
                  onClick={() =>
                    setInventoryDateKey((d) => shiftDateKey(d, 1))
                  }
                  aria-label="اليوم التالي"
                  className="p-2 text-slate-600 bg-slate-50 hover:bg-slate-100 border border-slate-200 rounded-lg cursor-pointer"
                >
                  <ChevronLeft className="w-4 h-4" aria-hidden="true" />
                </button>
                {inventoryDateKey !== todayKey && (
                  <button
                    type="button"
                    onClick={() => setInventoryDateKey(todayKey)}
                    className="px-2.5 py-1.5 text-xs font-semibold text-[#1E3A5F] bg-slate-100 hover:bg-slate-200 rounded-lg cursor-pointer"
                  >
                    اليوم
                  </button>
                )}
              </div>

              <div className="flex flex-wrap items-center gap-2">
                <button
                  type="button"
                  onClick={() => setShowPastInventories((v) => !v)}
                  className="inline-flex items-center gap-1.5 px-3 py-1.5 min-h-[36px] text-xs font-medium text-slate-700 bg-slate-50 hover:bg-slate-100 border border-slate-200 rounded-lg cursor-pointer"
                >
                  <Calendar className="w-3.5 h-3.5" aria-hidden="true" />
                  <span>الجرد السابق ({savedInventoryDates.length})</span>
                </button>

                {canEdit && (
                  <button
                    type="button"
                    onClick={() => setEditingQuestions((v) => !v)}
                    className={`inline-flex items-center gap-1.5 px-3 py-1.5 min-h-[36px] text-xs font-medium rounded-lg border cursor-pointer ${
                      editingQuestions
                        ? 'bg-[#1E3A5F] text-white border-[#1E3A5F]'
                        : 'bg-slate-50 text-slate-700 border-slate-200 hover:bg-slate-100'
                    }`}
                  >
                    <Edit3 className="w-3.5 h-3.5" aria-hidden="true" />
                    <span>
                      {editingQuestions ? 'إنهاء تعديل الأسئلة' : 'تخصيص الأسئلة'}
                    </span>
                  </button>
                )}
              </div>
            </div>

            <div className="flex flex-wrap items-center justify-between gap-2 pt-2 border-t border-slate-100 text-[11px] text-slate-500">
              <span>
                إجابات الجرد الليلي خاصة بك داخل مسار التعافي ولا تُنشر في السجل اليومي.
              </span>
              <span className="tabular-nums">
                {currentInventoryEntry?.updatedAtMs
                  ? `محفوظ تلقائيًا · ${new Date(
                      currentInventoryEntry.updatedAtMs
                    ).toLocaleTimeString('ar-EG', {
                      hour: '2-digit',
                      minute: '2-digit',
                    })}`
                  : 'الحفظ التلقائي مفعّل أثناء الكتابة'}
              </span>
            </div>

            {/* Export & Share Bar */}
            <div className="flex flex-wrap items-center gap-2 pt-1">
              <button
                type="button"
                onClick={() => void handleCopyInventory()}
                className="inline-flex items-center gap-1.5 px-3 py-1.5 text-xs font-medium text-slate-700 bg-slate-50 hover:bg-slate-100 border border-slate-200 rounded-lg cursor-pointer"
              >
                {copiedInventory ? (
                  <Check className="w-3.5 h-3.5 text-emerald-700" aria-hidden="true" />
                ) : (
                  <Copy className="w-3.5 h-3.5" aria-hidden="true" />
                )}
                <span>{copiedInventory ? 'تم نسخ النص' : 'نسخ الجرد'}</span>
              </button>

              <button
                type="button"
                onClick={handleDownloadInventoryTxt}
                className="inline-flex items-center gap-1.5 px-3 py-1.5 text-xs font-medium text-slate-700 bg-slate-50 hover:bg-slate-100 border border-slate-200 rounded-lg cursor-pointer"
              >
                <Download className="w-3.5 h-3.5" aria-hidden="true" />
                <span>تنزيل (.txt)</span>
              </button>

              <button
                type="button"
                onClick={handleExportInventoryPdf}
                className="inline-flex items-center gap-1.5 px-3 py-1.5 text-xs font-medium text-slate-700 bg-slate-50 hover:bg-slate-100 border border-slate-200 rounded-lg cursor-pointer"
              >
                <Printer className="w-3.5 h-3.5" aria-hidden="true" />
                <span>تصدير / طباعة PDF</span>
              </button>

              <a
                href={buildWhatsAppShareUrl(formattedInventoryText)}
                target="_blank"
                rel="noopener noreferrer"
                className="inline-flex items-center gap-1.5 px-3 py-1.5 text-xs font-semibold text-emerald-800 bg-emerald-50 hover:bg-emerald-100 border border-emerald-200 rounded-lg"
              >
                <Share2 className="w-3.5 h-3.5" aria-hidden="true" />
                <span>مشاركة عبر واتساب</span>
              </a>

              {typeof navigator !== 'undefined' &&
                typeof navigator.share === 'function' && (
                  <button
                    type="button"
                    onClick={() => void handleNativeShareInventory()}
                    className="inline-flex items-center gap-1.5 px-3 py-1.5 text-xs font-medium text-[#1E3A5F] bg-slate-100 hover:bg-slate-200 rounded-lg cursor-pointer"
                  >
                    <Share2 className="w-3.5 h-3.5" aria-hidden="true" />
                    <span>مشاركة سريعة</span>
                  </button>
                )}
            </div>
          </div>

          {/* Past Inventories Selector Drawer */}
          {showPastInventories && (
            <div className="bg-white border border-slate-200 rounded-xl p-4 space-y-2.5">
              <h3 className="text-xs font-bold text-slate-900">
                أرشيف الجرد الليلي المحفوظ
              </h3>
              {savedInventoryDates.length === 0 ? (
                <p className="text-xs text-slate-500">
                  لا توجد إدخالات جرد ليلي محفوظة بعد.
                </p>
              ) : (
                <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-2 max-h-56 overflow-y-auto thin-scrollbar">
                  {savedInventoryDates.map((entry) => {
                    const answeredCount = sortedQuestions.filter((q) =>
                      Boolean((entry.answers?.[q.id] || '').trim())
                    ).length;
                    const active = entry.dateKey === inventoryDateKey;
                    return (
                      <button
                        key={entry.dateKey}
                        type="button"
                        onClick={() => setInventoryDateKey(entry.dateKey)}
                        className={`p-2.5 rounded-lg border text-right flex items-center justify-between gap-2 cursor-pointer ${
                          active
                            ? 'bg-[#1E3A5F] text-white border-[#1E3A5F]'
                            : 'bg-slate-50 text-slate-700 border-slate-200 hover:bg-slate-100'
                        }`}
                      >
                        <span className="text-xs font-semibold tabular-nums">
                          {entry.dateKey}
                        </span>
                        <span
                          className={`text-[11px] tabular-nums ${
                            active ? 'text-white/85' : 'text-slate-500'
                          }`}
                        >
                          {answeredCount} / {sortedQuestions.length} أسئلة
                        </span>
                      </button>
                    );
                  })}
                </div>
              )}
            </div>
          )}

          {/* Question Customization Panel */}
          {editingQuestions && canEdit && (
            <div className="bg-white border border-slate-200 rounded-xl p-4 space-y-4">
              <div className="flex flex-wrap items-center justify-between gap-2">
                <h3 className="text-sm font-bold text-slate-900">
                  إدارة أسئلة الجرد الليلي (خاصة بمسار التعافي فقط)
                </h3>
                <button
                  type="button"
                  onClick={handleResetDefaultQuestions}
                  className="inline-flex items-center gap-1 px-2.5 py-1 text-[11px] font-medium text-slate-600 bg-slate-100 hover:bg-slate-200 rounded-md cursor-pointer"
                >
                  <RotateCcw className="w-3 h-3" aria-hidden="true" />
                  <span>استعادة الأسئلة الافتراضية</span>
                </button>
              </div>

              <div className="space-y-2">
                {sortedQuestions.map((q, idx) => (
                  <div
                    key={q.id}
                    className="flex items-center gap-2 bg-slate-50 border border-slate-200 rounded-lg p-2"
                  >
                    <span className="text-xs font-bold text-slate-500 tabular-nums w-5 text-center shrink-0">
                      {idx + 1}
                    </span>
                    <input
                      type="text"
                      value={q.prompt}
                      onChange={(e) =>
                        handleEditQuestionPrompt(q.id, e.target.value)
                      }
                      className="flex-1 min-w-0 px-2.5 py-1.5 text-xs bg-white border border-slate-300 rounded-md"
                    />
                    <button
                      type="button"
                      disabled={idx === 0}
                      onClick={() => handleMoveQuestion(idx, -1)}
                      aria-label="تحريك السؤال لأعلى"
                      className="p-1.5 text-slate-400 hover:text-slate-700 disabled:opacity-30 cursor-pointer"
                    >
                      <ArrowUp className="w-3.5 h-3.5" aria-hidden="true" />
                    </button>
                    <button
                      type="button"
                      disabled={idx === sortedQuestions.length - 1}
                      onClick={() => handleMoveQuestion(idx, 1)}
                      aria-label="تحريك السؤال لأسفل"
                      className="p-1.5 text-slate-400 hover:text-slate-700 disabled:opacity-30 cursor-pointer"
                    >
                      <ArrowDown className="w-3.5 h-3.5" aria-hidden="true" />
                    </button>
                    <button
                      type="button"
                      onClick={() => handleDeleteQuestion(q.id)}
                      aria-label="حذف السؤال"
                      className="p-1.5 text-slate-400 hover:text-red-600 cursor-pointer"
                    >
                      <Trash2 className="w-3.5 h-3.5" aria-hidden="true" />
                    </button>
                  </div>
                ))}
              </div>

              <form
                onSubmit={handleAddInventoryQuestion}
                className="flex flex-col sm:flex-row gap-2 pt-2 border-t border-slate-100"
              >
                <input
                  type="text"
                  required
                  value={newQuestionText}
                  onChange={(e) => setNewQuestionText(e.target.value)}
                  placeholder="أضف سؤال جرد ليلي جديد..."
                  className="flex-1 min-w-0 px-3 py-2 text-xs bg-slate-50 border border-slate-300 rounded-lg"
                />
                <input
                  type="text"
                  value={newQuestionHint}
                  onChange={(e) => setNewQuestionHint(e.target.value)}
                  placeholder="تلميح مساعد (اختياري)"
                  className="sm:w-56 px-3 py-2 text-xs bg-slate-50 border border-slate-300 rounded-lg"
                />
                <button
                  type="submit"
                  className="inline-flex items-center justify-center gap-1 px-3.5 py-2 text-xs font-semibold text-white bg-[#1E3A5F] hover:bg-[#162C49] rounded-lg cursor-pointer shrink-0"
                >
                  <Plus className="w-3.5 h-3.5" aria-hidden="true" />
                  <span>إضافة سؤال</span>
                </button>
              </form>
            </div>
          )}

          {/* Inventory Questions & Autosaved Answers */}
          <div className="space-y-3">
            {sortedQuestions.length === 0 ? (
              <div className="bg-white border border-dashed border-slate-200 rounded-xl p-6 text-center space-y-2">
                <NotebookPen className="w-7 h-7 text-slate-400 mx-auto" aria-hidden="true" />
                <p className="text-xs text-slate-600">
                  لا توجد أسئلة في الجرد حاليًا. اضغط «تخصيص الأسئلة» لإضافة أسئلتك أو استعادة الافتراضي.
                </p>
              </div>
            ) : (
              sortedQuestions.map((q, idx) => (
                <div
                  key={q.id}
                  className="bg-white border border-slate-200 rounded-xl p-4 space-y-2"
                >
                  <div className="space-y-0.5">
                    <label
                      htmlFor={`inv-ans-${q.id}`}
                      className="block text-sm font-bold text-slate-900"
                    >
                      <span className="text-[#1E3A5F] tabular-nums ml-1">
                        {idx + 1}.
                      </span>
                      <BidiText text={q.prompt} />
                    </label>
                    {q.helperHint && (
                      <p className="text-[11px] text-slate-500">{q.helperHint}</p>
                    )}
                  </div>
                  <textarea
                    id={`inv-ans-${q.id}`}
                    rows={3}
                    disabled={!canEdit}
                    value={currentInventoryEntry?.answers?.[q.id] || ''}
                    onChange={(e) =>
                      handleInventoryAnswerChange(q.id, e.target.value)
                    }
                    placeholder="اكتب إجابتك بصدق وهدوء..."
                    className="w-full px-3 py-2 text-xs sm:text-sm bg-slate-50 border border-slate-200 rounded-lg focus:outline-none focus:border-[#1E3A5F] leading-relaxed"
                  />
                </div>
              ))
            )}

            <div className="bg-white border border-slate-200 rounded-xl p-4 space-y-2">
              <label
                htmlFor="inv-general-note"
                className="block text-xs font-bold text-slate-800"
              >
                ملاحظة ختامية أو رسالة لنفسي (اختياري)
              </label>
              <textarea
                id="inv-general-note"
                rows={2}
                disabled={!canEdit}
                value={currentInventoryEntry?.generalNote || ''}
                onChange={(e) =>
                  handleInventoryGeneralNoteChange(e.target.value)
                }
                placeholder="أي ملاحظات أو دعاء أو خلاصة لليوم..."
                className="w-full px-3 py-2 text-xs sm:text-sm bg-slate-50 border border-slate-200 rounded-lg focus:outline-none focus:border-[#1E3A5F]"
              />
            </div>
          </div>
        </div>
      )}

      {/* =================================================================== */}
      {/* TAB 4: SERVICE                                                      */}
      {/* =================================================================== */}
      {activeTab === 'service' && (
        <div className="space-y-4">
          <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-3">
            <div className="flex flex-wrap items-center gap-1.5">
              {(
                [
                  { id: 'all', label: 'الكل' },
                  { id: 'space', label: 'مساحات' },
                  { id: 'commitment', label: 'التزامات' },
                  { id: 'task', label: 'مهام' },
                  { id: 'note', label: 'ملاحظات' },
                  { id: 'resource', label: 'موارد' },
                ] as const
              ).map((f) => (
                <button
                  key={f.id}
                  type="button"
                  onClick={() => setServiceFilter(f.id)}
                  className={`px-2.5 py-1.5 text-xs font-medium rounded-lg border cursor-pointer ${
                    serviceFilter === f.id
                      ? 'bg-[#1E3A5F] text-white border-[#1E3A5F]'
                      : 'bg-white text-slate-600 border-slate-200 hover:bg-slate-50'
                  }`}
                >
                  {f.label}
                </button>
              ))}
            </div>

            {canEdit && (
              <button
                type="button"
                onClick={() => setShowServiceForm((v) => !v)}
                className="inline-flex items-center justify-center gap-1.5 px-3.5 py-2 min-h-[38px] text-xs font-semibold text-white bg-[#1E3A5F] hover:bg-[#162C49] rounded-lg cursor-pointer shrink-0"
              >
                <Plus className="w-3.5 h-3.5" aria-hidden="true" />
                <span>{showServiceForm ? 'إلغاء' : 'إضافة نشاط خدمة'}</span>
              </button>
            )}
          </div>

          {canEdit && (
            <label className="inline-flex items-center gap-1.5 text-xs text-slate-600 cursor-pointer select-none">
              <input
                type="checkbox"
                checked={logServiceOnComplete}
                onChange={(e) => setLogServiceOnComplete(e.target.checked)}
                className="rounded border-slate-300 text-[#1E3A5F]"
              />
              <span>تسجيل أنشطة الخدمة المكتملة في السجل اليومي</span>
            </label>
          )}

          {showServiceForm && canEdit && (
            <form
              onSubmit={handleAddServiceItem}
              className="bg-white border border-slate-200 rounded-xl p-4 space-y-3"
            >
              <h3 className="text-sm font-bold text-slate-900">
                عنصر خدمة جديد
              </h3>
              <div className="grid grid-cols-1 sm:grid-cols-3 gap-3">
                <label className="block text-xs font-medium text-slate-700">
                  النوع
                  <select
                    value={serviceKind}
                    onChange={(e) =>
                      setServiceKind(e.target.value as RecoveryServiceItemKind)
                    }
                    className="mt-1 w-full px-3 py-2 text-xs bg-slate-50 border border-slate-300 rounded-lg"
                  >
                    {Object.entries(SERVICE_KIND_LABELS).map(([k, lbl]) => (
                      <option key={k} value={k}>
                        {lbl}
                      </option>
                    ))}
                  </select>
                </label>
                <label className="block text-xs font-medium text-slate-700 sm:col-span-2">
                  العنوان (مطلوب)
                  <input
                    type="text"
                    required
                    value={serviceTitle}
                    onChange={(e) => setServiceTitle(e.target.value)}
                    placeholder="مثلاً: استقبال الوافدين الجدد / تنسيق القراءة"
                    className="mt-1 w-full px-3 py-2 text-xs bg-slate-50 border border-slate-300 rounded-lg"
                  />
                </label>
                <label className="block text-xs font-medium text-slate-700">
                  مساحة الخدمة / المجموعة
                  <input
                    type="text"
                    value={serviceSpaceName}
                    onChange={(e) => setServiceSpaceName(e.target.value)}
                    placeholder="مثلاً: مجموعة الثلاثاء"
                    className="mt-1 w-full px-3 py-2 text-xs bg-slate-50 border border-slate-300 rounded-lg"
                  />
                </label>
                <label className="block text-xs font-medium text-slate-700">
                  الموعد أو التفاصيل
                  <input
                    type="text"
                    value={serviceDetail}
                    onChange={(e) => setServiceDetail(e.target.value)}
                    placeholder="مثلاً: كل خميس · ربع ساعة قبل اللقاء"
                    className="mt-1 w-full px-3 py-2 text-xs bg-slate-50 border border-slate-300 rounded-lg"
                  />
                </label>
                <label className="block text-xs font-medium text-slate-700">
                  رابط مورد (اختياري)
                  <input
                    type="url"
                    value={serviceLinkUrl}
                    onChange={(e) => setServiceLinkUrl(e.target.value)}
                    placeholder="https://..."
                    className="mt-1 w-full px-3 py-2 text-xs bg-slate-50 border border-slate-300 rounded-lg"
                  />
                </label>
              </div>
              <label className="block text-xs font-medium text-slate-700">
                ملاحظات (اختياري)
                <textarea
                  rows={2}
                  value={serviceNotes}
                  onChange={(e) => setServiceNotes(e.target.value)}
                  placeholder="تفاصيل، أسماء التواصل، أو نقاط متابعة..."
                  className="mt-1 w-full px-3 py-2 text-xs bg-slate-50 border border-slate-300 rounded-lg"
                />
              </label>
              <div className="flex justify-end gap-2">
                <button
                  type="button"
                  onClick={() => setShowServiceForm(false)}
                  className="px-3.5 py-2 text-xs font-medium text-slate-700 bg-slate-100 rounded-lg cursor-pointer"
                >
                  إلغاء
                </button>
                <button
                  type="submit"
                  className="px-4 py-2 text-xs font-semibold text-white bg-[#1E3A5F] rounded-lg cursor-pointer"
                >
                  حفظ عنصر الخدمة
                </button>
              </div>
            </form>
          )}

          {filteredServiceItems.length === 0 ? (
            <div className="bg-white border border-dashed border-slate-200 rounded-xl p-6 text-center space-y-1.5">
              <HandHeart className="w-7 h-7 text-slate-400 mx-auto" aria-hidden="true" />
              <p className="text-sm font-semibold text-slate-800">
                لا توجد عناصر خدمة مضافة بعد
              </p>
              <p className="text-xs text-slate-500">
                نظّم مساحات الخدمة، الالتزامات، المهام، والملاحظات الخاصة بدورك في التعافي.
              </p>
            </div>
          ) : (
            <div className="space-y-2.5">
              {filteredServiceItems.map((item) => {
                const safeUrl = item.linkUrl
                  ? sanitizeRecoveryHttpUrl(item.linkUrl)
                  : '';
                return (
                  <article
                    key={item.id}
                    className="bg-white border border-slate-200 rounded-xl p-4 flex flex-col sm:flex-row sm:items-start justify-between gap-3"
                  >
                    <div className="space-y-1.5 min-w-0 flex-1">
                      <div className="flex flex-wrap items-center gap-2">
                        <span className="px-2 py-0.5 text-[11px] font-medium bg-slate-100 text-slate-700 rounded-md">
                          {SERVICE_KIND_LABELS[item.kind]}
                        </span>
                        {item.spaceName && (
                          <span className="text-[11px] text-slate-500">
                            {item.spaceName}
                          </span>
                        )}
                        {item.completed && item.completedDateKey && (
                          <span className="text-[11px] font-medium text-emerald-700 tabular-nums">
                            أُنجز في {item.completedDateKey}
                          </span>
                        )}
                      </div>
                      <h3
                        className={`text-sm font-bold ${
                          item.completed
                            ? 'line-through text-slate-400'
                            : 'text-slate-900'
                        }`}
                      >
                        <BidiText text={item.title} />
                      </h3>
                      {item.scheduleOrDetail && (
                        <p className="text-xs text-slate-600">
                          {item.scheduleOrDetail}
                        </p>
                      )}
                      {item.notes && (
                        <p className="text-xs text-slate-600 whitespace-pre-wrap leading-relaxed">
                          <BidiText text={item.notes} />
                        </p>
                      )}
                      {safeUrl && (
                        <a
                          href={safeUrl}
                          target="_blank"
                          rel="noopener noreferrer"
                          className="inline-flex items-center gap-1 text-xs font-medium text-[#1E3A5F] hover:underline"
                        >
                          <ExternalLink className="w-3 h-3" aria-hidden="true" />
                          <span>فتح المورد</span>
                        </a>
                      )}
                    </div>

                    {canEdit && (
                      <div className="flex items-center gap-1.5 shrink-0">
                        <button
                          type="button"
                          onClick={() => handleToggleServiceComplete(item)}
                          className={`inline-flex items-center gap-1 px-3 py-1.5 min-h-[34px] text-xs font-semibold rounded-lg border cursor-pointer ${
                            item.completed
                              ? 'bg-emerald-50 text-emerald-800 border-emerald-200'
                              : 'bg-slate-50 text-slate-700 border-slate-200 hover:bg-slate-100'
                          }`}
                        >
                          <Check className="w-3.5 h-3.5" aria-hidden="true" />
                          <span>
                            {item.completed ? 'مكتمل' : 'تحديد كمكتمل'}
                          </span>
                        </button>
                        <button
                          type="button"
                          onClick={() => handleDeleteServiceItem(item.id)}
                          aria-label={`حذف ${item.title}`}
                          className="p-1.5 text-slate-400 hover:text-red-600 rounded-md cursor-pointer"
                        >
                          <Trash2 className="w-3.5 h-3.5" aria-hidden="true" />
                        </button>
                      </div>
                    )}
                  </article>
                );
              })}
            </div>
          )}
        </div>
      )}

      {/* =================================================================== */}
      {/* TAB 5: COURSES & RECOVERY RESOURCES                                 */}
      {/* =================================================================== */}
      {activeTab === 'resources' && (
        <div className="space-y-5">
          {/* Linked Knowledge Balance Courses */}
          <div className="bg-white border border-slate-200 rounded-xl p-4 space-y-3">
            <div className="flex flex-wrap items-center justify-between gap-2">
              <h3 className="text-sm font-bold text-slate-900 flex items-center gap-1.5">
                <Layers className="w-4 h-4 text-[#1E3A5F]" aria-hidden="true" />
                <span>كورسات مرتبطة بمسار التعافي ({linkedCourses.length})</span>
              </h3>
            </div>

            {linkedCourses.length > 0 ? (
              <div className="grid grid-cols-1 md:grid-cols-2 gap-2.5">
                {linkedCourses.map((course) => {
                  const loggedToday = isLoggedOnDate(
                    'course',
                    String(course.id),
                    todayKey
                  );
                  return (
                    <div
                      key={course.id}
                      className="p-3 bg-slate-50 border border-slate-200 rounded-lg flex flex-col justify-between gap-2"
                    >
                      <div className="space-y-1">
                        <div className="flex items-center justify-between gap-2">
                          <span className="text-xs font-bold text-slate-900">
                            <BidiText text={course.title} />
                          </span>
                          <span className="text-[11px] font-semibold text-slate-600 tabular-nums">
                            {course.progressPct}%
                          </span>
                        </div>
                        {course.instructor && (
                          <p className="text-[11px] text-slate-500">
                            {course.instructor}
                          </p>
                        )}
                      </div>
                      <div className="flex flex-wrap items-center gap-2 pt-1">
                        <button
                          type="button"
                          onClick={() => onOpenCourse(course.id)}
                          className="px-2.5 py-1 text-[11px] font-semibold text-[#1E3A5F] bg-white border border-slate-200 hover:bg-slate-100 rounded-md cursor-pointer"
                        >
                          فتح الكورس ←
                        </button>
                        {canEdit && onLogRecoveryActivity && (
                          <button
                            type="button"
                            disabled={loggedToday}
                            onClick={() => handleLogLinkedCourseSession(course)}
                            className={`px-2.5 py-1 text-[11px] font-semibold rounded-md cursor-pointer ${
                              loggedToday
                                ? 'bg-emerald-50 text-emerald-800 border border-emerald-200 cursor-default'
                                : 'bg-[#1E3A5F] text-white hover:bg-[#162C49]'
                            }`}
                          >
                            {loggedToday
                              ? 'سُجّل في السجل اليومي'
                              : 'تسجيل دراسة اليوم'}
                          </button>
                        )}
                      </div>
                    </div>
                  );
                })}
              </div>
            ) : (
              <p className="text-xs text-slate-500">
                اختر من كورساتك أدناه لربطها مباشرة بمسار التعافي.
              </p>
            )}

            {canEdit && courses.length > 0 && (
              <div className="pt-2 border-t border-slate-100 space-y-1.5">
                <p className="text-[11px] font-medium text-slate-500">
                  ربط أو إلغاء ربط كورس من كورساتك:
                </p>
                <div className="flex flex-wrap gap-1.5 max-h-32 overflow-y-auto thin-scrollbar">
                  {courses.map((c) => {
                    const linked = path.linkedCourseIds.includes(c.id);
                    return (
                      <button
                        key={c.id}
                        type="button"
                        onClick={() => onToggleLinkedCourse(c.id)}
                        className={`px-2.5 py-1 text-[11px] font-medium rounded-md border cursor-pointer ${
                          linked
                            ? 'bg-[#1E3A5F] text-white border-[#1E3A5F]'
                            : 'bg-white text-slate-600 border-slate-200 hover:bg-slate-50'
                        }`}
                      >
                        {linked ? '✓ ' : '+ '}
                        {c.title}
                      </button>
                    );
                  })}
                </div>
              </div>
            )}
          </div>

          {/* Linked Library Reading Items */}
          <div className="bg-white border border-slate-200 rounded-xl p-4 space-y-3">
            <div className="flex flex-wrap items-center justify-between gap-2">
              <h3 className="text-sm font-bold text-slate-900 flex items-center gap-1.5">
                <BookOpen className="w-4 h-4 text-[#1E3A5F]" aria-hidden="true" />
                <span>كتب ومقالات من المكتبة ({linkedReadingItems.length})</span>
              </h3>
              {onOpenLibrary && (
                <button
                  type="button"
                  onClick={onOpenLibrary}
                  className="text-xs font-semibold text-[#1E3A5F] hover:underline cursor-pointer"
                >
                  فتح المكتبة ←
                </button>
              )}
            </div>

            {linkedReadingItems.length > 0 && (
              <div className="grid grid-cols-1 md:grid-cols-2 gap-2.5">
                {linkedReadingItems.map((item) => {
                  const loggedToday = isLoggedOnDate(
                    'reading_item',
                    item.id,
                    todayKey
                  );
                  return (
                    <div
                      key={item.id}
                      className="p-3 bg-slate-50 border border-slate-200 rounded-lg flex flex-col justify-between gap-2"
                    >
                      <div className="space-y-0.5">
                        <p className="text-xs font-bold text-slate-900">
                          <BidiText text={item.title} />
                        </p>
                        <p className="text-[11px] text-slate-500">
                          {item.itemType}
                          {item.author ? ` · ${item.author}` : ''}
                          {item.totalPages > 0
                            ? ` · ${item.currentPage}/${item.totalPages} ص`
                            : ''}
                        </p>
                      </div>
                      <div className="flex flex-wrap items-center gap-2">
                        {canEdit && onLogRecoveryActivity && (
                          <button
                            type="button"
                            disabled={loggedToday}
                            onClick={() => handleLogLinkedReadingSession(item)}
                            className={`px-2.5 py-1 text-[11px] font-semibold rounded-md cursor-pointer ${
                              loggedToday
                                ? 'bg-emerald-50 text-emerald-800 border border-emerald-200 cursor-default'
                                : 'bg-[#1E3A5F] text-white hover:bg-[#162C49]'
                            }`}
                          >
                            {loggedToday
                              ? 'سُجّل في السجل اليومي'
                              : 'تسجيل قراءة اليوم'}
                          </button>
                        )}
                      </div>
                    </div>
                  );
                })}
              </div>
            )}

            {canEdit && readingItems.length > 0 && (
              <div className="pt-2 border-t border-slate-100 space-y-1.5">
                <p className="text-[11px] font-medium text-slate-500">
                  ربط كتب أو مقالات من مكتبتك:
                </p>
                <div className="flex flex-wrap gap-1.5 max-h-32 overflow-y-auto thin-scrollbar">
                  {readingItems.map((item) => {
                    const linked = workspace.linkedReadingIds.includes(item.id);
                    return (
                      <button
                        key={item.id}
                        type="button"
                        onClick={() => handleToggleLinkedReading(item.id)}
                        className={`px-2.5 py-1 text-[11px] font-medium rounded-md border cursor-pointer ${
                          linked
                            ? 'bg-[#1E3A5F] text-white border-[#1E3A5F]'
                            : 'bg-white text-slate-600 border-slate-200 hover:bg-slate-50'
                        }`}
                      >
                        {linked ? '✓ ' : '+ '}
                        {item.title}
                      </button>
                    );
                  })}
                </div>
              </div>
            )}
          </div>

          {/* Custom Recovery Workshops & Resources */}
          <div className="bg-white border border-slate-200 rounded-xl p-4 space-y-3">
            <div className="flex flex-wrap items-center justify-between gap-2">
              <h3 className="text-sm font-bold text-slate-900 flex items-center gap-1.5">
                <FileText className="w-4 h-4 text-[#1E3A5F]" aria-hidden="true" />
                <span>
                  ورش عمل ومواد تعافي إضافية ({workspace.customResources.length})
                </span>
              </h3>

              {canEdit && (
                <button
                  type="button"
                  onClick={() => setShowResourceForm((v) => !v)}
                  className="inline-flex items-center gap-1 px-3 py-1.5 text-xs font-semibold text-[#1E3A5F] bg-slate-100 hover:bg-slate-200 rounded-lg cursor-pointer"
                >
                  <Plus className="w-3.5 h-3.5" aria-hidden="true" />
                  <span>{showResourceForm ? 'إلغاء' : 'إضافة مورد / ورشة'}</span>
                </button>
              )}
            </div>

            {canEdit && (
              <label className="inline-flex items-center gap-1.5 text-xs text-slate-600 cursor-pointer select-none">
                <input
                  type="checkbox"
                  checked={logResourceOnComplete}
                  onChange={(e) => setLogResourceOnComplete(e.target.checked)}
                  className="rounded border-slate-300 text-[#1E3A5F]"
                />
                <span>تسجيل إتمام الورشة أو المورد في السجل اليومي</span>
              </label>
            )}

            {showResourceForm && canEdit && (
              <form
                onSubmit={handleAddCustomResource}
                className="p-3 bg-slate-50 border border-slate-200 rounded-xl space-y-3"
              >
                <div className="grid grid-cols-1 sm:grid-cols-3 gap-3">
                  <label className="block text-xs font-medium text-slate-700">
                    النوع
                    <select
                      value={resKind}
                      onChange={(e) =>
                        setResKind(e.target.value as RecoveryResourceKind)
                      }
                      className="mt-1 w-full px-3 py-2 text-xs bg-white border border-slate-300 rounded-lg"
                    >
                      {Object.entries(RESOURCE_KIND_LABELS).map(([k, lbl]) => (
                        <option key={k} value={k}>
                          {lbl}
                        </option>
                      ))}
                    </select>
                  </label>
                  <label className="block text-xs font-medium text-slate-700 sm:col-span-2">
                    العنوان (مطلوب)
                    <input
                      type="text"
                      required
                      value={resTitle}
                      onChange={(e) => setResTitle(e.target.value)}
                      placeholder="مثلاً: ورشة الحدود الصحية في العلاقات"
                      className="mt-1 w-full px-3 py-2 text-xs bg-white border border-slate-300 rounded-lg"
                    />
                  </label>
                </div>
                <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
                  <label className="block text-xs font-medium text-slate-700">
                    رابط (اختياري)
                    <input
                      type="url"
                      value={resUrl}
                      onChange={(e) => setResUrl(e.target.value)}
                      placeholder="https://..."
                      className="mt-1 w-full px-3 py-2 text-xs bg-white border border-slate-300 rounded-lg"
                    />
                  </label>
                  <label className="block text-xs font-medium text-slate-700">
                    ملاحظات (اختياري)
                    <input
                      type="text"
                      value={resNotes}
                      onChange={(e) => setResNotes(e.target.value)}
                      placeholder="ملخص سريع أو نقطة مهمة..."
                      className="mt-1 w-full px-3 py-2 text-xs bg-white border border-slate-300 rounded-lg"
                    />
                  </label>
                </div>
                <div className="flex justify-end gap-2">
                  <button
                    type="button"
                    onClick={() => setShowResourceForm(false)}
                    className="px-3 py-1.5 text-xs font-medium text-slate-700 bg-white border border-slate-200 rounded-lg cursor-pointer"
                  >
                    إلغاء
                  </button>
                  <button
                    type="submit"
                    className="px-4 py-1.5 text-xs font-semibold text-white bg-[#1E3A5F] rounded-lg cursor-pointer"
                  >
                    حفظ المورد
                  </button>
                </div>
              </form>
            )}

            {workspace.customResources.length === 0 ? (
              <p className="text-xs text-slate-500">
                أضف ورش العمل، المقاطع الصوتية، أو الروابط الداعمة الخاصة بمسار التعافي.
              </p>
            ) : (
              <div className="divide-y divide-slate-100">
                {workspace.customResources.map((res) => {
                  const safeUrl = res.url ? sanitizeRecoveryHttpUrl(res.url) : '';
                  return (
                    <div
                      key={res.id}
                      className="py-2.5 flex flex-col sm:flex-row sm:items-center justify-between gap-2"
                    >
                      <div className="space-y-0.5 min-w-0">
                        <div className="flex flex-wrap items-center gap-2">
                          <span className="px-2 py-0.5 text-[10px] font-semibold bg-slate-100 text-slate-700 rounded">
                            {RESOURCE_KIND_LABELS[res.kind]}
                          </span>
                          <span
                            className={`text-xs font-bold ${
                              res.completed
                                ? 'line-through text-slate-400'
                                : 'text-slate-900'
                            }`}
                          >
                            <BidiText text={res.title} />
                          </span>
                        </div>
                        {res.notes && (
                          <p className="text-[11px] text-slate-600">{res.notes}</p>
                        )}
                        {safeUrl && (
                          <a
                            href={safeUrl}
                            target="_blank"
                            rel="noopener noreferrer"
                            className="inline-flex items-center gap-1 text-[11px] font-medium text-[#1E3A5F] hover:underline"
                          >
                            <ExternalLink className="w-3 h-3" aria-hidden="true" />
                            <span>فتح الرابط</span>
                          </a>
                        )}
                      </div>

                      {canEdit && (
                        <div className="flex items-center gap-1.5 shrink-0">
                          <button
                            type="button"
                            onClick={() => handleToggleCustomResourceComplete(res)}
                            className={`inline-flex items-center gap-1 px-2.5 py-1 text-[11px] font-semibold rounded-md border cursor-pointer ${
                              res.completed
                                ? 'bg-emerald-50 text-emerald-800 border-emerald-200'
                                : 'bg-slate-50 text-slate-700 border-slate-200 hover:bg-slate-100'
                            }`}
                          >
                            <Check className="w-3 h-3" aria-hidden="true" />
                            <span>{res.completed ? 'تم الإتمام' : 'تحديد كمتمّ'}</span>
                          </button>
                          <button
                            type="button"
                            onClick={() => handleDeleteCustomResource(res.id)}
                            aria-label={`حذف ${res.title}`}
                            className="p-1 text-slate-400 hover:text-red-600 cursor-pointer"
                          >
                            <Trash2 className="w-3.5 h-3.5" aria-hidden="true" />
                          </button>
                        </div>
                      )}
                    </div>
                  );
                })}
              </div>
            )}
          </div>
        </div>
      )}
    </section>
  );
}
