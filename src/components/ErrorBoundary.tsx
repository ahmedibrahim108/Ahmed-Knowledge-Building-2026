import { Component, ErrorInfo, ReactNode } from 'react';
import { AlertTriangle, RotateCcw } from 'lucide-react';

interface ErrorBoundaryProps {
  children: ReactNode;
  inline?: boolean;
  fallbackTitle?: string;
  fallbackMessage?: string;
  onReset?: () => void;
}

interface ErrorBoundaryState {
  hasError: boolean;
  errorMessage: string;
}

export default class ErrorBoundary extends Component<
  ErrorBoundaryProps,
  ErrorBoundaryState
> {
  constructor(props: ErrorBoundaryProps) {
    super(props);
    this.state = { hasError: false, errorMessage: '' };
  }

  static getDerivedStateFromError(error: Error): ErrorBoundaryState {
    return {
      hasError: true,
      errorMessage: error.message || 'حدث خطأ غير متوقع في التطبيق.',
    };
  }

  componentDidCatch(error: Error, info: ErrorInfo) {
    console.error('ErrorBoundary caught:', error, info);
  }

  private handleReset = () => {
    this.setState({ hasError: false, errorMessage: '' });
    this.props.onReset?.();
  };

  render() {
    if (this.state.hasError) {
      if (this.props.inline) {
        return (
          <div
            dir="rtl"
            role="alert"
            className="rounded-xl border border-red-200 bg-red-50/70 p-4 space-y-2.5"
          >
            <div className="flex items-start gap-2.5">
              <AlertTriangle
                className="w-4 h-4 text-red-700 shrink-0 mt-0.5"
                aria-hidden="true"
              />
              <div className="space-y-1 flex-1 min-w-0">
                <p className="text-xs font-bold text-red-900">
                  {this.props.fallbackTitle || 'تعذّر تحميل هذا القسم مؤقتًا'}
                </p>
                <p className="text-[11px] text-red-800 leading-relaxed">
                  {this.props.fallbackMessage ||
                    'حدث خطأ غير متوقع أثناء عرض المحتوى. يمكنك المحاولة مرة أخرى دون فقدان بياناتك.'}
                </p>
                {this.state.errorMessage && (
                  <p className="text-[10px] text-red-700/80 break-words">
                    {this.state.errorMessage}
                  </p>
                )}
              </div>
            </div>
            <div className="flex justify-end">
              <button
                type="button"
                onClick={this.handleReset}
                className="inline-flex items-center gap-1.5 px-3 py-1.5 text-xs font-medium text-white bg-red-700 hover:bg-red-800 rounded-lg cursor-pointer"
              >
                <RotateCcw className="w-3.5 h-3.5" aria-hidden="true" />
                <span>إعادة المحاولة</span>
              </button>
            </div>
          </div>
        );
      }

      return (
        <div
          dir="rtl"
          className="min-h-screen bg-[#F7F8FA] flex items-center justify-center p-6"
        >
          <div className="max-w-lg w-full bg-white border border-slate-200 rounded-xl p-8 space-y-4">
            <h1 className="font-editorial text-2xl font-bold text-slate-900">
              {this.props.fallbackTitle || 'تعذّر إتمام العملية مؤقتًا'}
            </h1>
            <p className="text-sm text-slate-600 leading-relaxed">
              {this.props.fallbackMessage ||
                'واجه التطبيق خطأً أثناء المزامنة أو العرض. يمكنك إعادة تحميل الصفحة للمتابعة بأمان.'}
            </p>
            <p className="text-xs text-slate-500 bg-slate-50 border border-slate-200 rounded-lg p-3 break-words">
              {this.state.errorMessage}
            </p>
            <button
              type="button"
              onClick={() => window.location.reload()}
              className="px-4 py-2 text-xs font-medium text-white bg-[#1E3A5F] rounded-lg hover:bg-[#162C49] cursor-pointer"
            >
              إعادة تحميل الصفحة
            </button>
          </div>
        </div>
      );
    }
    return this.props.children;
  }
}
