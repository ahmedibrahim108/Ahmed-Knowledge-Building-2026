import {
  LearningPath,
  NightlyInventoryEntry,
  NightlyInventoryQuestion,
  RecoveryMeeting,
  RecoveryMeetingAttendance,
  RecoveryMeetingType,
  RecoveryPathWorkspace,
  RecoveryPracticeLog,
  RecoveryResourceItem,
  RecoveryResourceKind,
  RecoveryServiceItem,
  RecoveryServiceItemKind,
  RecoveryToolItem,
  getTodayDateKey,
} from '../data/curriculumData';

const RECOVERY_LOCAL_PREFIX = 'mizan_recovery_path_v1_';

export function isRecoveryLearningPath(
  path: Pick<LearningPath, 'title'> | null | undefined
): boolean {
  if (!path || !path.title) return false;
  const raw = path.title.trim();
  if (!raw) return false;
  return (
    raw.includes('التعافي') ||
    /(^|\s)تعافي(\s|$)/.test(raw) ||
    /\brecovery\b/i.test(raw)
  );
}

export function sanitizeRecoveryHttpUrl(raw: string | undefined | null): string {
  if (!raw || typeof raw !== 'string') return '';
  const trimmed = raw.trim();
  if (!trimmed) return '';
  try {
    const parsed = new URL(trimmed);
    if (parsed.protocol === 'http:' || parsed.protocol === 'https:') {
      return parsed.toString();
    }
    return '';
  } catch {
    return '';
  }
}

export const DEFAULT_NIGHTLY_INVENTORY_QUESTIONS: NightlyInventoryQuestion[] = [
  {
    id: 'inv-q-1',
    prompt: 'ما المواقف التي أثارت لديّ خوفًا أو غضبًا أو انزعاجًا اليوم؟',
    helperHint: 'سجّل الموقف بإيجاز ومشاعرك نحوه دون قسوة على النفس.',
    sortOrder: 0,
  },
  {
    id: 'inv-q-2',
    prompt: 'هل قصّرت أو أخطأت في حق نفسي أو أحد اليوم، وما الذي أحتاج للاعتراف به أو تصحيحه؟',
    helperHint: 'كن صادقًا وبسيطًا في تحديد المسؤولية.',
    sortOrder: 1,
  },
  {
    id: 'inv-q-3',
    prompt: 'ما الأشياء والمواقف التي أشعر بالامتنان تجاهها اليوم؟',
    helperHint: 'حتى النعم الصغيرة تُثبّت الهدوء واليقظة.',
    sortOrder: 2,
  },
  {
    id: 'inv-q-4',
    prompt: 'ما الأفكار أو المحفزات التي لاحظتُها اليوم وكيف تعاملت معها؟',
    helperHint: 'لاحظ الأنماط المبكرة لتفهم احتياجك الحقيقي.',
    sortOrder: 3,
  },
  {
    id: 'inv-q-5',
    prompt: 'ما الخطوة البسيطة التي أنوي الالتزام بها غدًا لمواصلة التعافي؟',
    helperHint: 'خطوة واحدة واضحة وقابلة للتنفيذ.',
    sortOrder: 4,
  },
];

export const STARTER_RECOVERY_TOOLS: Array<{
  title: string;
  category: string;
  description: string;
  cadence: string;
}> = [
  {
    title: 'الامتنان اليومي',
    category: 'الامتنان',
    description: 'كتابة 3 أمور أمتنّ لها اليوم لتعديل التركيز وتهدئة الذهن.',
    cadence: 'يومي',
  },
  {
    title: 'الجرد والوقفة الصادقة',
    category: 'الجرد',
    description: 'مراجعة المشاعر وردود الفعل والأخطاء أولًا بأول دون تراكم.',
    cadence: 'يومي',
  },
  {
    title: 'التأمل والهدوء الذهني',
    category: 'التأمل',
    description: '10 دقائق من الصمت والتنفس العميق ومراقبة الأفكار بهدوء.',
    cadence: 'يومي',
  },
  {
    title: 'عمل الخطوات',
    category: 'الخطوات',
    description: 'قراءة أو كتابة جزء من عمل الخطوات ومراجعته بصدق.',
    cadence: 'أسبوعي / يومي',
  },
  {
    title: 'الدعاء والصلاة وطلب التوفيق',
    category: 'الدعاء',
    description: 'الاستعانة بالله في بداية اليوم وعند التحديات وطلب الثبات.',
    cadence: 'يومي',
  },
  {
    title: 'القراءة في أدبيات التعافي',
    category: 'القراءة',
    description: 'قراءة صفحة أو فصل قصير لتجديد الوعي والاتزان.',
    cadence: 'يومي',
  },
  {
    title: 'التواصل الداعم',
    category: 'التواصل',
    description: 'الاتصال أو مشاركة مختصرة مع مرشد أو صديق داعم في التعافي.',
    cadence: 'عند الحاجة / يومي',
  },
];

