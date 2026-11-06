import { useEffect } from 'react';

/**
 * Space or Enter presses the element marked data-primary (the "Next / OK / Continue" button of the open dialogue or popup).
 * Typing in a text field is left alone. Native button activation is cancelled so a focused button is not pressed twice.
 */
export function usePrimaryKey(enabled = true) {
  useEffect(() => {
    if (!enabled) return;
    const typing = (t: EventTarget | null) => t instanceof HTMLElement && /^(INPUT|TEXTAREA|SELECT)$/.test(t.tagName);
    const down = (e: KeyboardEvent) => {
      if ((e.key !== ' ' && e.key !== 'Enter') || e.repeat || typing(e.target)) return;
      const btn = document.querySelector<HTMLButtonElement>('[data-primary]:not(:disabled)');
      if (!btn) return;
      e.preventDefault();
      btn.click();
    };
    const up = (e: KeyboardEvent) => { if ((e.key === ' ' || e.key === 'Enter') && !typing(e.target) && document.querySelector('[data-primary]')) e.preventDefault(); };
    window.addEventListener('keydown', down, true);
    window.addEventListener('keyup', up, true);
    return () => { window.removeEventListener('keydown', down, true); window.removeEventListener('keyup', up, true); };
  }, [enabled]);
}
