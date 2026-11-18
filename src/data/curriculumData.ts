export type DomainId =
  | 'islamic_thought'
  | 'philosophy'
  | 'psychology'
  | 'society_history'
  | 'literature_biographies'
  | 'personal_dev';

export type MonthStatus = 'not_started' | 'in_progress' | 'completed';

export type ResourceFormat = 'كتاب' | 'سلسلة محاضرات' | 'كتاب + محاضرات';

export interface TrackItem {
  title: string;
  author: string;
  format: ResourceFormat;
  domainId: DomainId;
  pace: string;
  focus: string;
}

export interface MonthActivities {
  reading: boolean;
  listening: boolean;
  summarizing: boolean;
  discussing: boolean;
}

export interface MonthPlan {
  id: number;
  quarter: 1 | 2 | 3 | 4;
  quarterTitle: string;
  theme: string;
  foundational: TrackItem;
  exploratory: TrackItem;
  courseId: number;
  discussionPrompt: string;
  applicationTask: string;
  activities: MonthActivities;
  status: MonthStatus;
  notes: string;
}

export interface ThinkerInfo {
  name: string;
  role: string;
  keyWorks: string[];
  contribution: string;
}

export interface DomainInfo {
  id: DomainId;
  title: string;
  subtitle: string;
  purpose: string;
  thinkers: ThinkerInfo[];
}

export interface PersonalCourse {
  id: number;
  title: string;
  category: string;
  linkedMonths: number[];
  complementaryBook: string;
  bookAuthor: string;
  applicationMilestone: string;
  completed: boolean;
}

export interface WeeklyRhythmSlot {
  id: string;
  pillar: string;
  suggestedDuration: string;
  focus: string;
  guideline: string;
}

export const HERO_IMAGE_PATH = '/src/assets/images/editorial_study_library_1795029579941.jpg';

