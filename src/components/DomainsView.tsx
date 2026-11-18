import { ArrowLeft, BookMarked } from 'lucide-react';
import { DOMAINS, DomainId, MonthPlan } from '../data/curriculumData';

interface DomainsViewProps {
  months: MonthPlan[];
  onFilterMonthsByDomain: (domainId: DomainId) => void;
}

export default function DomainsView({
  months,
  onFilterMonthsByDomain,
}: DomainsViewProps) {
  return (
    <div className="space-y-8">
      <div className="bg-white border border-slate-200 rounded-xl p-6 sm:p-8 flex flex-col md:flex-row md:items-end justify-between gap-4">
        <div className="space-y-2 max-w-3xl">
          <p className="text-xs text-slate-500">
            التوزيع المعرفي المعتمد · 6 محاور متكاملة
          </p>
          <h1 className="font-editorial text-3xl font-bold text-slate-900">
            المحاور الفكرية والمفكرون المعتمدون
          </h1>
          <p className="text-sm text-slate-600 leading-relaxed">
            تم اعتماد التعديلات المطلوبة في الخطة: إسناد محور المجتمع والتاريخ إلى <strong className="text-slate-900 font-semibold">جمال حمدان</strong> مع مالك بن نبي وابن خلدون، وإسناد محور الأدب والسير إلى <strong className="text-slate-900 font-semibold">مصطفى صادق الرافعي</strong> مع غازي القصيبي والتجارب الإنسانية المتنوعة.
          </p>
        </div>
      </div>

      <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
        {DOMAINS.map((domain, index) => {
          const monthCount = months.filter(
            (m) =>
              m.foundational.domainId === domain.id ||
              m.exploratory.domainId === domain.id
          ).length;

          return (
            <section
              key={domain.id}
              className="bg-white border border-slate-200 rounded-xl p-6 sm:p-7 flex flex-col justify-between gap-6"
            >
              <div className="space-y-4">
                <div className="flex items-start justify-between gap-4">
                  <div className="space-y-1">
                    <div className="flex items-center gap-2 text-xs text-slate-500 tabular-nums">
                      <span>0{index + 1}.</span>
                      <span>{domain.subtitle}</span>
                    </div>
                    <h2 className="font-editorial text-2xl font-bold text-slate-900">
                      {domain.title}
                    </h2>
                  </div>

                  {monthCount > 0 && (
                    <span className="text-xs text-slate-500 tabular-nums whitespace-nowrap shrink-0 pt-1">
                      حاضر في {monthCount} {monthCount === 1 ? 'شهر' : 'أشهر'}
                    </span>
                  )}
                </div>

                <p className="text-sm text-slate-600 leading-relaxed">
                  {domain.purpose}
                </p>

                <div className="divide-y divide-slate-200 border-t border-slate-200">
                  {domain.thinkers.map((thinker) => (
                    <div key={thinker.name} className="py-4 first:pt-4 last:pb-0 space-y-1.5">
                      <div className="flex flex-wrap items-baseline justify-between gap-2">
                        <h3 className="text-base font-semibold text-slate-900">
                          {thinker.name}
                        </h3>
                        <span className="text-xs text-slate-500">
                          {thinker.role}
                        </span>
                      </div>
                      <p className="text-xs text-slate-600 leading-relaxed">
                        {thinker.contribution}
                      </p>
                      <div className="flex items-start gap-2 pt-1 text-xs text-slate-700">
                        <BookMarked
                          className="w-3.5 h-3.5 text-[#1E3A5F] mt-0.5 shrink-0"
                          aria-hidden="true"
                        />
                        <span>{thinker.keyWorks.join(' · ')}</span>
                      </div>
                    </div>
                  ))}
                </div>
              </div>

              <div className="pt-4 border-t border-slate-100 flex items-center justify-between">
                <button
                  type="button"
                  onClick={() => onFilterMonthsByDomain(domain.id)}
                  className="inline-flex items-center gap-1.5 text-xs font-semibold text-[#1E3A5F] hover:underline cursor-pointer"
                >
                  <span>عرض الأشهر المرتبطة بهذا المحور</span>
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