export function createEmptyRecoveryWorkspace(
  pathId: string
): RecoveryPathWorkspace {
  return {
    pathId,
    meetings: [],
    attendanceLogs: [],
    tools: [],
    practiceLogs: [],
    inventoryQuestions: DEFAULT_NIGHTLY_INVENTORY_QUESTIONS.map((q) => ({ ...q })),
    inventoryEntries: {},
    serviceItems: [],
    linkedReadingIds: [],
    customResources: [],
    updatedAtMs: 0,
  };
}

function clipText(val: unknown, maxLen: number): string {
  if (typeof val !== 'string') return '';
  return val.slice(0, maxLen);
}

function sanitizeDateKey(val: unknown): string {
  const s = typeof val === 'string' ? val.trim() : '';
  return /^\d{4}-\d{2}-\d{2}$/.test(s) ? s : getTodayDateKey();
}

export function sanitizeRecoveryPathWorkspace(
  raw: unknown,
  fallbackPathId = ''
): RecoveryPathWorkspace {
  if (!raw || typeof raw !== 'object') {
    return createEmptyRecoveryWorkspace(fallbackPathId);
  }
  const obj = raw as Record<string, unknown>;
  const pathId = clipText(obj.pathId, 128) || fallbackPathId;

  const validMeetingTypes: RecoveryMeetingType[] = ['حضوري', 'أونلاين', 'مختلط'];
  const meetings: RecoveryMeeting[] = Array.isArray(obj.meetings)
    ? obj.meetings
        .filter(
          (m): m is Record<string, unknown> =>
            Boolean(m && typeof m === 'object' && typeof (m as Record<string, unknown>).name === 'string')
        )
        .slice(0, 100)
        .map((m, idx) => ({
          id: clipText(m.id, 128) || `rmtg-${idx}`,
          name: clipText(m.name, 200),
          schedule: clipText(m.schedule, 200),
          meetingType: validMeetingTypes.includes(m.meetingType as RecoveryMeetingType)
            ? (m.meetingType as RecoveryMeetingType)
            : 'أونلاين',
          locationOrLink: m.locationOrLink ? clipText(m.locationOrLink, 500) : undefined,
          notes: m.notes ? clipText(m.notes, 2000) : undefined,
          createdAtMs: Number(m.createdAtMs) || 0,
        }))
    : [];

  const attendanceLogs: RecoveryMeetingAttendance[] = Array.isArray(obj.attendanceLogs)
    ? obj.attendanceLogs
        .filter(
          (a): a is Record<string, unknown> =>
            Boolean(a && typeof a === 'object' && typeof (a as Record<string, unknown>).meetingId === 'string')
        )
        .slice(0, 600)
        .map((a, idx) => ({
          id: clipText(a.id, 128) || `ratt-${idx}`,
          meetingId: clipText(a.meetingId, 128),
          meetingName: clipText(a.meetingName, 200),
          dateKey: sanitizeDateKey(a.dateKey),
          note: a.note ? clipText(a.note, 500) : undefined,
          attendedAtMs: Number(a.attendedAtMs) || 0,
        }))
    : [];

  const tools: RecoveryToolItem[] = Array.isArray(obj.tools)
    ? obj.tools
        .filter(
          (t): t is Record<string, unknown> =>
            Boolean(t && typeof t === 'object' && typeof (t as Record<string, unknown>).title === 'string')
        )
        .slice(0, 120)
        .map((t, idx) => ({
          id: clipText(t.id, 128) || `rtool-${idx}`,
          title: clipText(t.title, 200),
          category: clipText(t.category, 80) || 'أخرى',
          description: t.description ? clipText(t.description, 1000) : undefined,
          cadence: t.cadence ? clipText(t.cadence, 80) : undefined,
          sortOrder: Number.isFinite(Number(t.sortOrder)) ? Number(t.sortOrder) : idx,
          createdAtMs: Number(t.createdAtMs) || 0,
        }))
    : [];

  const practiceLogs: RecoveryPracticeLog[] = Array.isArray(obj.practiceLogs)
    ? obj.practiceLogs
        .filter(
          (p): p is Record<string, unknown> =>
            Boolean(p && typeof p === 'object' && typeof (p as Record<string, unknown>).toolId === 'string')
        )
        .slice(0, 800)
        .map((p, idx) => ({
          id: clipText(p.id, 128) || `rprac-${idx}`,
          toolId: clipText(p.toolId, 128),
          toolTitle: clipText(p.toolTitle, 200),
          dateKey: sanitizeDateKey(p.dateKey),
          note: p.note ? clipText(p.note, 1000) : undefined,
          loggedToDailyJournal: Boolean(p.loggedToDailyJournal),
          practicedAtMs: Number(p.practicedAtMs) || 0,
        }))
    : [];

  const rawQuestions = Array.isArray(obj.inventoryQuestions)
    ? obj.inventoryQuestions
        .filter(
          (q): q is Record<string, unknown> =>
            Boolean(q && typeof q === 'object' && typeof (q as Record<string, unknown>).prompt === 'string')
        )
        .slice(0, 40)
        .map((q, idx) => ({
          id: clipText(q.id, 128) || `inv-q-${idx + 1}`,
          prompt: clipText(q.prompt, 500),
          helperHint: q.helperHint ? clipText(q.helperHint, 300) : undefined,
          sortOrder: Number.isFinite(Number(q.sortOrder)) ? Number(q.sortOrder) : idx,
        }))
    : [];

  const inventoryQuestions =
    rawQuestions.length > 0
      ? rawQuestions
      : Array.isArray(obj.inventoryQuestions)
      ? []
      : DEFAULT_NIGHTLY_INVENTORY_QUESTIONS.map((q) => ({ ...q }));

  const inventoryEntries: Record<string, NightlyInventoryEntry> = {};
  if (obj.inventoryEntries && typeof obj.inventoryEntries === 'object') {
    const entries = Object.entries(obj.inventoryEntries as Record<string, unknown>).slice(0, 750);
    for (const [k, v] of entries) {
      if (!/^\d{4}-\d{2}-\d{2}$/.test(k) || !v || typeof v !== 'object') continue;
      const entryObj = v as Record<string, unknown>;
      const cleanAnswers: Record<string, string> = {};
      if (entryObj.answers && typeof entryObj.answers === 'object') {
        for (const [qId, ans] of Object.entries(
          entryObj.answers as Record<string, unknown>
        )) {
          if (typeof ans === 'string') {
            cleanAnswers[clipText(qId, 128)] = clipText(ans, 6000);
          }
        }
      }
      inventoryEntries[k] = {
        dateKey: k,
        answers: cleanAnswers,
        generalNote: entryObj.generalNote
          ? clipText(entryObj.generalNote, 6000)
          : undefined,
        updatedAtMs: Number(entryObj.updatedAtMs) || 0,
      };
    }
  }

  const validServiceKinds: RecoveryServiceItemKind[] = [
    'space',
    'commitment',
    'task',
    'note',
    'resource',
  ];
  const serviceItems: RecoveryServiceItem[] = Array.isArray(obj.serviceItems)
    ? obj.serviceItems
        .filter(
          (s): s is Record<string, unknown> =>
            Boolean(s && typeof s === 'object' && typeof (s as Record<string, unknown>).title === 'string')
        )
        .slice(0, 200)
        .map((s, idx) => ({
          id: clipText(s.id, 128) || `rsrv-${idx}`,
          kind: validServiceKinds.includes(s.kind as RecoveryServiceItemKind)
            ? (s.kind as RecoveryServiceItemKind)
            : 'commitment',
          title: clipText(s.title, 250),
          spaceName: s.spaceName ? clipText(s.spaceName, 160) : undefined,
          scheduleOrDetail: s.scheduleOrDetail
            ? clipText(s.scheduleOrDetail, 250)
            : undefined,
          linkUrl: s.linkUrl ? clipText(s.linkUrl, 1000) : undefined,
          notes: s.notes ? clipText(s.notes, 3000) : undefined,
          completed: Boolean(s.completed),
          completedDateKey: s.completedDateKey
            ? sanitizeDateKey(s.completedDateKey)
            : undefined,
          completedAtMs: s.completedAtMs ? Number(s.completedAtMs) : undefined,
          createdAtMs: Number(s.createdAtMs) || 0,
        }))
    : [];

  const linkedReadingIds: string[] = Array.isArray(obj.linkedReadingIds)
    ? Array.from(
        new Set(
          obj.linkedReadingIds
            .filter((id): id is string => typeof id === 'string' && Boolean(id.trim()))
            .map((id) => clipText(id.trim(), 128))
        )
      ).slice(0, 200)
    : [];

  const validResourceKinds: RecoveryResourceKind[] = [
    'workshop',
    'book_article',
    'media',
    'link',
  ];
  const customResources: RecoveryResourceItem[] = Array.isArray(obj.customResources)
    ? obj.customResources
        .filter(
          (r): r is Record<string, unknown> =>
            Boolean(r && typeof r === 'object' && typeof (r as Record<string, unknown>).title === 'string')
        )
        .slice(0, 200)
        .map((r, idx) => ({
          id: clipText(r.id, 128) || `rres-${idx}`,
          kind: validResourceKinds.includes(r.kind as RecoveryResourceKind)
            ? (r.kind as RecoveryResourceKind)
            : 'workshop',
          title: clipText(r.title, 250),
          url: r.url ? clipText(r.url, 1000) : undefined,
          notes: r.notes ? clipText(r.notes, 2000) : undefined,
          completed: Boolean(r.completed),
          completedDateKey: r.completedDateKey
            ? sanitizeDateKey(r.completedDateKey)
            : undefined,
          completedAtMs: r.completedAtMs ? Number(r.completedAtMs) : undefined,
          createdAtMs: Number(r.createdAtMs) || 0,
        }))
    : [];

  return {
    pathId,
    meetings,
    attendanceLogs,
    tools,
    practiceLogs,
    inventoryQuestions,
    inventoryEntries,
    serviceItems,
    linkedReadingIds,
    customResources,
    updatedAtMs: Number(obj.updatedAtMs) || 0,
  };
}