export const DOMAINS: DomainInfo[] = [
  {
    id: 'islamic_thought',
    title: 'الفكر الإسلامي وبناء المنهج',
    subtitle: 'التأسيس العقدي، قراءة الوحي، ونقد الخطاب المعاصر',
    purpose: 'بناء مرجعية راسخة تجمع بين عمق التراث وفهم أسئلة العصر وإشكالاته الفكرية.',
    thinkers: [
      {
        name: 'أحمد بن يوسف السيد',
        role: 'البناء المنهجي وتدبر الوحي',
        keyWorks: ['البوصلة القرآنية', 'سلسلة البناء المنهجي', 'المسلكيات'],
        contribution: 'تأسيس خارطة طريق متدرجة لطالب العلم والمثقف المسلم بعيدًا عن العشوائية.',
      },
      {
        name: 'إبراهيم السكران',
        role: 'تحليل الخطاب والفكر الرقائقي',
        keyWorks: ['الطريق إلى القرآن', 'رقائق القرآن', 'مآلات الخطاب المدني'],
        contribution: 'الربط بين التزكية القلبية والصلابة المنهجية في تحليل النصوص والواقع.',
      },
      {
        name: 'عبدالله العجيري',
        role: 'الفلسفة العقدية ونقد الإلحاد',
        keyWorks: ['شموع النهار', 'ميليشيا الإلحاد', 'خرافة السر'],
        contribution: 'مناقشة الأسئلة الوجودية والشكوك المعاصرة بأسلوب عقلي منضبط.',
      },
      {
        name: 'سلطان العميري',
        role: 'تأصيل القضايا الفكرية والحريات',
        keyWorks: ['الظاهرة الإلحادية الحديثة', 'فضاءات الحرية', 'محاضرات التأسيس العقدي'],
        contribution: 'تفكيك المقولات الفلسفية والحداثية وبيان أصولها النظرية.',
      },
    ],
  },
  {
    id: 'philosophy',
    title: 'التفكير والفلسفة',
    subtitle: 'التفكير العلمي، تجديد العقل، ونقد النماذج المعرفية',
    purpose: 'صقل أدوات التحليل المنطقي، والتمييز بين العلم والانطباع، واكتشاف التحيزات الخفية في الأفكار.',
    thinkers: [
      {
        name: 'فؤاد زكريا',
        role: 'فلسفة العلم والتفكير النقدي',
        keyWorks: ['التفكير العلمي', 'آراء نقدية في مشكلات الفكر والثقافة'],
        contribution: 'ترسيخ قواعد التفكير العلمي الموضوعي في مقاربة الظواهر الثقافية.',
      },
      {
        name: 'زكي نجيب محمود',
        role: 'المنطق وتجديد الفكر العربي',
        keyWorks: ['تجديد الفكر العربي', 'المعقول واللامعقول في تراثنا الفكري', 'قصة عقل'],
        contribution: 'موازنة العقلانية المعاصرة مع قراءة التراث العربي قراءة تحليلية ناقدة.',
      },
      {
        name: 'عبد الوهاب المسيري',
        role: 'النموذج المعرفي وإشكالية التحيز',
        keyWorks: ['رحلتي الفكرية', 'إشكالية التحيز', 'العلمانية الجزئية والعلمانية الشاملة'],
        contribution: 'تعليم كيفية النظر إلى ما وراء المفاهيم والمصطلحات لكشف الرؤية الكونية الكامنة.',
      },
    ],
  },
  {
    id: 'psychology',
    title: 'علم النفس وفهم الذات',
    subtitle: 'البحث عن المعنى، الحرية النفسية، وانحيازات العقل',
    purpose: 'فهم النفس البشرية وآليات اتخاذ القرار والمشاعر، مما يحوّل المعرفة إلى وعي ذاتي سليم.',
    thinkers: [
      {
        name: 'فيكتور فرانكل',
        role: 'العلاج بالمعنى',
        keyWorks: ['الإنسان يبحث عن المعنى'],
        contribution: 'تأسيس فكرة أن المعنى والغاية هما المحرك الأعمق لصمود الإنسان.',
      },
      {
        name: 'إريك فروم',
        role: 'التحليل النفسي الاجتماعي',
        keyWorks: ['فن الحب', 'الخوف من الحرية', 'الإنسان بين الجوهر والمظهر'],
        contribution: 'تحليل علاقة الفرد بالحرية والانتماء والنضج العاطفي بعيدًا عن الاستهلاك.',
      },
      {
        name: 'دانيال كانيمان',
        role: 'علم النفس المعرفي واقتصاد السلوك',
        keyWorks: ['التفكير السريع والبطيء'],
        contribution: 'كشف الأخطاء الإدراكية والتحيزات اللاواعية في أحكامنا اليومية.',
      },
    ],
  },
  {
    id: 'society_history',
    title: 'المجتمع والتاريخ',
    subtitle: 'جغرافية المكان، سنن الحضارة، وفقه العمران',
    purpose: 'فهم القوانين العميقة التي تحكم نهضة المجتمعات وتراجعها، وتأثير الجغرافيا والتاريخ في الواقع.',
    thinkers: [
      {
        name: 'جمال حمدان',
        role: 'الجغرافيا التاريخية وفلسفة المكان',
        keyWorks: ['شخصية مصر: دراسة في عبقرية المكان', 'استراتيجية الاستعمار والتحرير'],
        contribution: 'قراءة التكوين الحضاري والاجتماعي للمكان بوصفه مفتاحًا لفهم الحاضر والمستقبل.',
      },
      {
        name: 'مالك بن نبي',
        role: 'فلسفة الحضارة ومشكلات النهضة',
        keyWorks: ['شروط النهضة', 'مشكلة الأفكار في العالم الإسلامي', 'وجهة العالم الإسلامي'],
        contribution: 'تشخيص أزمة الحضارة باعتبارها أزمة أفكار وإنسان وتوجيه للطاقات قبل الإمكانات المادية.',
      },
      {
        name: 'ابن خلدون',
        role: 'علم العمران البشري وفلسفة التاريخ',
        keyWorks: ['مقدمة ابن خلدون (مختارات مشروحة)'],
        contribution: 'اكتشاف السنن الاجتماعية والعصبية وأطوار الدول ومنهج نقد الرواية التاريخية.',
      },
    ],
  },
  {
    id: 'literature_biographies',
    title: 'الأدب والسير',
    subtitle: 'بيان العربية، التجربة الإدارية، والرحلات الإنسانية',
    purpose: 'تهذيب الذائقة اللغوية والوجدانية، والاطلاع على التجارب الإنسانية الحية في الإدارة والتحولات الفكرية.',
    thinkers: [
      {
        name: 'مصطفى صادق الرافعي',
        role: 'مدرسة البيان والأدب الرفيع',
        keyWorks: ['وحي القلم', 'تحت راية القرآن', 'تاريخ آداب العرب'],
        contribution: 'بناء الملكة اللغوية الراقية وربط الجمال البياني بالقيم الفكرية والروحية.',
      },
      {
        name: 'غازي القصيبي',
        role: 'أدب السيرة والتجربة الإدارية',
        keyWorks: ['حياة في الإدارة', 'سبعة', 'أبو شلاخ البرمائي'],
        contribution: 'نقل خلاصة تجربة قيادية وإدارية واقعية بلغة أدبية ساخرة ورشيقة.',
      },
      {
        name: 'تجارب إنسانية متنوعة',
        role: 'سير رحلات وتحولات عالمية',
        keyWorks: ['الطريق إلى مكة — محمد أسد', 'رحلة جبلية رحلة صعبة — فدوى طوقان'],
        contribution: 'توسيع الأفق الإنساني عبر معايشة تحولات الآخرين الفكرية والروحية والثقافية.',
      },
    ],
  },
  {
    id: 'personal_dev',
    title: 'التطوير الشخصي والكورسات الستة',
    subtitle: 'تحويل الأفكار إلى مهارات يومية ومشاريع عملية',
    purpose: 'منع الانفصال بين الثقافة النظرية والواقع العملي عبر ربط الكورسات الستة بمراجع عميقة.',
    thinkers: [
      {
        name: 'الكورسات الستة المشترك فيها',
        role: 'مسار التطبيق والمهارات',
        keyWorks: ['ربط كل كورس بمرجع مكمل', 'مشاريع تطبيقية شهرية'],
        contribution: 'ضمان خروج كل شهر بخطوة عملية ملموسة في التفكير أو الإنتاجية أو التواصل.',
      },
    ],
  },
];

