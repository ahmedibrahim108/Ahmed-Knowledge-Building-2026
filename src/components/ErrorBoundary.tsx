import { Component, ErrorInfo, ReactNode } from 'react';

interface ErrorBoundaryProps {
  children: ReactNode;
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

  render() {
    if (this.state.hasError) {
      return (
        <div
          dir="rtl"
          className="min-h-screen bg-[#F7F8FA] flex items-center justify-center p-6"
        >
          <div className="max-w-lg w-full bg-white border border-slate-200 rounded-xl p-8 space-y-4">
            <h1 className="font-editorial text-2xl font-bold text-slate-900">
              تعذّر إتمام العملية مؤقتًا
            </h1>
            <p className="text-sm text-slate-600 leading-relaxed">
              واجه التطبيق خطأً أثناء المزامنة أو العرض. يمكنك إعادة تحميل الصفحة للمتابعة بأمان.
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
