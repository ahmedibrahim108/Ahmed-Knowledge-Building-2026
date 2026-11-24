import { Download, ExternalLink, Eye, Mail, RotateCcw } from 'lucide-react';
import { PublicSiteConfig } from '../data/curriculumData';

interface SiteFooterProps {
  siteConfig: PublicSiteConfig;
  isAdmin: boolean;
  canEdit: boolean;
  showPublicLink?: boolean;
  showExcelExport?: boolean;
  onExportExcel?: () => void;
  onOpenContact?: () => void;
  onOpenPublicPreview?: () => void;
  onRequestReset?: () => void;
}

export default function SiteFooter({
  siteConfig,
  isAdmin,
  canEdit,
  showPublicLink = false,
  showExcelExport = false,
  onExportExcel,
  onOpenContact,
  onOpenPublicPreview,
  onRequestReset,
}: SiteFooterProps) {
  const year = Math.max(2026, new Date().getFullYear());
  const creatorName = siteConfig.creatorName?.trim() || 'Ahmed Ibrahim';

  return (
    <footer className="border-t border-slate-200 bg-white mt-12">
      <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 py-6 flex flex-col md:flex-row md:items-center md:justify-between gap-4 text-xs text-slate-600">
        <div className="space-y-1">
          <p className="font-semibold text-slate-900">
            ميزان المعرفة · Knowledge Balance
          </p>
          <p className="text-[11px] text-slate-500">
            © {year} {creatorName}. All rights reserved. · Created by {creatorName}
          </p>
        </div>

        <div className="flex flex-wrap items-center gap-3">
          {siteConfig.linkedinUrl && (
            <a
              href={siteConfig.linkedinUrl}
              target="_blank"
              rel="noopener noreferrer"
              className="inline-flex items-center gap-1.5 text-[#1E3A5F] hover:text-[#162C49] font-semibold"
            >
              <span>LinkedIn</span>
              <ExternalLink className="w-3 h-3" aria-hidden="true" />
            </a>
          )}

          {siteConfig.showContactForm !== false && onOpenContact && (
            <button
              type="button"
              onClick={onOpenContact}
              className="inline-flex items-center gap-1.5 text-slate-700 hover:text-[#1E3A5F] font-semibold cursor-pointer"
            >
              <Mail className="w-3.5 h-3.5" aria-hidden="true" />
              <span>تواصل معنا</span>
            </button>
          )}

          {canEdit && showExcelExport && onExportExcel && (
            <button
              type="button"
              onClick={onExportExcel}
              className="inline-flex items-center gap-1.5 text-slate-700 hover:text-[#1E3A5F] font-semibold cursor-pointer"
            >
              <Download className="w-3.5 h-3.5" aria-hidden="true" />
              <span>تصدير Excel</span>
            </button>
          )}

          {(isAdmin || showPublicLink) && onOpenPublicPreview && (
            <button
              type="button"
              onClick={onOpenPublicPreview}
              className="inline-flex items-center gap-1.5 text-[#1E3A5F] hover:underline font-semibold cursor-pointer"
            >
              <Eye className="w-3.5 h-3.5" aria-hidden="true" />
              <span>الواجهة العامة</span>
            </button>
          )}

          {canEdit && onRequestReset && (
            <button
              type="button"
              onClick={onRequestReset}
              className="inline-flex items-center gap-1.5 text-slate-500 hover:text-red-700 cursor-pointer"
            >
              <RotateCcw className="w-3.5 h-3.5" aria-hidden="true" />
              <span>إعادة ضبط</span>
            </button>
          )}
        </div>
      </div>
    </footer>
  );
}