export function sanitizeRecoveryWorkspacesMap(
  raw: unknown
): Record<string, RecoveryPathWorkspace> {
  if (!raw || typeof raw !== 'object' || Array.isArray(raw)) return {};
  const result: Record<string, RecoveryPathWorkspace> = {};
  for (const [pathId, value] of Object.entries(raw as Record<string, unknown>).slice(0, 10)) {
    if (!pathId) continue;
    result[clipText(pathId, 128)] = sanitizeRecoveryPathWorkspace(value, pathId);
  }
  return result;
}

function storageKey(uid: string | undefined, pathId: string): string {
  return `${RECOVERY_LOCAL_PREFIX}${uid || 'local'}_${pathId}`;
}

export function loadLocalRecoveryWorkspace(
  uid: string | undefined,
  pathId: string
): RecoveryPathWorkspace | null {
  if (typeof window === 'undefined' || !pathId) return null;
  try {
    const raw = window.localStorage.getItem(storageKey(uid, pathId));
    if (!raw) return null;
    const parsed = JSON.parse(raw);
    return sanitizeRecoveryPathWorkspace(parsed, pathId);
  } catch {
    return null;
  }
}

export function saveLocalRecoveryWorkspace(
  uid: string | undefined,
  workspace: RecoveryPathWorkspace
): void {
  if (typeof window === 'undefined' || !workspace.pathId) return;
  try {
    window.localStorage.setItem(
      storageKey(uid, workspace.pathId),
      JSON.stringify(workspace)
    );
  } catch {
    // Ignore quota errors cleanly
  }
}

