import type { JournalQuoteMeta, UserQuoteItem } from '../data/curriculumData';

interface QuoteTemplate {
  text: string;
  author: string;
  theme: string;
}

export interface QuoteColorTheme {
  key: string;
  label: string;
  cardClass: string;
  accentTextClass: string;
  swatchClass: string;
}

export const QUOTE_COLOR_THEMES: Record<string, QuoteColorTheme> = {
  amber: {
    key: 'amber',
    label: 'عنبري دافئ',
    cardClass: 'bg-amber-50/75 border-amber-200/80',
    accentTextClass: 'text-amber-700',
    swatchClass: 'bg-amber-100 border-amber-300',
  },
  navy: {
    key: 'navy',
    label: 'أزرق معرفي',
    cardClass: 'bg-sky-50/70 border-sky-200/80',
    accentTextClass: 'text-[#1E3A5F]',
    swatchClass: 'bg-sky-100 border-sky-300',
  },
  sage: {
    key: 'sage',
    label: 'أخضر هادئ',
    cardClass: 'bg-emerald-50/70 border-emerald-200/80',
    accentTextClass: 'text-emerald-700',
    swatchClass: 'bg-emerald-100 border-emerald-300',
  },
  lavender: {
    key: 'lavender',
    label: 'بنفسجي ناعم',
    cardClass: 'bg-violet-50/70 border-violet-200/80',
    accentTextClass: 'text-violet-700',
    swatchClass: 'bg-violet-100 border-violet-300',
  },
  rose: {
    key: 'rose',
    label: 'وردي دافئ',
    cardClass: 'bg-rose-50/70 border-rose-200/80',
    accentTextClass: 'text-rose-700',
    swatchClass: 'bg-rose-100 border-rose-300',
  },
  slate: {
    key: 'slate',
    label: 'رمادي كلاسيكي',
    cardClass: 'bg-slate-50/90 border-slate-200',
    accentTextClass: 'text-slate-700',
    swatchClass: 'bg-slate-200 border-slate-300',
  },
};

