import { useEffect, useState } from 'react';
import {
  Activity,
  ArrowDown,
  ArrowUp,
  ArrowUpLeft,
  BookOpen,
  BookOpenText,
  CalendarDays,
  Check,
  CheckCircle2,
  Database,
  Download,
  Edit3,
  Eye,
  FolderCog,
  Globe,
  KeyRound,
  LayoutGrid,
  Loader2,
  Mail,
  MessageSquarePlus,
  Palette,
  PenLine,
  Pin,
  PinOff,
  Plus,
  Quote,
  RefreshCw,
  RotateCcw,
  Save,
  Shield,
  Sparkles,
  Trash2,
  Users,
  X,
} from 'lucide-react';
import {
  BlogPost,
  BookNote,
  ContactMessageRecord,
  ContentAccessGrant,
  CustomCategory,
  DEFAULT_HUB_CATEGORIES,
  DEFAULT_NAV_TAB_ORDER,
  DEFAULT_PINNED_NAV_TABS,
  DEFAULT_REFLECTION_CATEGORIES,
  DomainId,
  DomainInfo,
  GrantAccessMode,
  GrantedItemNote,
  HUB_ACCENT_PRESETS,
  LearningHubMeta,
  LearningPath,
  MonthActivities,
  MonthPlan,
  MonthStatus,
  NAV_PINNABLE_TABS_META,
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
  UserPreferences,
  UserProfileItem,
  UserQuoteItem,
  VoiceDialectMode,
  WeeklyMeeting,
  getTodayDateKey,
  resolveLearningHubs,
  setActiveLearningHubs,
} from '../data/curriculumData';
import { OWNER_ADMIN_EMAIL } from '../firebase';
import {
  SupabaseConnectionTestResult,
  testSupabaseConnection,
} from '../services/supabaseClient';
import {
  addGrantedItemNote,
  deleteContactMessage,
  deleteContentAccessGrant,
  deleteGrantedItemNote,
  fetchAllContentGrants,
  fetchAllUserProfiles,
  fetchContactMessages,
  fetchGrantedItemNotesForOwner,
  isPending007Migration,
  isPending011Migration,
  isPending012Migration,
  isPending013Migration,
  isPending014Migration,
  isPending015Migration,
  updateContactMessageStatus,
  updateUserProfileAccess,
  upsertContentAccessGrant,
} from '../services/supabaseSync';
import {
  isPending016Migration,
} from '../services/quickDropSync';
import { exportPlanToExcel } from '../utils/excelExport';
import AutoResizeTextarea from './AutoResizeTextarea';
import ConfirmDialog from './ConfirmDialog';
import DomainsView from './DomainsView';
import { ActiveTab } from './Header';
import type { ActivePdfTarget } from './PDFViewerModal';
import QuickDropSection from './QuickDropSection';
import TwelveMonthPlanView from './TwelveMonthPlanView';
import ThemeSettingsPanel from './ThemeSettingsPanel';
import WeeklyMeetingsPanel from './WeeklyMeetingsPanel';

type AccountSubTab =
  | 'workspace'
  | 'appearance'
  | 'public_site'
  | 'plan'
  | 'meetings'
  | 'categories'
  | 'users'
  | 'data';

interface AccountCenterViewProps {
  uid?: string;
  isAdmin: boolean;
  userDisplayName?: string;
  userEmail?: string;
  userPhotoUrl?: string | null;
  canEdit: boolean;
  onRequireAuth: () => void;
  voiceDialect: VoiceDialectMode;
  preferences: UserPreferences;
  onUpdatePreferences: (updates: Partial<UserPreferences>) => void;
  onNavigateTab: (tab: ActiveTab) => void;
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
  blogPosts?: BlogPost[];
  onToggleBlogPublic?: (id: string, isPublic: boolean) => void;
  customReadingModes?: ReadingModeMeta[];
  onUpdateReadingModes?: (nextModes: ReadingModeMeta[]) => void;
  initialSubTab?: AccountSubTab;
  onConsumeInitialSubTab?: () => void;
}