export function resolveBestRecoveryWorkspace(
  pathId: string,
  cloudWorkspace?: RecoveryPathWorkspace | null,
  localWorkspace?: RecoveryPathWorkspace | null
): RecoveryPathWorkspace {
  if (!cloudWorkspace && !localWorkspace) {
    return createEmptyRecoveryWorkspace(pathId);
  }
  if (!cloudWorkspace) return sanitizeRecoveryPathWorkspace(localWorkspace, pathId);
  if (!localWorkspace) return sanitizeRecoveryPathWorkspace(cloudWorkspace, pathId);

  const cloudTs = Number(cloudWorkspace.updatedAtMs) || 0;
  const localTs = Number(localWorkspace.updatedAtMs) || 0;
  if (localTs > cloudTs) {
    return sanitizeRecoveryPathWorkspace(localWorkspace, pathId);
  }
  return sanitizeRecoveryPathWorkspace(cloudWorkspace, pathId);
}

export function formatNightlyInventoryText(
  dateKey: string,
  questions: NightlyInventoryQuestion[],
  entry: NightlyInventoryEntry | undefined,
  pathTitle = 'التعافي'
): string {
  const ordered = [...questions].sort((a, b) => a.sortOrder - b.sortOrder);
  const lines: string[] = [
    `الجرد الليلي — مسار ${pathTitle}`,
    `التاريخ: ${dateKey}`,
    '────────────────────────',
    '',
  ];

  ordered.forEach((q, idx) => {
    const ans = (entry?.answers?.[q.id] || '').trim();
    lines.push(`${idx + 1}. ${q.prompt}`);
    lines.push(ans || '— (لم يُكتب رد بعد)');
    lines.push('');
  });

  const extra = (entry?.generalNote || '').trim();
  if (extra) {
    lines.push('ملاحظة إضافية:');
    lines.push(extra);
    lines.push('');
  }

  return lines.join('\n').trim();
}

