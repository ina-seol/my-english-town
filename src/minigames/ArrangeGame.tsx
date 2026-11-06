import { useMemo, useState } from 'react';
import { useApp } from '../app/store';
import { getPack } from '../content';
import { arrangeProgress, generateArrangeRounds } from '../systems/learning/more';
import { mulberry32 } from '../utils/rng';
import { speak } from '../utils/speech';
import { GameFrame, HintBox, ResultCard, SpeechBubble, useAutoSpeak } from './shared';

const seedOf = (s: string) => [...s].reduce((a, c) => (a * 31 + c.charCodeAt(0)) >>> 0, 29);

/** Library: the book page is torn into words. Tap them in the right order to rebuild the sentence. */
export function ArrangeGame({ runId }: { runId: string }) {
  const { save } = useApp();
  const pack = getPack(save!.grade);
  const ko = save!.settings.koreanHelp, sp = save!.settings.speech;
  const rounds = useMemo(() => generateArrangeRounds(pack, mulberry32(seedOf(runId))), [pack, runId]);
  const [idx, setIdx] = useState(0);
  const [picked, setPicked] = useState<number[]>([]);
  const [wrong, setWrong] = useState(0);
  const [total, setTotal] = useState(0);
  const [msg, setMsg] = useState<string | null>(null);
  const [phase, setPhase] = useState<'play' | 'done' | 'result'>('play');
  const round = rounds[idx];
  useAutoSpeak(round?.en, idx);
  const words = picked.map((id) => round.shuffled.find((t) => t.id === id)!.ch);
  const nextWord = round.words[words.length];

  const pick = (id: number, ch: string) => {
    if (phase !== 'play' || picked.includes(id)) return;
    const next = [...words, ch];
    const r = arrangeProgress(round, next);
    if (r === 'wrong') {
      const w = wrong + 1;
      setWrong(w); setTotal((t) => t + 1); setPicked([]);
      if (w === 1) setMsg(`Hint: the sentence starts with “${round.words[0]}”. · “${round.words[0]}”로 시작해요.`);
      else if (w === 2) { setPicked([round.shuffled.find((t) => t.ch === round.words[0])!.id]); setMsg('We placed the first word for you. · 첫 단어를 놓아 줬어요.'); }
      else setMsg('Tap the glowing word each time! · 반짝이는 단어를 차례로 눌러요!');
      return;
    }
    setPicked((p) => [...p, id]); setMsg(null);
    if (r === 'correct') {
      setPhase('done'); speak(round.en, sp);
      setTimeout(() => {
        if (idx + 1 >= rounds.length) { setPhase('result'); return; }
        setIdx(idx + 1); setPicked([]); setWrong(0); setPhase('play');
      }, 1500);
    }
  };

  if (phase === 'result') {
    return <ResultCard gameId="library" runId={runId} totalWrong={total} rounds={rounds.length} wordIds={rounds.flatMap((r) => r.words.map((w) => w.toLowerCase().replace(/[^a-z']/g, '')))}
      summary={<div>{rounds.map((r) => <div key={r.en} className="chip" style={{ margin: 3 }}>📖 {r.en}</div>)}</div>} />;
  }
  return (
    <GameFrame gameId="library" step={idx} total={rounds.length}>
      <SpeechBubble text={round.en} hidden hiddenText="Listen, then build the sentence!" />
      {ko && <div className="kr" style={{ textAlign: 'center', fontSize: 18 }}>{round.ko}</div>}
      <div className="sentence-slots page" aria-label="Your sentence">
        {round.words.map((_, i) => <span key={i} className={'slot' + (words[i] ? ' filled' : '')}>{words[i] ?? '…'}</span>)}
        <button className="btn small" disabled={picked.length === 0 || phase !== 'play'} onClick={() => setPicked((p) => p.slice(0, -1))}>⌫</button>
      </div>
      <div className="chips">
        {round.shuffled.map((t) => (
          <button key={t.id} className={'btn' + (picked.includes(t.id) ? ' picked' : '') + (wrong >= 3 && t.ch === nextWord && !picked.includes(t.id) ? ' glow' : '')} disabled={phase !== 'play' || picked.includes(t.id)} onClick={() => pick(t.id, t.ch)}>{t.ch}</button>
        ))}
      </div>
      {msg && <HintBox>{msg}</HintBox>}
      {phase === 'done' && <div className="hint" style={{ textAlign: 'center', fontSize: 24 }}>✨ {round.en}</div>}
    </GameFrame>
  );
}
