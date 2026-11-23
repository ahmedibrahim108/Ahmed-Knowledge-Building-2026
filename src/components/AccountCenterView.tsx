import { useEffect, useState } from 'react';
import {
  Activity,
  BookOpen,
  CalendarDays,
  Check,
  CheckCircle2,
  Database,
  Download,
  Eye,
  FolderCog,
  Globe,
  KeyRound,
  Loader2,
  PenLine,
  Plus,
  RefreshCw,
  RotateCcw,
  Save,
  Shield,
  Trash2,
  Users,
  X,
} from 'lucide-react';
import {
  BookNote,
  ContentAccessGrant,
  CustomCategory,
  DEFAULT_REFLECTION_CATEGORIES,
  DomainId,
  DomainInfo,
  LEARNING_HUBS,
  LearningHubId,
  LearningPath,
  MonthActivities,
  MonthPlan,
  MonthStatus,
  PersonalCourse,
  PersonalReflection,
  PublicSiteConfig,
  QuarterInfo,
  ReadingLibraryItem,
  ReadingModeMeta,
  SmallTask,
  StudyHistoryEntry,
  StudyResource,
  UnifiedTask,
  UserProfileItem,
  VoiceDialectMode,
  WeeklyMeeting,
  getHubMeta,
} from '../data/curriculumData';
import { OWNER_ADMIN_EMAIL } from '../firebase';
import {
  SupabaseConnectionTestResult,
  testSupabaseConnection,
} from '../services/supabaseClient';
import {
  deleteContentAccessGrant,
  fetchAllContentGrants,
  fetchAllUserProfiles,
  isPending007Migration,
  updateUserProfileAccess,
  upsertContentAccessGrant,
} from '../services/supabaseSync';
import { exportPlanToExcel } from '../utils/excelExport';
import ConfirmDialog from './ConfirmDialog';
import DomainsView from './DomainsView';
import type { ActivePdfTarget } from './PDFViewerModal';
import TwelveMonthPlanView from './TwelveMonthPlanView';
import WeeklyMeetingsPanel from './WeeklyMeetingsPanel';

type AccountSubTab =
  | 'plan'
  | 'meetings'
  | 'categories'
  | 'data'
  | 'public_site'
  | 'users';

interface AccountCenterViewProps {
  uid?: string;
  canEdit: boolean;
  onRequireAuth: () => void;
  voiceDialect: VoiceDialectMode;
  quarters: QuarterInfo[];
  months: MonthPlan[];
  domains: DomainInfo[];
  courses: PersonalCourse[];
  learningPaths: LearningPath[];
  readingItems: ReadingLibraryItem[];
  bookNotesCount: number;
  selectedMonthId: number;
  domainFilter: DomainId | 'all';
  onSelectMonth: (id: number) => void;
  onChangeDomainFilter: (domainId: DomainId | 'all') => void;
  onOpenPdf?: (target: ActivePdfTarget) => void;
  onAddQuarter: (title: string, subtitle: string) => void;
  onUpdateQuarter: (id: string, updates: Partial<QuarterInfo>) => void;
  onDeleteQuarter: (id: string) => void;
  onAddMonth: (payload: {
    quarter: number;
    theme: string;
    foundationalTitle: string;
    foundationalAuthor: string;
    exploratoryTitle: string;
    exploratoryAuthor: string;
    courseId: number;
  }) => void;
  onUpdateMonth: (id: number, updates: Partial<MonthPlan>) => void;
  onDeleteMonth: (id: number) => void;
  onUpdateMonthStatus: (id: number, status: MonthStatus) => void;
  onToggleActivity: (id: number, key: keyof MonthActivities) => void;
  onUpdateMonthNotes: (id: number, notes: string) => void;
  onUpdateTrackItem: (
    id: number,
    track: 'foundational' | 'exploratory',
    field: 'title' | 'author' | 'pace' | 'domainId' | 'format' | 'focus',
    value: string
  ) => void;
  onToggleMonthTask: (monthId: number, taskId: string) => void;
  onAddMonthTask: (monthId: number, text: string, track: SmallTask['track']) => void;
  onDeleteMonthTask: (monthId: number, taskId: string) => void;
  onAddMonthResource: (
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
  ) => void;
  onUpdateMonthResource?: (
    monthId: number,
    resourceId: string,
    updates: Partial<StudyResource>
  ) => void;
  onDeleteMonthResource: (monthId: number, resourceId: string) => void;
  onOpenBookNote?: (
    bookTitle: string,
    author: string,
    initialContent?: string
  ) => void;
  onLogMonthStudyMetric?: (id: number, metric: 'review' | 'listen') => void;
  onAddDomain: (domain: Omit<DomainInfo, 'id' | 'order'>) => void;
  onUpdateDomain: (id: DomainId, updates: Partial<DomainInfo>) => void;
  onDeleteDomain: (id: DomainId) => void;
  weeklyMeetings: WeeklyMeeting[];
  onAddWeeklyMeeting: (meeting: Omit<WeeklyMeeting, 'id'>) => void;
  onUpdateWeeklyMeeting: (id: string, updates: Partial<WeeklyMeeting>) => void;
  onDeleteWeeklyMeeting: (id: string) => void;
  onAddUnifiedTask: (task: Omit<UnifiedTask, 'id'>) => string;
  onOpenCalendar: () => void;
  customCategories: CustomCategory[];
  onAddCustomCategory: (
    title: string,
    description: string,
    color: CustomCategory['color'],
    hubId: CustomCategory['hubId']
  ) => void;
  onDeleteCustomCategory: (id: string) => void;
  history: StudyHistoryEntry[];
  onClearHistory: () => void;
  onNavigateFromHistory: (entry: StudyHistoryEntry) => void;
  onResetWorkspace: () => void;
  onForceSync: () => Promise<void> | void;
  publicSiteConfig: PublicSiteConfig;
  onSavePublicSiteConfig: (next: PublicSiteConfig) => Promise<void> | void;
  onToggleCoursePublic: (docId: string, isPublic: boolean) => void;
  onTogglePathPublic: (pathId: string, isPublic: boolean) => void;
  onToggleBookPublic: (bookId: string, isPublic: boolean) => void;
  onPreviewPublicSite: () => void;
  bookNotesForExcel: Parameters<typeof exportPlanToExcel>[2];
  bookNotes?: BookNote[];
  reflections?: PersonalReflection[];
  reflectionCategories?: string[];
  onToggleReflectionPublic?: (id: string, isPublic: boolean) => void;
  customReadingModes?: ReadingModeMeta[];
  onUpdateReadingModes?: (nextModes: ReadingModeMeta[]) => void;
}

