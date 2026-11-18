import * as XLSX from 'xlsx';
import {
  BookNote,
  DOMAINS,
  DomainId,
  DomainInfo,
  MonthPlan,
  MonthStatus,
  PersonalCourse,
  WEEKLY_RHYTHM,
} from '../data/curriculumData';
import { richHtmlToMarkdown, richHtmlToPlainText } from './richText';

const STATUS_AR: Record<MonthStatus, string> = {
  not_started: 'لم يبدأ',
  in_progress: 'قيد الدراسة',
  completed: 'مكتمل',
};

function getDomainName(domainId: DomainId, domains: DomainInfo[]): string {
  return domains.find((d) => d.id === domainId)?.title ?? domainId;
}

function sanitizeFilename(name: string): string {
  return (
    name
      .trim()
      .replace(/[\\/:*?"<>|]+/g, '_')
      .replace(/\s+/g, '_')
      .slice(0, 60) || 'ملاحظات_كتاب'
  );
}

export function exportPlanToExcel(
  months: MonthPlan[],
  courses: PersonalCourse[],
  bookNotes: BookNote[] = [],
  domains: DomainInfo[] = DOMAINS
): void {
  const workbook = XLSX.utils.book_new();
  workbook.Workbook = {
    Views: [{ RTL: true }],
  };

  // Sheet 1: الخطة الشهرية (12 شهرًا)
  const monthlyRows = months.map((m) => {
    const linkedCourse = courses.find((c) => c.id === m.courseId);
    const doneActivitiesCount = Object.values(m.activities).filter(Boolean).length;
    const tasksDone = m.tasks.filter((t) => t.done).length;

    return {
      'الشهر': `الشهر ${m.id}`,
      'الفصل المعرفي': m.quarterTitle,
      'محور الشهر': m.theme,
      'المسار التأسيسي (الكتاب / السلسلة)': m.foundational.title,
      'مفكر المسار التأسيسي': m.foundational.author,
      'مجال المسار التأسيسي': getDomainName(m.foundational.domainId, domains),
      'نوع المصدر التأسيسي': m.foundational.format,
      'وتيرة التأسيسي': m.foundational.pace,
      'المسار الاستكشافي (الكتاب / السلسلة)': m.exploratory.title,
      'مفكر المسار الاستكشافي': m.exploratory.author,
      'مجال المسار الاستكشافي': getDomainName(m.exploratory.domainId, domains),
      'نوع المصدر الاستكشافي': m.exploratory.format,
      'وتيرة الاستكشافي': m.exploratory.pace,
      'كورس التطوير الشخصي المرتبط': linkedCourse ? linkedCourse.title : `كورس ${m.courseId}`,
      'سؤال المناقشة': m.discussionPrompt,
      'التطبيق العملي': m.applicationTask,
      'القراءة': m.activities.reading ? 'تم' : 'قيد الانتظار',
      'الاستماع': m.activities.listening ? 'تم' : 'قيد الانتظار',
      'التلخيص': m.activities.summarizing ? 'تم' : 'قيد الانتظار',
      'المناقشة والتطبيق': m.activities.discussing ? 'تم' : 'قيد الانتظار',
      'المهام الصغيرة المنجزة': `${tasksDone} / ${m.tasks.length}`,
      'نسبة الإنجاز الشهري': `${Math.round((doneActivitiesCount / 4) * 100)}%`,
      'الحالة': STATUS_AR[m.status],
      'ملخصات وملاحظات المستخدم': m.notes || '—',
    };
  });

  const wsMonths = XLSX.utils.json_to_sheet(monthlyRows);
  wsMonths['!views'] = [{ rightToLeft: true }];
  wsMonths['!cols'] = [
    { wch: 10 },
    { wch: 32 },
    { wch: 28 },
    { wch: 36 },
    { wch: 22 },
    { wch: 24 },
    { wch: 16 },
    { wch: 28 },
    { wch: 36 },
    { wch: 22 },
    { wch: 24 },
    { wch: 16 },
    { wch: 28 },
    { wch: 34 },
    { wch: 40 },
    { wch: 38 },
    { wch: 12 },
    { wch: 12 },
    { wch: 12 },
    { wch: 16 },
    { wch: 20 },
    { wch: 16 },
    { wch: 14 },
    { wch: 42 },
  ];
  XLSX.utils.book_append_sheet(workbook, wsMonths, '1_الخطة_الشهرية');

  // Sheet 2: المحاور والمفكرون
  const domainRows: Array<Record<string, string>> = [];
  for (const domain of domains) {
    for (const thinker of domain.thinkers) {
      domainRows.push({
        'المحور المعرفي': domain.title,
        'هدف المحور': domain.purpose,
        'المفكر / الأديب': thinker.name,
        'الدور المنهجي': thinker.role,
        'أبرز الأعمال المختارة': thinker.keyWorks.join(' — '),
        'الأثر في بناء العقل المتوازن': thinker.contribution,
      });
    }
  }
  const wsDomains = XLSX.utils.json_to_sheet(domainRows);
  wsDomains['!views'] = [{ rightToLeft: true }];
  wsDomains['!cols'] = [
    { wch: 26 },
    { wch: 42 },
    { wch: 24 },
    { wch: 26 },
    { wch: 40 },
    { wch: 46 },
  ];
  XLSX.utils.book_append_sheet(workbook, wsDomains, '2_المحاور_والمفكرون');

  // Sheet 3: الكورسات والمراجع
  const courseRows = courses.map((c) => ({
    'رقم الكورس': c.id,
    'اسم الكورس': c.title,
    'المجال المهاري': c.category,
    'الأشهر / الوحدات المرتبطة': c.linkedMonths.map((m) => `وحدة ${m}`).join('، '),
    'المرجع الكتابي المكمل': c.complementaryBook,
    'المفكر المرجعي': c.bookAuthor,
    'المصادر الموصى بها': c.resources.map((r) => r.title).join(' | '),
    'هدف التطبيق العملي': c.applicationMilestone,
    'مهام الكورس المنجزة': `${c.tasks.filter((t) => t.done).length} / ${c.tasks.length}`,
    'الحالة': c.completed ? 'مكتمل' : 'قيد التنفيذ',
  }));
  const wsCourses = XLSX.utils.json_to_sheet(courseRows);
  wsCourses['!views'] = [{ rightToLeft: true }];
  wsCourses['!cols'] = [
    { wch: 12 },
    { wch: 36 },
    { wch: 20 },
    { wch: 20 },
    { wch: 34 },
    { wch: 32 },
    { wch: 48 },
    { wch: 44 },
    { wch: 18 },
    { wch: 14 },
  ];
  XLSX.utils.book_append_sheet(workbook, wsCourses, '3_الكورسات_والمراجع');

  // Sheet 4: الإيقاع الأسبوعي المتوازن
  const rhythmRows = WEEKLY_RHYTHM.map((slot) => ({
    'الركيزة الأسبوعية': slot.pillar,
    'الوقت المقترح': slot.suggestedDuration,
    'نطاق التركيز': slot.focus,
    'القاعدة المنهجية (بدون سباق)': slot.guideline,
  }));
  const wsRhythm = XLSX.utils.json_to_sheet(rhythmRows);
  wsRhythm['!views'] = [{ rightToLeft: true }];
  wsRhythm['!cols'] = [
    { wch: 24 },
    { wch: 22 },
    { wch: 38 },
    { wch: 52 },
  ];
  XLSX.utils.book_append_sheet(workbook, wsRhythm, '4_الإيقاع_الأسبوعي');

  // Sheet 5: المهام الصغيرة والمصادر
  const taskRows: Array<Record<string, string>> = [];
  for (const m of months) {
    for (const t of m.tasks) {
      taskRows.push({
        'النطاق': `الشهر ${m.id}: ${m.theme}`,
        'المسار':
          t.track === 'foundational'
            ? 'تأسيسي'
            : t.track === 'exploratory'
            ? 'استكشافي'
            : 'تطبيق عملي',
        'المهمة الصغيرة': t.text,
        'الحالة': t.done ? 'منجز' : 'قيد الانتظار',
      });
    }
  }
  for (const c of courses) {
    for (const t of c.tasks) {
      taskRows.push({
        'النطاق': c.title,
        'المسار': 'كورس تطوير شخصي',
        'المهمة الصغيرة': t.text,
        'الحالة': t.done ? 'منجز' : 'قيد الانتظار',
      });
    }
  }
  const wsTasks = XLSX.utils.json_to_sheet(taskRows);
  wsTasks['!views'] = [{ rightToLeft: true }];
  wsTasks['!cols'] = [{ wch: 34 }, { wch: 18 }, { wch: 56 }, { wch: 14 }];
  XLSX.utils.book_append_sheet(workbook, wsTasks, '5_المهام_الصغيرة');

  // Sheet 6: نوتس الكتب والكورسات والمحاضرات
  const NOTE_TYPE_AR = {
    book: 'كتاب',
    course_lecture: 'كورس / محاضرة',
    general: 'ملاحظة عامة',
  };

  const bookNoteRows =
    bookNotes.length > 0
      ? bookNotes.map((bn) => ({
          'النوع': NOTE_TYPE_AR[bn.noteType ?? 'book'],
          'عنوان الملاحظة / الكتاب': bn.bookTitle,
          'الكورس المرتبط': bn.courseTitle || '—',
          'المحاضرة': bn.lectureTitle || '—',
          'التصنيف المخصص': bn.categoryLabel || '—',
          'المؤلف / المحاضر': bn.author || '—',
          'الموضع / الصفحة': bn.progressMarker || '—',
          'النوتس والأفكار المستخلصة': richHtmlToPlainText(bn.content) || '—',
          'اقتباسات أو أسئلة مناقشة': richHtmlToPlainText(bn.quotes) || '—',
          'آخر تحديث': bn.updatedAt,
        }))
      : [
          {
            'النوع': '—',
            'عنوان الملاحظة / الكتاب': 'لم تُضف ملاحظات بعد',
            'الكورس المرتبط': '—',
            'المحاضرة': '—',
            'التصنيف المخصص': '—',
            'المؤلف / المحاضر': '—',
            'الموضع / الصفحة': '—',
            'النوتس والأفكار المستخلصة': 'يمكنك إضافة ملاحظات الكتب والكورسات من تبويب دفتر الملاحظات.',
            'اقتباسات أو أسئلة مناقشة': '—',
            'آخر تحديث': '—',
          },
        ];
  const wsBookNotes = XLSX.utils.json_to_sheet(bookNoteRows);
  wsBookNotes['!views'] = [{ rightToLeft: true }];
  wsBookNotes['!cols'] = [
    { wch: 16 },
    { wch: 32 },
    { wch: 28 },
    { wch: 26 },
    { wch: 20 },
    { wch: 22 },
    { wch: 22 },
    { wch: 56 },
    { wch: 44 },
    { wch: 22 },
  ];
  XLSX.utils.book_append_sheet(workbook, wsBookNotes, '6_الملاحظات_المنظمة');

  XLSX.writeFile(workbook, 'خطة_ميزان_المعرفة_الدراسية.xlsx');
}

export function exportSingleBookNoteAsMarkdown(note: BookNote): void {
  const typeLabel =
    note.noteType === 'course_lecture'
      ? 'كورس / محاضرة'
      : note.noteType === 'general'
      ? 'ملاحظة عامة'
      : 'كتاب';

  const lines = [
    `# ${note.bookTitle}`,
    '',
    `- **النوع:** ${typeLabel}`,
    ...(note.courseTitle ? [`- **الكورس:** ${note.courseTitle}`] : []),
    ...(note.lectureTitle ? [`- **المحاضرة:** ${note.lectureTitle}`] : []),
    ...(note.categoryLabel ? [`- **التصنيف:** ${note.categoryLabel}`] : []),
    `- **المؤلف / المحاضر:** ${note.author || 'غير محدد'}`,
    `- **الموضع:** ${note.progressMarker || 'غير محدد'}`,
    `- **تاريخ التحديث:** ${note.updatedAt}`,
    '',
    '---',
    '',
    '## النوتس والأفكار المستخلصة',
    '',
    richHtmlToMarkdown(note.content) || '_لم تُكتب ملاحظات بعد._',
    '',
  ];

  const quotesMd = richHtmlToMarkdown(note.quotes);
  if (quotesMd) {
    lines.push('## اقتباسات وأسئلة للمناقشة', '', quotesMd, '');
  }

  lines.push('---', '_تم التصدير من منصة ميزان المعرفة_');

  const blob = new Blob(['\uFEFF' + lines.join('\n')], {
    type: 'text/markdown;charset=utf-8',
  });
  const url = URL.createObjectURL(blob);
  const a = document.createElement('a');
  a.href = url;
  a.download = `نوتس_${sanitizeFilename(note.bookTitle)}.md`;
  document.body.appendChild(a);
  a.click();
  document.body.removeChild(a);
  URL.revokeObjectURL(url);
}

export function exportSingleBookNoteAsExcel(note: BookNote): void {
  const workbook = XLSX.utils.book_new();
  workbook.Workbook = { Views: [{ RTL: true }] };

  const rows = [
    {
      'النوع':
        note.noteType === 'course_lecture'
          ? 'كورس / محاضرة'
          : note.noteType === 'general'
          ? 'ملاحظة عامة'
          : 'كتاب',
      'العنوان / الكتاب': note.bookTitle,
      'الكورس المرتبط': note.courseTitle || '—',
      'المحاضرة': note.lectureTitle || '—',
      'التصنيف': note.categoryLabel || '—',
      'المؤلف / المحاضر': note.author || '—',
      'الفصل / رقم الصفحة': note.progressMarker || '—',
      'النوتس والأفكار المستخلصة': richHtmlToPlainText(note.content) || '—',
      'اقتباسات أو أسئلة مناقشة': richHtmlToPlainText(note.quotes) || '—',
      'آخر تحديث': note.updatedAt,
    },
  ];

  const ws = XLSX.utils.json_to_sheet(rows);
  ws['!views'] = [{ rightToLeft: true }];
  ws['!cols'] = [
    { wch: 16 },
    { wch: 30 },
    { wch: 28 },
    { wch: 24 },
    { wch: 20 },
    { wch: 22 },
    { wch: 22 },
    { wch: 60 },
    { wch: 46 },
    { wch: 22 },
  ];
  XLSX.utils.book_append_sheet(workbook, ws, 'نوتس_منظم');
  XLSX.writeFile(workbook, `نوتس_${sanitizeFilename(note.bookTitle)}.xlsx`);
}
