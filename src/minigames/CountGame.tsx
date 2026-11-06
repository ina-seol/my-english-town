import { useMemo, useState } from 'react';
import { useApp } from '../app/store';
import { getPack } from '../content';
import { generateCountRounds } from '../systems/learning/more';
import { numberWords } from '../systems/learning/games';
import { mulberry32 } from '../utils/rng';
import { speak } from '../utils/speech';
import { GameFrame, HintBox, ResultCard, SpeechBubble, useAutoSpeak } from './shared';

const seedOf = (s: string) => [...s].reduce((a, c) => (a * 31 + c.charCodeAt(0)) >>> 0, 37);

/** Pet shop: tap each animal to count it out loud, then say how many there are. */
export function CountGame({ runId }: { runId: string }) {
  const { save } = useApp();
  const pack = getPack(save!.grade);
  const cfg = pack.petshop!;
  const ko = save!.settings.koreanHelp, sp = save!.settings.speech;
  const rounds = useMemo(() => generateCountRounds(pack, mulberry32(seedOf(runId))), [pack, runId]);
  const [idx, setIdx] = useState(0);
  const [counted, setCounted] = useState<number[]>([]); // animal slots in the order tapped
  const [gone, setGone] = useState<number[]>([]); // answers already tried
  const [wrong, setWrong] = useState(0);
  const [total, setTotal] = useState(0);
  const [msg, setMsg] = useState<string | null>(null);
  const [phase, setPhase] = useState<'play' | 'done' | 'result'>('play');
  const round = rounds[idx];
  useAutoSpeak(round?.question, idx);
  const animal = cfg.animals.find((a) => a.id === round.animalId)!;

  const count = (slot: number) => {
    if (phase !== 'play' || counted.includes(slot)) return;
    const n = counted.length + 1;
    setCounted((c) => [...c, slot]);
    speak(numberWords(n), sp);
  };
  const choose = (n: number, text: string) => {
    if (phase !== 'play' || gone.includes(n)) return;
    if (n === round.n) {
      setPhase('done'); setMsg(null); speak(text, sp);
      setTimeout(() => {
        if (idx + 1 >= rounds.length) { setPhase('result'); return; }
        setIdx(idx + 1); setCounted([]); setGone([]); setWrong(0); setPhase('play');
      }, 1500);
      return;
    }
    const w = wrong + 1;
    setWrong(w); setTotal((t) => t + 1); setGone((g) => [...g, n]);
    if (w === 1) setMsg('Count again! Tap each animal one by one. · 다시 세어 봐요! 동물을 하나씩 눌러요.');
    else setMsg(`There are ${round.n}: ${numberWords(round.n)}. Tap the glowing answer! · 정답은 ${round.n}! 반짝이는 답을 눌러요.`);
  };

  if (phase === 'result') {
    return <ResultCard gameId="petshop" runId={runId} totalWrong={total} rounds={rounds.length} wordIds={rounds.map((r) => r.animalId)}
      summary={<div>{rounds.map((r) => <div key={r.animalId} className="chip" style={{ margin: 3 }}>{cfg.animals.find((a) => a.id === r.animalId)!.emoji} {r.answer}</div>)}</div>} />;
  }
  return (
    <GameFrame gameId="petshop" step={idx} total={rounds.length}>
      <SpeechBubble text={round.question} />
      <div className="pen" aria-label={`${round.n} ${animal.many}`}>
        {Array.from({ length: round.n }, (_, slot) => {
          const k = counted.indexOf(slot);
          return (
            <button key={slot} className={'pet' + (k >= 0 ? ' counted' : '')} onClick={() => count(slot)} aria-label={`${animal.one} ${slot + 1}`}>
              <span className="pe">{animal.emoji}</span>{k >= 0 && <b className="num">{k + 1}</b>}
            </button>
          );
        })}
      </div>
      <div className="row" style={{ justifyContent: 'center' }}>
        <span className="chip">Counted · 센 수: {counted.length}</span>
        <button className="btn small" disabled={counted.length === 0 || phase !== 'play'} onClick={() => setCounted([])}>↺ Count again</button>
        {ko && <span className="kr">{animal.ko}</span>}
      </div>
      <div className="chips">
        {round.choices.map((c) => (
          <button key={c.n} className={'btn' + (wrong >= 2 && c.n === round.n ? ' glow' : '') + (gone.includes(c.n) ? ' dim' : '')} disabled={phase !== 'play' || gone.includes(c.n)} onClick={() => choose(c.n, c.text)}>{c.text}</button>
        ))}
      </div>
      {msg && <HintBox>{msg}</HintBox>}
      {phase === 'done' && <div className="hint" style={{ textAlign: 'center', fontSize: 24 }}>🐾 {round.answer}</div>}
    </GameFrame>
  );
}