export default function AccountCenterView(props: AccountCenterViewProps) {
  const [subTab, setSubTab] = useState<AccountSubTab>('plan');
  const [planSubMode, setPlanSubMode] = useState<'months' | 'domains'>('months');

  // Custom Category state
  const [catTitle, setCatTitle] = useState('');
  const [catDesc, setCatDesc] = useState('');
  const [catHub, setCatHub] = useState<CustomCategory['hubId']>('all');
  const [catColor, setCatColor] = useState<CustomCategory['color']>('navy');

  // Data & Diagnostics state
  const [confirmResetOpen, setConfirmResetOpen] = useState(false);
  const [syncingManual, setSyncingManual] = useState(false);
  const [diagOpen, setDiagOpen] = useState(false);
  const [diagRunning, setDiagRunning] = useState(false);
  const [diagResult, setDiagResult] = useState<SupabaseConnectionTestResult | null>(null);

  // Public site editor state
  const [siteDraft, setSiteDraft] = useState<PublicSiteConfig>(props.publicSiteConfig);
  const [newSkill, setNewSkill] = useState('');
  const [editingSkillIdx, setEditingSkillIdx] = useState<number | null>(null);
  const [editingSkillVal, setEditingSkillVal] = useState('');
  const [newInterest, setNewInterest] = useState('');
  const [editingInterestIdx, setEditingInterestIdx] = useState<number | null>(null);
  const [editingInterestVal, setEditingInterestVal] = useState('');
  const [savingSite, setSavingSite] = useState(false);
  const [siteSavedNotice, setSiteSavedNotice] = useState<string | null>(null);

  // Users RBAC & Content Grants state
  const [profiles, setProfiles] = useState<UserProfileItem[]>([]);
  const [grantsByUid, setGrantsByUid] = useState<Record<string, ContentAccessGrant>>({});
  const [loadingProfiles, setLoadingProfiles] = useState(false);
  const [profilesError, setProfilesError] = useState<string | null>(null);
  const [grantModalUser, setGrantModalUser] = useState<UserProfileItem | null>(null);
  const [grantDraft, setGrantDraft] = useState<{
    courseDocIds: string[];
    includeCourseNotes: boolean;
    noteIds: string[];
    pathIds: string[];
    bookIds: string[];
    reflectionIds: string[];
    reflectionCategories: string[];
    notesForUser: string;
  }>({
    courseDocIds: [],
    includeCourseNotes: true,
    noteIds: [],
    pathIds: [],
    bookIds: [],
    reflectionIds: [],
    reflectionCategories: [],
    notesForUser: '',
  });
  const [grantNoteSearch, setGrantNoteSearch] = useState('');
  const [savingGrant, setSavingGrant] = useState(false);

  const allReflectionCats = Array.from(
    new Set([
      ...(props.reflectionCategories && props.reflectionCategories.length > 0
        ? props.reflectionCategories
        : DEFAULT_REFLECTION_CATEGORIES),
      ...(props.reflections || [])
        .map((r) => (r.categoryTag || '').trim())
        .filter(Boolean),
    ])
  );

  useEffect(() => {
    setSiteDraft(props.publicSiteConfig);
  }, [props.publicSiteConfig]);

  const loadProfiles = async () => {
    setLoadingProfiles(true);
    setProfilesError(null);
    try {
      const [list, grantsList] = await Promise.all([
        fetchAllUserProfiles(),
        props.uid ? fetchAllContentGrants(props.uid) : Promise.resolve([]),
      ]);
      setProfiles(list);
      const map: Record<string, ContentAccessGrant> = {};
      for (const g of grantsList) {
        map[g.granteeUid] = g;
      }
      setGrantsByUid(map);
    } catch (err) {
      setProfilesError(
        err instanceof Error ? err.message : 'تعذر تحميل قائمة المستخدمين.'
      );
    } finally {
      setLoadingProfiles(false);
    }
  };

  useEffect(() => {
    if (subTab === 'users') {
      void loadProfiles();
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [subTab]);

  const openGrantModalForUser = (prof: UserProfileItem) => {
    const existing = grantsByUid[prof.uid];
    setGrantModalUser(prof);
    setGrantNoteSearch('');
    setGrantDraft({
      courseDocIds: existing?.courseDocIds ?? [],
      includeCourseNotes: existing?.includeCourseNotes ?? true,
      noteIds: existing?.noteIds ?? [],
      pathIds: existing?.pathIds ?? [],
      bookIds: existing?.bookIds ?? [],
      reflectionIds: existing?.reflectionIds ?? [],
      reflectionCategories: existing?.reflectionCategories ?? [],
      notesForUser: existing?.notesForUser ?? '',
    });
  };

  const handleSaveUserGrant = async () => {
    if (!grantModalUser || !props.uid) return;
    setSavingGrant(true);
    setProfilesError(null);
    try {
      const saved = await upsertContentAccessGrant(props.uid, {
        granteeUid: grantModalUser.uid,
        granteeEmail: grantModalUser.email,
        ...grantDraft,
      });
      setGrantsByUid((prev) => ({
        ...prev,
        [grantModalUser.uid]: saved,
      }));
      setGrantModalUser(null);
    } catch (err) {
      setProfilesError(
        err instanceof Error ? err.message : 'تعذر حفظ صلاحيات المحتوى.'
      );
    } finally {
      setSavingGrant(false);
    }
  };

  const handleRevokeUserGrant = async () => {
    if (!grantModalUser || !props.uid) return;
    setSavingGrant(true);
    setProfilesError(null);
    try {
      await deleteContentAccessGrant(props.uid, grantModalUser.uid);
      setGrantsByUid((prev) => {
        const next = { ...prev };
        delete next[grantModalUser.uid];
        return next;
      });
      setGrantModalUser(null);
    } catch (err) {
      setProfilesError(
        err instanceof Error ? err.message : 'تعذر إلغاء صلاحيات المحتوى.'
      );
    } finally {
      setSavingGrant(false);
    }
  };

  const handleRunDiagnostics = async () => {
    setDiagRunning(true);
    try {
      const res = await testSupabaseConnection();
      setDiagResult(res);
    } finally {
      setDiagRunning(false);
    }
  };

  const handleSavePublicConfig = async (e: React.FormEvent) => {
    e.preventDefault();
    setSavingSite(true);
    setSiteSavedNotice(null);
    try {
      await props.onSavePublicSiteConfig({
        ...siteDraft,
        updatedAtMs: Date.now(),
      });
      setSiteSavedNotice('تم حفظ إعدادات الموقع العام ومزامنتها.');
    } finally {
      setSavingSite(false);
    }
  };

  const handleRoleUpdate = async (
    userRow: UserProfileItem,
    role: 'user' | 'admin',
    approvalStatus: UserProfileItem['approvalStatus']
  ) => {
    setProfilesError(null);
    try {
      await updateUserProfileAccess(userRow.uid, { role, approvalStatus });
      setProfiles((prev) =>
        prev.map((p) =>
          p.uid === userRow.uid ? { ...p, role, approvalStatus } : p
        )
      );
    } catch (err) {
      setProfilesError(
        err instanceof Error ? err.message : 'تعذر تحديث صلاحيات المستخدم.'
      );
    }
  };

  const domainBreakdown = props.domains.map((domain) => {
    const matchingMonths = props.months.filter(
      (m) => m.foundational.domainId === domain.id || m.exploratory.domainId === domain.id
    );
    const completedMonths = matchingMonths.filter((m) => m.status === 'completed').length;
    return {
      domain,
      total: matchingMonths.length,
      completed: completedMonths,
    };
  });

  const subTabs: Array<{ id: AccountSubTab; label: string; icon: typeof CalendarDays }> = [
    { id: 'plan', label: 'الخطة السنوية والمجالات', icon: CalendarDays },
    { id: 'meetings', label: 'اللقاءات والتراكمي', icon: Activity },
    { id: 'categories', label: 'التصنيفات وسجل النشاط', icon: FolderCog },
    { id: 'public_site', label: 'تخصيص الموقع العام', icon: Globe },
    { id: 'users', label: 'المستخدمون والصلاحيات', icon: Users },
    { id: 'data', label: 'البيانات والنسخ الاحتياطي', icon: Database },
  ];

  return (
    <div className="space-y-6">
      {/* Header + Sub-nav */}
      <div className="bg-white border border-slate-200 rounded-2xl p-5 sm:p-6 space-y-4">
        <div className="flex flex-wrap items-center justify-between gap-3">
          <div>
            <h1 className="font-editorial text-2xl sm:text-3xl font-bold text-slate-900">
              مركز الحساب والإدارة
            </h1>
            <p className="text-xs sm:text-sm text-slate-600 mt-1">
              إدارة الخطة السنوية، اللقاءات، التصنيفات، تخصيص الصفحة العامة للزوار، وإدارة صلاحيات المستخدمين والبيانات.
            </p>
          </div>
          <button
            type="button"
            onClick={props.onPreviewPublicSite}
            className="inline-flex items-center gap-1.5 px-3.5 py-2 min-h-[38px] text-xs font-semibold text-[#1E3A5F] bg-[#F7F8FA] border border-slate-300 hover:bg-slate-100 rounded-lg cursor-pointer"
          >
            <Eye className="w-4 h-4" aria-hidden="true" />
            <span>معاينة الموقع العام</span>
          </button>
        </div>

        <div className="flex flex-wrap gap-2 pt-1 border-t border-slate-100">
          {subTabs.map((t) => {
            const Icon = t.icon;
            const active = subTab === t.id;
            return (
              <button
                key={t.id}
                type="button"
                onClick={() => setSubTab(t.id)}
                className={`inline-flex items-center gap-1.5 px-3.5 py-2 min-h-[38px] text-xs font-semibold rounded-lg border cursor-pointer transition-colors ${
                  active
                    ? 'bg-[#1E3A5F] text-white border-[#1E3A5F]'
                    : 'bg-[#F7F8FA] text-slate-700 border-slate-200 hover:bg-slate-100'
                }`}
              >
                <Icon className="w-3.5 h-3.5" aria-hidden="true" />
                <span>{t.label}</span>
              </button>
            );
          })}
        </div>
      </div>

      {/* Sub-tab 1: 12-Month Plan & Domains */}
      {subTab === 'plan' && (
        <div className="space-y-4">
          <div className="flex items-center gap-2">
            <button
              type="button"
              onClick={() => setPlanSubMode('months')}
              className={`px-4 py-2 text-xs font-semibold rounded-lg border cursor-pointer ${
                planSubMode === 'months'
                  ? 'bg-[#1E3A5F] text-white border-[#1E3A5F]'
                  : 'bg-white text-slate-700 border-slate-200'
              }`}
            >
              الخطة الشهرية والوحدات (12 وحدة)
            </button>
            <button
              type="button"
              onClick={() => setPlanSubMode('domains')}
              className={`px-4 py-2 text-xs font-semibold rounded-lg border cursor-pointer ${
                planSubMode === 'domains'
                  ? 'bg-[#1E3A5F] text-white border-[#1E3A5F]'
                  : 'bg-white text-slate-700 border-slate-200'
              }`}
            >
              المحاور المعرفية والمفكرون ({props.domains.length})
            </button>
          </div>

          {planSubMode === 'months' ? (
            <TwelveMonthPlanView
              uid={props.uid}
              canEdit={props.canEdit}
              onRequireAuth={props.onRequireAuth}
              voiceDialect={props.voiceDialect}
              quarters={props.quarters}
              months={props.months}
              domains={props.domains}
              courses={props.courses}
              selectedMonthId={props.selectedMonthId}
              domainFilter={props.domainFilter}
              onSelectMonth={props.onSelectMonth}
              onChangeDomainFilter={props.onChangeDomainFilter}
              onOpenPdf={props.onOpenPdf}
              onAddQuarter={props.onAddQuarter}
              onUpdateQuarter={props.onUpdateQuarter}
              onDeleteQuarter={props.onDeleteQuarter}
              onAddMonth={props.onAddMonth}
              onUpdateMonth={props.onUpdateMonth}
              onDeleteMonth={props.onDeleteMonth}
              onUpdateMonthStatus={props.onUpdateMonthStatus}
              onToggleActivity={props.onToggleActivity}
              onUpdateMonthNotes={props.onUpdateMonthNotes}
              onUpdateTrackItem={props.onUpdateTrackItem}
              onToggleMonthTask={props.onToggleMonthTask}
              onAddMonthTask={props.onAddMonthTask}
              onDeleteMonthTask={props.onDeleteMonthTask}
              onAddMonthResource={props.onAddMonthResource}
              onUpdateMonthResource={props.onUpdateMonthResource}
              onDeleteMonthResource={props.onDeleteMonthResource}
              onOpenBookNote={props.onOpenBookNote ?? (() => {})}
              customReadingModes={props.customReadingModes}
              onUpdateReadingModes={props.onUpdateReadingModes}
            />
          ) : (
            <DomainsView
              canEdit={props.canEdit}
              domains={props.domains}
              months={props.months}
              onFilterMonthsByDomain={(dId) => {
                props.onChangeDomainFilter(dId);
                setPlanSubMode('months');
              }}
              onAddDomain={props.onAddDomain}
              onUpdateDomain={props.onUpdateDomain}
              onDeleteDomain={props.onDeleteDomain}
            />
          )}
        </div>
      )}

      {/* Sub-tab 2: Cumulative Stats & Weekly Meetings */}
      {subTab === 'meetings' && (
        <div className="space-y-6">
          <section className="bg-white border border-slate-200 rounded-2xl p-5 sm:p-6 space-y-4">
            <h2 className="font-editorial text-xl font-bold text-slate-900">
              التقدم التراكمي عبر المجالات
            </h2>
            <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-3.5">
              {domainBreakdown.map(({ domain, total, completed }) => {
                const pct = total > 0 ? Math.round((completed / total) * 100) : 0;
                return (
                  <div
                    key={domain.id}
                    className="p-4 rounded-xl bg-[#F7F8FA] border border-slate-200 space-y-2"
                  >
                    <div className="flex items-center justify-between gap-2">
                      <span className="text-xs font-bold text-slate-900 truncate">
                        {domain.title}
                      </span>
                      <span className="text-xs font-semibold text-[#1E3A5F] tabular-nums">
                        {completed} / {total}
                      </span>
                    </div>
                    <div className="h-1.5 bg-slate-200 rounded-full overflow-hidden">
                      <div
                        className="h-full bg-[#1E3A5F]"
                        style={{ width: `${pct}%` }}
                      />
                    </div>
                  </div>
                );
              })}
            </div>
          </section>

          <WeeklyMeetingsPanel
            canEdit={props.canEdit}
            onRequireAuth={props.onRequireAuth}
            meetings={props.weeklyMeetings}
            onAddMeeting={props.onAddWeeklyMeeting}
            onUpdateMeeting={props.onUpdateWeeklyMeeting}
            onDeleteMeeting={props.onDeleteWeeklyMeeting}
            onCreateTaskFromFollowUp={(t) => props.onAddUnifiedTask(t)}
            onOpenCalendar={props.onOpenCalendar}
          />
        </div>
      )}

      {/* Sub-tab 3: Custom Categories & Activity History */}
      {subTab === 'categories' && (
        <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
          <section className="bg-white border border-slate-200 rounded-2xl p-5 sm:p-6 space-y-4">
            <h2 className="font-editorial text-xl font-bold text-slate-900">
              التصنيفات المخصّصة
            </h2>
            <form
              onSubmit={(e) => {
                e.preventDefault();
                if (!catTitle.trim()) return;
                props.onAddCustomCategory(
                  catTitle.trim(),
                  catDesc.trim(),
                  catColor,
                  catHub
                );
                setCatTitle('');
                setCatDesc('');
              }}
              className="p-4 rounded-xl bg-[#F7F8FA] border border-slate-200 space-y-3"
            >
              <div className="grid grid-cols-1 sm:grid-cols-2 gap-2.5">
                <input
                  type="text"
                  value={catTitle}
                  onChange={(e) => setCatTitle(e.target.value)}
                  placeholder="اسم التصنيف..."
                  className="px-3 py-2 text-xs bg-white border border-slate-300 rounded-lg"
                />
                <select
                  value={catHub}
                  onChange={(e) => setCatHub(e.target.value as CustomCategory['hubId'])}
                  className="px-2.5 py-2 text-xs bg-white border border-slate-300 rounded-lg"
                >
                  <option value="all">جميع المحاور</option>
                  {LEARNING_HUBS.map((h) => (
                    <option key={h.id} value={h.id}>
                      {h.title}
                    </option>
                  ))}
                </select>
              </div>
              <div className="flex flex-wrap gap-2">
                <input
                  type="text"
                  value={catDesc}
                  onChange={(e) => setCatDesc(e.target.value)}
                  placeholder="وصف مختصر..."
                  className="flex-1 min-w-[160px] px-3 py-2 text-xs bg-white border border-slate-300 rounded-lg"
                />
                <select
                  value={catColor}
                  onChange={(e) =>
                    setCatColor(e.target.value as CustomCategory['color'])
                  }
                  className="px-2.5 py-2 text-xs bg-white border border-slate-300 rounded-lg"
                >
                  <option value="navy">كحلي</option>
                  <option value="emerald">أخضر</option>
                  <option value="amber">ذهبي</option>
                  <option value="slate">رمادي</option>
                </select>
                <button
                  type="submit"
                  disabled={!catTitle.trim()}
                  className="px-4 py-2 text-xs font-semibold text-white bg-[#1E3A5F] rounded-lg disabled:opacity-45 cursor-pointer"
                >
                  إضافة
                </button>
              </div>
            </form>

            <div className="space-y-2">
              {props.customCategories.map((cat) => (
                <div
                  key={cat.id}
                  className="p-3 bg-[#F7F8FA] border border-slate-200 rounded-lg flex items-center justify-between gap-2"
                >
                  <div>
                    <p className="text-xs font-bold text-slate-900">{cat.title}</p>
                    {cat.description && (
                      <p className="text-[11px] text-slate-500">{cat.description}</p>
                    )}
                  </div>
                  <button
                    type="button"
                    onClick={() => props.onDeleteCustomCategory(cat.id)}
                    aria-label="حذف التصنيف"
                    className="p-1.5 text-slate-400 hover:text-red-700 cursor-pointer"
                  >
                    <Trash2 className="w-3.5 h-3.5" />
                  </button>
                </div>
              ))}
            </div>
          </section>

          <section className="bg-white border border-slate-200 rounded-2xl p-5 sm:p-6 space-y-4">
            <div className="flex items-center justify-between">
              <h2 className="font-editorial text-xl font-bold text-slate-900">
                سجل النشاط والدراسة ({props.history.length})
              </h2>
              {props.history.length > 0 && (
                <button
                  type="button"
                  onClick={props.onClearHistory}
                  className="text-xs text-red-700 hover:underline cursor-pointer"
                >
                  مسح السجل
                </button>
              )}
            </div>

            {props.history.length === 0 ? (
              <p className="text-xs text-slate-500 py-4">لا يوجد نشاط مسجّل بعد.</p>
            ) : (
              <div className="space-y-2 max-h-[460px] overflow-y-auto">
                {props.history.map((entry) => (
                  <button
                    key={entry.id}
                    type="button"
                    onClick={() => props.onNavigateFromHistory(entry)}
                    className="w-full text-right p-3 bg-[#F7F8FA] hover:bg-slate-100 border border-slate-200 rounded-lg transition-colors cursor-pointer"
                  >
                    <div className="flex items-center justify-between text-[11px] text-slate-500">
                      <span className="font-semibold text-[#1E3A5F]">
                        {entry.title}
                      </span>
                      <span>{entry.timestampLabel}</span>
                    </div>
                    {entry.detail && (
                      <p className="text-xs text-slate-700 mt-1 truncate">
                        {entry.detail}
                      </p>
                    )}
                  </button>
                ))}
              </div>
            )}
          </section>
        </div>
      )}

      {/* Sub-tab 4: Public Homepage Editor & Publish Controls */}
      {subTab === 'public_site' && (
        <div className="space-y-6">
          <form
            onSubmit={handleSavePublicConfig}
            className="bg-white border border-slate-200 rounded-2xl p-5 sm:p-6 space-y-5"
          >
            <div className="flex flex-wrap items-center justify-between gap-3">
              <div>
                <h2 className="font-editorial text-xl font-bold text-slate-900">
                  تحرير الواجهة العامة للزوار
                </h2>
                <p className="text-xs text-slate-500">
                  تظهر هذه المعلومات للزوار غير المسجلين وللمستخدمين العاديين فقط.
                </p>
              </div>
              <button
                type="submit"
                disabled={savingSite}
                className="inline-flex items-center gap-1.5 px-4 py-2 text-xs font-semibold text-white bg-[#1E3A5F] hover:bg-[#162C49] rounded-lg cursor-pointer"
              >
                {savingSite ? (
                  <Loader2 className="w-3.5 h-3.5 animate-spin" />
                ) : (
                  <Save className="w-3.5 h-3.5" />
                )}
                <span>حفظ التغييرات</span>
              </button>
            </div>

            {siteSavedNotice && (
              <div className="p-3 rounded-lg bg-emerald-50 border border-emerald-200 text-xs text-emerald-800">
                {siteSavedNotice}
              </div>
            )}

            <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
              <div>
                <label className="block text-xs font-semibold text-slate-700 mb-1">
                  العنوان الرئيسي للواجهة
                </label>
                <input
                  type="text"
                  value={siteDraft.heroTitle}
                  onChange={(e) =>
                    setSiteDraft((p) => ({ ...p, heroTitle: e.target.value }))
                  }
                  className="w-full px-3 py-2 text-sm bg-[#F7F8FA] border border-slate-300 rounded-lg"
                />
              </div>
              <div>
                <label className="block text-xs font-semibold text-slate-700 mb-1">
                  العنوان الفرعي
                </label>
                <input
                  type="text"
                  value={siteDraft.heroSubtitle}
                  onChange={(e) =>
                    setSiteDraft((p) => ({ ...p, heroSubtitle: e.target.value }))
                  }
                  className="w-full px-3 py-2 text-sm bg-[#F7F8FA] border border-slate-300 rounded-lg"
                />
              </div>
            </div>

            <div>
              <label className="block text-xs font-semibold text-slate-700 mb-1">
                نبذة تعريفية
              </label>
              <textarea
                rows={3}
                value={siteDraft.introBio}
                onChange={(e) =>
                  setSiteDraft((p) => ({ ...p, introBio: e.target.value }))
                }
                className="w-full px-3 py-2 text-sm bg-[#F7F8FA] border border-slate-300 rounded-lg"
              />
            </div>

            <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
              <div>
                <label className="block text-xs font-semibold text-slate-700 mb-1">
                  الخلفية والخبرة
                </label>
                <textarea
                  rows={3}
                  value={siteDraft.backgroundText}
                  onChange={(e) =>
                    setSiteDraft((p) => ({ ...p, backgroundText: e.target.value }))
                  }
                  className="w-full px-3 py-2 text-sm bg-[#F7F8FA] border border-slate-300 rounded-lg"
                />
              </div>
              <div>
                <label className="block text-xs font-semibold text-slate-700 mb-1">
                  فلسفة التعلّم
                </label>
                <textarea
                  rows={3}
                  value={siteDraft.philosophyText}
                  onChange={(e) =>
                    setSiteDraft((p) => ({ ...p, philosophyText: e.target.value }))
                  }
                  className="w-full px-3 py-2 text-sm bg-[#F7F8FA] border border-slate-300 rounded-lg"
                />
              </div>
            </div>

            {/* Skills & Interests with Inline Edit */}
            <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
              <div className="p-4 rounded-xl bg-[#F7F8FA] border border-slate-200 space-y-2.5">
                <p className="text-xs font-bold text-slate-800">المهارات الظاهرة</p>
                <div className="flex flex-wrap gap-1.5">
                  {siteDraft.skills.map((sk, idx) =>
                    editingSkillIdx === idx ? (
                      <div
                        key={`edit-sk-${idx}`}
                        className="inline-flex items-center gap-1 bg-white border border-[#1E3A5F] rounded-md px-1.5 py-0.5"
                      >
                        <input
                          type="text"
                          autoFocus
                          value={editingSkillVal}
                          onChange={(e) => setEditingSkillVal(e.target.value)}
                          onKeyDown={(e) => {
                            if (e.key === 'Enter') {
                              e.preventDefault();
                              const clean = editingSkillVal.trim();
                              if (clean) {
                                setSiteDraft((p) => ({
                                  ...p,
                                  skills: p.skills.map((s, i) => (i === idx ? clean : s)),
                                }));
                              }
                              setEditingSkillIdx(null);
                            } else if (e.key === 'Escape') {
                              setEditingSkillIdx(null);
                            }
                          }}
                          className="w-28 text-xs focus:outline-none"
                        />
                        <button
                          type="button"
                          onClick={() => {
                            const clean = editingSkillVal.trim();
                            if (clean) {
                              setSiteDraft((p) => ({
                                ...p,
                                skills: p.skills.map((s, i) => (i === idx ? clean : s)),
                              }));
                            }
                            setEditingSkillIdx(null);
                          }}
                          className="text-emerald-700 cursor-pointer"
                          aria-label="حفظ التعديل"
                        >
                          <Check className="w-3 h-3" />
                        </button>
                      </div>
                    ) : (
                      <span
                        key={`${sk}-${idx}`}
                        className="inline-flex items-center gap-1 px-2.5 py-1 text-xs bg-white border border-slate-200 rounded-md"
                      >
                        <span>{sk}</span>
                        <button
                          type="button"
                          onClick={() => {
                            setEditingSkillIdx(idx);
                            setEditingSkillVal(sk);
                          }}
                          aria-label={`تعديل ${sk}`}
                          className="text-slate-400 hover:text-[#1E3A5F] cursor-pointer"
                        >
                          <PenLine className="w-2.5 h-2.5" />
                        </button>
                        <button
                          type="button"
                          onClick={() =>
                            setSiteDraft((p) => ({
                              ...p,
                              skills: p.skills.filter((_, i) => i !== idx),
                            }))
                          }
                          aria-label={`حذف ${sk}`}
                          className="text-slate-400 hover:text-red-700 cursor-pointer"
                        >
                          <X className="w-3 h-3" />
                        </button>
                      </span>
                    )
                  )}
                </div>
                <div className="flex gap-2">
                  <input
                    type="text"
                    value={newSkill}
                    onChange={(e) => setNewSkill(e.target.value)}
                    placeholder="أضف مهارة..."
                    className="flex-1 px-2.5 py-1.5 text-xs bg-white border border-slate-300 rounded-lg"
                  />
                  <button
                    type="button"
                    onClick={() => {
                      const clean = newSkill.trim();
                      if (!clean || siteDraft.skills.includes(clean)) return;
                      setSiteDraft((p) => ({ ...p, skills: [...p.skills, clean] }));
                      setNewSkill('');
                    }}
                    className="px-3 py-1.5 text-xs font-semibold text-white bg-[#1E3A5F] rounded-lg cursor-pointer"
                  >
                    إضافة
                  </button>
                </div>
              </div>

              <div className="p-4 rounded-xl bg-[#F7F8FA] border border-slate-200 space-y-2.5">
                <p className="text-xs font-bold text-slate-800">الاهتمامات الظاهرة</p>
                <div className="flex flex-wrap gap-1.5">
                  {siteDraft.interests.map((intr, idx) =>
                    editingInterestIdx === idx ? (
                      <div
                        key={`edit-intr-${idx}`}
                        className="inline-flex items-center gap-1 bg-white border border-[#1E3A5F] rounded-md px-1.5 py-0.5"
                      >
                        <input
                          type="text"
                          autoFocus
                          value={editingInterestVal}
                          onChange={(e) => setEditingInterestVal(e.target.value)}
                          onKeyDown={(e) => {
                            if (e.key === 'Enter') {
                              e.preventDefault();
                              const clean = editingInterestVal.trim();
                              if (clean) {
                                setSiteDraft((p) => ({
                                  ...p,
                                  interests: p.interests.map((s, i) =>
                                    i === idx ? clean : s
                                  ),
                                }));
                              }
                              setEditingInterestIdx(null);
                            } else if (e.key === 'Escape') {
                              setEditingInterestIdx(null);
                            }
                          }}
                          className="w-28 text-xs focus:outline-none"
                        />
                        <button
                          type="button"
                          onClick={() => {
                            const clean = editingInterestVal.trim();
                            if (clean) {
                              setSiteDraft((p) => ({
                                ...p,
                                interests: p.interests.map((s, i) =>
                                  i === idx ? clean : s
                                ),
                              }));
                            }
                            setEditingInterestIdx(null);
                          }}
                          className="text-emerald-700 cursor-pointer"
                          aria-label="حفظ التعديل"
                        >
                          <Check className="w-3 h-3" />
                        </button>
                      </div>
                    ) : (
                      <span
                        key={`${intr}-${idx}`}
                        className="inline-flex items-center gap-1 px-2.5 py-1 text-xs bg-white border border-slate-200 rounded-md"
                      >
                        <span>{intr}</span>
                        <button
                          type="button"
                          onClick={() => {
                            setEditingInterestIdx(idx);
                            setEditingInterestVal(intr);
                          }}
                          aria-label={`تعديل ${intr}`}
                          className="text-slate-400 hover:text-[#1E3A5F] cursor-pointer"
                        >
                          <PenLine className="w-2.5 h-2.5" />
                        </button>
                        <button
                          type="button"
                          onClick={() =>
                            setSiteDraft((p) => ({
                              ...p,
                              interests: p.interests.filter((_, i) => i !== idx),
                            }))
                          }
                          aria-label={`حذف ${intr}`}
                          className="text-slate-400 hover:text-red-700 cursor-pointer"
                        >
                          <X className="w-3 h-3" />
                        </button>
                      </span>
                    )
                  )}
                </div>
                <div className="flex gap-2">
                  <input
                    type="text"
                    value={newInterest}
                    onChange={(e) => setNewInterest(e.target.value)}
                    placeholder="أضف اهتمامًا..."
                    className="flex-1 px-2.5 py-1.5 text-xs bg-white border border-slate-300 rounded-lg"
                  />
                  <button
                    type="button"
                    onClick={() => {
                      const clean = newInterest.trim();
                      if (!clean || siteDraft.interests.includes(clean)) return;
                      setSiteDraft((p) => ({
                        ...p,
                        interests: [...p.interests, clean],
                      }));
                      setNewInterest('');
                    }}
                    className="px-3 py-1.5 text-xs font-semibold text-white bg-[#1E3A5F] rounded-lg cursor-pointer"
                  >
                    إضافة
                  </button>
                </div>
              </div>
            </div>

            {/* Visibility Toggles */}
            <div className="p-4 rounded-xl bg-[#F7F8FA] border border-slate-200 space-y-3">
              <p className="text-xs font-bold text-slate-800">
                إظهار / إخفاء الأقسام في الصفحة العامة
              </p>
              <div className="grid grid-cols-2 sm:grid-cols-3 lg:grid-cols-5 gap-2 text-xs">
                {(
                  [
                    ['showHero', 'الواجهة التعريفية'],
                    ['showBackground', 'الخلفية المهنية'],
                    ['showPhilosophy', 'فلسفة التعلّم'],
                    ['showSkills', 'المهارات'],
                    ['showInterests', 'الاهتمامات'],
                    ['showCourses', 'الكورسات المنشورة'],
                    ['showPaths', 'المسارات المنشورة'],
                    ['showBooks', 'الكتب المنشورة'],
                    ['showReflections', 'الخواطر المنشورة'],
                  ] as const
                ).map(([key, label]) => (
                  <label
                    key={key}
                    className="inline-flex items-center gap-2 p-2 bg-white border border-slate-200 rounded-lg cursor-pointer"
                  >
                    <input
                      type="checkbox"
                      checked={siteDraft.visibilityFlags[key] !== false}
                      onChange={(e) =>
                        setSiteDraft((p) => ({
                          ...p,
                          visibilityFlags: {
                            ...p.visibilityFlags,
                            [key]: e.target.checked,
                          },
                        }))
                      }
                    />
                    <span>{label}</span>
                  </label>
                ))}
              </div>

              {allReflectionCats.length > 0 && (
                <div className="pt-3 border-t border-slate-200/80 space-y-2">
                  <p className="text-xs font-bold text-slate-800">
                    تصنيفات الخواطر المنشورة تلقائيًا للعامة:
                  </p>
                  <div className="flex flex-wrap gap-2">
                    {allReflectionCats.map((cat) => {
                      const pubCats = siteDraft.publicReflectionCategories ?? [];
                      const checked = pubCats.includes(cat);
                      return (
                        <label
                          key={cat}
                          className={`inline-flex items-center gap-1.5 px-2.5 py-1.5 text-xs rounded-lg border cursor-pointer ${
                            checked
                              ? 'bg-emerald-50 border-emerald-200 text-emerald-900 font-semibold'
                              : 'bg-white border-slate-200 text-slate-700'
                          }`}
                        >
                          <input
                            type="checkbox"
                            checked={checked}
                            onChange={(e) =>
                              setSiteDraft((p) => {
                                const prev = p.publicReflectionCategories ?? [];
                                const next = e.target.checked
                                  ? Array.from(new Set([...prev, cat]))
                                  : prev.filter((c) => c !== cat);
                                return { ...p, publicReflectionCategories: next };
                              })
                            }
                          />
                          <span>{cat}</span>
                        </label>
                      );
                    })}
                  </div>
                </div>
              )}
            </div>

            {/* Custom Sections */}
            <div className="space-y-3">
              <div className="flex items-center justify-between">
                <p className="text-xs font-bold text-slate-800">
                  الأقسام المخصّصة ({siteDraft.sections.length})
                </p>
                <button
                  type="button"
                  onClick={() =>
                    setSiteDraft((p) => ({
                      ...p,
                      sections: [
                        ...p.sections,
                        {
                          id: `sec-${Date.now()}`,
                          title: 'قسم جديد',
                          body: '',
                          visible: true,
                        },
                      ],
                    }))
                  }
                  className="inline-flex items-center gap-1 px-3 py-1.5 text-xs font-semibold text-[#1E3A5F] bg-slate-100 rounded-lg cursor-pointer"
                >
                  <Plus className="w-3.5 h-3.5" />
                  <span>إضافة قسم</span>
                </button>
              </div>
              {siteDraft.sections.map((sec) => (
                <div
                  key={sec.id}
                  className="p-3.5 rounded-xl bg-[#F7F8FA] border border-slate-200 space-y-2"
                >
                  <div className="flex flex-wrap items-center justify-between gap-2">
                    <input
                      type="text"
                      value={sec.title}
                      onChange={(e) =>
                        setSiteDraft((p) => ({
                          ...p,
                          sections: p.sections.map((s) =>
                            s.id === sec.id ? { ...s, title: e.target.value } : s
                          ),
                        }))
                      }
                      className="flex-1 min-w-[180px] px-2.5 py-1.5 text-xs font-bold bg-white border border-slate-300 rounded-lg"
                    />
                    <label className="inline-flex items-center gap-1.5 text-xs cursor-pointer">
                      <input
                        type="checkbox"
                        checked={sec.visible}
                        onChange={(e) =>
                          setSiteDraft((p) => ({
                            ...p,
                            sections: p.sections.map((s) =>
                              s.id === sec.id ? { ...s, visible: e.target.checked } : s
                            ),
                          }))
                        }
                      />
                      <span>ظاهر</span>
                    </label>
                    <button
                      type="button"
                      onClick={() =>
                        setSiteDraft((p) => ({
                          ...p,
                          sections: p.sections.filter((s) => s.id !== sec.id),
                        }))
                      }
                      className="p-1 text-slate-400 hover:text-red-700 cursor-pointer"
                    >
                      <Trash2 className="w-3.5 h-3.5" />
                    </button>
                  </div>
                  <textarea
                    rows={2}
                    value={sec.body}
                    onChange={(e) =>
                      setSiteDraft((p) => ({
                        ...p,
                        sections: p.sections.map((s) =>
                          s.id === sec.id ? { ...s, body: e.target.value } : s
                        ),
                      }))
                    }
                    className="w-full px-2.5 py-1.5 text-xs bg-white border border-slate-300 rounded-lg"
                  />
                </div>
              ))}
            </div>
          </form>

          {/* Quick Publish Controls */}
          <section className="bg-white border border-slate-200 rounded-2xl p-5 sm:p-6 space-y-4">
            <h2 className="font-editorial text-xl font-bold text-slate-900">
              التحكم السريع في نشر الكورسات والمسارات والكتب للعامة
            </h2>
            <p className="text-xs text-slate-500">
              لا يظهر للزوار إلا ما تُفعّل نشره هنا (ملاحظاتك الخاصة ومهامك وتأملاتك تبقى محمية بالكامل ولا تنشر أبدًا).
            </p>

            <div className="grid grid-cols-1 lg:grid-cols-3 gap-4">
              <div className="p-3.5 rounded-xl bg-[#F7F8FA] border border-slate-200 space-y-2 max-h-[340px] overflow-y-auto">
                <p className="text-xs font-bold text-slate-900">
                  الكورسات ({props.courses.filter((c) => c.isPublic).length} منشور)
                </p>
                {props.courses.map((c) => {
                  const docId = c.docId || `course-${c.id}`;
                  return (
                    <label
                      key={docId}
                      className="flex items-center justify-between gap-2 p-2 bg-white border border-slate-200 rounded-lg text-xs cursor-pointer"
                    >
                      <span className="truncate">{c.title}</span>
                      <input
                        type="checkbox"
                        checked={Boolean(c.isPublic)}
                        onChange={(e) =>
                          props.onToggleCoursePublic(docId, e.target.checked)
                        }
                      />
                    </label>
                  );
                })}
              </div>

              <div className="p-3.5 rounded-xl bg-[#F7F8FA] border border-slate-200 space-y-2 max-h-[340px] overflow-y-auto">
                <p className="text-xs font-bold text-slate-900">
                  المسارات ({props.learningPaths.filter((p) => p.isPublic).length} منشور)
                </p>
                {props.learningPaths.map((p) => (
                  <label
                    key={p.id}
                    className="flex items-center justify-between gap-2 p-2 bg-white border border-slate-200 rounded-lg text-xs cursor-pointer"
                  >
                    <span className="truncate">{p.title}</span>
                    <input
                      type="checkbox"
                      checked={Boolean(p.isPublic)}
                      onChange={(e) => props.onTogglePathPublic(p.id, e.target.checked)}
                    />
                  </label>
                ))}
              </div>

              <div className="p-3.5 rounded-xl bg-[#F7F8FA] border border-slate-200 space-y-2 max-h-[340px] overflow-y-auto">
                <p className="text-xs font-bold text-slate-900">
                  المكتبة ({props.readingItems.filter((b) => b.isPublic).length} منشور)
                </p>
                {props.readingItems.map((b) => (
                  <label
                    key={b.id}
                    className="flex items-center justify-between gap-2 p-2 bg-white border border-slate-200 rounded-lg text-xs cursor-pointer"
                  >
                    <span className="truncate">{b.title}</span>
                    <input
                      type="checkbox"
                      checked={Boolean(b.isPublic)}
                      onChange={(e) => props.onToggleBookPublic(b.id, e.target.checked)}
                    />
                  </label>
                ))}
              </div>
            </div>

            {(props.reflections?.length ?? 0) > 0 && props.onToggleReflectionPublic && (
              <div className="p-3.5 rounded-xl bg-[#F7F8FA] border border-slate-200 space-y-2 max-h-[260px] overflow-y-auto">
                <p className="text-xs font-bold text-slate-900">
                  الخواطر الفردية ({(props.reflections || []).filter((r) => r.isPublic).length} منشورة فرديًا)
                </p>
                <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-2">
                  {(props.reflections || []).map((r) => (
                    <label
                      key={r.id}
                      className="flex items-center justify-between gap-2 p-2 bg-white border border-slate-200 rounded-lg text-xs cursor-pointer"
                    >
                      <span className="truncate">
                        {r.title || r.moodTag}
                        {r.categoryTag ? ` (${r.categoryTag})` : ''}
                      </span>
                      <input
                        type="checkbox"
                        checked={Boolean(r.isPublic)}
                        onChange={(e) =>
                          props.onToggleReflectionPublic?.(r.id, e.target.checked)
                        }
                      />
                    </label>
                  ))}
                </div>
              </div>
            )}
          </section>
        </div>
      )}

      {/* Sub-tab 5: Users, Roles & Granular Content Access Control */}
      {subTab === 'users' && (
        <section className="bg-white border border-slate-200 rounded-2xl p-5 sm:p-6 space-y-4">
          <div className="flex flex-wrap items-center justify-between gap-3">
            <div>
              <h2 className="font-editorial text-xl font-bold text-slate-900">
                المستخدمون والصلاحيات والمحتوى المخصّص
              </h2>
              <p className="text-xs text-slate-500">
                تحكم في أدوار الحسابات، وامنح كل حساب صلاحية الوصول إلى كورسات أو تلخيصات أو مسارات أو كتب أو خواطر محددة. يظل ({OWNER_ADMIN_EMAIL}) محميًا كمسؤول.
              </p>
            </div>
            <button
              type="button"
              onClick={() => void loadProfiles()}
              disabled={loadingProfiles}
              className="inline-flex items-center gap-1.5 px-3 py-2 text-xs font-medium bg-slate-100 hover:bg-slate-200 rounded-lg cursor-pointer"
            >
              <RefreshCw
                className={`w-3.5 h-3.5 ${loadingProfiles ? 'animate-spin' : ''}`}
              />
              <span>تحديث</span>
            </button>
          </div>

          {profilesError && (
            <div className="p-3 rounded-lg bg-red-50 border border-red-200 text-xs text-red-800">
              {profilesError}
            </div>
          )}

          {loadingProfiles ? (
            <div className="py-8 flex items-center justify-center gap-2 text-xs text-slate-500">
              <Loader2 className="w-4 h-4 animate-spin" />
              <span>جاري تحميل المستخدمين...</span>
            </div>
          ) : profiles.length === 0 ? (
            <p className="text-xs text-slate-500 py-4">لا توجد ملفات مستخدمين مسجّلة.</p>
          ) : (
            <div className="overflow-x-auto">
              <table className="w-full text-right text-xs border-collapse">
                <thead>
                  <tr className="border-b border-slate-200 text-slate-500">
                    <th className="py-2.5 px-3 font-semibold">المستخدم</th>
                    <th className="py-2.5 px-3 font-semibold">البريد</th>
                    <th className="py-2.5 px-3 font-semibold">الدور</th>
                    <th className="py-2.5 px-3 font-semibold">الحالة</th>
                    <th className="py-2.5 px-3 font-semibold">صلاحيات المحتوى المخصّصة</th>
                  </tr>
                </thead>
                <tbody className="divide-y divide-slate-100">
                  {profiles.map((prof) => {
                    const isPrimaryOwner =
                      prof.email.toLowerCase() === OWNER_ADMIN_EMAIL.toLowerCase();
                    const g = grantsByUid[prof.uid];
                    const grantParts: string[] = [];
                    if (g?.courseDocIds.length)
                      grantParts.push(`${g.courseDocIds.length} كورس`);
                    if (g?.noteIds.length) grantParts.push(`${g.noteIds.length} تلخيص`);
                    if (g?.pathIds.length) grantParts.push(`${g.pathIds.length} مسار`);
                    if (g?.bookIds.length) grantParts.push(`${g.bookIds.length} كتاب`);
                    if ((g?.reflectionIds.length || 0) + (g?.reflectionCategories.length || 0) > 0)
                      grantParts.push('خواطر');

                    return (
                      <tr key={prof.uid}>
                        <td className="py-3 px-3 font-semibold text-slate-900">
                          {prof.displayName || 'مستخدم'}
                          {isPrimaryOwner && (
                            <span className="mr-2 text-[10px] font-bold text-[#1E3A5F]">
                              (المالك الأساسي)
                            </span>
                          )}
                        </td>
                        <td className="py-3 px-3 text-slate-600">{prof.email}</td>
                        <td className="py-3 px-3">
                          <select
                            disabled={isPrimaryOwner}
                            value={prof.role}
                            onChange={(e) =>
                              void handleRoleUpdate(
                                prof,
                                e.target.value as 'user' | 'admin',
                                prof.approvalStatus
                              )
                            }
                            className="px-2 py-1 bg-[#F7F8FA] border border-slate-300 rounded-md disabled:opacity-60"
                          >
                            <option value="user">مستخدم عادي (عام + مخصّص)</option>
                            <option value="admin">مسؤول (Admin)</option>
                          </select>
                        </td>
                        <td className="py-3 px-3">
                          <select
                            disabled={isPrimaryOwner}
                            value={prof.approvalStatus}
                            onChange={(e) =>
                              void handleRoleUpdate(
                                prof,
                                prof.role,
                                e.target.value as UserProfileItem['approvalStatus']
                              )
                            }
                            className="px-2 py-1 bg-[#F7F8FA] border border-slate-300 rounded-md disabled:opacity-60"
                          >
                            <option value="pending">قيد الانتظار</option>
                            <option value="approved">مفعّل</option>
                            <option value="suspended">معلّق</option>
                            <option value="rejected">مرفوض</option>
                          </select>
                        </td>
                        <td className="py-3 px-3">
                          {isPrimaryOwner ? (
                            <span className="text-[11px] text-slate-500">صلاحية كاملة للمالك</span>
                          ) : (
                            <div className="flex flex-wrap items-center gap-2">
                              <button
                                type="button"
                                onClick={() => openGrantModalForUser(prof)}
                                className="inline-flex items-center gap-1.5 px-2.5 py-1.5 text-[11px] font-semibold text-[#1E3A5F] bg-[#F7F8FA] hover:bg-slate-200 border border-slate-200 rounded-lg cursor-pointer"
                              >
                                <KeyRound className="w-3 h-3" aria-hidden="true" />
                                <span>تخصيص المحتوى</span>
                              </button>
                              <span className="text-[11px] text-slate-500 tabular-nums">
                                {grantParts.length > 0 ? grantParts.join(' · ') : 'عام فقط'}
                              </span>
                            </div>
                          )}
                        </td>
                      </tr>
                    );
                  })}
                </tbody>
              </table>
            </div>
          )}

          {/* Per-Account Content Access Grants Modal */}
          {grantModalUser && (
            <div
              className="fixed inset-0 z-[75] bg-slate-950/60 backdrop-blur-xs flex items-center justify-center p-3 sm:p-4"
              role="dialog"
              aria-modal="true"
              onClick={() => setGrantModalUser(null)}
            >
              <div
                onClick={(e) => e.stopPropagation()}
                className="w-full max-w-4xl max-h-[90dvh] flex flex-col bg-white border border-slate-200 rounded-2xl shadow-2xl overflow-hidden"
              >
                <div className="px-5 py-3.5 bg-slate-50 border-b border-slate-200 flex items-center justify-between gap-2">
                  <div>
                    <h3 className="text-sm sm:text-base font-bold text-slate-900">
                      تخصيص المحتوى لحساب: {grantModalUser.displayName || grantModalUser.email}
                    </h3>
                    <p className="text-[11px] text-slate-500">{grantModalUser.email}</p>
                  </div>
                  <button
                    type="button"
                    onClick={() => setGrantModalUser(null)}
                    aria-label="إغلاق"
                    className="p-1.5 text-slate-500 hover:text-slate-900 rounded-lg cursor-pointer"
                  >
                    <X className="w-4 h-4" />
                  </button>
                </div>

                <div className="flex-1 overflow-y-auto p-5 space-y-5 text-xs">
                  <div className="p-3.5 bg-[#F7F8FA] border border-slate-200 rounded-xl space-y-2.5">
                    <label className="inline-flex items-center gap-2 font-semibold text-[#1E3A5F] cursor-pointer">
                      <input
                        type="checkbox"
                        checked={grantDraft.includeCourseNotes}
                        onChange={(e) =>
                          setGrantDraft((p) => ({
                            ...p,
                            includeCourseNotes: e.target.checked,
                          }))
                        }
                      />
                      <span>
                        منح جميع التلخيصات والملاحظات المرتبطة بالكورسات المختارة تلقائيًا
                      </span>
                    </label>
                    <input
                      type="text"
                      value={grantDraft.notesForUser}
                      onChange={(e) =>
                        setGrantDraft((p) => ({ ...p, notesForUser: e.target.value }))
                      }
                      placeholder="رسالة ترحيب أو ملاحظة قصيرة لهذا الحساب (اختياري)..."
                      className="w-full px-3 py-2 bg-white border border-slate-300 rounded-lg"
                    />
                  </div>

                  <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                    {/* Courses */}
                    <div className="p-3.5 rounded-xl border border-slate-200 space-y-2 max-h-64 overflow-y-auto">
                      <p className="font-bold text-slate-900">
                        الكورسات ({grantDraft.courseDocIds.length} محدد)
                      </p>
                      {props.courses.map((c) => {
                        const docId = c.docId || `course-${c.id}`;
                        const checked = grantDraft.courseDocIds.includes(docId);
                        return (
                          <label
                            key={docId}
                            className="flex items-center justify-between gap-2 p-2 bg-[#F7F8FA] rounded-lg cursor-pointer"
                          >
                            <span className="truncate">{c.title}</span>
                            <input
                              type="checkbox"
                              checked={checked}
                              onChange={(e) =>
                                setGrantDraft((p) => ({
                                  ...p,
                                  courseDocIds: e.target.checked
                                    ? Array.from(new Set([...p.courseDocIds, docId]))
                                    : p.courseDocIds.filter((id) => id !== docId),
                                }))
                              }
                            />
                          </label>
                        );
                      })}
                    </div>

                    {/* BookNotes / Summaries */}
                    <div className="p-3.5 rounded-xl border border-slate-200 space-y-2 max-h-64 overflow-y-auto">
                      <div className="flex items-center justify-between gap-2">
                        <p className="font-bold text-slate-900">
                          التلخيصات والملاحظات ({grantDraft.noteIds.length} محدد)
                        </p>
                        <input
                          type="text"
                          value={grantNoteSearch}
                          onChange={(e) => setGrantNoteSearch(e.target.value)}
                          placeholder="بحث..."
                          className="w-32 px-2 py-1 text-[11px] bg-[#F7F8FA] border border-slate-300 rounded"
                        />
                      </div>
                      {(props.bookNotes || [])
                        .filter((bn) => {
                          const q = grantNoteSearch.trim().toLowerCase();
                          if (!q) return true;
                          return (
                            bn.bookTitle.toLowerCase().includes(q) ||
                            (bn.courseTitle || '').toLowerCase().includes(q)
                          );
                        })
                        .map((bn) => {
                          const checked = grantDraft.noteIds.includes(bn.id);
                          return (
                            <label
                              key={bn.id}
                              className="flex items-center justify-between gap-2 p-2 bg-[#F7F8FA] rounded-lg cursor-pointer"
                            >
                              <span className="truncate">
                                {bn.bookTitle}
                                {bn.courseTitle ? ` — ${bn.courseTitle}` : ''}
                              </span>
                              <input
                                type="checkbox"
                                checked={checked}
                                onChange={(e) =>
                                  setGrantDraft((p) => ({
                                    ...p,
                                    noteIds: e.target.checked
                                      ? Array.from(new Set([...p.noteIds, bn.id]))
                                      : p.noteIds.filter((id) => id !== bn.id),
                                  }))
                                }
                              />
                            </label>
                          );
                        })}
                    </div>

                    {/* Learning Paths */}
                    <div className="p-3.5 rounded-xl border border-slate-200 space-y-2 max-h-56 overflow-y-auto">
                      <p className="font-bold text-slate-900">
                        مسارات التعلّم ({grantDraft.pathIds.length} محدد)
                      </p>
                      {props.learningPaths.map((lp) => {
                        const checked = grantDraft.pathIds.includes(lp.id);
                        return (
                          <label
                            key={lp.id}
                            className="flex items-center justify-between gap-2 p-2 bg-[#F7F8FA] rounded-lg cursor-pointer"
                          >
                            <span className="truncate">{lp.title}</span>
                            <input
                              type="checkbox"
                              checked={checked}
                              onChange={(e) =>
                                setGrantDraft((p) => ({
                                  ...p,
                                  pathIds: e.target.checked
                                    ? Array.from(new Set([...p.pathIds, lp.id]))
                                    : p.pathIds.filter((id) => id !== lp.id),
                                }))
                              }
                            />
                          </label>
                        );
                      })}
                    </div>

                    {/* Reading Library Books */}
                    <div className="p-3.5 rounded-xl border border-slate-200 space-y-2 max-h-56 overflow-y-auto">
                      <p className="font-bold text-slate-900">
                        الكتب ومصادر المكتبة ({grantDraft.bookIds.length} محدد)
                      </p>
                      {props.readingItems.map((b) => {
                        const checked = grantDraft.bookIds.includes(b.id);
                        return (
                          <label
                            key={b.id}
                            className="flex items-center justify-between gap-2 p-2 bg-[#F7F8FA] rounded-lg cursor-pointer"
                          >
                            <span className="truncate">{b.title}</span>
                            <input
                              type="checkbox"
                              checked={checked}
                              onChange={(e) =>
                                setGrantDraft((p) => ({
                                  ...p,
                                  bookIds: e.target.checked
                                    ? Array.from(new Set([...p.bookIds, b.id]))
                                    : p.bookIds.filter((id) => id !== b.id),
                                }))
                              }
                            />
                          </label>
                        );
                      })}
                    </div>
                  </div>

                  {/* Reflections & Reflection Categories */}
                  <div className="p-3.5 rounded-xl border border-slate-200 space-y-3">
                    <p className="font-bold text-slate-900">
                      منح خواطر وتصنيفات خواطر ({grantDraft.reflectionIds.length} خاطرة ·{' '}
                      {grantDraft.reflectionCategories.length} تصنيف)
                    </p>
                    {allReflectionCats.length > 0 && (
                      <div className="flex flex-wrap gap-2">
                        {allReflectionCats.map((cat) => {
                          const checked = grantDraft.reflectionCategories.includes(cat);
                          return (
                            <label
                              key={cat}
                              className="inline-flex items-center gap-1.5 px-2.5 py-1 bg-[#F7F8FA] border border-slate-200 rounded-lg cursor-pointer"
                            >
                              <input
                                type="checkbox"
                                checked={checked}
                                onChange={(e) =>
                                  setGrantDraft((p) => ({
                                    ...p,
                                    reflectionCategories: e.target.checked
                                      ? Array.from(
                                          new Set([...p.reflectionCategories, cat])
                                        )
                                      : p.reflectionCategories.filter((c) => c !== cat),
                                  }))
                                }
                              />
                              <span>تصنيف: {cat}</span>
                            </label>
                          );
                        })}
                      </div>
                    )}
                    {(props.reflections?.length ?? 0) > 0 && (
                      <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-2 max-h-40 overflow-y-auto">
                        {(props.reflections || []).map((r) => {
                          const checked = grantDraft.reflectionIds.includes(r.id);
                          return (
                            <label
                              key={r.id}
                              className="flex items-center justify-between gap-2 p-2 bg-[#F7F8FA] rounded-lg cursor-pointer"
                            >
                              <span className="truncate">{r.title || r.moodTag}</span>
                              <input
                                type="checkbox"
                                checked={checked}
                                onChange={(e) =>
                                  setGrantDraft((p) => ({
                                    ...p,
                                    reflectionIds: e.target.checked
                                      ? Array.from(new Set([...p.reflectionIds, r.id]))
                                      : p.reflectionIds.filter((id) => id !== r.id),
                                  }))
                                }
                              />
                            </label>
                          );
                        })}
                      </div>
                    )}
                  </div>
                </div>

                <div className="px-5 py-3.5 bg-slate-50 border-t border-slate-200 flex flex-wrap items-center justify-between gap-2">
                  {grantsByUid[grantModalUser.uid] ? (
                    <button
                      type="button"
                      disabled={savingGrant}
                      onClick={() => void handleRevokeUserGrant()}
                      className="px-3.5 py-2 text-xs font-semibold text-red-700 bg-red-50 hover:bg-red-100 rounded-lg cursor-pointer"
                    >
                      إلغاء كل الصلاحيات المخصّصة
                    </button>
                  ) : (
                    <span />
                  )}
                  <div className="flex items-center gap-2">
                    <button
                      type="button"
                      onClick={() => setGrantModalUser(null)}
                      className="px-4 py-2 text-xs font-medium text-slate-600 bg-white border border-slate-200 rounded-lg cursor-pointer"
                    >
                      إلغاء
                    </button>
                    <button
                      type="button"
                      disabled={savingGrant}
                      onClick={() => void handleSaveUserGrant()}
                      className="inline-flex items-center gap-1.5 px-4 py-2 text-xs font-semibold text-white bg-[#1E3A5F] hover:bg-[#162C49] rounded-lg cursor-pointer"
                    >
                      {savingGrant && <Loader2 className="w-3.5 h-3.5 animate-spin" />}
                      <span>حفظ الصلاحيات</span>
                    </button>
                  </div>
                </div>
              </div>
            </div>
          )}
        </section>
      )}

      {/* Sub-tab 6: Data, Excel Export, Sync & Technical Diagnostics */}
      {subTab === 'data' && (
        <div className="space-y-5">
          {isPending007Migration() && (
            <div className="p-4 rounded-xl bg-amber-50 border border-amber-200 text-xs text-amber-900 leading-relaxed">
              توجد حقول حديثة (مثل أهداف التعلّم والترتيب المخصّص وربط المهام والواجهة العامة) بانتظار تشغيل الترحيل{' '}
              <code className="font-mono font-bold">007_rbac_public_site_objectives_rhythm_sorting.sql</code>{' '}
              في محرر SQL بلوحة Supabase لتُحفظ سحابيًا بالكامل.
            </div>
          )}

          <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
            <div className="bg-white border border-slate-200 rounded-2xl p-5 space-y-3">
              <div className="flex items-center gap-2">
                <Download className="w-4 h-4 text-[#1E3A5F]" aria-hidden="true" />
                <h2 className="text-base font-bold text-slate-900">
                  تصدير البيانات إلى Excel
                </h2>
              </div>
              <p className="text-xs text-slate-600 leading-relaxed">
                تنزيل نسخة منظمة من الخطة السنوية والكورسات والملخصات بصيغة Excel للمراجعة والأرشفة.
              </p>
              <button
                type="button"
                onClick={() =>
                  exportPlanToExcel(
                    props.months,
                    props.courses,
                    props.bookNotesForExcel,
                    props.domains
                  )
                }
                className="inline-flex items-center gap-1.5 px-4 py-2 text-xs font-semibold text-white bg-[#1E3A5F] hover:bg-[#162C49] rounded-lg cursor-pointer"
              >
                <Download className="w-3.5 h-3.5" aria-hidden="true" />
                <span>تصدير Excel الكامل</span>
              </button>
            </div>

            <div className="bg-white border border-slate-200 rounded-2xl p-5 space-y-3">
              <div className="flex items-center gap-2">
                <RefreshCw className="w-4 h-4 text-[#1E3A5F]" aria-hidden="true" />
                <h2 className="text-base font-bold text-slate-900">
                  مزامنة السحابة وإعادة التهيئة
                </h2>
              </div>
              <p className="text-xs text-slate-600 leading-relaxed">
                حدّث البيانات فورًا من السحابة أو أعد ضبط الخطة الافتراضية عند الحاجة.
              </p>
              <div className="flex flex-wrap gap-2">
                <button
                  type="button"
                  disabled={syncingManual}
                  onClick={async () => {
                    setSyncingManual(true);
                    try {
                      await props.onForceSync();
                    } finally {
                      setSyncingManual(false);
                    }
                  }}
                  className="inline-flex items-center gap-1.5 px-4 py-2 text-xs font-semibold text-white bg-emerald-700 hover:bg-emerald-800 rounded-lg cursor-pointer"
                >
                  <RefreshCw
                    className={`w-3.5 h-3.5 ${syncingManual ? 'animate-spin' : ''}`}
                  />
                  <span>مزامنة فورية الآن</span>
                </button>

                <button
                  type="button"
                  onClick={() => setConfirmResetOpen(true)}
                  className="inline-flex items-center gap-1.5 px-4 py-2 text-xs font-semibold text-red-700 bg-red-50 hover:bg-red-100 rounded-lg cursor-pointer"
                >
                  <RotateCcw className="w-3.5 h-3.5" />
                  <span>إعادة ضبط الخطة الافتراضية</span>
                </button>
              </div>
            </div>
          </div>

          {/* Admin Collapsible Technical Diagnostics */}
          <div className="bg-white border border-slate-200 rounded-2xl p-5 space-y-3">
            <div className="flex flex-wrap items-center justify-between gap-2">
              <div className="flex items-center gap-2">
                <Shield className="w-4 h-4 text-[#1E3A5F]" aria-hidden="true" />
                <h2 className="text-sm font-bold text-slate-900">
                  تشخيص الاتصال بالخادم (للمسؤول فقط)
                </h2>
              </div>
              <button
                type="button"
                onClick={() => {
                  const next = !diagOpen;
                  setDiagOpen(next);
                  if (next && !diagResult) void handleRunDiagnostics();
                }}
                className="px-3 py-1.5 text-xs font-semibold text-[#1E3A5F] bg-[#F7F8FA] border border-slate-200 rounded-lg cursor-pointer"
              >
                {diagOpen ? 'إخفاء التشخيص' : 'فحص حالة الربط'}
              </button>
            </div>

            {diagOpen && (
              <div className="space-y-3 pt-2 border-t border-slate-100">
                <div className="flex items-center justify-between">
                  <span className="text-xs text-slate-500">
                    يتحقق من توثيق Firebase وحماية RLS وصلاحيات الحاويات دون عرض أسرار.
                  </span>
                  <button
                    type="button"
                    disabled={diagRunning}
                    onClick={() => void handleRunDiagnostics()}
                    className="inline-flex items-center gap-1 px-3 py-1.5 text-xs font-semibold bg-slate-100 rounded-lg cursor-pointer"
                  >
                    <RefreshCw
                      className={`w-3 h-3 ${diagRunning ? 'animate-spin' : ''}`}
                    />
                    <span>إعادة الفحص</span>
                  </button>
                </div>

                {diagResult && (
                  <div className="space-y-2">
                    {diagResult.checks.map((chk) => (
                      <div
                        key={chk.id}
                        className="p-2.5 rounded-lg bg-[#F7F8FA] border border-slate-200 flex items-start justify-between gap-2 text-xs"
                      >
                        <div>
                          <p className="font-semibold text-slate-900">{chk.label}</p>
                          <p className="text-[11px] text-slate-600">{chk.detail}</p>
                        </div>
                        <span
                          className={`font-semibold shrink-0 ${
                            chk.ok ? 'text-emerald-700' : 'text-amber-700'
                          }`}
                        >
                          {chk.ok ? 'سليم' : 'تنبيه'}
                        </span>
                      </div>
                    ))}
                  </div>
                )}
              </div>
            )}
          </div>

          <div className="p-4 rounded-xl bg-[#F7F8FA] border border-slate-200 flex flex-wrap items-center gap-4 text-xs text-slate-600">
            <span className="inline-flex items-center gap-1.5">
              <CheckCircle2 className="w-4 h-4 text-emerald-700" />
              <span>عدد الملخصات المحفوظة: {props.bookNotesCount}</span>
            </span>
            <span className="inline-flex items-center gap-1.5">
              <BookOpen className="w-4 h-4 text-[#1E3A5F]" />
              <span>عدد الكتب في المكتبة: {props.readingItems.length}</span>
            </span>
            <span className="inline-flex items-center gap-1.5">
              <Users className="w-4 h-4 text-[#1E3A5F]" />
              <span>عدد المحاور: {getHubMeta('knowledge').title} وأخواتها</span>
            </span>
          </div>
        </div>
      )}

      <ConfirmDialog
        open={confirmResetOpen}
        title="إعادة ضبط الخطة الافتراضية"
        message="هل أنت متأكد من إعادة ضبط وحدات الخطة الافتراضية؟ يفضّل تصدير نسخة Excel أولاً."
        confirmLabel="إعادة الضبط"
        onConfirm={() => {
          props.onResetWorkspace();
          setConfirmResetOpen(false);
        }}
        onCancel={() => setConfirmResetOpen(false)}
      />
    </div>
  );
}