export default function AccountCenterView(props: AccountCenterViewProps) {
  const [subTab, setSubTab] = useState<AccountSubTab>(props.initialSubTab || 'workspace');
  const [planSubMode, setPlanSubMode] = useState<'domains' | 'months'>('domains');

  useEffect(() => {
    if (props.initialSubTab) {
      setSubTab(props.initialSubTab);
      props.onConsumeInitialSubTab?.();
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [props.initialSubTab]);

  // Hub Editor state
  const hubs = resolveLearningHubs(props.preferences.customHubs);
  const [editingHubId, setEditingHubId] = useState<string | null>(null);
  const [creatingHub, setCreatingHub] = useState(false);
  const [hubTitle, setHubTitle] = useState('');
  const [hubShort, setHubShort] = useState('');
  const [hubPurpose, setHubPurpose] = useState('');
  const [hubPresetId, setHubPresetId] = useState('indigo');
  const [hubCatsText, setHubCatsText] = useState('');

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
  const [diagResult, setDiagResult] =
    useState<SupabaseConnectionTestResult | null>(null);

  // Public site editor state
  const [siteDraft, setSiteDraft] = useState<PublicSiteConfig>(
    props.publicSiteConfig
  );
  const [newSkill, setNewSkill] = useState('');
  const [editingSkillIdx, setEditingSkillIdx] = useState<number | null>(null);
  const [editingSkillVal, setEditingSkillVal] = useState('');
  const [newInterest, setNewInterest] = useState('');
  const [editingInterestIdx, setEditingInterestIdx] = useState<number | null>(
    null
  );
  const [editingInterestVal, setEditingInterestVal] = useState('');
  const [savingSite, setSavingSite] = useState(false);
  const [siteSavedNotice, setSiteSavedNotice] = useState<string | null>(null);
  const [pubQuoteText, setPubQuoteText] = useState('');
  const [pubQuoteAuthor, setPubQuoteAuthor] = useState('');
  const [pubQuoteTheme, setPubQuoteTheme] = useState('');

  // Users RBAC & Content Grants state
  const [profiles, setProfiles] = useState<UserProfileItem[]>([]);
  const [grantsByUid, setGrantsByUid] = useState<
    Record<string, ContentAccessGrant>
  >({});
  const [grantedItemNotes, setGrantedItemNotes] = useState<GrantedItemNote[]>([]);
  const [loadingProfiles, setLoadingProfiles] = useState(false);
  const [profilesError, setProfilesError] = useState<string | null>(null);
  const [grantModalUser, setGrantModalUser] =
    useState<UserProfileItem | null>(null);
  const [grantDraft, setGrantDraft] = useState<{
    courseDocIds: string[];
    includeCourseNotes: boolean;
    noteIds: string[];
    pathIds: string[];
    bookIds: string[];
    reflectionIds: string[];
    reflectionCategories: string[];
    blogIds: string[];
    accessMode: GrantAccessMode;
    customAdditionTitle: string;
    customAdditionBody: string;
    notesForUser: string;
  }>({
    courseDocIds: [],
    includeCourseNotes: true,
    noteIds: [],
    pathIds: [],
    bookIds: [],
    reflectionIds: [],
    reflectionCategories: [],
    blogIds: [],
    accessMode: 'read_only',
    customAdditionTitle: '',
    customAdditionBody: '',
    notesForUser: '',
  });
  const [grantNoteSearch, setGrantNoteSearch] = useState('');
  const [savingGrant, setSavingGrant] = useState(false);
  const [replyDraftByNoteKey, setReplyDraftByNoteKey] = useState<Record<string, string>>({});
  const [activeReplyNoteId, setActiveReplyNoteId] = useState<string | null>(null);
  const [savingReply, setSavingReply] = useState(false);

  // Contact Messages Inbox state
  const [contactMessages, setContactMessages] = useState<ContactMessageRecord[]>([]);
  const [loadingMessages, setLoadingMessages] = useState(false);

  const pinnedSet = new Set(
    props.preferences.pinnedNavTabs && props.preferences.pinnedNavTabs.length > 0
      ? props.preferences.pinnedNavTabs
      : DEFAULT_PINNED_NAV_TABS
  );

  const handleTogglePinTab = (tabId: string) => {
    if (!props.canEdit) return props.onRequireAuth();
    const current = Array.from(pinnedSet);
    const next = pinnedSet.has(tabId)
      ? current.filter((id) => id !== tabId)
      : [...current, tabId];
    // Guarantee at least 1 tab stays pinned besides overview/account
    if (next.length === 0) return;
    props.onUpdatePreferences({ pinnedNavTabs: next });
  };

  const orderedNavTabs = (() => {
    const orderSource =
      props.preferences.navTabOrder && props.preferences.navTabOrder.length > 0
        ? props.preferences.navTabOrder
        : DEFAULT_NAV_TAB_ORDER;
    const rank = new Map<string, number>();
    orderSource.forEach((id, idx) => rank.set(id, idx));
    return [...NAV_PINNABLE_TABS_META].sort((a, b) => {
      const ra = rank.has(a.id) ? (rank.get(a.id) as number) : 999;
      const rb = rank.has(b.id) ? (rank.get(b.id) as number) : 999;
      return ra - rb;
    });
  })();

  const handleMoveNavTab = (tabId: string, dir: 'up' | 'down') => {
    if (!props.canEdit) return props.onRequireAuth();
    const ids: string[] = orderedNavTabs.map((t) => t.id);
    const idx = ids.indexOf(tabId);
    if (idx === -1) return;
    const targetIdx = dir === 'up' ? idx - 1 : idx + 1;
    if (targetIdx < 0 || targetIdx >= ids.length) return;
    const next = [...ids];
    const [moved] = next.splice(idx, 1);
    next.splice(targetIdx, 0, moved);
    props.onUpdatePreferences({ navTabOrder: next });
  };

  const handleResetNavOrder = () => {
    if (!props.canEdit) return props.onRequireAuth();
    props.onUpdatePreferences({
      navTabOrder: DEFAULT_NAV_TAB_ORDER,
      pinnedNavTabs: DEFAULT_PINNED_NAV_TABS,
    });
  };

  const openHubForm = (hub?: LearningHubMeta) => {
    if (!props.canEdit) return props.onRequireAuth();
    if (hub) {
      setCreatingHub(false);
      setEditingHubId(hub.id);
      setHubTitle(hub.title);
      setHubShort(hub.shortTitle);
      setHubPurpose(hub.purpose);
      const match =
        HUB_ACCENT_PRESETS.find((p) => p.accentHex === hub.accentHex) ??
        HUB_ACCENT_PRESETS[2];
      setHubPresetId(match.id);
      const cats =
        props.preferences.hubCategories?.[hub.id] &&
        props.preferences.hubCategories[hub.id].length > 0
          ? props.preferences.hubCategories[hub.id]
          : hub.defaultCategories;
      setHubCatsText(cats.join('\n'));
    } else {
      setCreatingHub(true);
      setEditingHubId(`hub_${Date.now()}`);
      setHubTitle('');
      setHubShort('');
      setHubPurpose('');
      setHubPresetId('indigo');
      setHubCatsText('عام\nأساسي\nمتقدم');
    }
  };

  const handleSaveHub = (e: React.FormEvent) => {
    e.preventDefault();
    if (!props.canEdit || !editingHubId) return;
    const cleanTitle = hubTitle.trim();
    if (!cleanTitle) return;
    const cleanShort = hubShort.trim() || cleanTitle;
    const preset =
      HUB_ACCENT_PRESETS.find((p) => p.id === hubPresetId) ??
      HUB_ACCENT_PRESETS[2];
    const cats = Array.from(
      new Set(
        hubCatsText
          .split(/[\n،,]/)
          .map((s) => s.trim())
          .filter(Boolean)
      )
    );
    const finalCats = cats.length > 0 ? cats : ['عام', 'أساسي', 'متقدم'];

    const hubItem: LearningHubMeta = {
      id: editingHubId,
      title: cleanTitle,
      shortTitle: cleanShort,
      englishTitle: cleanShort,
      purpose: hubPurpose.trim(),
      accentHex: preset.accentHex,
      badgeClass: preset.badgeClass,
      defaultCategories: finalCats,
    };

    const nextHubs = creatingHub
      ? [...hubs, hubItem]
      : hubs.map((h) => (h.id === editingHubId ? { ...h, ...hubItem } : h));
    const nextHubCats = {
      ...(props.preferences.hubCategories ?? DEFAULT_HUB_CATEGORIES),
      [editingHubId]: finalCats,
    };

    setActiveLearningHubs(nextHubs);
    props.onUpdatePreferences({
      customHubs: nextHubs,
      hubCategories: nextHubCats,
    });
    setEditingHubId(null);
    setCreatingHub(false);
  };

  const handleDeleteCustomHub = (hubId: string) => {
    if (!props.canEdit || hubs.length <= 1) return;
    const nextHubs = hubs.filter((h) => h.id !== hubId);
    setActiveLearningHubs(nextHubs);
    props.onUpdatePreferences({ customHubs: nextHubs });
    if (editingHubId === hubId) {
      setEditingHubId(null);
      setCreatingHub(false);
    }
  };

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
    setLoadingMessages(true);
    setProfilesError(null);
    try {
      const [list, grantsList, itemNotesList, messagesList] = await Promise.all([
        fetchAllUserProfiles(),
        props.uid ? fetchAllContentGrants(props.uid) : Promise.resolve([]),
        props.uid ? fetchGrantedItemNotesForOwner(props.uid) : Promise.resolve([]),
        fetchContactMessages(),
      ]);
      setProfiles(list);
      const map: Record<string, ContentAccessGrant> = {};
      for (const g of grantsList) {
        map[g.granteeUid] = g;
      }
      setGrantsByUid(map);
      setGrantedItemNotes(itemNotesList);
      setContactMessages(messagesList);
    } catch (err) {
      setProfilesError(
        err instanceof Error ? err.message : 'تعذر تحميل قائمة المستخدمين.'
      );
    } finally {
      setLoadingProfiles(false);
      setLoadingMessages(false);
    }
  };

  useEffect(() => {
    if (props.isAdmin && subTab === 'users') {
      void loadProfiles();
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [props.isAdmin, subTab]);

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
      blogIds: existing?.blogIds ?? [],
      accessMode:
        existing?.accessMode === 'can_annotate' || existing?.allowUserNotes
          ? 'can_annotate'
          : 'read_only',
      customAdditionTitle: existing?.customAdditionTitle ?? '',
      customAdditionBody: existing?.customAdditionBody ?? '',
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
        allowUserNotes: grantDraft.accessMode === 'can_annotate',
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

  const handleAdminReplyToItemNote = async (sourceNote: GrantedItemNote) => {
    if (!props.uid) return;
    const text = (replyDraftByNoteKey[sourceNote.id] || '').trim();
    if (!text) return;
    setSavingReply(true);
    setProfilesError(null);
    try {
      const saved = await addGrantedItemNote({
        ownerId: props.uid,
        authorUid: props.uid,
        authorEmail: OWNER_ADMIN_EMAIL,
        authorName: 'الإدارة',
        targetType: sourceNote.targetType,
        targetId: sourceNote.targetId,
        content: text,
        isAdminReply: true,
        createdAtLabel: new Date().toLocaleDateString('ar-EG', {
          month: 'short',
          day: 'numeric',
        }),
        createdAtMs: Date.now(),
      });
      setGrantedItemNotes((prev) => [saved, ...prev]);
      setReplyDraftByNoteKey((prev) => ({ ...prev, [sourceNote.id]: '' }));
      setActiveReplyNoteId(null);
    } catch (err) {
      setProfilesError(
        err instanceof Error ? err.message : 'تعذر حفظ رد الإدارة.'
      );
    } finally {
      setSavingReply(false);
    }
  };

  const handleDeleteGrantedNote = async (noteId: string) => {
    setProfilesError(null);
    try {
      await deleteGrantedItemNote(noteId);
      setGrantedItemNotes((prev) => prev.filter((n) => n.id !== noteId));
    } catch (err) {
      setProfilesError(
        err instanceof Error ? err.message : 'تعذر حذف الملاحظة.'
      );
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
      setSiteSavedNotice('تم حفظ إعدادات الموقع العام وصفحاته بنجاح.');
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
      (m) =>
        m.foundational.domainId === domain.id ||
        m.exploratory.domainId === domain.id
    );
    const completedMonths = matchingMonths.filter(
      (m) => m.status === 'completed'
    ).length;
    return {
      domain,
      total: matchingMonths.length,
      completed: completedMonths,
    };
  });

  const navRailItems: Array<{
    id: AccountSubTab;
    label: string;
    subtitle: string;
    icon: typeof LayoutGrid;
  }> = [
    {
      id: 'workspace',
      label: 'الأقسام والشريط العلوي',
      subtitle: 'تثبيت التبويبات وتعديل المجالات',
      icon: LayoutGrid,
    },
    {
      id: 'appearance',
      label: 'المظهر والثيمات',
      subtitle: 'الأوضاع والألوان والتباين',
      icon: Palette,
    },
    {
      id: 'public_site',
      label: 'الموقع العام والنشر',
      subtitle: 'الرئيسية والخواطر والمدونة',
      icon: Globe,
    },
    {
      id: 'plan',
      label: 'المجالات وخطة السنة',
      subtitle: 'المحاور المعرفية و12 شهرًا',
      icon: CalendarDays,
    },
    {
      id: 'meetings',
      label: 'اللقاءات والتراكمي',
      subtitle: 'متابعة أسبوعية وإحصائيات',
      icon: Activity,
    },
    {
      id: 'categories',
      label: 'التصنيفات والنشاط',
      subtitle: 'تصنيفات مخصّصة وسجل العمل',
      icon: FolderCog,
    },
    {
      id: 'users',
      label: 'المستخدمون والصلاحيات',
      subtitle: 'إدارة الحسابات والمحتوى المخصّص',
      icon: Users,
    },
    {
      id: 'data',
      label: 'البيانات والنسخ',
      subtitle: 'Excel والمزامنة والتشخيص',
      icon: Database,
    },
  ];

  // Strict RBAC separation: Non-admin authenticated users see ONLY their personal summary,
  // Public Website link, and Theme Settings Studio—never any admin navigation, analytics, or controls.
  if (!props.isAdmin) {
    const accountName =
      props.userDisplayName?.trim() || props.userEmail || 'حسابي';
    const accountInitial = accountName.charAt(0).toUpperCase();

    return (
      <div className="space-y-6">
        <div className="bg-white border border-slate-200 rounded-2xl px-5 sm:px-6 py-5 flex flex-wrap items-center justify-between gap-4">
          <div className="flex items-center gap-3.5 min-w-0">
            {props.userPhotoUrl ? (
              <img
                src={props.userPhotoUrl}
                alt=""
                referrerPolicy="no-referrer"
                className="w-12 h-12 rounded-full object-cover border border-slate-200 shrink-0"
              />
            ) : (
              <span className="w-12 h-12 rounded-full bg-[#1E3A5F] text-white text-base font-bold inline-flex items-center justify-center shrink-0">
                {accountInitial}
              </span>
            )}
            <div className="min-w-0 space-y-1">
              <div className="flex flex-wrap items-center gap-2">
                <h1 className="font-editorial text-xl sm:text-2xl font-bold text-slate-900 truncate">
                  {accountName}
                </h1>
                <span className="px-2 py-0.5 text-[11px] font-semibold bg-[#F1F5F9] text-[#1E3A5F] border border-slate-200 rounded-md">
                  حساب عضو مسجّل
                </span>
              </div>
              {props.userEmail && (
                <p className="text-xs text-slate-500 truncate">{props.userEmail}</p>
              )}
            </div>
          </div>

          <button
            type="button"
            onClick={props.onPreviewPublicSite}
            className="inline-flex items-center gap-1.5 px-4 py-2 min-h-[38px] text-xs font-semibold text-[#1E3A5F] bg-[#F7F8FA] border border-slate-200 hover:bg-slate-100 rounded-xl cursor-pointer whitespace-nowrap shrink-0"
          >
            <Eye className="w-4 h-4" aria-hidden="true" />
            <span>عرض الموقع العام</span>
          </button>
        </div>

        <ThemeSettingsPanel
          canEdit={Boolean(props.uid)}
          onRequireAuth={props.onRequireAuth}
        />

        <QuickDropSection
          uid={props.uid}
          canEdit={Boolean(props.uid)}
          onRequireAuth={props.onRequireAuth}
        />
      </div>
    );
  }

  return (
    <div className="space-y-6">
      {/* Calm Header Bar */}
      <div className="bg-white border border-slate-200 rounded-2xl px-6 py-5 flex flex-wrap items-center justify-between gap-4">
        <div className="space-y-1">
          <h1 className="font-editorial text-2xl sm:text-3xl font-bold text-slate-900">
            الإدارة والحساب
          </h1>
          <p className="text-xs sm:text-sm text-slate-500">
            تحكّم هادئ في تثبيت أقسامك بالشريط العلوي، وتعديل مجالات التركيز، وإدارة الموقع العام والصلاحيات.
          </p>
        </div>

        <button
          type="button"
          onClick={props.onPreviewPublicSite}
          className="inline-flex items-center gap-1.5 px-4 py-2 min-h-[38px] text-xs font-semibold text-[#1E3A5F] bg-[#F7F8FA] border border-slate-200 hover:bg-slate-100 rounded-xl cursor-pointer whitespace-nowrap shrink-0"
        >
          <Eye className="w-4 h-4" aria-hidden="true" />
          <span>معاينة الموقع العام</span>
        </button>
      </div>

      {/* Calm Two-Column Settings Layout (Sidebar Rail on Desktop, Clean Strip on Mobile) */}
      <div className="grid grid-cols-1 lg:grid-cols-12 gap-6 items-start">
        <aside className="lg:col-span-3 lg:sticky lg:top-28">
          <nav
            aria-label="أقسام الإدارة"
            className="bg-white border border-slate-200 rounded-2xl p-2 flex lg:flex-col gap-1.5 overflow-x-auto no-scrollbar"
          >
            {navRailItems.map((item) => {
              const Icon = item.icon;
              const active = subTab === item.id;
              return (
                <button
                  key={item.id}
                  type="button"
                  onClick={() => setSubTab(item.id)}
                  className={`flex items-start gap-2.5 px-3 py-2.5 rounded-xl text-right transition-colors whitespace-nowrap lg:whitespace-normal shrink-0 cursor-pointer ${
                    active
                      ? 'bg-[#F1F5F9] text-[#1E3A5F]'
                      : 'text-slate-600 hover:bg-slate-50 hover:text-slate-900'
                  }`}
                >
                  <Icon
                    className={`w-4 h-4 mt-0.5 shrink-0 ${
                      active ? 'text-[#1E3A5F]' : 'text-slate-400'
                    }`}
                    aria-hidden="true"
                  />
                  <div className="min-w-0">
                    <p
                      className={`text-xs sm:text-[13px] leading-snug ${
                        active ? 'font-bold text-[#1E3A5F]' : 'font-semibold'
                      }`}
                    >
                      {item.label}
                    </p>
                    <p className="hidden lg:block text-[11px] text-slate-400 mt-0.5">
                      {item.subtitle}
                    </p>
                  </div>
                </button>
              );
            })}
          </nav>
        </aside>

        <div className="lg:col-span-9 space-y-6">
          {subTab === 'appearance' && (
            <ThemeSettingsPanel
              canEdit={props.canEdit}
              onRequireAuth={props.onRequireAuth}
            />
          )}

          {/* SECTION 1: Workspace Navigation Pins & Learning Hubs Customizer */}
          {subTab === 'workspace' && (
            <div className="space-y-6">
              {/* Navbar Pinning, Ordering & Quick Launcher */}
              <section className="bg-white border border-slate-200 rounded-2xl p-5 sm:p-6 space-y-4">
                <div className="flex flex-wrap items-start justify-between gap-3 pb-3 border-b border-slate-100">
                  <div className="space-y-1">
                    <h2 className="font-editorial text-xl font-bold text-slate-900">
                      تخصيص وترتيب الشريط العلوي ({pinnedSet.size})
                    </h2>
                    <p className="text-xs text-slate-500">
                      اختر الأقسام الظاهرة في الشريط العلوي ورتّب أولويتها (مثلاً تقديم الكورسات أو التلخيص قبل غيرها) مع بقاء جميع الأقسام متاحة للفتح هنا.
                    </p>
                  </div>
                  <button
                    type="button"
                    onClick={handleResetNavOrder}
                    className="inline-flex items-center gap-1.5 px-3 py-1.5 text-[11px] font-semibold text-slate-700 bg-[#F7F8FA] hover:bg-slate-200 border border-slate-200 rounded-lg cursor-pointer shrink-0"
                  >
                    <RotateCcw className="w-3 h-3" aria-hidden="true" />
                    <span>استعادة الترتيب الافتراضي</span>
                  </button>
                </div>

                <div className="grid grid-cols-1 sm:grid-cols-2 xl:grid-cols-3 gap-3">
                  {orderedNavTabs.map((item, idx) => {
                    const isPinned = pinnedSet.has(item.id);
                    return (
                      <div
                        key={item.id}
                        className={`p-4 rounded-xl border transition-colors flex flex-col justify-between gap-3 ${
                          isPinned
                            ? 'bg-[#F8FAFC] border-[#1E3A5F]/25'
                            : 'bg-white border-slate-200'
                        }`}
                      >
                        <div className="space-y-1">
                          <div className="flex items-center justify-between gap-2">
                            <div className="flex items-center gap-1.5 min-w-0">
                              <span className="inline-flex items-center justify-center w-5 h-5 rounded-md bg-slate-200/70 text-[10px] font-bold text-slate-700 tabular-nums shrink-0">
                                {idx + 1}
                              </span>
                              <p className="text-sm font-bold text-slate-900 truncate">
                                {item.label}
                              </p>
                            </div>
                            <span
                              className={`text-[10px] font-semibold shrink-0 ${
                                isPinned ? 'text-[#1E3A5F]' : 'text-slate-400'
                              }`}
                            >
                              {isPinned ? 'ظاهر بالشريط' : 'مخفي بالداخل'}
                            </span>
                          </div>
                          <p className="text-xs text-slate-500 leading-relaxed">
                            {item.description}
                          </p>
                        </div>

                        <div className="flex flex-wrap items-center justify-between gap-2 pt-2 border-t border-slate-100">
                          <div className="flex items-center gap-1">
                            <button
                              type="button"
                              disabled={idx === 0}
                              onClick={() => handleMoveNavTab(item.id, 'up')}
                              title="تقديم التبويب خطوة للأول"
                              aria-label={`تقديم تبويب ${item.label}`}
                              className="p-1.5 rounded-lg border border-slate-200 bg-white text-slate-600 hover:text-[#1E3A5F] hover:bg-slate-50 disabled:opacity-35 cursor-pointer disabled:cursor-not-allowed"
                            >
                              <ArrowUp className="w-3.5 h-3.5" aria-hidden="true" />
                            </button>
                            <button
                              type="button"
                              disabled={idx === orderedNavTabs.length - 1}
                              onClick={() => handleMoveNavTab(item.id, 'down')}
                              title="تأخير التبويب خطوة للخلف"
                              aria-label={`تأخير تبويب ${item.label}`}
                              className="p-1.5 rounded-lg border border-slate-200 bg-white text-slate-600 hover:text-[#1E3A5F] hover:bg-slate-50 disabled:opacity-35 cursor-pointer disabled:cursor-not-allowed"
                            >
                              <ArrowDown className="w-3.5 h-3.5" aria-hidden="true" />
                            </button>
                            <button
                              type="button"
                              onClick={() => props.onNavigateTab(item.id)}
                              className="inline-flex items-center gap-1 px-2 py-1 text-xs font-semibold text-[#1E3A5F] hover:underline cursor-pointer"
                            >
                              <span>فتح</span>
                              <ArrowUpLeft
                                className="w-3.5 h-3.5"
                                aria-hidden="true"
                              />
                            </button>
                          </div>

                          <button
                            type="button"
                            onClick={() => handleTogglePinTab(item.id)}
                            className={`inline-flex items-center gap-1 px-2.5 py-1 text-[11px] font-semibold rounded-lg border cursor-pointer ${
                              isPinned
                                ? 'bg-[#1E3A5F] text-white border-[#1E3A5F]'
                                : 'bg-white text-slate-600 border-slate-200 hover:bg-slate-50'
                            }`}
                          >
                            {isPinned ? (
                              <>
                                <PinOff className="w-3 h-3" aria-hidden="true" />
                                <span>إخفاء من الشريط</span>
                              </>
                            ) : (
                              <>
                                <Pin className="w-3 h-3" aria-hidden="true" />
                                <span>تثبيت بالشريط</span>
                              </>
                            )}
                          </button>
                        </div>
                      </div>
                    );
                  })}
                </div>
              </section>

              {/* Editable Focus Hubs Manager (Edit existing titles / add 4th+ Hub) */}
              <section className="bg-white border border-slate-200 rounded-2xl p-5 sm:p-6 space-y-4">
                <div className="flex flex-wrap items-center justify-between gap-3 pb-3 border-b border-slate-100">
                  <div className="space-y-1">
                    <div className="flex items-center gap-2">
                      <Sparkles
                        className="w-4 h-4 text-[#1E3A5F]"
                        aria-hidden="true"
                      />
                      <h2 className="font-editorial text-xl font-bold text-slate-900">
                        تخصيص مجالات التركيز والمحاور ({hubs.length})
                      </h2>
                    </div>
                    <p className="text-xs text-slate-500">
                      عدّل عنوان أي مجال حالي أو أضف مجالاً رابعًا وخامسًا للتركيز عليه في الكورسات والمسارات والمكتبة.
                    </p>
                  </div>
                  <button
                    type="button"
                    onClick={() => openHubForm()}
                    className="inline-flex items-center gap-1.5 px-3.5 py-2 text-xs font-semibold text-white bg-[#1E3A5F] hover:bg-[#162C49] rounded-xl cursor-pointer whitespace-nowrap"
                  >
                    <Plus className="w-3.5 h-3.5" aria-hidden="true" />
                    <span>إضافة مجال / محور {hubs.length + 1}</span>
                  </button>
                </div>

                <div className="grid grid-cols-1 md:grid-cols-2 gap-3.5">
                  {hubs.map((h) => (
                    <div
                      key={h.id}
                      className="p-4 rounded-xl bg-[#F7F8FA] border border-slate-200 flex flex-col justify-between gap-3"
                    >
                      <div className="space-y-1.5">
                        <div className="flex items-center justify-between gap-2">
                          <span
                            className={`px-2 py-0.5 text-[11px] font-bold rounded-md border ${h.badgeClass}`}
                          >
                            {h.shortTitle}
                          </span>
                          <div className="flex items-center gap-1">
                            <button
                              type="button"
                              onClick={() => openHubForm(h)}
                              className="inline-flex items-center gap-1 px-2.5 py-1 text-[11px] font-semibold text-[#1E3A5F] bg-white border border-slate-200 hover:bg-slate-100 rounded-lg cursor-pointer"
                            >
                              <Edit3 className="w-3 h-3" aria-hidden="true" />
                              <span>تعديل</span>
                            </button>
                            {hubs.length > 1 &&
                              h.id !== 'marketing' &&
                              h.id !== 'dental_career' &&
                              h.id !== 'knowledge' && (
                                <button
                                  type="button"
                                  onClick={() => handleDeleteCustomHub(h.id)}
                                  aria-label={`حذف ${h.title}`}
                                  className="p-1.5 text-slate-400 hover:text-red-700 rounded-lg cursor-pointer"
                                >
                                  <Trash2 className="w-3.5 h-3.5" />
                                </button>
                              )}
                          </div>
                        </div>
                        <p className="text-sm font-bold text-slate-900">
                          {h.title}
                        </p>
                        {h.purpose && (
                          <p className="text-xs text-slate-600 leading-relaxed">
                            {h.purpose}
                          </p>
                        )}
                      </div>
                      <p className="text-[11px] text-slate-400 tabular-nums">
                        {
                          (
                            props.preferences.hubCategories?.[h.id] ??
                            h.defaultCategories
                          ).length
                        }{' '}
                        تصنيف فرعي مرتبط
                      </p>
                    </div>
                  ))}
                </div>

                {editingHubId && (
                  <form
                    onSubmit={handleSaveHub}
                    className="p-5 rounded-2xl bg-[#F8FAFC] border border-[#1E3A5F]/25 space-y-4"
                  >
                    <div className="flex items-center justify-between">
                      <h3 className="text-sm font-bold text-slate-900">
                        {creatingHub
                          ? `إضافة مجال تركيز جديد (${hubs.length + 1})`
                          : `تعديل المجال: ${hubTitle}`}
                      </h3>
                      <button
                        type="button"
                        onClick={() => {
                          setEditingHubId(null);
                          setCreatingHub(false);
                        }}
                        className="p-1 text-slate-500 hover:text-slate-900 cursor-pointer"
                      >
                        <X className="w-4 h-4" />
                      </button>
                    </div>

                    <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
                      <div>
                        <label className="block text-xs font-semibold text-slate-700 mb-1">
                          عنوان المجال *
                        </label>
                        <input
                          type="text"
                          required
                          value={hubTitle}
                          onChange={(e) => setHubTitle(e.target.value)}
                          placeholder="مثلاً: الذكاء الاصطناعي والبرمجة"
                          className="w-full px-3 py-2 text-sm bg-white border border-slate-300 rounded-xl"
                        />
                      </div>
                      <div>
                        <label className="block text-xs font-semibold text-slate-700 mb-1">
                          الاسم المختصر
                        </label>
                        <input
                          type="text"
                          value={hubShort}
                          onChange={(e) => setHubShort(e.target.value)}
                          placeholder="مثلاً: التقنية والبرمجة"
                          className="w-full px-3 py-2 text-sm bg-white border border-slate-300 rounded-xl"
                        />
                      </div>
                    </div>

                    <div>
                      <label className="block text-xs font-semibold text-slate-700 mb-1">
                        وصف المجال وغايته
                      </label>
                      <AutoResizeTextarea
                        minRows={2}
                        value={hubPurpose}
                        onChange={(e) => setHubPurpose(e.target.value)}
                        className="w-full px-3 py-2 text-xs sm:text-sm bg-white border border-slate-300 rounded-xl"
                      />
                    </div>

                    <div>
                      <span className="block text-xs font-semibold text-slate-700 mb-1.5">
                        لون التمييز
                      </span>
                      <div className="flex flex-wrap gap-2">
                        {HUB_ACCENT_PRESETS.map((p) => (
                          <button
                            key={p.id}
                            type="button"
                            onClick={() => setHubPresetId(p.id)}
                            className={`inline-flex items-center gap-1.5 px-3 py-1.5 text-xs rounded-lg border cursor-pointer ${
                              hubPresetId === p.id
                                ? `${p.badgeClass} font-bold ring-2 ring-[#1E3A5F]/20`
                                : 'bg-white border-slate-200 text-slate-700'
                            }`}
                          >
                            <span
                              className="w-2.5 h-2.5 rounded-sm shrink-0"
                              style={{ backgroundColor: p.accentHex }}
                            />
                            <span>{p.label}</span>
                          </button>
                        ))}
                      </div>
                    </div>

                    <div>
                      <label className="block text-xs font-semibold text-slate-700 mb-1">
                        التصنيفات الفرعية (سطر لكل تصنيف)
                      </label>
                      <AutoResizeTextarea
                        minRows={3}
                        value={hubCatsText}
                        onChange={(e) => setHubCatsText(e.target.value)}
                        className="w-full px-3 py-2 text-xs bg-white border border-slate-300 rounded-xl"
                      />
                    </div>

                    <div className="flex justify-end gap-2">
                      <button
                        type="button"
                        onClick={() => {
                          setEditingHubId(null);
                          setCreatingHub(false);
                        }}
                        className="px-4 py-2 text-xs font-medium text-slate-600 bg-white border border-slate-200 rounded-lg cursor-pointer"
                      >
                        إلغاء
                      </button>
                      <button
                        type="submit"
                        className="inline-flex items-center gap-1.5 px-4 py-2 text-xs font-semibold text-white bg-[#1E3A5F] rounded-lg cursor-pointer"
                      >
                        <Check className="w-3.5 h-3.5" aria-hidden="true" />
                        <span>حفظ التغييرات</span>
                      </button>
                    </div>
                  </form>
                )}
              </section>
            </div>
          )}

          {/* SECTION 2: Public Website & Multi-Page Controls */}
          {subTab === 'public_site' && (
            <div className="space-y-6">
              <form
                onSubmit={handleSavePublicConfig}
                className="bg-white border border-slate-200 rounded-2xl p-5 sm:p-6 space-y-5"
              >
                <div className="flex flex-wrap items-center justify-between gap-3">
                  <div>
                    <h2 className="font-editorial text-xl font-bold text-slate-900">
                      إعدادات الموقع العام وصفحاته الثلاث
                    </h2>
                    <p className="text-xs text-slate-500">
                      يتكون الموقع العام للزوار من: الرئيسية، الخواطر والتأملات، والمدونة والمقالات.
                    </p>
                  </div>
                  <button
                    type="submit"
                    disabled={savingSite}
                    className="inline-flex items-center gap-1.5 px-4 py-2 text-xs font-semibold text-white bg-[#1E3A5F] hover:bg-[#162C49] rounded-xl cursor-pointer"
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
                  <div className="p-3 rounded-xl bg-emerald-50 border border-emerald-200 text-xs text-emerald-800">
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
                        setSiteDraft((p) => ({
                          ...p,
                          heroTitle: e.target.value,
                        }))
                      }
                      className="w-full px-3 py-2 text-sm bg-[#F7F8FA] border border-slate-300 rounded-xl"
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
                        setSiteDraft((p) => ({
                          ...p,
                          heroSubtitle: e.target.value,
                        }))
                      }
                      className="w-full px-3 py-2 text-sm bg-[#F7F8FA] border border-slate-300 rounded-xl"
                    />
                  </div>
                </div>

                <div>
                  <label className="block text-xs font-semibold text-slate-700 mb-1">
                    نبذة تعريفية
                  </label>
                  <AutoResizeTextarea
                    minRows={3}
                    value={siteDraft.introBio}
                    onChange={(e) =>
                      setSiteDraft((p) => ({ ...p, introBio: e.target.value }))
                    }
                    className="w-full px-3 py-2.5 text-sm bg-[#F7F8FA] border border-slate-300 rounded-xl"
                  />
                </div>

                {/* Creator Profile, Copyright & Contact Settings */}
                <div className="p-4 rounded-xl bg-[#F7F8FA] border border-slate-200 space-y-3">
                  <div className="flex flex-wrap items-center justify-between gap-2">
                    <p className="text-xs font-bold text-slate-800">
                      ملف صاحب المنصة وحقوق النشر والتواصل (تظهر في التذييل وقسم تواصل معنا)
                    </p>
                    <label className="inline-flex items-center gap-2 text-xs text-slate-700 cursor-pointer">
                      <input
                        type="checkbox"
                        checked={siteDraft.showContactForm !== false}
                        onChange={(e) =>
                          setSiteDraft((p) => ({
                            ...p,
                            showContactForm: e.target.checked,
                          }))
                        }
                      />
                      <span>إظهار نموذج «تواصل معنا»</span>
                    </label>
                  </div>

                  <div className="grid grid-cols-1 sm:grid-cols-3 gap-3">
                    <div>
                      <label className="block text-[11px] font-semibold text-slate-700 mb-1">
                        الاسم المعتمد في حقوق النشر
                      </label>
                      <input
                        type="text"
                        value={siteDraft.creatorName ?? 'Ahmed Ibrahim'}
                        onChange={(e) =>
                          setSiteDraft((p) => ({
                            ...p,
                            creatorName: e.target.value,
                          }))
                        }
                        placeholder="Ahmed Ibrahim"
                        dir="ltr"
                        className="w-full px-3 py-2 text-xs bg-white border border-slate-300 rounded-lg"
                      />
                    </div>
                    <div>
                      <label className="block text-[11px] font-semibold text-slate-700 mb-1">
                        رابط LinkedIn الرسمي (اختياري)
                      </label>
                      <input
                        type="url"
                        value={siteDraft.linkedinUrl ?? ''}
                        onChange={(e) =>
                          setSiteDraft((p) => ({
                            ...p,
                            linkedinUrl: e.target.value,
                          }))
                        }
                        placeholder="https://www.linkedin.com/in/..."
                        dir="ltr"
                        className="w-full px-3 py-2 text-xs bg-white border border-slate-300 rounded-lg"
                      />
                    </div>
                    <div>
                      <label className="block text-[11px] font-semibold text-slate-700 mb-1">
                        البريد الرسمي المعروض للتواصل
                      </label>
                      <input
                        type="email"
                        value={siteDraft.contactEmail ?? 'ahmedibrahim108@outlook.com'}
                        onChange={(e) =>
                          setSiteDraft((p) => ({
                            ...p,
                            contactEmail: e.target.value,
                          }))
                        }
                        placeholder="ahmedibrahim108@outlook.com"
                        dir="ltr"
                        className="w-full px-3 py-2 text-xs bg-white border border-slate-300 rounded-lg"
                      />
                    </div>
                  </div>
                  <p className="text-[11px] text-slate-500">
                    تُرسل رسائل نموذج «تواصل معنا» عبر الخادم مباشرة إلى <span dir="ltr" className="font-semibold text-slate-700">ahmedibrahim108@outlook.com</span> عند ضبط متغير <span dir="ltr" className="font-mono">RESEND_API_KEY</span> في بيئة الخادم.
                  </p>
                </div>

                <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
                  <div>
                    <label className="block text-xs font-semibold text-slate-700 mb-1">
                      الخلفية والخبرة
                    </label>
                    <AutoResizeTextarea
                      minRows={3}
                      value={siteDraft.backgroundText}
                      onChange={(e) =>
                        setSiteDraft((p) => ({
                          ...p,
                          backgroundText: e.target.value,
                        }))
                      }
                      className="w-full px-3 py-2.5 text-sm bg-[#F7F8FA] border border-slate-300 rounded-xl"
                    />
                  </div>
                  <div>
                    <label className="block text-xs font-semibold text-slate-700 mb-1">
                      فلسفة التعلّم
                    </label>
                    <AutoResizeTextarea
                      minRows={3}
                      value={siteDraft.philosophyText}
                      onChange={(e) =>
                        setSiteDraft((p) => ({
                          ...p,
                          philosophyText: e.target.value,
                        }))
                      }
                      className="w-full px-3 py-2.5 text-sm bg-[#F7F8FA] border border-slate-300 rounded-xl"
                    />
                  </div>
                </div>

                {/* Skills & Interests */}
                <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
                  <div className="p-4 rounded-xl bg-[#F7F8FA] border border-slate-200 space-y-2.5">
                    <p className="text-xs font-bold text-slate-800">
                      المهارات الظاهرة
                    </p>
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
                              onChange={(e) =>
                                setEditingSkillVal(e.target.value)
                              }
                              onKeyDown={(e) => {
                                if (e.key === 'Enter') {
                                  e.preventDefault();
                                  const clean = editingSkillVal.trim();
                                  if (clean) {
                                    setSiteDraft((p) => ({
                                      ...p,
                                      skills: p.skills.map((s, i) =>
                                        i === idx ? clean : s
                                      ),
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
                                    skills: p.skills.map((s, i) =>
                                      i === idx ? clean : s
                                    ),
                                  }));
                                }
                                setEditingSkillIdx(null);
                              }}
                              className="text-emerald-700 cursor-pointer"
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
                          setSiteDraft((p) => ({
                            ...p,
                            skills: [...p.skills, clean],
                          }));
                          setNewSkill('');
                        }}
                        className="px-3 py-1.5 text-xs font-semibold text-white bg-[#1E3A5F] rounded-lg cursor-pointer"
                      >
                        إضافة
                      </button>
                    </div>
                  </div>

                  <div className="p-4 rounded-xl bg-[#F7F8FA] border border-slate-200 space-y-2.5">
                    <p className="text-xs font-bold text-slate-800">
                      الاهتمامات الظاهرة
                    </p>
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
                              onChange={(e) =>
                                setEditingInterestVal(e.target.value)
                              }
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
                              className="text-slate-400 hover:text-[#1E3A5F] cursor-pointer"
                            >
                              <PenLine className="w-2.5 h-2.5" />
                            </button>
                            <button
                              type="button"
                              onClick={() =>
                                setSiteDraft((p) => ({
                                  ...p,
                                  interests: p.interests.filter(
                                    (_, i) => i !== idx
                                  ),
                                }))
                              }
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
                          if (!clean || siteDraft.interests.includes(clean))
                            return;
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

                {/* Visibility Toggles including Blogs & Reflections */}
                <div className="p-4 rounded-xl bg-[#F7F8FA] border border-slate-200 space-y-3">
                  <p className="text-xs font-bold text-slate-800">
                    إظهار / إخفاء الأقسام والصفحات في الموقع العام
                  </p>
                  <div className="grid grid-cols-2 sm:grid-cols-3 lg:grid-cols-5 gap-2 text-xs">
                    {(
                      [
                        ['showHero', 'الواجهة التعريفية'],
                        ['showBackground', 'الخلفية المهنية'],
                        ['showPhilosophy', 'فلسفة التعلّم'],
                        ['showSkills', 'المهارات'],
                        ['showInterests', 'الاهتمامات'],
                        ['showQuotes', 'قسم الاقتباسات اليومية'],
                        ['showCourses', 'الكورسات'],
                        ['showPaths', 'المسارات'],
                        ['showBooks', 'الكتب'],
                        ['showReflections', 'صفحة الخواطر'],
                        ['showBlogs', 'صفحة المدونة'],
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
                          const pubCats =
                            siteDraft.publicReflectionCategories ?? [];
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
                                    const prev =
                                      p.publicReflectionCategories ?? [];
                                    const next = e.target.checked
                                      ? Array.from(new Set([...prev, cat]))
                                      : prev.filter((c) => c !== cat);
                                    return {
                                      ...p,
                                      publicReflectionCategories: next,
                                    };
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

                {/* Public Daily Quotes Management */}
                <div className="p-4 rounded-xl bg-[#F7F8FA] border border-slate-200 space-y-3">
                  <div className="flex flex-wrap items-center justify-between gap-2">
                    <div className="flex items-center gap-2">
                      <Quote className="w-4 h-4 text-[#1E3A5F]" aria-hidden="true" />
                      <p className="text-xs font-bold text-slate-800">
                        الاقتباسات المنشورة في الموقع العام ({(siteDraft.publicQuotes ?? []).length})
                      </p>
                    </div>
                    {(props.preferences.quotesLibrary?.length ?? 0) > 0 && (
                      <button
                        type="button"
                        onClick={() => {
                          const existing = siteDraft.publicQuotes ?? [];
                          const existingTexts = new Set(existing.map((q) => q.text.trim()));
                          const imported = (props.preferences.quotesLibrary ?? []).filter(
                            (q) => !existingTexts.has(q.text.trim())
                          );
                          if (imported.length === 0) return;
                          setSiteDraft((p) => ({
                            ...p,
                            publicQuotes: [...existing, ...imported],
                          }));
                        }}
                        className="inline-flex items-center gap-1 px-2.5 py-1 text-[11px] font-semibold text-[#1E3A5F] bg-white border border-slate-200 hover:bg-slate-100 rounded-lg cursor-pointer"
                      >
                        <Plus className="w-3 h-3" aria-hidden="true" />
                        <span>
                          استيراد من مكتبة اقتباساتي ({props.preferences.quotesLibrary?.length ?? 0})
                        </span>
                      </button>
                    )}
                  </div>

                  <label className="block text-[11px] text-slate-600">
                    عنوان قسم الاقتباسات في الصفحة العامة
                    <input
                      type="text"
                      value={siteDraft.publicQuotesHeading ?? 'اقتباس اليوم ومختارات ملهمة'}
                      onChange={(e) =>
                        setSiteDraft((p) => ({
                          ...p,
                          publicQuotesHeading: e.target.value,
                        }))
                      }
                      placeholder="اقتباس اليوم ومختارات ملهمة"
                      className="mt-1 w-full px-3 py-1.5 text-xs bg-white border border-slate-200 rounded-lg"
                    />
                  </label>

                  <div className="p-3 bg-white border border-slate-200 rounded-xl space-y-2">
                    <AutoResizeTextarea
                      minRows={2}
                      value={pubQuoteText}
                      onChange={(e) => setPubQuoteText(e.target.value)}
                      placeholder="أضف نص الاقتباس الذي يظهر للزوار..."
                      className="w-full px-3 py-2 text-xs bg-[#F7F8FA] border border-slate-200 rounded-lg"
                    />
                    <div className="flex flex-wrap items-center gap-2">
                      <input
                        type="text"
                        value={pubQuoteAuthor}
                        onChange={(e) => setPubQuoteAuthor(e.target.value)}
                        placeholder="القائل / المصدر"
                        className="flex-1 min-w-[140px] px-2.5 py-1.5 text-xs bg-[#F7F8FA] border border-slate-200 rounded-lg"
                      />
                      <input
                        type="text"
                        value={pubQuoteTheme}
                        onChange={(e) => setPubQuoteTheme(e.target.value)}
                        placeholder="المحور (مثال: التعلّم)"
                        className="flex-1 min-w-[120px] px-2.5 py-1.5 text-xs bg-[#F7F8FA] border border-slate-200 rounded-lg"
                      />
                      <button
                        type="button"
                        onClick={() => {
                          const txt = pubQuoteText.trim();
                          if (!txt) return;
                          const now = Date.now();
                          const nextItem: UserQuoteItem = {
                            id: `pubq_${now}`,
                            text: txt,
                            author: pubQuoteAuthor.trim() || 'مقتبس مختار',
                            theme: pubQuoteTheme.trim() || 'إلهام',
                            dateKey: getTodayDateKey(),
                            colorKey: 'amber',
                            createdAtMs: now,
                            updatedAtMs: now,
                          };
                          setSiteDraft((p) => ({
                            ...p,
                            publicQuotes: [nextItem, ...(p.publicQuotes ?? [])],
                          }));
                          setPubQuoteText('');
                          setPubQuoteAuthor('');
                          setPubQuoteTheme('');
                        }}
                        className="inline-flex items-center gap-1 px-3 py-1.5 text-xs font-semibold text-white bg-[#1E3A5F] hover:bg-[#162C49] rounded-lg cursor-pointer"
                      >
                        <Plus className="w-3.5 h-3.5" aria-hidden="true" />
                        <span>إضافة اقتباس عام</span>
                      </button>
                    </div>
                  </div>

                  {(siteDraft.publicQuotes ?? []).length > 0 && (
                    <div className="max-h-[240px] overflow-y-auto thin-scrollbar space-y-2">
                      {(siteDraft.publicQuotes ?? []).map((pq) => {
                        const isPinned = siteDraft.pinnedPublicQuoteId === pq.id;
                        return (
                          <div
                            key={pq.id}
                            className="p-2.5 bg-white border border-slate-200 rounded-lg flex items-start justify-between gap-2 text-xs"
                          >
                            <div className="min-w-0 flex-1 space-y-0.5">
                              <p className="font-semibold text-slate-900 line-clamp-2">
                                «{pq.text}»
                              </p>
                              <p className="text-[11px] text-slate-500">
                                — {pq.author}
                                {pq.theme ? ` · ${pq.theme}` : ''}
                              </p>
                            </div>
                            <div className="flex items-center gap-1 shrink-0">
                              <button
                                type="button"
                                onClick={() =>
                                  setSiteDraft((p) => ({
                                    ...p,
                                    pinnedPublicQuoteId: isPinned ? null : pq.id,
                                  }))
                                }
                                title={isPinned ? 'إلغاء التثبيت' : 'تثبيت كاقتباس رئيسي'}
                                className={`px-2 py-1 text-[10px] font-semibold rounded border cursor-pointer ${
                                  isPinned
                                    ? 'bg-[#1E3A5F] text-white border-[#1E3A5F]'
                                    : 'bg-slate-50 text-slate-700 border-slate-200 hover:bg-slate-100'
                                }`}
                              >
                                {isPinned ? 'مثبّت' : 'تثبيت'}
                              </button>
                              <button
                                type="button"
                                onClick={() =>
                                  setSiteDraft((p) => ({
                                    ...p,
                                    publicQuotes: (p.publicQuotes ?? []).filter(
                                      (x) => x.id !== pq.id
                                    ),
                                    pinnedPublicQuoteId:
                                      p.pinnedPublicQuoteId === pq.id
                                        ? null
                                        : p.pinnedPublicQuoteId,
                                  }))
                                }
                                title="حذف الاقتباس"
                                className="p-1 text-rose-600 hover:bg-rose-50 rounded cursor-pointer"
                              >
                                <Trash2 className="w-3.5 h-3.5" aria-hidden="true" />
                              </button>
                            </div>
                          </div>
                        );
                      })}
                    </div>
                  )}
                </div>

                {/* Custom Sections with AutoResizeTextarea */}
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
                                s.id === sec.id
                                  ? { ...s, title: e.target.value }
                                  : s
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
                                  s.id === sec.id
                                    ? { ...s, visible: e.target.checked }
                                    : s
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
                              sections: p.sections.filter(
                                (s) => s.id !== sec.id
                              ),
                            }))
                          }
                          className="p-1 text-slate-400 hover:text-red-700 cursor-pointer"
                        >
                          <Trash2 className="w-3.5 h-3.5" />
                        </button>
                      </div>
                      <AutoResizeTextarea
                        minRows={2}
                        value={sec.body}
                        onChange={(e) =>
                          setSiteDraft((p) => ({
                            ...p,
                            sections: p.sections.map((s) =>
                              s.id === sec.id
                                ? { ...s, body: e.target.value }
                                : s
                            ),
                          }))
                        }
                        className="w-full px-2.5 py-2 text-xs bg-white border border-slate-300 rounded-lg"
                      />
                    </div>
                  ))}
                </div>
              </form>

              {/* Quick Publish Controls including Blog Posts */}
              <section className="bg-white border border-slate-200 rounded-2xl p-5 sm:p-6 space-y-4">
                <h2 className="font-editorial text-xl font-bold text-slate-900">
                  التحكم السريع في نشر المحتوى للعامة
                </h2>
                <p className="text-xs text-slate-500">
                  لا يظهر للزوار إلا ما تُفعّل نشره هنا أو في صفحة المقالات والخواطر.
                </p>

                <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                  {(props.blogPosts?.length ?? 0) > 0 &&
                    props.onToggleBlogPublic && (
                      <div className="p-3.5 rounded-xl bg-[#F7F8FA] border border-slate-200 space-y-2 max-h-[300px] overflow-y-auto">
                        <p className="text-xs font-bold text-slate-900">
                          المقالات ({(props.blogPosts || []).filter((b) => b.isPublic).length} منشور)
                        </p>
                        {(props.blogPosts || []).map((b) => (
                          <label
                            key={b.id}
                            className="flex items-center justify-between gap-2 p-2 bg-white border border-slate-200 rounded-lg text-xs cursor-pointer"
                          >
                            <span className="truncate">{b.title}</span>
                            <input
                              type="checkbox"
                              checked={Boolean(b.isPublic)}
                              onChange={(e) =>
                                props.onToggleBlogPublic?.(
                                  b.id,
                                  e.target.checked
                                )
                              }
                            />
                          </label>
                        ))}
                      </div>
                    )}

                  <div className="p-3.5 rounded-xl bg-[#F7F8FA] border border-slate-200 space-y-2 max-h-[300px] overflow-y-auto">
                    <p className="text-xs font-bold text-slate-900">
                      الكورسات ({props.courses.filter((c) => c.isPublic).length}{' '}
                      منشور)
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
                              props.onToggleCoursePublic(
                                docId,
                                e.target.checked
                              )
                            }
                          />
                        </label>
                      );
                    })}
                  </div>

                  <div className="p-3.5 rounded-xl bg-[#F7F8FA] border border-slate-200 space-y-2 max-h-[300px] overflow-y-auto">
                    <p className="text-xs font-bold text-slate-900">
                      المسارات (
                      {props.learningPaths.filter((p) => p.isPublic).length}{' '}
                      منشور)
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
                          onChange={(e) =>
                            props.onTogglePathPublic(p.id, e.target.checked)
                          }
                        />
                      </label>
                    ))}
                  </div>

                  <div className="p-3.5 rounded-xl bg-[#F7F8FA] border border-slate-200 space-y-2 max-h-[300px] overflow-y-auto">
                    <p className="text-xs font-bold text-slate-900">
                      المكتبة (
                      {props.readingItems.filter((b) => b.isPublic).length}{' '}
                      منشور)
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
                          onChange={(e) =>
                            props.onToggleBookPublic(b.id, e.target.checked)
                          }
                        />
                      </label>
                    ))}
                  </div>
                </div>

                {(props.reflections?.length ?? 0) > 0 &&
                  props.onToggleReflectionPublic && (
                    <div className="p-3.5 rounded-xl bg-[#F7F8FA] border border-slate-200 space-y-2 max-h-[260px] overflow-y-auto">
                      <p className="text-xs font-bold text-slate-900">
                        الخواطر الفردية (
                        {
                          (props.reflections || []).filter((r) => r.isPublic)
                            .length
                        }{' '}
                        منشورة فرديًا)
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
                                props.onToggleReflectionPublic?.(
                                  r.id,
                                  e.target.checked
                                )
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

          {/* SECTION 3: Domains & 12-Month Plan */}
          {subTab === 'plan' && (
            <div className="space-y-4">
              <div className="flex flex-wrap items-center gap-2">
                <button
                  type="button"
                  onClick={() => setPlanSubMode('domains')}
                  className={`px-4 py-2 text-xs font-semibold rounded-xl border cursor-pointer ${
                    planSubMode === 'domains'
                      ? 'bg-[#1E3A5F] text-white border-[#1E3A5F]'
                      : 'bg-white text-slate-700 border-slate-200'
                  }`}
                >
                  المحاور المعرفية والمفكرون ({props.domains.length})
                </button>
                <button
                  type="button"
                  onClick={() => setPlanSubMode('months')}
                  className={`px-4 py-2 text-xs font-semibold rounded-xl border cursor-pointer ${
                    planSubMode === 'months'
                      ? 'bg-[#1E3A5F] text-white border-[#1E3A5F]'
                      : 'bg-white text-slate-700 border-slate-200'
                  }`}
                >
                  الخطة الشهرية والوحدات ({props.months.length} وحدة)
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

          {/* SECTION 4: Cumulative Stats & Weekly Meetings */}
          {subTab === 'meetings' && (
            <div className="space-y-6">
              <section className="bg-white border border-slate-200 rounded-2xl p-5 sm:p-6 space-y-4">
                <h2 className="font-editorial text-xl font-bold text-slate-900">
                  التقدم التراكمي عبر المجالات
                </h2>
                <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-3.5">
                  {domainBreakdown.map(({ domain, total, completed }) => {
                    const pct =
                      total > 0 ? Math.round((completed / total) * 100) : 0;
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

          {/* SECTION 5: Custom Categories & Activity History */}
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
                      onChange={(e) =>
                        setCatHub(e.target.value as CustomCategory['hubId'])
                      }
                      className="px-2.5 py-2 text-xs bg-white border border-slate-300 rounded-lg"
                    >
                      <option value="all">جميع المحاور</option>
                      {hubs.map((h) => (
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
                        <p className="text-xs font-bold text-slate-900">
                          {cat.title}
                        </p>
                        {cat.description && (
                          <p className="text-[11px] text-slate-500">
                            {cat.description}
                          </p>
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
                  <p className="text-xs text-slate-500 py-4">
                    لا يوجد نشاط مسجّل بعد.
                  </p>
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

          {/* SECTION 6: Users, Roles & Granular Content Access */}
          {subTab === 'users' && (
            <div className="space-y-5">
              <section className="bg-white border border-slate-200 rounded-2xl p-4 sm:p-6 space-y-4">
                <div className="flex flex-wrap items-center justify-between gap-3">
                  <div>
                    <h2 className="font-editorial text-xl font-bold text-slate-900">
                      المستخدمون والصلاحيات والمحتوى المخصّص
                    </h2>
                    <p className="text-xs text-slate-500">
                      تحكّم من هنا في أدوار الحسابات، وافتح لأي حساب كورسات أو تلخيصات أو مسارات أو كتب أو خواطر أو مقالات محددة — بصلاحية قراءة فقط أو مع السماح بالإضافة، وبإضافة مخصّصة له. يظل ({OWNER_ADMIN_EMAIL}) محميًا كمسؤول.
                    </p>
                  </div>
                  <button
                    type="button"
                    onClick={() => void loadProfiles()}
                    disabled={loadingProfiles}
                    className="inline-flex items-center gap-1.5 px-3 py-2 text-xs font-medium bg-slate-100 hover:bg-slate-200 rounded-lg cursor-pointer whitespace-nowrap shrink-0"
                  >
                    <RefreshCw
                      className={`w-3.5 h-3.5 ${loadingProfiles ? 'animate-spin' : ''}`}
                    />
                    <span>تحديث</span>
                  </button>
                </div>

                {isPending011Migration() && (
                  <div className="p-3.5 rounded-xl bg-amber-50 border border-amber-200 text-xs text-amber-900 leading-relaxed">
                    لتفعيل جدول إضافات الحسابات (<code className="font-mono font-bold">granted_item_notes</code>) والحقول الأصلية على قاعدة البيانات مباشرة، يُنصح بتشغيل ملف{' '}
                    <code className="font-mono font-bold">011_account_permissions_and_hero_prefs.sql</code>{' '}
                    في محرر SQL بلوحة Supabase. (تعمل إعدادات المنح والوصول حاليًا بالتوافق التلقائي.)
                  </div>
                )}

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
                  <p className="text-xs text-slate-500 py-4">
                    لا توجد ملفات مستخدمين مسجّلة.
                  </p>
                ) : (
                  <>
                    {/* Mobile Cards (< md) for zero horizontal table overflow */}
                    <div className="md:hidden space-y-3">
                      {profiles.map((prof) => {
                        const isPrimaryOwner =
                          prof.email.toLowerCase() ===
                          OWNER_ADMIN_EMAIL.toLowerCase();
                        const g = grantsByUid[prof.uid];
                        const grantParts: string[] = [];
                        if (g?.courseDocIds.length)
                          grantParts.push(`${g.courseDocIds.length} كورس`);
                        if (g?.noteIds.length)
                          grantParts.push(`${g.noteIds.length} تلخيص`);
                        if (g?.pathIds.length)
                          grantParts.push(`${g.pathIds.length} مسار`);
                        if (g?.bookIds.length)
                          grantParts.push(`${g.bookIds.length} كتاب`);
                        if ((g?.blogIds?.length || 0) > 0)
                          grantParts.push(`${g!.blogIds!.length} مقال`);
                        if (
                          (g?.reflectionIds.length || 0) +
                            (g?.reflectionCategories.length || 0) >
                          0
                        )
                          grantParts.push('خواطر');
                        const canAnnotate =
                          g?.accessMode === 'can_annotate' || g?.allowUserNotes;

                        return (
                          <div
                            key={`m-${prof.uid}`}
                            className="p-3.5 rounded-xl bg-[#F7F8FA] border border-slate-200 space-y-3 text-xs"
                          >
                            <div className="flex items-start justify-between gap-2">
                              <div className="min-w-0">
                                <p className="font-bold text-slate-900 truncate">
                                  {prof.displayName || 'مستخدم'}
                                  {isPrimaryOwner && (
                                    <span className="mr-1.5 text-[10px] text-[#1E3A5F]">
                                      (المالك)
                                    </span>
                                  )}
                                </p>
                                <p className="text-[11px] text-slate-500 truncate" dir="ltr">
                                  {prof.email}
                                </p>
                              </div>
                              {!isPrimaryOwner && g && (
                                <span
                                  className={`px-2 py-0.5 text-[10px] font-semibold rounded-md border shrink-0 ${
                                    canAnnotate
                                      ? 'bg-emerald-50 border-emerald-200 text-emerald-800'
                                      : 'bg-white border-slate-200 text-slate-600'
                                  }`}
                                >
                                  {canAnnotate ? 'عرض + إضافة' : 'قراءة فقط'}
                                </span>
                              )}
                            </div>

                            <div className="grid grid-cols-2 gap-2">
                              <label className="space-y-1">
                                <span className="block text-[10px] text-slate-500">الدور</span>
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
                                  className="w-full px-2 py-2 text-[11px] bg-white border border-slate-300 rounded-lg disabled:opacity-60"
                                >
                                  <option value="user">مستخدم عادي</option>
                                  <option value="admin">مسؤول</option>
                                </select>
                              </label>
                              <label className="space-y-1">
                                <span className="block text-[10px] text-slate-500">الحالة</span>
                                <select
                                  disabled={isPrimaryOwner}
                                  value={prof.approvalStatus}
                                  onChange={(e) =>
                                    void handleRoleUpdate(
                                      prof,
                                      prof.role,
                                      e.target
                                        .value as UserProfileItem['approvalStatus']
                                    )
                                  }
                                  className="w-full px-2 py-2 text-[11px] bg-white border border-slate-300 rounded-lg disabled:opacity-60"
                                >
                                  <option value="pending">قيد الانتظار</option>
                                  <option value="approved">مفعّل</option>
                                  <option value="suspended">معلّق</option>
                                  <option value="rejected">مرفوض</option>
                                </select>
                              </label>
                            </div>

                            {!isPrimaryOwner && (
                              <div className="flex flex-wrap items-center justify-between gap-2 pt-2 border-t border-slate-200/80">
                                <span className="text-[11px] text-slate-600 tabular-nums">
                                  {grantParts.length > 0
                                    ? grantParts.join(' · ')
                                    : 'عام فقط'}
                                  {g?.customAdditionTitle ? ' · + إضافة مخصّصة' : ''}
                                </span>
                                <button
                                  type="button"
                                  onClick={() => openGrantModalForUser(prof)}
                                  className="inline-flex items-center gap-1.5 px-3 py-2 text-xs font-semibold text-white bg-[#1E3A5F] rounded-lg cursor-pointer whitespace-nowrap shrink-0"
                                >
                                  <KeyRound className="w-3.5 h-3.5" aria-hidden="true" />
                                  <span>تخصيص الصلاحيات</span>
                                </button>
                              </div>
                            )}
                          </div>
                        );
                      })}
                    </div>

                    {/* Desktop Table (>= md) */}
                    <div className="hidden md:block overflow-x-auto">
                      <table className="w-full text-right text-xs border-collapse">
                        <thead>
                          <tr className="border-b border-slate-200 text-slate-500">
                            <th className="py-2.5 px-3 font-semibold">المستخدم</th>
                            <th className="py-2.5 px-3 font-semibold">البريد</th>
                            <th className="py-2.5 px-3 font-semibold">الدور</th>
                            <th className="py-2.5 px-3 font-semibold">الحالة</th>
                            <th className="py-2.5 px-3 font-semibold">
                              صلاحيات المحتوى المخصّصة
                            </th>
                          </tr>
                        </thead>
                        <tbody className="divide-y divide-slate-100">
                          {profiles.map((prof) => {
                            const isPrimaryOwner =
                              prof.email.toLowerCase() ===
                              OWNER_ADMIN_EMAIL.toLowerCase();
                            const g = grantsByUid[prof.uid];
                            const grantParts: string[] = [];
                            if (g?.courseDocIds.length)
                              grantParts.push(`${g.courseDocIds.length} كورس`);
                            if (g?.noteIds.length)
                              grantParts.push(`${g.noteIds.length} تلخيص`);
                            if (g?.pathIds.length)
                              grantParts.push(`${g.pathIds.length} مسار`);
                            if (g?.bookIds.length)
                              grantParts.push(`${g.bookIds.length} كتاب`);
                            if ((g?.blogIds?.length || 0) > 0)
                              grantParts.push(`${g!.blogIds!.length} مقال`);
                            if (
                              (g?.reflectionIds.length || 0) +
                                (g?.reflectionCategories.length || 0) >
                              0
                            )
                              grantParts.push('خواطر');
                            const canAnnotate =
                              g?.accessMode === 'can_annotate' || g?.allowUserNotes;

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
                                <td className="py-3 px-3 text-slate-600">
                                  {prof.email}
                                </td>
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
                                    <option value="user">
                                      مستخدم عادي (عام + مخصّص)
                                    </option>
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
                                        e.target
                                          .value as UserProfileItem['approvalStatus']
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
                                    <span className="text-[11px] text-slate-500">
                                      صلاحية كاملة للمالك
                                    </span>
                                  ) : (
                                    <div className="flex flex-wrap items-center gap-2">
                                      <button
                                        type="button"
                                        onClick={() => openGrantModalForUser(prof)}
                                        className="inline-flex items-center gap-1.5 px-2.5 py-1.5 text-[11px] font-semibold text-[#1E3A5F] bg-[#F7F8FA] hover:bg-slate-200 border border-slate-200 rounded-lg cursor-pointer whitespace-nowrap"
                                      >
                                        <KeyRound
                                          className="w-3 h-3"
                                          aria-hidden="true"
                                        />
                                        <span>تخصيص المحتوى</span>
                                      </button>
                                      {g && (
                                        <span
                                          className={`px-2 py-0.5 text-[10px] font-semibold rounded-md border ${
                                            canAnnotate
                                              ? 'bg-emerald-50 border-emerald-200 text-emerald-800'
                                              : 'bg-white border-slate-200 text-slate-600'
                                          }`}
                                        >
                                          {canAnnotate ? 'عرض + إضافة' : 'قراءة فقط'}
                                        </span>
                                      )}
                                      <span className="text-[11px] text-slate-500 tabular-nums">
                                        {grantParts.length > 0
                                          ? grantParts.join(' · ')
                                          : 'عام فقط'}
                                        {g?.customAdditionTitle ? ' · + إضافة' : ''}
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
                  </>
                )}

                {/* Per-Account Content Access Grants Modal */}
                {grantModalUser && (
                  <div
                    className="fixed inset-0 z-[75] bg-slate-950/60 backdrop-blur-xs flex items-center justify-center p-2.5 sm:p-4"
                    role="dialog"
                    aria-modal="true"
                    onClick={() => setGrantModalUser(null)}
                  >
                    <div
                      onClick={(e) => e.stopPropagation()}
                      className="w-full max-w-4xl max-h-[92dvh] flex flex-col bg-white border border-slate-200 rounded-2xl shadow-2xl overflow-hidden"
                    >
                      <div className="px-4 sm:px-5 py-3.5 bg-slate-50 border-b border-slate-200 flex items-center justify-between gap-2">
                        <div className="min-w-0">
                          <h3 className="text-sm sm:text-base font-bold text-slate-900 truncate">
                            تخصيص المحتوى لحساب:{' '}
                            {grantModalUser.displayName || grantModalUser.email}
                          </h3>
                          <p className="text-[11px] text-slate-500 truncate" dir="ltr">
                            {grantModalUser.email}
                          </p>
                        </div>
                        <button
                          type="button"
                          onClick={() => setGrantModalUser(null)}
                          aria-label="إغلاق"
                          className="p-2 text-slate-500 hover:text-slate-900 rounded-lg cursor-pointer shrink-0"
                        >
                          <X className="w-4 h-4" />
                        </button>
                      </div>

                      <div className="flex-1 overflow-y-auto p-3.5 sm:p-5 space-y-4 sm:space-y-5 text-xs">
                        {/* Access Mode & Custom Admin Addition */}
                        <div className="p-3.5 bg-[#F7F8FA] border border-slate-200 rounded-xl space-y-3.5">
                          <div className="space-y-1.5">
                            <p className="font-bold text-slate-900">
                              مستوى الصلاحية لهذا الحساب
                            </p>
                            <div className="grid grid-cols-1 sm:grid-cols-2 gap-2.5">
                              <button
                                type="button"
                                onClick={() =>
                                  setGrantDraft((p) => ({
                                    ...p,
                                    accessMode: 'read_only',
                                  }))
                                }
                                className={`p-3 rounded-xl border text-right transition-colors cursor-pointer space-y-0.5 ${
                                  grantDraft.accessMode === 'read_only'
                                    ? 'bg-white border-[#1E3A5F] ring-2 ring-[#1E3A5F]/15'
                                    : 'bg-white/70 border-slate-200 hover:bg-white'
                                }`}
                              >
                                <p className="font-bold text-slate-900">
                                  عرض وقراءة فقط
                                </p>
                                <p className="text-[11px] text-slate-500">
                                  يشاهد الحساب الكورسات والملخصات المختارة دون إمكانية إضافة ملاحظات.
                                </p>
                              </button>
                              <button
                                type="button"
                                onClick={() =>
                                  setGrantDraft((p) => ({
                                    ...p,
                                    accessMode: 'can_annotate',
                                  }))
                                }
                                className={`p-3 rounded-xl border text-right transition-colors cursor-pointer space-y-0.5 ${
                                  grantDraft.accessMode === 'can_annotate'
                                    ? 'bg-emerald-50/70 border-emerald-600 ring-2 ring-emerald-500/15'
                                    : 'bg-white/70 border-slate-200 hover:bg-white'
                                }`}
                              >
                                <p className="font-bold text-slate-900">
                                  عرض + السماح بالإضافة والتعليق
                                </p>
                                <p className="text-[11px] text-slate-500">
                                  يستطيع الحساب كتابة إضافات أو أسئلة داخل المواد المفتوحة له وتظهر لك في الإدارة.
                                </p>
                              </button>
                            </div>
                          </div>

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
                              setGrantDraft((p) => ({
                                ...p,
                                notesForUser: e.target.value,
                              }))
                            }
                            placeholder="رسالة ترحيب أو توجيه عام لهذا الحساب (اختياري)..."
                            className="w-full px-3 py-2 bg-white border border-slate-300 rounded-lg"
                          />

                          {/* Custom Addition / Note Specifically Attached by Admin for this Account */}
                          <div className="pt-2.5 border-t border-slate-200 space-y-2">
                            <p className="font-bold text-slate-900">
                              إضافة أو تكليف خاص لهذا الحساب (يظهر داخل مساحته المخصّصة)
                            </p>
                            <input
                              type="text"
                              value={grantDraft.customAdditionTitle}
                              onChange={(e) =>
                                setGrantDraft((p) => ({
                                  ...p,
                                  customAdditionTitle: e.target.value,
                                }))
                              }
                              placeholder="عنوان الإضافة المخصّصة (مثلاً: خطة المراجعة الأسبوعية لك)..."
                              className="w-full px-3 py-2 bg-white border border-slate-300 rounded-lg"
                            />
                            <AutoResizeTextarea
                              minRows={2}
                              value={grantDraft.customAdditionBody}
                              onChange={(e) =>
                                setGrantDraft((p) => ({
                                  ...p,
                                  customAdditionBody: e.target.value,
                                }))
                              }
                              placeholder="اكتب هنا أي إضافة أو ملخص أو مهام خاصّة تزيدها لهذا الحساب فقط..."
                              className="w-full px-3 py-2 bg-white border border-slate-300 rounded-lg"
                            />
                          </div>
                        </div>

                        <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                          <div className="p-3.5 rounded-xl border border-slate-200 space-y-2 max-h-64 overflow-y-auto">
                            <p className="font-bold text-slate-900">
                              الكورسات ({grantDraft.courseDocIds.length} محدد)
                            </p>
                            {props.courses.map((c) => {
                              const docId = c.docId || `course-${c.id}`;
                              const checked =
                                grantDraft.courseDocIds.includes(docId);
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
                                          ? Array.from(
                                              new Set([...p.courseDocIds, docId])
                                            )
                                          : p.courseDocIds.filter(
                                              (id) => id !== docId
                                            ),
                                      }))
                                    }
                                  />
                                </label>
                              );
                            })}
                          </div>

                          <div className="p-3.5 rounded-xl border border-slate-200 space-y-2 max-h-64 overflow-y-auto">
                            <div className="flex items-center justify-between gap-2">
                              <p className="font-bold text-slate-900">
                                التلخيصات والملاحظات ({grantDraft.noteIds.length}{' '}
                                محدد)
                              </p>
                              <input
                                type="text"
                                value={grantNoteSearch}
                                onChange={(e) =>
                                  setGrantNoteSearch(e.target.value)
                                }
                                placeholder="بحث..."
                                className="w-28 sm:w-32 px-2 py-1 text-[11px] bg-[#F7F8FA] border border-slate-300 rounded"
                              />
                            </div>
                            {(props.bookNotes || [])
                              .filter((bn) => {
                                const q = grantNoteSearch.trim().toLowerCase();
                                if (!q) return true;
                                return (
                                  bn.bookTitle.toLowerCase().includes(q) ||
                                  (bn.courseTitle || '')
                                    .toLowerCase()
                                    .includes(q)
                                );
                              })
                              .map((bn) => {
                                const checked = grantDraft.noteIds.includes(
                                  bn.id
                                );
                                return (
                                  <label
                                    key={bn.id}
                                    className="flex items-center justify-between gap-2 p-2 bg-[#F7F8FA] rounded-lg cursor-pointer"
                                  >
                                    <span className="truncate">
                                      {bn.bookTitle}
                                      {bn.courseTitle
                                        ? ` — ${bn.courseTitle}`
                                        : ''}
                                    </span>
                                    <input
                                      type="checkbox"
                                      checked={checked}
                                      onChange={(e) =>
                                        setGrantDraft((p) => ({
                                          ...p,
                                          noteIds: e.target.checked
                                            ? Array.from(
                                                new Set([...p.noteIds, bn.id])
                                              )
                                            : p.noteIds.filter(
                                                (id) => id !== bn.id
                                              ),
                                        }))
                                      }
                                    />
                                  </label>
                                );
                              })}
                          </div>

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
                                          ? Array.from(
                                              new Set([...p.pathIds, lp.id])
                                            )
                                          : p.pathIds.filter(
                                              (id) => id !== lp.id
                                            ),
                                      }))
                                    }
                                  />
                                </label>
                              );
                            })}
                          </div>

                          <div className="p-3.5 rounded-xl border border-slate-200 space-y-2 max-h-56 overflow-y-auto">
                            <p className="font-bold text-slate-900">
                              الكتب ومصادر المكتبة ({grantDraft.bookIds.length}{' '}
                              محدد)
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
                                          ? Array.from(
                                              new Set([...p.bookIds, b.id])
                                            )
                                          : p.bookIds.filter((id) => id !== b.id),
                                      }))
                                    }
                                  />
                                </label>
                              );
                            })}
                          </div>
                        </div>

                        {(props.blogPosts?.length ?? 0) > 0 && (
                          <div className="p-3.5 rounded-xl border border-slate-200 space-y-2 max-h-48 overflow-y-auto">
                            <p className="font-bold text-slate-900 flex items-center gap-1.5">
                              <BookOpenText className="w-3.5 h-3.5 text-[#1E3A5F]" aria-hidden="true" />
                              <span>مقالات مخصّصة (حتى لو غير منشورة للعامة) ({grantDraft.blogIds.length} محدد)</span>
                            </p>
                            <div className="grid grid-cols-1 sm:grid-cols-2 gap-2">
                              {(props.blogPosts || []).map((post) => {
                                const checked = grantDraft.blogIds.includes(post.id);
                                return (
                                  <label
                                    key={post.id}
                                    className="flex items-center justify-between gap-2 p-2 bg-[#F7F8FA] rounded-lg cursor-pointer"
                                  >
                                    <span className="truncate">{post.title}</span>
                                    <input
                                      type="checkbox"
                                      checked={checked}
                                      onChange={(e) =>
                                        setGrantDraft((p) => ({
                                          ...p,
                                          blogIds: e.target.checked
                                            ? Array.from(
                                                new Set([...p.blogIds, post.id])
                                              )
                                            : p.blogIds.filter(
                                                (id) => id !== post.id
                                              ),
                                        }))
                                      }
                                    />
                                  </label>
                                );
                              })}
                            </div>
                          </div>
                        )}

                        <div className="p-3.5 rounded-xl border border-slate-200 space-y-3">
                          <p className="font-bold text-slate-900">
                            منح خواطر وتصنيفات خواطر ({grantDraft.reflectionIds.length}{' '}
                            خاطرة · {grantDraft.reflectionCategories.length} تصنيف)
                          </p>
                          {allReflectionCats.length > 0 && (
                            <div className="flex flex-wrap gap-2">
                              {allReflectionCats.map((cat) => {
                                const checked =
                                  grantDraft.reflectionCategories.includes(cat);
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
                                                new Set([
                                                  ...p.reflectionCategories,
                                                  cat,
                                                ])
                                              )
                                            : p.reflectionCategories.filter(
                                                (c) => c !== cat
                                              ),
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
                                const checked = grantDraft.reflectionIds.includes(
                                  r.id
                                );
                                return (
                                  <label
                                    key={r.id}
                                    className="flex items-center justify-between gap-2 p-2 bg-[#F7F8FA] rounded-lg cursor-pointer"
                                  >
                                    <span className="truncate">
                                      {r.title || r.moodTag}
                                    </span>
                                    <input
                                      type="checkbox"
                                      checked={checked}
                                      onChange={(e) =>
                                        setGrantDraft((p) => ({
                                          ...p,
                                          reflectionIds: e.target.checked
                                            ? Array.from(
                                                new Set([
                                                  ...p.reflectionIds,
                                                  r.id,
                                                ])
                                              )
                                            : p.reflectionIds.filter(
                                                (id) => id !== r.id
                                              ),
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

                      <div className="px-4 sm:px-5 py-3.5 bg-slate-50 border-t border-slate-200 flex flex-wrap items-center justify-between gap-2">
                        {grantsByUid[grantModalUser.uid] ? (
                          <button
                            type="button"
                            disabled={savingGrant}
                            onClick={() => void handleRevokeUserGrant()}
                            className="px-3.5 py-2 text-xs font-semibold text-red-700 bg-red-50 hover:bg-red-100 rounded-lg cursor-pointer whitespace-nowrap"
                          >
                            إلغاء كل الصلاحيات المخصّصة
                          </button>
                        ) : (
                          <span />
                        )}
                        <div className="flex items-center gap-2 mr-auto sm:mr-0">
                          <button
                            type="button"
                            onClick={() => setGrantModalUser(null)}
                            className="px-4 py-2 text-xs font-medium text-slate-600 bg-white border border-slate-200 rounded-lg cursor-pointer whitespace-nowrap"
                          >
                            إلغاء
                          </button>
                          <button
                            type="button"
                            disabled={savingGrant}
                            onClick={() => void handleSaveUserGrant()}
                            className="inline-flex items-center gap-1.5 px-4 py-2 text-xs font-semibold text-white bg-[#1E3A5F] hover:bg-[#162C49] rounded-lg cursor-pointer whitespace-nowrap"
                          >
                            {savingGrant && (
                              <Loader2 className="w-3.5 h-3.5 animate-spin" />
                            )}
                            <span>حفظ الصلاحيات</span>
                          </button>
                        </div>
                      </div>
                    </div>
                  </div>
                )}
              </section>

              {/* Admin Inbox: Notes & Additions Submitted by Granted Accounts */}
              <section className="bg-white border border-slate-200 rounded-2xl p-4 sm:p-6 space-y-4">
                <div className="flex flex-wrap items-center justify-between gap-2">
                  <div className="flex items-center gap-2">
                    <MessageSquarePlus className="w-4 h-4 text-[#1E3A5F]" aria-hidden="true" />
                    <h3 className="font-editorial text-lg font-bold text-slate-900">
                      إضافات وملاحظات الحسابات على المحتوى المخصّص ({grantedItemNotes.length})
                    </h3>
                  </div>
                  <span className="text-[11px] text-slate-500">
                    تظهر هنا تلقائيًا لأي حساب مُنح صلاحية الإضافة
                  </span>
                </div>

                {grantedItemNotes.length === 0 ? (
                  <p className="text-xs text-slate-500 py-3">
                    لم يضف أي حساب ملاحظات أو تعليقات على المحتوى المخصّص بعد.
                  </p>
                ) : (
                  <div className="space-y-2.5">
                    {grantedItemNotes.map((itemNote) => {
                      const targetLabel =
                        itemNote.targetType === 'course'
                          ? props.courses.find(
                              (c) =>
                                c.docId === itemNote.targetId ||
                                String(c.id) === itemNote.targetId
                            )?.title || 'كورس'
                          : itemNote.targetType === 'note'
                          ? props.bookNotes?.find((n) => n.id === itemNote.targetId)
                              ?.bookTitle || 'تلخيص'
                          : itemNote.targetType === 'path'
                          ? props.learningPaths.find((p) => p.id === itemNote.targetId)
                              ?.title || 'مسار'
                          : itemNote.targetType === 'book'
                          ? props.readingItems.find((b) => b.id === itemNote.targetId)
                              ?.title || 'كتاب'
                          : props.reflections?.find((r) => r.id === itemNote.targetId)
                              ?.title || 'خاطرة';

                      return (
                        <div
                          key={itemNote.id}
                          className={`p-3.5 rounded-xl border space-y-2 text-xs ${
                            itemNote.isAdminReply
                              ? 'bg-[#F0F4F9] border-[#1E3A5F]/20'
                              : 'bg-[#F7F8FA] border-slate-200'
                          }`}
                        >
                          <div className="flex flex-wrap items-center justify-between gap-2">
                            <div className="flex flex-wrap items-center gap-2 min-w-0">
                              <span className="font-bold text-slate-900">
                                {itemNote.isAdminReply
                                  ? 'رد الإدارة'
                                  : itemNote.authorName || itemNote.authorEmail}
                              </span>
                              <span className="px-2 py-0.5 text-[10px] font-semibold bg-white border border-slate-200 rounded-md text-[#1E3A5F] truncate max-w-[200px]">
                                {targetLabel}
                              </span>
                              <span className="text-[11px] text-slate-400">
                                {itemNote.createdAtLabel}
                              </span>
                            </div>

                            <div className="flex items-center gap-1.5">
                              {!itemNote.isAdminReply && (
                                <button
                                  type="button"
                                  onClick={() =>
                                    setActiveReplyNoteId((prev) =>
                                      prev === itemNote.id ? null : itemNote.id
                                    )
                                  }
                                  className="px-2.5 py-1 text-[11px] font-semibold text-[#1E3A5F] bg-white border border-slate-200 hover:bg-slate-50 rounded-lg cursor-pointer"
                                >
                                  رد
                                </button>
                              )}
                              <button
                                type="button"
                                onClick={() => void handleDeleteGrantedNote(itemNote.id)}
                                aria-label="حذف الملاحظة"
                                className="p-1.5 text-slate-400 hover:text-red-700 rounded-lg cursor-pointer"
                              >
                                <Trash2 className="w-3.5 h-3.5" />
                              </button>
                            </div>
                          </div>

                          <p className="text-slate-700 leading-relaxed whitespace-pre-wrap">
                            {itemNote.content}
                          </p>

                          {activeReplyNoteId === itemNote.id && (
                            <div className="pt-2 border-t border-slate-200/80 flex flex-col sm:flex-row gap-2">
                              <AutoResizeTextarea
                                minRows={2}
                                value={replyDraftByNoteKey[itemNote.id] || ''}
                                onChange={(e) =>
                                  setReplyDraftByNoteKey((prev) => ({
                                    ...prev,
                                    [itemNote.id]: e.target.value,
                                  }))
                                }
                                placeholder="اكتب ردك على هذه الملاحظة..."
                                className="flex-1 px-3 py-2 text-xs bg-white border border-slate-300 rounded-lg"
                              />
                              <button
                                type="button"
                                disabled={
                                  savingReply ||
                                  !(replyDraftByNoteKey[itemNote.id] || '').trim()
                                }
                                onClick={() => void handleAdminReplyToItemNote(itemNote)}
                                className="px-3.5 py-2 text-xs font-semibold text-white bg-[#1E3A5F] hover:bg-[#162C49] rounded-lg disabled:opacity-45 cursor-pointer self-end whitespace-nowrap shrink-0"
                              >
                                إرسال الرد
                              </button>
                            </div>
                          )}
                        </div>
                      );
                    })}
                  </div>
                )}
              </section>

              {/* Contact Us Inbox */}
              <section className="bg-white border border-slate-200 rounded-2xl p-4 sm:p-6 space-y-4">
                <div className="flex flex-wrap items-center justify-between gap-2">
                  <div className="flex items-center gap-2">
                    <Mail className="w-4 h-4 text-[#1E3A5F]" aria-hidden="true" />
                    <h3 className="font-editorial text-lg font-bold text-slate-900">
                      صندوق رسائل «تواصل معنا» ({contactMessages.length})
                    </h3>
                  </div>
                  <button
                    type="button"
                    onClick={() => void loadProfiles()}
                    disabled={loadingMessages}
                    className="inline-flex items-center gap-1 px-3 py-1.5 text-xs font-medium bg-slate-100 hover:bg-slate-200 rounded-lg cursor-pointer"
                  >
                    <RefreshCw
                      className={`w-3.5 h-3.5 ${loadingMessages ? 'animate-spin' : ''}`}
                    />
                    <span>تحديث الرسائل</span>
                  </button>
                </div>

                {contactMessages.length === 0 ? (
                  <p className="text-xs text-slate-500 py-3">
                    لا توجد رسائل تواصل مستلمة حتى الآن.
                  </p>
                ) : (
                  <div className="max-h-[380px] overflow-y-auto thin-scrollbar space-y-2.5">
                    {contactMessages.map((msg) => (
                      <div
                        key={msg.id}
                        className={`p-3.5 rounded-xl border text-xs space-y-2 ${
                          msg.status === 'unread'
                            ? 'bg-amber-50/40 border-amber-200'
                            : 'bg-[#F7F8FA] border-slate-200'
                        }`}
                      >
                        <div className="flex flex-wrap items-center justify-between gap-2">
                          <div className="flex flex-wrap items-center gap-2">
                            <span className="font-bold text-slate-900">
                              {msg.senderName}
                            </span>
                            <span className="text-[11px] text-slate-500" dir="ltr">
                              {msg.senderEmail}
                            </span>
                            {msg.subject && (
                              <span className="px-2 py-0.5 text-[10px] font-semibold bg-white border border-slate-200 rounded-md text-[#1E3A5F]">
                                {msg.subject}
                              </span>
                            )}
                          </div>
                          <div className="flex items-center gap-1.5">
                            <select
                              value={msg.status}
                              onChange={async (e) => {
                                const nextStatus = e.target.value as ContactMessageRecord['status'];
                                await updateContactMessageStatus(msg.id, nextStatus);
                                setContactMessages((prev) =>
                                  prev.map((x) =>
                                    x.id === msg.id ? { ...x, status: nextStatus } : x
                                  )
                                );
                              }}
                              className="px-2 py-1 text-[11px] bg-white border border-slate-300 rounded-md"
                            >
                              <option value="unread">غير مقروءة</option>
                              <option value="read">مقروءة</option>
                              <option value="archived">مؤرشفة</option>
                            </select>
                            <button
                              type="button"
                              onClick={async () => {
                                await deleteContactMessage(msg.id);
                                setContactMessages((prev) =>
                                  prev.filter((x) => x.id !== msg.id)
                                );
                              }}
                              aria-label="حذف الرسالة"
                              className="p-1.5 text-slate-400 hover:text-red-700 rounded-lg cursor-pointer"
                            >
                              <Trash2 className="w-3.5 h-3.5" />
                            </button>
                          </div>
                        </div>
                        <p className="text-slate-700 leading-relaxed whitespace-pre-wrap">
                          {msg.message}
                        </p>
                      </div>
                    ))}
                  </div>
                )}
              </section>
            </div>
          )}

          {/* SECTION 7: Data, Excel Export & Diagnostics */}
          {subTab === 'data' && (
            <div className="space-y-5">
              {isPending007Migration() && (
                <div className="p-4 rounded-xl bg-amber-50 border border-amber-200 text-xs text-amber-900 leading-relaxed">
                  يرجى تشغيل ملف التحديث{' '}
                  <code className="font-mono font-bold">
                    010_blogs_nav_pins_and_deadlock_free_fix.sql
                  </code>{' '}
                  في محرر SQL بلوحة Supabase لتفعيل جداول المدونة وتثبيت الشريط العلوي والمجالات المخصّصة سحابيًا بالكامل.
                </div>
              )}

              {isPending012Migration() && (
                <div className="p-4 rounded-xl bg-amber-50 border border-amber-200 text-xs text-amber-900 leading-relaxed">
                  يرجى تشغيل ملف التحديث{' '}
                  <code className="font-mono font-bold">
                    012_journals_reviews_planner_pins_contact.sql
                  </code>{' '}
                  خطوة بخطوة في محرر SQL بلوحة Supabase لتفعيل جداول اليوميات التلقائية، المراجعات الدورية، التخطيط الأسبوعي، قوائم التثبيت، وصندوق رسائل التواصل سحابيًا.
                </div>
              )}

              {isPending013Migration() && (
                <div className="p-4 rounded-xl bg-amber-50 border border-amber-200 text-xs text-amber-900 leading-relaxed">
                  يرجى تشغيل ملف التحديث{' '}
                  <code className="font-mono font-bold">
                    013_visual_journal_gallery.sql
                  </code>{' '}
                  في محرر SQL بلوحة Supabase لتفعيل حفظ حقول معرض اليوميات المرئي (الألوان، الأغلفة، التدوين الحر، والملاحظات السريعة) سحابيًا.
                </div>
              )}

              {isPending014Migration() && (
                <div className="p-4 rounded-xl bg-amber-50 border border-amber-200 text-xs text-amber-900 leading-relaxed">
                  يرجى تشغيل ملف التحديث{' '}
                  <code className="font-mono font-bold">
                    014_daily_journal_quote.sql
                  </code>{' '}
                  في محرر SQL بلوحة Supabase لتفعيل حفظ عمود «اقتباس اليوم» (
                  <code className="font-mono">daily_quote</code>) في جدول اليوميات سحابيًا.
                </div>
              )}

              {isPending015Migration() && (
                <div className="p-4 rounded-xl bg-amber-50 border border-amber-200 text-xs text-amber-900 leading-relaxed">
                  يرجى تشغيل ملف التحديث{' '}
                  <code className="font-mono font-bold">
                    015_user_theme_preferences_rls.sql
                  </code>{' '}
                  في محرر SQL بلوحة Supabase لتمكين جميع الحسابات المسجّلة (غير المسؤولين) من حفظ ومزامنة تفضيلات المظهر والثيمات الخاصة بكل حساب عبر الأجهزة بأمان.
                </div>
              )}

              {isPending016Migration() && (
                <div className="p-4 rounded-xl bg-amber-50 border border-amber-200 text-xs text-amber-900 leading-relaxed">
                  يرجى تشغيل ملف التحديث{' '}
                  <code className="font-mono font-bold">
                    016_quick_drop_items.sql
                  </code>{' '}
                  في محرر SQL بلوحة Supabase لإنشاء جدول{' '}
                  <code className="font-mono">quick_drop_items</code> وتفعيل المزامنة الفورية بين الأجهزة والأرشفة التلقائية بعد 24 ساعة.
                </div>
              )}

              <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                <div className="bg-white border border-slate-200 rounded-2xl p-5 space-y-3">
                  <div className="flex items-center gap-2">
                    <Download
                      className="w-4 h-4 text-[#1E3A5F]"
                      aria-hidden="true"
                    />
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
                    className="inline-flex items-center gap-1.5 px-4 py-2 text-xs font-semibold text-white bg-[#1E3A5F] hover:bg-[#162C49] rounded-xl cursor-pointer"
                  >
                    <Download className="w-3.5 h-3.5" aria-hidden="true" />
                    <span>تصدير Excel الكامل</span>
                  </button>
                </div>

                <div className="bg-white border border-slate-200 rounded-2xl p-5 space-y-3">
                  <div className="flex items-center gap-2">
                    <RefreshCw
                      className="w-4 h-4 text-[#1E3A5F]"
                      aria-hidden="true"
                    />
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
                      className="inline-flex items-center gap-1.5 px-4 py-2 text-xs font-semibold text-white bg-emerald-700 hover:bg-emerald-800 rounded-xl cursor-pointer"
                    >
                      <RefreshCw
                        className={`w-3.5 h-3.5 ${
                          syncingManual ? 'animate-spin' : ''
                        }`}
                      />
                      <span>مزامنة فورية الآن</span>
                    </button>

                    <button
                      type="button"
                      onClick={() => setConfirmResetOpen(true)}
                      className="inline-flex items-center gap-1.5 px-4 py-2 text-xs font-semibold text-red-700 bg-red-50 hover:bg-red-100 rounded-xl cursor-pointer"
                    >
                      <RotateCcw className="w-3.5 h-3.5" />
                      <span>إعادة ضبط الخطة الافتراضية</span>
                    </button>
                  </div>
                </div>
              </div>

              <div className="bg-white border border-slate-200 rounded-2xl p-5 space-y-3">
                <div className="flex flex-wrap items-center justify-between gap-2">
                  <div className="flex items-center gap-2">
                    <Shield
                      className="w-4 h-4 text-[#1E3A5F]"
                      aria-hidden="true"
                    />
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
                          className={`w-3 h-3 ${
                            diagRunning ? 'animate-spin' : ''
                          }`}
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
                              <p className="font-semibold text-slate-900">
                                {chk.label}
                              </p>
                              <p className="text-[11px] text-slate-600">
                                {chk.detail}
                              </p>
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
                  <span>إجمالي مجالات التركيز: {hubs.length}</span>
                </span>
              </div>
            </div>
          )}
        </div>
      </div>

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