export const INITIAL_COURSES: PersonalCourse[] = [
  {
    id: 1,
    title: 'الكورس 1: مهارات التعلم الفعّال وإدارة المعرفة',
    category: 'التعلم والإنتاجية',
    linkedMonths: [1, 2],
    complementaryBook: 'مفاتيح القراءة المثمرة ومنهجية التلخيص',
    bookAuthor: 'مرجع مكمل: أحمد بن يوسف السيد (البوصلة القرآنية)',
    applicationMilestone: 'بناء نظام بطاقات التلخيص (Zettelkasten / دفاتر القراءة) لأول شهرين.',
    completed: false,
  },
  {
    id: 2,
    title: 'الكورس 2: التفكير النقدي وحل المشكلات',
    category: 'المهارات العقلية',
    linkedMonths: [3, 4],
    complementaryBook: 'التفكير العلمي + فن الاستدلال',
    bookAuthor: 'مرجع مكمل: فؤاد زكريا وعبدالله العجيري',
    applicationMilestone: 'تحليل مقالتين معاصرتين وتفكيك المقدمات والنتائج فيهما كتابيًا.',
    completed: false,
  },
  {
    id: 3,
    title: 'الكورس 3: الذكاء العاطفي وإدارة الضغوط',
    category: 'النفس والعلاقات',
    linkedMonths: [5, 8],
    complementaryBook: 'الإنسان يبحث عن المعنى + فن الحب',
    bookAuthor: 'مرجع مكمل: فيكتور فرانكل وإريك فروم',
    applicationMilestone: 'تدوين مواقف القرارات السريعة والبطيئة أسبوعيًا وملاحظة الانحيازات.',
    completed: false,
  },
  {
    id: 4,
    title: 'الكورس 4: القيادة والإدارة التنفيذية',
    category: 'الإدارة والعمل',
    linkedMonths: [6, 7],
    complementaryBook: 'حياة في الإدارة',
    bookAuthor: 'مرجع مكمل: غازي القصيبي',
    applicationMilestone: 'استخلاص 5 مبادئ قيادية واقعية وتطبيق أحدها في مشروع أو فريق عمل.',
    completed: false,
  },
  {
    id: 5,
    title: 'الكورس 5: مهارات التواصل والبيان والإقناع',
    category: 'التواصل والكتابة',
    linkedMonths: [9, 10],
    complementaryBook: 'مختارات من وحي القلم + مشكلة الأفكار',
    bookAuthor: 'مرجع مكمل: مصطفى صادق الرافعي ومالك بن نبي',
    applicationMilestone: 'كتابة مقال نقدي أو عرض صوتي لملخص كتاب بلغة عربية سليمة ومقنعة.',
    completed: false,
  },
  {
    id: 6,
    title: 'الكورس 6: التخطيط الاستراتيجي وبناء المشاريع',
    category: 'التخطيط والمستقبل',
    linkedMonths: [11, 12],
    complementaryBook: 'شخصية مصر (مختارات) + شروط النهضة',
    bookAuthor: 'مرجع مكمل: جمال حمدان ومالك بن نبي',
    applicationMilestone: 'إعداد وثيقة الحصاد السنوي ورسم خطة السنة الثانية بناءً على الفجوات.',
    completed: false,
  },
];

