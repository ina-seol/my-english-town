import { useMemo, useState } from 'react';
import { useApp } from '../app/store';
import { getPack } from '../content';
import { generateMatchSet } from '../systems/learning/more';
import { mulberry32 } from '../utils/rng';
import { speak } from '../utils/speech';
import { GameFrame, HintBox, ResultCard, useAutoSpeak } from './shared';

const seedOf = (s: string) => [...s].reduce((a, c) => (a * 31 + c.charCodeAt(0)) >>> 0, 31);

/** Hospital: match what the patient is asked with what they answer. Tap a question, then its answer. */
export function MatchGame({ runId }: { runId: string }) {
  const { save } = useApp();
  const pack = getPack(save!.grade);
  const ko = save!.settings.koreanHelp, sp = save!.settings.speech;
  const set = useMemo(() => generateMatchSet(pack, mulberry32(seedOf(runId))), [pack, runId]);
  const [matched, setMatched] = useState<number[]>([]);
  const [sel, setSel] = useState<{ side: 'q' | 'a'; i: number } | null>(null);
  const [wrong, setWrong] = useState(0);
  const [total, setTotal] = useState(0);
  const [msg, setMsg] = useState<string | null>(null);
  const [shake, setShake] = useState<string | null>(null);
  const [done, setDone] = useState(false);
  useAutoSpeak(set.pairs[0]?.q, 'start');
  const left = (i: number) => set.pairs[i];

  const tap = (side: 'q' | 'a', i: number) => {
    if (done || matched.includes(i)) return;
    if (!sel || sel.side === side) { setSel({ side, i }); setMsg(null); if (side === 'q') speak(left(i).q, sp); return; }
    const other = sel.i; // pair index of the first tap
    if (other === i) {
      const nm = [...matched, i];
      setMatched(nm); setSel(null); setWrong(0); setMsg(null);
      speak(`${left(i).q} ${left(i).a}`, sp);
      if (nm.length === set.pairs.length) setTimeout(() => setDone(true), 900);
      return;
    }
    const w = wrong + 1;
    setWrong(w); setTotal((t) => t + 1); setShake(`${side}${i}`); setTimeout(() => setShake(null), 400); setSel(null);
    const target = sel.side === 'q' ? left(sel.i) : null;
    if (w === 1) setMsg(`Hmm, not a pair. Read both again! ${target ? `(${target.q})` : ''} · 짝이 아니에요. 다시 읽어 봐요!`);
    else if (w === 2) setMsg('Some choices are dimmed. · 몇 개를 흐리게 했어요.');
    else setMsg('Tap the glowing pair! · 반짝이는 짝을 눌러요!');
  };

  if (done) {
    return <ResultCard gameId="hospital" runId={runId} totalWrong={total} rounds={set.pairs.length} wordIds={set.pairs.map((p) => p.q.toLowerCase())}
      summary={<div>{set.pairs.map((p) => <div key={p.q} className="chip" style={{ margin: 3 }}>🩺 {p.q} → {p.a}</div>)}</div>} />;
  }
  const firstOpen = set.left.find((i) => !matched.includes(i))!;
  const focus = sel?.side === 'q' ? sel.i : firstOpen; // the pair that hints refer to
  const dimOthers = wrong >= 2;
  const glow = (i: number) => wrong >= 3 && i === focus;
  return (
    <GameFrame gameId="hospital" step={matched.length} total={set.pairs.length}>
      <div className="muted kr">Tap a question, then the answer that fits. · 질문을 누르고, 알맞은 대답을 눌러요.</div>
      <div className="match">
        <div className="match-col">
          {set.left.map((i) => (
            <button key={'q' + i} className={'btn match-card' + (matched.includes(i) ? ' ok' : '') + (sel?.side === 'q' && sel.i === i ? ' picked' : '') + (shake === 'q' + i ? ' wrong' : '') + (glow(i) ? ' glow' : '')} disabled={matched.includes(i)} onClick={() => tap('q', i)}>
              🩺 {left(i).q}{ko && <span className="kr"> {left(i).qko}</span>}
            </button>
          ))}
        </div>
        <div className="match-col">
          {set.right.map((i) => (
            <button key={'a' + i} className={'btn match-card' + (matched.includes(i) ? ' ok' : '') + (sel?.side === 'a' && sel.i === i ? ' picked' : '') + (shake === 'a' + i ? ' wrong' : '') + (glow(i) ? ' glow' : '') + (dimOthers && !matched.includes(i) && i !== focus && (i + focus) % 2 === 1 ? ' dim' : '')} disabled={matched.includes(i)} onClick={() => tap('a', i)}>
              💬 {left(i).a}{ko && <span className="kr"> {left(i).ako}</span>}
            </button>
          ))}
        </div>
      </div>
      {msg && <HintBox>{msg}</HintBox>}
    </GameFrame>
  );
}
