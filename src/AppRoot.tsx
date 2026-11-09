import { StrictMode, useEffect } from 'react';
import { ErrorProvider } from './context';
import { ErrorBoundary } from './components/ErrorBoundary';
import App from './App';

interface AppRootProps {
  /** Called once the tree is in the DOM (after hydration, when hydrating) */
  onMounted?: () => void;
}

/**
 * The full provider tree of the tool.
 *
 * Rendered in the browser by src/main.tsx and at build time by
 * src/prerender.tsx, so the pre-built first screen and the client's first
 * render always come from the same tree.
 */
export function AppRoot({ onMounted }: AppRootProps) {
  useEffect(() => {
    onMounted?.();
  }, [onMounted]);

  return (
    <StrictMode>
      <ErrorProvider>
        <ErrorBoundary>
          <App />
        </ErrorBoundary>
      </ErrorProvider>
    </StrictMode>
  );
}
