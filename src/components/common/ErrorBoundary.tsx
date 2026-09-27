import { Component, ErrorInfo, ReactNode } from 'react';
import { RefreshCw } from 'lucide-react';
import { Button } from '@/components/ui/button';
import { useSettings } from '@/contexts/AppSettings';

interface Props {
  children: ReactNode;
}

interface State {
  hasError: boolean;
}

// 函数式回退 UI（可用 i18n hook）
const ErrorFallback: React.FC = () => {
  const { t } = useSettings();
  return (
    <div className="flex flex-col items-center justify-center min-h-[60vh] text-center p-6">
      <div className="w-16 h-16 rounded-full bg-muted flex items-center justify-center mb-5">
        <RefreshCw className="w-8 h-8 text-muted-foreground" />
      </div>
      <h2 className="text-lg font-serif font-bold text-foreground mb-2">{t('error.boundaryTitle')}</h2>
      <p className="text-sm text-muted-foreground mb-5 max-w-sm">{t('error.boundaryMessage')}</p>
      <Button onClick={() => window.location.reload()}>
        <RefreshCw className="w-4 h-4 mr-1.5" />
        {t('error.reload')}
      </Button>
    </div>
  );
};

/** 全局错误边界：捕获渲染异常，避免白屏 */
export class ErrorBoundary extends Component<Props, State> {
  state: State = { hasError: false };

  static getDerivedStateFromError(): State {
    return { hasError: true };
  }

  componentDidCatch(error: Error, errorInfo: ErrorInfo) {
    console.error('页面渲染异常:', error, errorInfo);
  }

  render() {
    if (this.state.hasError) {
      return <ErrorFallback />;
    }
    return this.props.children;
  }
}

export default ErrorBoundary;
