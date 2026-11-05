import { createRoot } from 'react-dom/client';
import './styles.css';
import { App } from './app/App';

createRoot(document.getElementById('root')!).render(<App />);

// Dev-only handle for manual testing from the browser console (never shipped in production builds).
if (import.meta.env.DEV) {
  void import('./app/store').then((m) => { (window as unknown as Record<string, unknown>).__met = m; });
}
