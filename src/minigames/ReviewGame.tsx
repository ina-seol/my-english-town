import { useMemo, useState } from 'react';
import { useApp } from '../app/store';
import { getPack } from '../content';
import { generateReviewRounds } from '../systems/learning/more';
import { mulberry32 } from '../utils/rng';
import { speak } from '../utils/speech';
import { GameFrame, HintBox, ResultCard } from './shared';

const seedOf = (s: string) => [...s].reduce((a, c) => (a * 31 + c.charCodeAt(0)) >>> 0, 43);
const LABEL: Record<string, string> = { food: '🍞 Food', day: '📅 Days', subject: '📚 Subjects', action: '🏃 Actions', price: '🪙 Prices' };

/** Town hall: the mayor's review. Fill the blank in sentences you have practised in the other buildings. */
export function ReviewGame({ runId }: { runId: string }) {
  const { save } = useApp();
  const pack = getPack(save!.grade);
  const sp = save!.settings.speech;
  const rounds = useMemo(() => generateReviewRounds(pack, mulberry32(seedOf(runId))), [pack, runId]);
  const [idx, setIdx] = useState(0);
  const [gone, setGone] = useState<string[]>([]);
  const [wrong, setWrong] = useState(0);
  const [total, setTotal] = useState(0);
  const [msg, setMsg] = useState<string | null>(null);
  const [phase, setPhase] = useState<'play' | 'done' | 'result'>('play');
  const round = rounds[idx];

  const choose = (o: string) => {
    if (phase !== 'play' || gone.includes(o)) return;
    if (o === round.answer) {
      setPhase('done'); setMsg(null); speak(round.full, sp);
      setTimeout(() => {
        if (idx + 1 >= rounds.length) { setPhase('result'); return; }
        setIdx(idx + 1); setGone([]); setWrong(0); setPhase('play');
      }, 1700);
      return;
    }
    const w = wrong + 1;
    setWrong(w); setTotal((t) => t + 1); setGone((g) => [...g, o]);
    if (w === 1) setMsg('Read the whole sentence again, slowly. · 문장을 천천히 다시 읽어 봐요.');
    else setMsg(`${round.full} Tap the glowing answer! · 반짝이는 답을 눌러요!`);
  };

  if (phase === 'result') {
    return <ResultCard gameId="townhall" runId={runId} totalWrong={total} rounds={rounds.length} wordIds={rounds.map((r) => r.answer.toLowerCase())}
      summary={<div>{rounds.map((r) => <div key={r.full} className="chip" style={{ margin: 3 }}>🏛️ {r.full}</div>)}</div>} />;
  }
  return (
    <GameFrame gameId="townhall" step={idx} total={rounds.length}>
      <div className="muted"><span className="chip">{LABEL[round.kind] ?? round.kind}</span></div>
      <div className="review-clue" aria-label="Clue"><span className="clue-e">{round.clue}</span><span className="kr">그림·달력·가격표를 보고 빈칸을 채워요.</span></div>
      <div className="bubble"><span className="grow" style={{ fontSize: 28 }}>{round.prompt}</span>
        <button className="btn blue small" aria-label="Listen" onClick={() => speak(round.prompt.replace('_____', 'blank'), true)}>🔊 Listen</button></div>
      <div className="chips">
        {round.options.map((o) => (
          <button key={o} className={'btn' + (wrong >= 2 && o === round.answer ? ' glow' : '') + (gone.includes(o) ? ' dim' : '')} disabled={phase !== 'play' || gone.includes(o)} onClick={() => choose(o)}>{o}</button>
        ))}
      </div>
      {msg && <HintBox>{msg}</HintBox>}
      {phase === 'done' && <div className="hint" style={{ textAlign: 'center', fontSize: 24 }}>🎓 {round.full}</div>}
    </GameFrame>
  );
}