export const INITIAL_MONTHS: MonthPlan[] = [
  {
    id: 1,
    quarter: 1,
    quarterTitle: 'الربع الأول: التأسيس المنهجي وبوصلة العقل والذات',
    theme: 'كيف نبني المنهج قبل كثرة المحفوظات؟',
    foundational: {
      title: 'البوصلة القرآنية + محاضرات البناء المنهجي',
      author: 'أحمد بن يوسف السيد',
      format: 'كتاب + محاضرات',
      domainId: 'islamic_thought',
      pace: '30 صفحة أسبوعيًا + محاضرتان قصيرتان',
      focus: 'رسم خارطة القراءة الصحيحة وترتيب الأولويات المعرفية.',
    },
    exploratory: {
      title: 'التفكير العلمي (الفصول التأسيسية)',
      author: 'فؤاد زكريا',
      format: 'كتاب',
      domainId: 'philosophy',
      pace: '25 صفحة أسبوعيًا',
      focus: 'التفريق بين المنهج العلمي والتعميمات العاطفية.',
    },
    courseId: 1,
    discussionPrompt: 'ما الفرق بين القراءة العشوائية والقراءة المنهجية؟ وكيف يلتقي التدبر الشرعي مع الانضباط العلمي؟',
    applicationTask: 'إعداد جدول الإيقاع الأسبوعي وتخصيص دفتر واحد للتلخيص (بطاقة فكرة واحدة لكل فصل).',
    activities: { reading: false, listening: false, summarizing: false, discussing: false },
    status: 'in_progress',
    notes: '',
  },
  {
    id: 2,
    quarter: 1,
    quarterTitle: 'الربع الأول: التأسيس المنهجي وبوصلة العقل والذات',
    theme: 'بناء المعنى الداخلي واتصال القلب بالفكر',
    foundational: {
      title: 'الطريق إلى القرآن',
      author: 'إبراهيم السكران',
      format: 'كتاب',
      domainId: 'islamic_thought',
      pace: '35 صفحة أسبوعيًا',
      focus: 'إحياء الصلة التأسيسية بالنص القرآني ومعالجة فتور التلقي.',
    },
    exploratory: {
      title: 'الإنسان يبحث عن المعنى',
      author: 'فيكتور فرانكل',
      format: 'كتاب',
      domainId: 'psychology',
      pace: '35 صفحة أسبوعيًا',
      focus: 'كيف يمنح المعنى الإنسان صلابة نفسية في أشد الظروف؟',
    },
    courseId: 1,
    discussionPrompt: 'كيف يفسّر كل من السكران وفرانكل أزمة الفراغ الروحي والمعنى عند الإنسان المعاصر؟',
    applicationTask: 'تلخيص كتاب «الإنسان يبحث عن المعنى» في صفحتين ومناقشته مع صديق أو مجموعة قراءة.',
    activities: { reading: false, listening: false, summarizing: false, discussing: false },
    status: 'not_started',
    notes: '',
  },
  {
    id: 3,
    quarter: 1,
    quarterTitle: 'الربع الأول: التأسيس المنهجي وبوصلة العقل والذات',
    theme: 'تذوق البيان العربي وفهم شروط النهضة',
    foundational: {
      title: 'شروط النهضة',
      author: 'مالك بن نبي',
      format: 'كتاب + محاضرات',
      domainId: 'society_history',
      pace: '30 صفحة أسبوعيًا + محاضرة تعريفية بمدرسة بن نبي',
      focus: 'معادلة الحضارة (الإنسان + التراب + الوقت) وأزمة القابلية للاستعمار.',
    },
    exploratory: {
      title: 'وحي القلم — مختارات الجزء الأول',
      author: 'مصطفى صادق الرافعي',
      format: 'كتاب',
      domainId: 'literature_biographies',
      pace: '3 مقالات أدبية أسبوعيًا بتمعن لغوي',
      focus: 'تربية الذائقة البيانية العربية وفهم عمق الصورة والأسلوب عند الرافعي.',
    },
    courseId: 2,
    discussionPrompt: 'لماذا يربط الرافعي بين قوة اللغة والبيان وبين نهضة الوعي عند مالك بن نبي؟',
    applicationTask: 'استخراج 10 تعبيرات بليغة من «وحي القلم» وإعادة صياغة فكرة معاصرة بأسلوب رصين.',
    activities: { reading: false, listening: false, summarizing: false, discussing: false },
    status: 'not_started',
    notes: '',
  },
  {
    id: 4,
    quarter: 2,
    quarterTitle: 'الربع الثاني: قراءة الأفكار، النقد الفلسفي، وآليات الإدراك',
    theme: 'أسئلة الوجود والعقل وتجديد الفكر',
    foundational: {
      title: 'شموع النهار + محاضرات نقد الخطاب المعاصر',
      author: 'عبدالله العجيري',
      format: 'كتاب + محاضرات',
      domainId: 'islamic_thought',
      pace: '35 صفحة أسبوعيًا + محاضرة أسبوعية',
      focus: 'مناقشة الإشكالات العقدية والأسئلة الكبرى بأدوات عقلية هادئة.',
    },
    exploratory: {
      title: 'تجديد الفكر العربي',
      author: 'زكي نجيب محمود',
      format: 'كتاب',
      domainId: 'philosophy',
      pace: '30 صفحة أسبوعيًا',
      focus: 'كيف يتعامل العقل العربي مع التراث العلمي والفلسفي في ضوء الحاضر؟',
    },
    courseId: 2,
    discussionPrompt: 'أين يتفق العجيري وزكي نجيب محمود في أهمية الصرامة العقلية، وأين تختلف منطلقاتهما الفلسفية؟',
    applicationTask: 'كتابة ورقة مقارنة من صفحة واحدة حول «التوفيق بين الأصالة المنهجية والتجديد».',
    activities: { reading: false, listening: false, summarizing: false, discussing: false },
    status: 'not_started',
    notes: '',
  },
  {
    id: 5,
    quarter: 2,
    quarterTitle: 'الربع الثاني: قراءة الأفكار، النقد الفلسفي، وآليات الإدراك',
    theme: 'سيكولوجيا الحرية والانحيازات العقلية',
    foundational: {
      title: 'التفكير السريع والبطيء (النظام 1 والنظام 2)',
      author: 'دانيال كانيمان',
      format: 'كتاب',
      domainId: 'psychology',
      pace: '40 صفحة أسبوعيًا (النصف الأول)',
      focus: 'فهم كيف تقودنا البديهة السريعة إلى أخطاء في الحكم والتقدير.',
    },
    exploratory: {
      title: 'فن الحب / مدخل إلى الخوف من الحرية',
      author: 'إريك فروم',
      format: 'كتاب',
      domainId: 'psychology',
      pace: '25 صفحة أسبوعيًا',
      focus: 'تحليل العلاقة بين النضج الإنساني والحب المسؤول بعيدًا عن التملك.',
    },
    courseId: 3,
    discussionPrompt: 'متى نحتاج إلى إيقاف «النظام السريع» في أحكامنا على الناس والأفكار؟',
    applicationTask: 'رصد 3 انحيازات إدراكية وقعت فيها خلال الأسبوع وتدوين آلية تصحيحها.',
    activities: { reading: false, listening: false, summarizing: false, discussing: false },
    status: 'not_started',
    notes: '',
  },
  {
    id: 6,
    quarter: 2,
    quarterTitle: 'الربع الثاني: قراءة الأفكار، النقد الفلسفي، وآليات الإدراك',
    theme: 'عبقرية المكان وتجربة الإدارة الواقعية',
    foundational: {
      title: 'شخصية مصر: دراسة في عبقرية المكان (المدخل والمفاهيم الأساسية)',
      author: 'جمال حمدان',
      format: 'كتاب + محاضرات',
      domainId: 'society_history',
      pace: '35 صفحة مختارة أسبوعيًا + محاضرات تعريفية بفكر جمال حمدان',
      focus: 'اكتشاف كيف تصنع الجغرافيا والتاريخ ملامح الشخصية المجتمعية والسياسية.',
    },
    exploratory: {
      title: 'حياة في الإدارة',
      author: 'غازي القصيبي',
      format: 'كتاب',
      domainId: 'literature_biographies',
      pace: '40 صفحة أسبوعيًا',
      focus: 'القيادة الواقعية، التعامل مع البيروقراطية، وأخلاقيات المسؤولية.',
    },
    courseId: 4,
    discussionPrompt: 'كيف تؤثر البيئة الجغرافية والتاريخية التي يصفها جمال حمدان في تحديات الإدارة التي واجهها غازي القصيبي؟',
    applicationTask: 'استخلاص 5 دروس إدارية من «حياة في الإدارة» وربطها بالكورس الرابع.',
    activities: { reading: false, listening: false, summarizing: false, discussing: false },
    status: 'not_started',
    notes: '',
  },
  {
    id: 7,
    quarter: 3,
    quarterTitle: 'الربع الثالث: العمران البشري، التحيز المعرفي، والعمق الفكري',
    theme: 'سنن العمران ونقد المقولات المعاصرة',
    foundational: {
      title: 'سلسلة التأسيس العقدي والظاهرة الإلحادية والحريات',
      author: 'سلطان العميري',
      format: 'سلسلة محاضرات',
      domainId: 'islamic_thought',
      pace: 'محاضرتان أسبوعيًا مع تفريغ أو تلخيص النقاط',
      focus: 'التدقيق المفاهيمي في قضايا الحرية، الدليل العقدي، والمذاهب الفكرية.',
    },
    exploratory: {
      title: 'مقدمة ابن خلدون (مختارات العمران والعصبية)',
      author: 'ابن خلدون',
      format: 'كتاب + محاضرات',
      domainId: 'society_history',
      pace: '25 صفحة مشروحة أسبوعيًا + درس شارح للمقدمة',
      focus: 'فهم قانون العصبية وأطوار الدول ومنهج التحقق التاريخي.',
    },
    courseId: 4,
    discussionPrompt: 'كيف تسهم القراءة الخلدونية لسنن المجتمعات في ضبط النقاشات المعاصرة حول الحرية والدولة؟',
    applicationTask: 'بناء خريطة ذهنية لأطوار الدولة والعمران عند ابن خلدون ومقارنتها بواقع معاصر.',
    activities: { reading: false, listening: false, summarizing: false, discussing: false },
    status: 'not_started',
    notes: '',
  },
  {
    id: 8,
    quarter: 3,
    quarterTitle: 'الربع الثالث: العمران البشري، التحيز المعرفي، والعمق الفكري',
    theme: 'النموذج المعرفي وإشكالية التحيز',
    foundational: {
      title: 'رحلتي الفكرية + مدخل إشكالية التحيز',
      author: 'عبد الوهاب المسيري',
      format: 'كتاب + محاضرات',
      domainId: 'philosophy',
      pace: '35 صفحة أسبوعيًا + محاضرة حول التحيز المعرفي',
      focus: 'تتبع التحول الفكري للمسيري وفهم معنى «النموذج المعرفي الكامن».',
    },
    exploratory: {
      title: 'التفكير السريع والبطيء (الجزء الثاني: الاحتمالات والاختيار)',
      author: 'دانيال كانيمان',
      format: 'كتاب',
      domainId: 'psychology',
      pace: '35 صفحة أسبوعيًا',
      focus: 'استكمال فهم التحيزات في التوقعات واتخاذ القرار تحت عدم اليقين.',
    },
    courseId: 3,
    discussionPrompt: 'ما العلاقة بين «التحيز المعرفي» عند المسيري و«الانحيازات الإدراكية» عند كانيمان؟',
    applicationTask: 'تحليل مصطلح شائع في الإعلام أو الإدارة وكشف التحيز المعرفي الكامن خلفه.',
    activities: { reading: false, listening: false, summarizing: false, discussing: false },
    status: 'not_started',
    notes: '',
  },
  {
    id: 9,
    quarter: 3,
    quarterTitle: 'الربع الثالث: العمران البشري، التحيز المعرفي، والعمق الفكري',
    theme: 'صناعة الأفكار وبلاغة الموقف',
    foundational: {
      title: 'مشكلة الأفكار في العالم الإسلامي',
      author: 'مالك بن نبي',
      format: 'كتاب',
      domainId: 'society_history',
      pace: '30 صفحة أسبوعيًا',
      focus: 'التمييز بين الأفكار المطبوعة والأفكار الموضوعة، ودور الفكرة الميتة والقاتلة.',
    },
    exploratory: {
      title: 'تحت راية القرآن (أو مختارات وحي القلم ج2)',
      author: 'مصطفى صادق الرافعي',
      format: 'كتاب',
      domainId: 'literature_biographies',
      pace: '30 صفحة أسبوعيًا',
      focus: 'استيعاب معركة التجديد والبيان في مطلع القرن العشرين وأسلوب الرافعي الجدلي.',
    },
    courseId: 5,
    discussionPrompt: 'كيف يحوّل الكاتب «الفكرة الحية» إلى بيان مؤثر دون أن يسقط في الإنشائية الفارغة؟',
    applicationTask: 'كتابة نص تعبيري أو عرض شرائح قصير حول فكرة «عالم الأفكار وعالم الأشياء».',
    activities: { reading: false, listening: false, summarizing: false, discussing: false },
    status: 'not_started',
    notes: '',
  },
  {
    id: 10,
    quarter: 4,
    quarterTitle: 'الربع الرابع: التركيب، التجارب الإنسانية، والمناقشة والتطبيق',
    theme: 'النقد الثقافي وتجدد التراث وفقه الواقع',
    foundational: {
      title: 'مآلات الخطاب المدني + محاضرات فقه الواقع الفكري',
      author: 'إبراهيم السكران وعبدالله العجيري',
      format: 'كتاب + محاضرات',
      domainId: 'islamic_thought',
      pace: '30 صفحة أسبوعيًا + محاضرتان في تحليل التيارات',
      focus: 'قراءة التحولات الثقافية في الخطاب المعاصر بعين ناقدة متزنة.',
    },
    exploratory: {
      title: 'المعقول واللامعقول في تراثنا الفكري (مختارات)',
      author: 'زكي نجيب محمود',
      format: 'كتاب',
      domainId: 'philosophy',
      pace: '30 صفحة أسبوعيًا',
      focus: 'التعرف على الجدل الفكري حول العقلانية في التراث ومناقشته بموضوعية.',
    },
    courseId: 5,
    discussionPrompt: 'كيف نناقش أطروحة فكرية تخالفنا دون اختزالها أو التسرع في الحكم عليها؟',
    applicationTask: 'إعداد ملخص حواري متوازن يعرض وجهة نظر زكي نجيب محمود ومناقشة السكران لها.',
    activities: { reading: false, listening: false, summarizing: false, discussing: false },
    status: 'not_started',
    notes: '',
  },
  {
    id: 11,
    quarter: 4,
    quarterTitle: 'الربع الرابع: التركيب، التجارب الإنسانية، والمناقشة والتطبيق',
    theme: 'التجارب الإنسانية العابرة للثقافات والجغرافيا',
    foundational: {
      title: 'استراتيجية الاستعمار والتحرير (أو مختارات متقدمة من شخصية مصر)',
      author: 'جمال حمدان',
      format: 'كتاب',
      domainId: 'society_history',
      pace: '35 صفحة أسبوعيًا',
      focus: 'قراءة الخرائط الجيوسياسية وفهم صراعات النفوذ والاستقلال.',
    },
    exploratory: {
      title: 'الطريق إلى مكة (أو سيرة إنسانية عالمية مختارة)',
      author: 'محمد أسد (تجارب إنسانية متنوعة)',
      format: 'كتاب',
      domainId: 'literature_biographies',
      pace: '45 صفحة أسبوعيًا',
      focus: 'معايشة رحلة روحية وفكرية بين الثقافة الأوروبية والعالم الإسلامي.',
    },
    courseId: 6,
    discussionPrompt: 'ماذا تضيف السيرة الذاتية العابرة للثقافات إلى التحليل الجيوسياسي عند جمال حمدان؟',
    applicationTask: 'تسجيل مراجعة صوتية أو مكتوبة من 5 دقائق تربط السيرة الإنسانية بالسياق التاريخي.',
    activities: { reading: false, listening: false, summarizing: false, discussing: false },
    status: 'not_started',
    notes: '',
  },
  {
    id: 12,
    quarter: 4,
    quarterTitle: 'الربع الرابع: التركيب، التجارب الإنسانية، والمناقشة والتطبيق',
    theme: 'الحصاد المعرفي والتركيب والمراجعة الشاملة',
    foundational: {
      title: 'رقائق القرآن + استكمال سلسلة البناء المنهجي',
      author: 'إبراهيم السكران وأحمد بن يوسف السيد',
      format: 'كتاب + محاضرات',
      domainId: 'islamic_thought',
      pace: 'قراءة هادئة ومراجعة شاملة لدفاتر التلخيص',
      focus: 'تجديد البوصلة الروحية وتقييم ما تغيّر في طريقة التفكير خلال العام.',
    },
    exploratory: {
      title: 'المشروع الختامي: تركيب الأفكار بين المحاور الستة',
      author: 'مراجعة ذاتية وكتابات المستخدم',
      format: 'كتاب + محاضرات',
      domainId: 'personal_dev',
      pace: 'مراجعة 3 دفاتر تلخيص أسبوعيًا + جلسة مناقشة ختامية',
      focus: 'تجميع المخرجات الفكرية من الكورسات والكتب في خريطة وعي متماسكة.',
    },
    courseId: 6,
    discussionPrompt: 'ما أبرز ثلاث أفكار غيّرت نظرتك إلى الإنسان أو الواقع أو الدين خلال الـ 12 شهرًا؟',
    applicationTask: 'كتابة «بيان الحصاد السنوي» وتصدير النسخة الكاملة لملف Excel كمرجع شخصي.',
    activities: { reading: false, listening: false, summarizing: false, discussing: false },
    status: 'not_started',
    notes: '',
  },
];