export const PERSONAL_GROWTH_QUOTES: QuoteTemplate[] = [
  {
    text: 'الخطوة الصغيرة المستمرة كل يوم تصنع فارقًا لا تستطيعه الاندفاعات المؤقتة.',
    author: 'جيمس كلير',
    theme: 'الاستمرارية والعادات',
  },
  {
    text: 'ما تقرأه أو تتعلمه اليوم يصبح طريقة تفكيرك في المواقف الصعبة غدًا.',
    author: 'حكمة في التعلّم',
    theme: 'التعلّم العميق',
  },
  {
    text: 'لا تطلب سرعة النتائج قبل أن تستكمل جذور الفهم والممارسة.',
    author: 'ابن الجوزي',
    theme: 'الصبر والبناء',
  },
  {
    text: 'الوضوح في تحديد أولوية واحدة لليوم يغنيك عن انشغال عشر مهام متفرقة.',
    author: 'جريج ماكيون',
    theme: 'التركيز والوضوح',
  },
  {
    text: 'الكتابة في نهاية اليوم تحوّل التجارب العابرة إلى حكمة قابلة للاسترجاع.',
    author: 'آنايس نين',
    theme: 'التدوين والوعي',
  },
  {
    text: 'أنت لا ترتفع إلى مستوى أهدافك، بل تهبط إلى مستوى أنظمتك اليومية.',
    author: 'جيمس كلير',
    theme: 'الأنظمة والانضباط',
  },
  {
    text: 'السؤال الجيد الذي تسأله لنفسك كل مساء يختصر سنوات من الدوران في نفس الدائرة.',
    author: 'تأمل شخصي',
    theme: 'المراجعة الذاتية',
  },
  {
    text: 'قيمة المعرفة الحقيقية تظهر حين تنعكس في أسلوب عملك وقراراتك لا في عدد ما قرأته.',
    author: 'بيتر دراكر',
    theme: 'التطبيق العملي',
  },
  {
    text: 'الهدوء الذهني ليس فراغًا من المسؤوليات، بل حضورٌ كامل لما بين يديك الآن.',
    author: 'ماركوس أوريليوس',
    theme: 'الهدوء والوعي',
  },
  {
    text: 'لا تقارن بدايتك الهادئة بذروة غيرك؛ قارن يومك بأمسك.',
    author: 'حكمة في النمو',
    theme: 'النمو الشخصي',
  },
  {
    text: 'كل مهارة متقنة كانت يومًا ما محاولةً مترددة لم يتوقف صاحبها عن تكرارها.',
    author: 'روبرت غرين',
    theme: 'الإتقان',
  },
  {
    text: 'الإنجاز المتزن يحترم طاقتك البشرية بقدر ما يحترم طموحك.',
    author: 'أوليفر بيركمان',
    theme: 'التوازن',
  },
  {
    text: 'من يراقب أفكاره ويحاسب يومه بلطف يصبح أكثر قدرة على توجيه مستقبله.',
    author: 'سينيكا',
    theme: 'الوعي الذاتي',
  },
  {
    text: 'التفكير العميق يحتاج مساحة صمت؛ لا تملأ كل فراغ في يومك بالضجيج.',
    author: 'كال نيوبورت',
    theme: 'العمل العميق',
  },
  {
    text: 'ما لا يُقاس أو يُكتب في يومك يسهل أن يتسرب من ذاكرتك دون أثر.',
    author: 'مبدأ في الإنتاجية',
    theme: 'التوثيق',
  },
  {
    text: 'المرونة الحقيقية أن تعيد ترتيب خطتك عند التعثر دون أن تتخلى عن وجهتك.',
    author: 'حكمة عملية',
    theme: 'المرونة',
  },
  {
    text: 'ساعة واحدة من التعلّم المركز الصادق أعمق أثرًا من يومٍ كامل من التشتت.',
    author: 'كال نيوبورت',
    theme: 'جودة الانتباه',
  },
  {
    text: 'الامتنان لما أنجزته اليوم — مهما بدا يسيرًا — يمنحك وقودًا هادئًا للغد.',
    author: 'تأمل يومي',
    theme: 'الامتنان',
  },
  {
    text: 'نضج العقل يبدأ عندما تقبل أن تتعلم من أخطائك دون قسوة مفرطة على نفسك.',
    author: 'كارول دويك',
    theme: 'عقلية النمو',
  },
  {
    text: 'المعرفة غير المنظمة عبء على الذاكرة، أما التلخيص الشخصي فيحولها إلى أداة حية.',
    author: 'تياغو فورتي',
    theme: 'تنظيم المعرفة',
  },
  {
    text: 'ليس المطلوب أن يكون اليوم مثاليًا؛ يكفي أن يكون خطوة صادقة للأمام.',
    author: 'حكمة يومية',
    theme: 'الاستمرارية',
  },
  {
    text: 'احمِ أول ساعة في يومك من التشتت، فغالبًا ما ترسم إيقاع اليوم كله.',
    author: 'روبن شارما',
    theme: 'بداية اليوم',
  },
  {
    text: 'التركيز الحقيقي لا يعني قول نعم لما يهمك فحسب، بل قول لا لعشرات المشتتات.',
    author: 'ستيف جوبز',
    theme: 'التركيز',
  },
  {
    text: 'الإنسان يتغير حين يغيّر بيئته اليومية وأسئلته المعتادة قبل أن يجبر إرادته.',
    author: 'جيمس كلير',
    theme: 'تصميم البيئة',
  },
  {
    text: 'التكرار الواعي مع التغذية الراجعة هو الجسر الأقصر بين الفهم والمهارة.',
    author: 'أندرس إريكسون',
    theme: 'الممارسة المتعمدة',
  },
  {
    text: 'توقّف قليلًا لتفهم أين أنت، فالمسير السريع في اتجاه غير مقصود يضاعف التعب.',
    author: 'ستيفن كوفي',
    theme: 'البوصلة الشخصية',
  },
  {
    text: 'الكتب الجيدة لا تمنحك إجابات جاهزة بقدر ما توسّع أفق الأسئلة التي تطرحها.',
    author: 'مرتيمر أدلر',
    theme: 'القراءة الواعية',
  },
  {
    text: 'العادة التي تبدأ بدقيقتين أصدق من خطة مثالية لا تبدأ أبدًا.',
    author: 'جيمس كلير',
    theme: 'البدء البسيط',
  },
  {
    text: 'الصحة النفسية والصفاء الذهني شريكان أساسيان في كل مشروع معرفي طويل النفس.',
    author: 'تأمل متزن',
    theme: 'التوازن الشخصي',
  },
  {
    text: 'اجعل لكل فكرة تمر بك مكانًا تحفظها فيه، فالأفكار العظيمة تأتي غالبًا في أوقات عابرة.',
    author: 'ديفيد ألين',
    theme: 'التقاط الأفكار',
  },
  {
    text: 'عندما تربط ما تتعلمه اليوم بمشروع عملي حقيقي، تثبت المعلومة وتنمو الثقة.',
    author: 'حكمة في التطبيق',
    theme: 'التعلّم بالممارسة',
  },
  {
    text: 'النجاح الطويل الأمد يُبنى في الأيام العادية التي لا يصفّق فيها أحد.',
    author: 'ماركوس أوريليوس',
    theme: 'الرسوخ',
  },
  {
    text: 'كن فضوليًا مثل المبتدئ، ومنضبطًا مثل المحترف، ولطيفًا مع نفسك مثل الحكيم.',
    author: 'تأمل معرفي',
    theme: 'عقلية النمو',
  },
  {
    text: 'أكبر عدو للتقدّم المستمر هو انتظار اللحظة المثالية التي لا تأتي أبدًا.',
    author: 'آرثر آش',
    theme: 'المبادرة',
  },
  {
    text: 'مراجعة الأسبوع تمنحك رؤية طائر لما أنجزته وما يحتاج تعديلًا قبل أن يتراكم.',
    author: 'ديفيد ألين',
    theme: 'المراجعة الدورية',
  },
  {
    text: 'كل صفحة تلخّصها بأسلوبك الخاص هي حجر جديد في بناء عقليتك المستقلة.',
    author: 'مبدأ معرفي',
    theme: 'التلخيص الشخصي',
  },
];

