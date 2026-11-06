import { useMemo, useState } from 'react';
import { useApp } from '../app/store';
import { getPack } from '../content';
import { generateSpellRounds, spellProgress } from '../systems/learning/more';
import { mulberry32 } from '../utils/rng';
import { speak } from '../utils/speech';
import { GameFrame, HintBox, ResultCard, SpeechBubble, useAutoSpeak } from './shared';

const seedOf = (s: string) => [...s].reduce((a, c) => (a * 31 + c.charCodeAt(0)) >>> 0, 23);

/** Restaurant: the customer says what they like; spell the dish with letter tiles. */
export function SpellGame({ runId }: { runId: string }) {
  const { save } = useApp();
  const pack = getPack(save!.grade);
  const ko = save!.settings.koreanHelp, sp = save!.settings.speech;
  const rounds = useMemo(() => generateSpellRounds(pack, mulberry32(seedOf(runId))), [pack, runId]);
  const [idx, setIdx] = useState(0);
  const [picked, setPicked] = useState<number[]>([]); // tile ids in the order tapped
  const [wrong, setWrong] = useState(0);
  const [total, setTotal] = useState(0);
  const [msg, setMsg] = useState<string | null>(null);
  const [phase, setPhase] = useState<'play' | 'done' | 'result'>('play');
  const round = rounds[idx];
  useAutoSpeak(round?.say, idx);
  const chars = picked.map((id) => round.tiles.find((t) => t.id === id)!.ch);
  const need = round.word.split('');
  const hideExtras = wrong >= 2;
  const nextCh = need[chars.length];

  const pick = (id: number, ch: string) => {
    if (phase !== 'play' || picked.includes(id)) return;
    const next = [...chars, ch];
    const r = spellProgress(round.word, next);
    if (r === 'wrong') {
      const w = wrong + 1;
      setWrong(w); setTotal((t) => t + 1); setPicked([]);
      if (w === 1) setMsg(`Hint: it starts with “${round.word[0]}” and has ${round.word.length} letters. · “${round.word[0]}”로 시작하고 ${round.word.length}글자예요.`);
      else if (w === 2) setMsg('The extra letters are gone. · 필요 없는 글자를 치웠어요.');
      else setMsg(`${round.word} = ${round.ko}. Tap the glowing letters in order! · 반짝이는 글자를 차례로 눌러요!`);
      return;
    }
    setPicked((p) => [...p, id]); setMsg(null);
    if (r === 'correct') {
      setPhase('done'); speak(round.say, sp);
      setTimeout(() => {
        if (idx + 1 >= rounds.length) { setPhase('result'); return; }
        setIdx(idx + 1); setPicked([]); setWrong(0); setPhase('play');
      }, 1400);
    }
  };

  if (phase === 'result') {
    return <ResultCard gameId="restaurant" runId={runId} totalWrong={total} rounds={rounds.length} wordIds={rounds.map((r) => r.word)}
      summary={<div>{rounds.map((r) => <span key={r.word} className="chip" style={{ margin: 3 }}>{r.emoji} {r.word}</span>)}</div>} />;
  }
  const hideText = wrong < 2;
  return (
    <GameFrame gameId="restaurant" step={idx} total={rounds.length}>
      <div className="row" style={{ alignItems: 'center' }}>
        <div className="customer" style={{ fontSize: 56 }}>{round.customer.emoji}</div>
        <div className="grow"><SpeechBubble text={round.say} hidden={hideText} hiddenText="Listen and look at the picture!" /></div>
      </div>
      <div className="dish">
        <span className="dish-e">{round.emoji}</span>{ko && <span className="kr">{round.ko}</span>}
      </div>
      <div className="sentence-slots" aria-label="Spell the word">
        {need.map((_, i) => <span key={i} className={'slot letter' + (chars[i] ? ' filled' : '')}>{chars[i] ?? '_'}</span>)}
        <button className="btn small" disabled={picked.length === 0 || phase !== 'play'} onClick={() => setPicked((p) => p.slice(0, -1))}>⌫</button>
      </div>
      <div className="chips letters">
        {round.tiles.filter((t) => !(hideExtras && !need.includes(t.ch))).map((t) => (
          <button key={t.id} className={'btn letter' + (picked.includes(t.id) ? ' picked' : '') + (wrong >= 3 && t.ch === nextCh && !picked.includes(t.id) ? ' glow' : '')} disabled={phase !== 'play' || picked.includes(t.id)} onClick={() => pick(t.id, t.ch)}>{t.ch}</button>
        ))}
      </div>
      {msg && <HintBox>{msg}</HintBox>}
      {phase === 'done' && <div className="hint" style={{ textAlign: 'center', fontSize: 24 }}>🍽️ {round.say}</div>}
    </GameFrame>
  );
}
