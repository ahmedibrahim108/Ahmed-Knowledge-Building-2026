export type QuickDropItemType = 'url' | 'text' | 'mixed';
export type QuickDropStatus = 'active' | 'trashed';

export interface QuickDropItem {
  id: string;
  userId: string;
  title: string;
  content: string;
  itemType: QuickDropItemType;
  createdAt: string;
  expiresAt: string;
  status: QuickDropStatus;
  trashedAt: string | null;
  updatedAt: string;
  pendingSync?: boolean;
}

export interface QuickDropTextSegment {
  type: 'text' | 'url';
  value: string;
  href?: string;
}

export const QUICK_DROP_LIFETIME_MS = 24 * 60 * 60 * 1000;

const RAW_URL_PATTERN = /(https?:\/\/[^\s<>"'`]+|www\.[a-zA-Z0-9-]+(?:\.[a-zA-Z0-9-]+)+(?:\/[^\s<>"'`]*)?)/gi;
const TRAILING_PUNCT_RE = /[),.;:!?،؛]+$/;

/**
 * Normalizes a matched URL candidate and rejects any protocol other than http/https.
 * Blocks javascript:, data:, vbscript:, file:, etc.
 */
export function normalizeSafeHttpUrl(rawCandidate: string): string | null {
  let candidate = (rawCandidate || '').trim();
  if (!candidate) return null;

  // Strip unmatched trailing punctuation cleanly
  while (TRAILING_PUNCT_RE.test(candidate)) {
    const ch = candidate.slice(-1);
    if (ch === ')') {
      const openCount = (candidate.match(/\(/g) || []).length;
      const closeCount = (candidate.match(/\)/g) || []).length;
      if (closeCount <= openCount) break;
    }
    candidate = candidate.slice(0, -1);
  }

  if (!candidate) return null;
  if (/^www\./i.test(candidate)) {
    candidate = `https://${candidate}`;
  }

  try {
    const parsed = new URL(candidate);
    if (parsed.protocol !== 'http:' && parsed.protocol !== 'https:') {
      return null;
    }
    if (!parsed.hostname || !parsed.hostname.includes('.')) {
      return null;
    }
    return parsed.toString();
  } catch {
    return null;
  }
}

export function extractSafeUrls(content: string): string[] {
  const input = (content || '').trim();
  if (!input) return [];
  const matches = input.match(RAW_URL_PATTERN) || [];
  const unique: string[] = [];
  const seen = new Set<string>();
  for (const m of matches) {
    const safe = normalizeSafeHttpUrl(m);
    if (safe && !seen.has(safe)) {
      seen.add(safe);
      unique.push(safe);
    }
  }
  return unique;
}

export function classifyQuickDropContent(content: string): QuickDropItemType {
  const trimmed = (content || '').trim();
  if (!trimmed) return 'text';
  const urls = extractSafeUrls(trimmed);
  if (urls.length === 0) return 'text';
  if (urls.length === 1 && !/\s/.test(trimmed)) {
    const asUrl = normalizeSafeHttpUrl(trimmed);
    if (asUrl) return 'url';
  }
  return 'mixed';
}

export function splitQuickDropTextSegments(
  content: string
): QuickDropTextSegment[] {
  const text = content || '';
  if (!text) return [];
  const segments: QuickDropTextSegment[] = [];
  const re = new RegExp(RAW_URL_PATTERN.source, 'gi');
  let lastIdx = 0;
  let match: RegExpExecArray | null;

  while ((match = re.exec(text)) !== null) {
    const rawMatch = match[0];
    let trimmedMatch = rawMatch;
    while (TRAILING_PUNCT_RE.test(trimmedMatch)) {
      const ch = trimmedMatch.slice(-1);
      if (ch === ')') {
        const openCount = (trimmedMatch.match(/\(/g) || []).length;
        const closeCount = (trimmedMatch.match(/\)/g) || []).length;
        if (closeCount <= openCount) break;
      }
      trimmedMatch = trimmedMatch.slice(0, -1);
    }

    const safeHref = normalizeSafeHttpUrl(trimmedMatch);
    if (!safeHref) continue;

    if (match.index > lastIdx) {
      segments.push({
        type: 'text',
        value: text.slice(lastIdx, match.index),
      });
    }

    segments.push({
      type: 'url',
      value: trimmedMatch,
      href: safeHref,
    });

    lastIdx = match.index + trimmedMatch.length;
    re.lastIndex = lastIdx;
  }

  if (lastIdx < text.length) {
    segments.push({
      type: 'text',
      value: text.slice(lastIdx),
    });
  }

  return segments.length > 0 ? segments : [{ type: 'text', value: text }];
}

export function buildQuickDropTitlePreview(
  title: string,
  content: string
): string {
  const cleanTitle = (title || '').trim();
  if (cleanTitle) return cleanTitle;

  const trimmed = (content || '').trim();
  if (!trimmed) return 'عنصر مؤقت';

  const firstUrl = extractSafeUrls(trimmed)[0];
  if (firstUrl && classifyQuickDropContent(trimmed) === 'url') {
    try {
      const parsed = new URL(firstUrl);
      const host = parsed.hostname.replace(/^www\./i, '');
      const pathPart =
        parsed.pathname && parsed.pathname !== '/'
          ? parsed.pathname.slice(0, 28)
          : '';
      return `${host}${pathPart}`;
    } catch {
      return trimmed.slice(0, 64);
    }
  }

  const singleLine = trimmed.replace(/\s+/g, ' ');
  return singleLine.length > 68 ? `${singleLine.slice(0, 65)}...` : singleLine;
}

export function buildWhatsAppShareUrl(item: {
  title?: string;
  content: string;
}): string {
  const titleClean = (item.title || '').trim();
  const bodyClean = (item.content || '').trim();
  const payload =
    titleClean && titleClean !== bodyClean && !bodyClean.startsWith(titleClean)
      ? `${titleClean}\n${bodyClean}`
      : bodyClean;
  return `https://wa.me/?text=${encodeURIComponent(payload)}`;
}

export function formatQuickDropDateTime(iso: string): string {
  const ms = Date.parse(iso);
  if (!Number.isFinite(ms)) return '';
  try {
    return new Date(ms).toLocaleString('ar-EG', {
      month: 'short',
      day: 'numeric',
      hour: '2-digit',
      minute: '2-digit',
    });
  } catch {
    return new Date(ms).toISOString().slice(0, 16).replace('T', ' ');
  }
}

export function getQuickDropCountdown(
  expiresAtIso: string,
  nowMs: number = Date.now()
): {
  expired: boolean;
  remainingMs: number;
  progressRatio: number;
  label: string;
} {
  const expMs = Date.parse(expiresAtIso);
  if (!Number.isFinite(expMs)) {
    return {
      expired: false,
      remainingMs: QUICK_DROP_LIFETIME_MS,
      progressRatio: 1,
      label: '24 ساعة',
    };
  }
  const diff = expMs - nowMs;
  if (diff <= 0) {
    return {
      expired: true,
      remainingMs: 0,
      progressRatio: 0,
      label: 'انتهت مهلة 24 ساعة',
    };
  }

  const progressRatio = Math.max(
    0.02,
    Math.min(1, diff / QUICK_DROP_LIFETIME_MS)
  );
  const totalMinutes = Math.ceil(diff / 60000);
  const hours = Math.floor(totalMinutes / 60);
  const minutes = totalMinutes % 60;

  if (hours >= 1) {
    return {
      expired: false,
      remainingMs: diff,
      progressRatio,
      label:
        minutes > 0
          ? `متبقي ${hours} س و${minutes} د`
          : `متبقي ${hours} ساعة`,
    };
  }
  if (totalMinutes > 1) {
    return {
      expired: false,
      remainingMs: diff,
      progressRatio,
      label: `متبقي ${totalMinutes} دقيقة`,
    };
  }
  return {
    expired: false,
    remainingMs: diff,
    progressRatio,
    label: 'ينتهي خلال أقل من دقيقة',
  };
}

export function isQuickDropItemExpired(
  item: Pick<QuickDropItem, 'status' | 'expiresAt'>,
  nowMs: number = Date.now()
): boolean {
  if (item.status !== 'active') return false;
  const expMs = Date.parse(item.expiresAt);
  return Number.isFinite(expMs) && expMs <= nowMs;
}