function hashDateKey(dateKey: string): number {
  let h = 2166136261;
  for (let i = 0; i < dateKey.length; i += 1) {
    h ^= dateKey.charCodeAt(i);
    h = Math.imul(h, 16777619);
  }
  return h >>> 0;
}

export function getPersonalGrowthQuoteForDate(
  dateKey: string,
  offset = 0
): JournalQuoteMeta {
  const safeOffset = Math.max(0, Math.floor(offset));
  const idx =
    (hashDateKey(dateKey || '2026-01-01') + safeOffset) %
    PERSONAL_GROWTH_QUOTES.length;
  const tpl = PERSONAL_GROWTH_QUOTES[idx];
  return {
    text: tpl.text,
    author: tpl.author,
    theme: tpl.theme,
    dateKey,
  };
}

export function pickNextPersonalGrowthQuote(
  dateKey: string,
  currentText?: string
): JournalQuoteMeta {
  const currentIdx = PERSONAL_GROWTH_QUOTES.findIndex(
    (q) => q.text === currentText
  );
  const nextIdx =
    currentIdx >= 0
      ? (currentIdx + 1) % PERSONAL_GROWTH_QUOTES.length
      : (hashDateKey(dateKey) + 1) % PERSONAL_GROWTH_QUOTES.length;
  const tpl = PERSONAL_GROWTH_QUOTES[nextIdx];
  return {
    text: tpl.text,
    author: tpl.author,
    theme: tpl.theme,
    dateKey,
    savedAtMs: Date.now(),
  };
}

export function resolveEffectiveDailyQuote(params: {
  dateKey: string;
  journalQuote?: JournalQuoteMeta;
  quotesLibrary?: UserQuoteItem[];
  pinnedDailyQuoteId?: string | null;
}): {
  quote: JournalQuoteMeta;
  customQuote?: UserQuoteItem;
  isPinnedFromLibrary: boolean;
} {
  const library = params.quotesLibrary || [];
  if (params.pinnedDailyQuoteId) {
    const pinned = library.find((q) => q.id === params.pinnedDailyQuoteId);
    if (pinned) {
      return {
        quote: {
          text: pinned.text,
          author: pinned.author,
          theme: pinned.theme || 'اقتباسي',
          dateKey: params.dateKey,
          savedAtMs: pinned.updatedAtMs,
        },
        customQuote: pinned,
        isPinnedFromLibrary: true,
      };
    }
  }
  const datedCustom = library.find(
    (q) => q.isDailyPinned || q.dateKey === params.dateKey
  );
  if (datedCustom && !params.journalQuote?.text) {
    return {
      quote: {
        text: datedCustom.text,
        author: datedCustom.author,
        theme: datedCustom.theme || 'اقتباسي',
        dateKey: params.dateKey,
        savedAtMs: datedCustom.updatedAtMs,
      },
      customQuote: datedCustom,
      isPinnedFromLibrary: Boolean(datedCustom.isDailyPinned),
    };
  }
  if (params.journalQuote?.text) {
    const matching = library.find((q) => q.text === params.journalQuote?.text);
    return {
      quote: params.journalQuote,
      customQuote: matching,
      isPinnedFromLibrary: false,
    };
  }
  return {
    quote: getPersonalGrowthQuoteForDate(params.dateKey),
    isPinnedFromLibrary: false,
  };
}

export function rotateDailyQuoteFromLibrary(
  dateKey: string,
  currentText: string | undefined,
  quotesLibrary: UserQuoteItem[] = []
): { quote: JournalQuoteMeta; customQuote?: UserQuoteItem } {
  const combined: Array<{
    text: string;
    author: string;
    theme: string;
    custom?: UserQuoteItem;
  }> = [
    ...quotesLibrary.map((q) => ({
      text: q.text,
      author: q.author,
      theme: q.theme || 'اقتباسي',
      custom: q,
    })),
    ...PERSONAL_GROWTH_QUOTES.map((q) => ({
      text: q.text,
      author: q.author,
      theme: q.theme,
    })),
  ];

  const idx = combined.findIndex((item) => item.text === currentText);
  const next =
    idx >= 0
      ? combined[(idx + 1) % combined.length]
      : combined[(hashDateKey(dateKey) + 1) % combined.length];

  return {
    quote: {
      text: next.text,
      author: next.author,
      theme: next.theme,
      dateKey,
      savedAtMs: Date.now(),
    },
    customQuote: next.custom,
  };
}