export const WEEKLY_RHYTHM: WeeklyRhythmSlot[] = [
  {
    id: 'reading',
    pillar: 'القراءة المتأنية',
    suggestedDuration: '3.5 ساعات أسبوعيًا',
    focus: 'كتاب المسار التأسيسي + كتاب المسار الاستكشافي',
    guideline: '30–40 دقيقة يوميًا بوتيرة هادئة دون التزام بعدد صفحات قسري.',
  },
  {
    id: 'listening',
    pillar: 'الاستماع والمحاضرات',
    suggestedDuration: '1.5 ساعة أسبوعيًا',
    focus: 'سلاسل البناء المنهجي أو المحاضرات الفلسفية والتاريخية',
    guideline: 'استغلال أوقات التنقل مع تدوين نقطة محورية واحدة بعد كل محاضرة.',
  },
  {
    id: 'summarizing',
    pillar: 'التلخيص والبطاقات الفكرية',
    suggestedDuration: '1 ساعة أسبوعيًا',
    focus: 'تحويل المقروء والمسموع إلى أفكار خاصة بك',
    guideline: 'كتابة خلاصة من 5 أسطر بلغتك الخاصة لا بنقل العبارات حرفيًا.',
  },
  {
    id: 'discussing',
    pillar: 'المناقشة والتطبيق',
    suggestedDuration: '1 ساعة أسبوعيًا',
    focus: 'حوار مع صديق أو ربط بكورس التطوير الشخصي',
    guideline: 'اختبار الفكرة في الواقع: سؤال نقاشي + خطوة عملية من الكورس المرتبط.',
  },
];