function escapeHtml(str: string): string {
  return str
    .replace(/&/g, '&amp;')
    .replace(/</g, '&lt;')
    .replace(/>/g, '&gt;')
    .replace(/"/g, '&quot;')
    .replace(/'/g, '&#39;');
}

export function buildNightlyInventoryPrintHtml(
  dateKey: string,
  questions: NightlyInventoryQuestion[],
  entry: NightlyInventoryEntry | undefined,
  pathTitle = 'التعافي'
): string {
  const ordered = [...questions].sort((a, b) => a.sortOrder - b.sortOrder);
  const sectionsHtml = ordered
    .map((q, idx) => {
      const ans = (entry?.answers?.[q.id] || '').trim();
      return `
        <section class="item">
          <h2>${idx + 1}. ${escapeHtml(q.prompt)}</h2>
          <p class="${ans ? 'answer' : 'empty'}">${
            ans ? escapeHtml(ans).replace(/\n/g, '<br/>') : 'لم يُكتب رد بعد.'
          }</p>
        </section>
      `;
    })
    .join('\n');

  const extra = (entry?.generalNote || '').trim();
  const extraHtml = extra
    ? `<section class="item extra">
         <h2>ملاحظة إضافية</h2>
         <p class="answer">${escapeHtml(extra).replace(/\n/g, '<br/>')}</p>
       </section>`
    : '';

  return `<!doctype html>
<html lang="ar" dir="rtl">
<head>
  <meta charset="utf-8" />
  <title>الجرد الليلي - ${escapeHtml(dateKey)}</title>
  <style>
    @page { margin: 18mm; }
    body {
      font-family: system-ui, -apple-system, 'Segoe UI', Tahoma, Arial, sans-serif;
      color: #0f172a;
      background: #ffffff;
      line-height: 1.7;
      margin: 0;
      padding: 20px;
    }
    header {
      border-bottom: 2px solid #1e3a5f;
      padding-bottom: 12px;
      margin-bottom: 20px;
      display: flex;
      justify-content: space-between;
      align-items: baseline;
      gap: 12px;
    }
    h1 {
      font-size: 20px;
      margin: 0;
      color: #1e3a5f;
    }
    .date {
      font-size: 13px;
      color: #475569;
      font-variant-numeric: tabular-nums;
    }
    .item {
      border: 1px solid #e2e8f0;
      border-radius: 10px;
      padding: 12px 16px;
      margin-bottom: 12px;
      page-break-inside: avoid;
    }
    .item h2 {
      font-size: 14px;
      margin: 0 0 6px 0;
      color: #1e293b;
    }
    .answer {
      font-size: 13px;
      margin: 0;
      color: #334155;
    }
    .empty {
      font-size: 12px;
      margin: 0;
      color: #94a3b8;
      font-style: italic;
    }
  </style>
</head>
<body>
  <header>
    <h1>الجرد الليلي — مسار ${escapeHtml(pathTitle)}</h1>
    <span class="date">${escapeHtml(dateKey)}</span>
  </header>
  ${sectionsHtml}
  ${extraHtml}
</body>
</html>`;
}

export function buildWhatsAppShareUrl(text: string): string {
  return `https://wa.me/?text=${encodeURIComponent(text)}`;
}
