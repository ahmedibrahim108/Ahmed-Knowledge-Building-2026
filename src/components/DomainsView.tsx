import { useState } from 'react';
import {
  ArrowLeft,
  BookMarked,
  Edit3,
  Plus,
  Trash2,
  UserPlus,
} from 'lucide-react';
import {
  DomainId,
  DomainInfo,
  MonthPlan,
  ThinkerInfo,
} from '../data/curriculumData';

interface DomainsViewProps {
  canEdit: boolean;
  domains: DomainInfo[];
  months: MonthPlan[];
  onFilterMonthsByDomain: (domainId: DomainId) => void;
  onAddDomain: (domain: Omit<DomainInfo, 'id' | 'order'>) => void;
  onUpdateDomain: (id: DomainId, updates: Partial<DomainInfo>) => void;
  onDeleteDomain: (id: DomainId) => void;
}

export default function DomainsView({
  canEdit,
  domains,
  months,
  onFilterMonthsByDomain,
  onAddDomain,
  onUpdateDomain,
  onDeleteDomain,
}: DomainsViewProps) {
  const [showAddDomain, setShowAddDomain] = useState(false);
  const [newTitle, setNewTitle] = useState('');
  const [newSubtitle, setNewSubtitle] = useState('');
  const [newPurpose, setNewPurpose] = useState('');

  const [editingDomainId, setEditingDomainId] = useState<string | null>(null);
  const [confirmDeleteDomainId, setConfirmDeleteDomainId] = useState<
    string | null
  >(null);

  const [addingThinkerDomainId, setAddingThinkerDomainId] = useState<
    string | null
  >(null);
  const [thinkerName, setThinkerName] = useState('');
  const [thinkerRole, setThinkerRole] = useState('');
  const [thinkerWorks, setThinkerWorks] = useState('');
  const [thinkerContribution, setThinkerContribution] = useState('');

  const [editingThinkerKey, setEditingThinkerKey] = useState<string | null>(
    null
  );

  const handleCreateDomain = (e: React.FormEvent) => {
    e.preventDefault();
    const title = newTitle.trim();
    if (!title) return;
    onAddDomain({
      title,
      subtitle: newSubtitle.trim() || 'محور معرفي مضاف',
      purpose:
        newPurpose.trim() || 'توسيع المعرفة وبناء الفهم المتوازن في هذا المجال.',
      thinkers: [],
    });
    setNewTitle('');
    setNewSubtitle('');
    setNewPurpose('');
    setShowAddDomain(false);
  };

  const handleCreateThinker = (e: React.FormEvent, domain: DomainInfo) => {
    e.preventDefault();
    const name = thinkerName.trim();
    if (!name) return;
    const newThinker: ThinkerInfo = {
      name,
      role: thinkerRole.trim() || 'مفكر / باحث',
      keyWorks: thinkerWorks
        .split('،')
        .map((s) => s.trim())
        .filter(Boolean),
      contribution:
        thinkerContribution.trim() ||
        'إسهام فكري مكمل لمحاور الخطة المتوازنة.',
    };
    onUpdateDomain(domain.id, {
      thinkers: [...domain.thinkers, newThinker],
    });
    setThinkerName('');
    setThinkerRole('');
    setThinkerWorks('');
    setThinkerContribution('');
    setAddingThinkerDomainId(null);
  };

  const handleUpdateThinker = (
    domain: DomainInfo,
    index: number,
    updates: Partial<ThinkerInfo>
  ) => {
    const nextThinkers = domain.thinkers.map((t, i) =>
      i === index ? { ...t, ...updates } : t
    );
    onUpdateDomain(domain.id, { thinkers: nextThinkers });
  };

  const handleDeleteThinker = (domain: DomainInfo, index: number) => {
    const nextThinkers = domain.thinkers.filter((_, i) => i !== index);
    onUpdateDomain(domain.id, { thinkers: nextThinkers });
  };

  return (
    <div className="space-y-8">
      <div className="bg-white border border-slate-200 rounded-xl p-6 sm:p-8 flex flex-col md:flex-row md:items-end justify-between gap-4">
        <div className="space-y-2 max-w-3xl">
          <p className="text-xs text-slate-500">
            التوزيع المعرفي المرن · {domains.length} محاور مفعّلة حاليًا
          </p>
          <h1 className="font-editorial text-3xl font-bold text-slate-900">
            المحاور المعرفية الـ {domains.length} والمفكرون
          </h1>
          <p className="text-sm text-slate-600 leading-relaxed">
            أضف أي محور معرفي جديد تريد التوسع فيه، وعدّل أو رتّب المفكرين وأعمالهم بحرية كاملة مع{' '}
            <strong className="text-slate-900 font-semibold">جمال حمدان</strong>{' '}
            ومالك بن نبي وابن خلدون، و{' '}
            <strong className="text-slate-900 font-semibold">
              مصطفى صادق الرافعي
            </strong>{' '}
            وغازي القصيبي وغيرهم.
          </p>
        </div>

        <button
          type="button"
          disabled={!canEdit}
          title={!canEdit ? 'سجّل الدخول بحساب Google لإضافة محور جديد' : undefined}
          onClick={() => setShowAddDomain((v) => !v)}
          className="inline-flex items-center gap-1.5 px-4 py-2 text-xs font-medium text-white bg-[#1E3A5F] rounded-lg hover:bg-[#162C49] transition-colors whitespace-nowrap shrink-0 cursor-pointer disabled:opacity-45 disabled:cursor-not-allowed"
        >
          <Plus className="w-4 h-4" aria-hidden="true" />
          <span>{showAddDomain ? 'إلغاء' : `إضافة المحور ${domains.length + 1}`}</span>
        </button>
      </div>

      {showAddDomain && canEdit && (
        <form
          onSubmit={handleCreateDomain}
          className="bg-white border border-slate-200 rounded-xl p-6 space-y-4"
        >
          <h2 className="text-base font-semibold text-slate-900">
            إضافة محور معرفي جديد
          </h2>
          <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
            <label className="block text-xs font-medium text-slate-600">
              اسم المحور
              <input
                type="text"
                required
                value={newTitle}
                onChange={(e) => setNewTitle(e.target.value)}
                placeholder="مثلاً: الاقتصاد والوعي المالي أو العلوم والتقنية"
                className="mt-1 w-full px-3 py-2 text-sm bg-slate-50 border border-slate-300 rounded-lg focus:outline-none focus:border-[#1E3A5F]"
              />
            </label>
            <label className="block text-xs font-medium text-slate-600">
              الوصف المختصر
              <input
                type="text"
                value={newSubtitle}
                onChange={(e) => setNewSubtitle(e.target.value)}
                placeholder="الكلمات المفتاحية للمحور..."
                className="mt-1 w-full px-3 py-2 text-sm bg-slate-50 border border-slate-300 rounded-lg focus:outline-none focus:border-[#1E3A5F]"
              />
            </label>
          </div>
          <label className="block text-xs font-medium text-slate-600">
            هدف المحور وأثره في بناء العقل المتوازن
            <textarea
              rows={2}
              value={newPurpose}
              onChange={(e) => setNewPurpose(e.target.value)}
              placeholder="لماذا أضفت هذا المحور إلى رحلتك؟"
              className="mt-1 w-full px-3 py-2 text-sm bg-slate-50 border border-slate-300 rounded-lg focus:outline-none focus:border-[#1E3A5F]"
            />
          </label>
          <div className="flex justify-end gap-2">
            <button
              type="button"
              onClick={() => setShowAddDomain(false)}
              className="px-4 py-2 text-xs font-medium text-slate-600 bg-slate-100 rounded-lg hover:bg-slate-200 cursor-pointer"
            >
              إلغاء
            </button>
            <button
              type="submit"
              className="px-4 py-2 text-xs font-medium text-white bg-[#1E3A5F] rounded-lg hover:bg-[#162C49] cursor-pointer"
            >
              حفظ المحور
            </button>
          </div>
        </form>
      )}

      <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
        {domains.map((domain, index) => {
          const monthCount = months.filter(
            (m) =>
              m.foundational.domainId === domain.id ||
              m.exploratory.domainId === domain.id
          ).length;
          const isEditingDomain = editingDomainId === domain.id;
          const isConfirmingDelete = confirmDeleteDomainId === domain.id;
          const isAddingThinker = addingThinkerDomainId === domain.id;

          return (
            <section
              key={domain.id}
              className="bg-white border border-slate-200 rounded-xl p-6 sm:p-7 flex flex-col justify-between gap-6"
            >
              <div className="space-y-4">
                <div className="flex items-start justify-between gap-4">
                  <div className="space-y-1 flex-1">
                    <div className="flex items-center gap-2 text-xs text-slate-500 tabular-nums">
                      <span>{String(index + 1).padStart(2, '0')}.</span>
                      {!isEditingDomain && <span>{domain.subtitle}</span>}
                    </div>
                    {!isEditingDomain && (
                      <h2 className="font-editorial text-2xl font-bold text-slate-900">
                        {domain.title}
                      </h2>
                    )}
                  </div>

                  {canEdit && (
                    <div className="flex items-center gap-1.5 shrink-0">
                      <button
                        type="button"
                        onClick={() =>
                          setEditingDomainId(isEditingDomain ? null : domain.id)
                        }
                        className="inline-flex items-center gap-1 px-2.5 py-1.5 text-xs font-medium text-slate-700 bg-slate-100 rounded-md hover:bg-slate-200 cursor-pointer"
                      >
                        <Edit3 className="w-3.5 h-3.5" aria-hidden="true" />
                        <span>{isEditingDomain ? 'حفظ' : 'تعديل'}</span>
                      </button>

                      {!isConfirmingDelete ? (
                        <button
                          type="button"
                          onClick={() => setConfirmDeleteDomainId(domain.id)}
                          aria-label={`حذف ${domain.title}`}
                          className="p-1.5 text-slate-400 hover:text-red-600 rounded-md hover:bg-red-50 transition-colors cursor-pointer"
                        >
                          <Trash2 className="w-3.5 h-3.5" aria-hidden="true" />
                        </button>
                      ) : (
                        <div className="inline-flex items-center gap-1">
                          <button
                            type="button"
                            onClick={() => {
                              onDeleteDomain(domain.id);
                              setConfirmDeleteDomainId(null);
                            }}
                            className="px-2 py-1 text-[11px] font-medium text-white bg-red-600 rounded-md hover:bg-red-700 cursor-pointer"
                          >
                            تأكيد الحذف
                          </button>
                          <button
                            type="button"
                            onClick={() => setConfirmDeleteDomainId(null)}
                            className="px-2 py-1 text-[11px] text-slate-600 bg-slate-100 rounded-md cursor-pointer"
                          >
                            إلغاء
                          </button>
                        </div>
                      )}
                    </div>
                  )}
                </div>

                {isEditingDomain ? (
                  <div className="space-y-3 p-4 bg-slate-50 border border-slate-200 rounded-lg">
                    <label className="block text-xs text-slate-600">
                      اسم المحور
                      <input
                        type="text"
                        value={domain.title}
                        onChange={(e) =>
                          onUpdateDomain(domain.id, { title: e.target.value })
                        }
                        className="mt-1 w-full px-3 py-1.5 text-sm bg-white border border-slate-300 rounded-md"
                      />
                    </label>
                    <label className="block text-xs text-slate-600">
                      الوصف الفرعي
                      <input
                        type="text"
                        value={domain.subtitle}
                        onChange={(e) =>
                          onUpdateDomain(domain.id, { subtitle: e.target.value })
                        }
                        className="mt-1 w-full px-3 py-1.5 text-xs bg-white border border-slate-300 rounded-md"
                      />
                    </label>
                    <label className="block text-xs text-slate-600">
                      هدف المحور
                      <textarea
                        rows={2}
                        value={domain.purpose}
                        onChange={(e) =>
                          onUpdateDomain(domain.id, { purpose: e.target.value })
                        }
                        className="mt-1 w-full px-3 py-1.5 text-xs bg-white border border-slate-300 rounded-md"
                      />
                    </label>
                  </div>
                ) : (
                  <p className="text-sm text-slate-600 leading-relaxed">
                    {domain.purpose}
                  </p>
                )}

                {/* Thinkers List */}
                <div className="divide-y divide-slate-200 border-t border-slate-200">
                  {domain.thinkers.map((thinker, tIdx) => {
                    const tKey = `${domain.id}-${tIdx}`;
                    const isEditingThinker = editingThinkerKey === tKey;

                    return (
                      <div
                        key={tKey}
                        className="py-4 first:pt-4 last:pb-0 space-y-2"
                      >
                        {isEditingThinker ? (
                          <div className="space-y-2 p-3 bg-slate-50 border border-slate-200 rounded-lg">
                            <div className="grid grid-cols-1 sm:grid-cols-2 gap-2">
                              <input
                                type="text"
                                value={thinker.name}
                                onChange={(e) =>
                                  handleUpdateThinker(domain, tIdx, {
                                    name: e.target.value,
                                  })
                                }
                                placeholder="اسم المفكر"
                                className="px-2.5 py-1.5 text-xs bg-white border border-slate-300 rounded-md"
                              />
                              <input
                                type="text"
                                value={thinker.role}
                                onChange={(e) =>
                                  handleUpdateThinker(domain, tIdx, {
                                    role: e.target.value,
                                  })
                                }
                                placeholder="الدور المنهجي"
                                className="px-2.5 py-1.5 text-xs bg-white border border-slate-300 rounded-md"
                              />
                            </div>
                            <input
                              type="text"
                              value={thinker.keyWorks.join('، ')}
                              onChange={(e) =>
                                handleUpdateThinker(domain, tIdx, {
                                  keyWorks: e.target.value
                                    .split('،')
                                    .map((s) => s.trim())
                                    .filter(Boolean),
                                })
                              }
                              placeholder="الأعمال (افصل بفاصلة عربية ،)"
                              className="w-full px-2.5 py-1.5 text-xs bg-white border border-slate-300 rounded-md"
                            />
                            <textarea
                              rows={2}
                              value={thinker.contribution}
                              onChange={(e) =>
                                handleUpdateThinker(domain, tIdx, {
                                  contribution: e.target.value,
                                })
                              }
                              placeholder="الأثر المعرفي..."
                              className="w-full px-2.5 py-1.5 text-xs bg-white border border-slate-300 rounded-md"
                            />
                            <button
                              type="button"
                              onClick={() => setEditingThinkerKey(null)}
                              className="px-3 py-1 text-xs font-medium text-white bg-[#1E3A5F] rounded-md cursor-pointer"
                            >
                              تم
                            </button>
                          </div>
                        ) : (
                          <>
                            <div className="flex flex-wrap items-baseline justify-between gap-2">
                              <div className="flex items-baseline gap-2">
                                <h3 className="text-base font-semibold text-slate-900">
                                  {thinker.name}
                                </h3>
                                <span className="text-xs text-slate-500">
                                  {thinker.role}
                                </span>
                              </div>
                              {canEdit && (
                                <div className="flex items-center gap-1">
                                  <button
                                    type="button"
                                    onClick={() => setEditingThinkerKey(tKey)}
                                    aria-label={`تعديل ${thinker.name}`}
                                    className="p-1 text-slate-400 hover:text-[#1E3A5F] cursor-pointer"
                                  >
                                    <Edit3 className="w-3 h-3" aria-hidden="true" />
                                  </button>
                                  <button
                                    type="button"
                                    onClick={() => handleDeleteThinker(domain, tIdx)}
                                    aria-label={`حذف ${thinker.name}`}
                                    className="p-1 text-slate-400 hover:text-red-600 cursor-pointer"
                                  >
                                    <Trash2 className="w-3 h-3" aria-hidden="true" />
                                  </button>
                                </div>
                              )}
                            </div>
                            <p className="text-xs text-slate-600 leading-relaxed">
                              {thinker.contribution}
                            </p>
                            {thinker.keyWorks.length > 0 && (
                              <div className="flex items-start gap-2 pt-1 text-xs text-slate-700">
                                <BookMarked
                                  className="w-3.5 h-3.5 text-[#1E3A5F] mt-0.5 shrink-0"
                                  aria-hidden="true"
                                />
                                <span>{thinker.keyWorks.join(' · ')}</span>
                              </div>
                            )}
                          </>
                        )}
                      </div>
                    );
                  })}
                </div>

                {/* Add Thinker Inline Form */}
                {isAddingThinker && (
                  <form
                    onSubmit={(e) => handleCreateThinker(e, domain)}
                    className="p-3.5 bg-slate-50 border border-slate-200 rounded-lg space-y-2.5"
                  >
                    <p className="text-xs font-semibold text-slate-800">
                      إضافة مفكر أو أديب جديد في هذا المحور
                    </p>
                    <div className="grid grid-cols-1 sm:grid-cols-2 gap-2">
                      <input
                        type="text"
                        required
                        value={thinkerName}
                        onChange={(e) => setThinkerName(e.target.value)}
                        placeholder="الاسم..."
                        className="px-2.5 py-1.5 text-xs bg-white border border-slate-300 rounded-md"
                      />
                      <input
                        type="text"
                        value={thinkerRole}
                        onChange={(e) => setThinkerRole(e.target.value)}
                        placeholder="التخصص / الدور..."
                        className="px-2.5 py-1.5 text-xs bg-white border border-slate-300 rounded-md"
                      />
                    </div>
                    <input
                      type="text"
                      value={thinkerWorks}
                      onChange={(e) => setThinkerWorks(e.target.value)}
                      placeholder="أبرز الكتب (افصل بفاصلة عربية ،)..."
                      className="w-full px-2.5 py-1.5 text-xs bg-white border border-slate-300 rounded-md"
                    />
                    <input
                      type="text"
                      value={thinkerContribution}
                      onChange={(e) => setThinkerContribution(e.target.value)}
                      placeholder="الأثر في بناء الوعي..."
                      className="w-full px-2.5 py-1.5 text-xs bg-white border border-slate-300 rounded-md"
                    />
                    <div className="flex gap-2">
                      <button
                        type="submit"
                        className="px-3 py-1.5 text-xs font-medium text-white bg-[#1E3A5F] rounded-md cursor-pointer"
                      >
                        حفظ المفكر
                      </button>
                      <button
                        type="button"
                        onClick={() => setAddingThinkerDomainId(null)}
                        className="px-3 py-1.5 text-xs text-slate-600 bg-slate-200 rounded-md cursor-pointer"
                      >
                        إلغاء
                      </button>
                    </div>
                  </form>
                )}
              </div>

              <div className="pt-4 border-t border-slate-100 flex flex-wrap items-center justify-between gap-3">
                <div className="flex items-center gap-3">
                  {canEdit && (
                    <button
                      type="button"
                      onClick={() =>
                        setAddingThinkerDomainId(
                          isAddingThinker ? null : domain.id
                        )
                      }
                      className="inline-flex items-center gap-1 text-xs font-medium text-slate-700 hover:text-[#1E3A5F] cursor-pointer"
                    >
                      <UserPlus className="w-3.5 h-3.5" aria-hidden="true" />
                      <span>+ إضافة مفكر</span>
                    </button>
                  )}
                  {monthCount > 0 && (
                    <span className="text-xs text-slate-400 tabular-nums">
                      · {monthCount} {monthCount === 1 ? 'شهر' : 'أشهر'}
                    </span>
                  )}
                </div>

                <button
                  type="button"
                  onClick={() => onFilterMonthsByDomain(domain.id)}
                  className="inline-flex items-center gap-1.5 text-xs font-semibold text-[#1E3A5F] hover:underline cursor-pointer"
                >
                  <span>عرض الأشهر المرتبطة</span>
                  <ArrowLeft className="w-3.5 h-3.5" aria-hidden="true" />
                </button>
              </div>
            </section>
          );
        })}
      </div>
    </div>
  );
}
