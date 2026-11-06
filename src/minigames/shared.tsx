import { useEffect, useState, type ReactNode } from 'react';
import { actions, useApp } from '../app/store';
import { starsFor } from '../systems/learning';
import { canSpeak, speak } from '../utils/speech';
import { Icon } from '../components/Icon';

export const GAME_INFO: Record<string, { title: string; ko: string; emoji: string; tone: string }> = {
  bakery: { title: 'Bakery Order', ko: '빵집 주문', emoji: '🍞', tone: 'var(--sun)' },
  school: { title: 'School Timetable', ko: '학교 시간표', emoji: '🏫', tone: 'var(--sky)' },
  market: { title: 'Market Shop', ko: '시장 가게', emoji: '🛒', tone: 'var(--mint)' },
  post: { title: 'Post Office', ko: '우체국 배달', emoji: '📮', tone: 'var(--pink)' },
  restaurant: { title: 'Restaurant Spelling', ko: '식당 철자', emoji: '🍽️', tone: '#ffd0a8' },
  library: { title: 'Library Sentences', ko: '도서관 문장', emoji: '📚', tone: '#d9c9ff' },
  hospital: { title: 'Hospital Match', ko: '병원 짝 맞추기', emoji: '🩺', tone: '#c6ecf7' },
  petshop: { title: 'Pet Shop Counting', ko: '동물가게 세기', emoji: '🐾', tone: '#ffc4da' },
  clothing: { title: 'Clothing Shop', ko: '옷가게', emoji: '👗', tone: '#ffcfe8' },
  townhall: { title: 'Mayor\'s Review', ko: '시장님의 복습', emoji: '🏛️', tone: '#cdd6f5' },
  park: { title: 'Park Action Challenge', ko: '공원 동작 챌린지', emoji: '🌳', tone: 'var(--mint)' },
};

/** Shared frame: title bar, progress dots, leave-with-confirm. */
export function GameFrame({ gameId, step, total, children }: { gameId: string; step: number; total: number; children: ReactNode }) {
  const g = GAME_INFO[gameId];
  return (
    <div className="overlay">
      <div className="panel game" role="dialog" aria-label={g.title}>
        <div className="modal-head" style={{ background: g.tone }}>
          <span>{g.emoji}</span><span className="grow">{g.title} <span className="kr">{g.ko}</span></span>
          <div className="dots" aria-label={`Round ${Math.min(step + 1, total)} of ${total}`}>
            {Array.from({ length: total }, (_, i) => <span key={i} className={'dot' + (i < step ? ' on' : i === step ? ' cur' : '')} />)}
          </div>
          <button className="btn icon-btn small" aria-label="Leave" onClick={() => { if (window.confirm('Leave this game? Your progress here will not be saved.\n나가면 이번 게임은 저장되지 않아요.')) actions.closeModal(); }}>✕</button>
        </div>
        <div className="game-body">{children}</div>
      </div>
    </div>
  );
}

export function SpeechBubble({ text, hidden, hiddenText }: { text: string; hidden?: boolean; hiddenText?: string }) {
  return (
    <div className="bubble">
      <span className="grow">{hidden ? <span className="muted">🔊 {hiddenText ?? 'Listen carefully…'} <span className="kr">잘 들어 보세요</span></span> : text}</span>
      {canSpeak() && <button className="btn blue small" aria-label="Listen" onClick={() => speak(text, true)}>🔊 Listen</button>}
    </div>
  );
}

/** Auto-read a sentence when the round changes (if the student has speech on). */
export function useAutoSpeak(text: string | undefined, key: unknown) {
  const { save } = useApp();
  const speech = !!save?.settings.speech;
  useEffect(() => {
    if (!text || !speech) return;
    const t = setTimeout(() => speak(text, true), 200);
    return () => clearTimeout(t);
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [key]);
}

export function HintBox({ children }: { children: ReactNode }) {
  return <div className="hint" role="status">{children}</div>;
}

export function ResultCard({ gameId, runId, totalWrong, rounds, wordIds, summary }: { gameId: string; runId: string; totalWrong: number; rounds: number; wordIds: string[]; summary: ReactNode }) {
  const [busy, setBusy] = useState(false);
  const stars = starsFor(totalWrong);
  const collect = () => {
    if (busy) return;
    setBusy(true);
    actions.finishMinigame(gameId, { runId, stars, correct: rounds, wrong: totalWrong, wordIds });
    actions.closeModal();
  };
  return (
    <div className="overlay">
      <div className="panel reward">
        <div className="ribbon">ALL DONE!</div>
        <div className="stars" aria-label={`${stars} stars`}>{'⭐'.repeat(stars)}{'☆'.repeat(3 - stars)}</div>
        <div>{summary}</div>
        <p className="kr">{totalWrong === 0 ? 'Perfect! 완벽해요!' : `Mistakes: ${totalWrong} — try again for more stars. 다시 하면 별을 더 받을 수 있어요.`}</p>
        <button className="btn green big" disabled={busy} onClick={collect}>Collect reward <Icon name="coin" fallback="🪙" size={24} /></button>
      </div>
    </div>
  );
}
