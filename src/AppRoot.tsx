import { StrictMode } from 'react';
import { ErrorProvider } from './context';
import { ErrorBoundary } from './components/ErrorBoundary';
import App from './App';

/**
 * The full provider tree of the tool.
 *
 * Rendered in the browser by src/main.tsx and at build time by
 * src/prerender.tsx, so the pre-built first screen and the client's first
 * render always come from the same tree.
 */
export function AppRoot() {
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
