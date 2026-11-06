import { useMemo, useState } from 'react';
import { useApp } from '../app/store';
import { getPack } from '../content';
import { generateDressRounds, judgeDress } from '../systems/learning/more';
import { mulberry32, shuffle } from '../utils/rng';
import { speak } from '../utils/speech';
import { GameFrame, HintBox, ResultCard, SpeechBubble, useAutoSpeak } from './shared';

const seedOf = (s: string) => [...s].reduce((a, c) => (a * 31 + c.charCodeAt(0)) >>> 0, 41);

/** Clothing shop: the customer asks for a colour and a piece of clothing. Pick both, then dress them up. */
export function DressGame({ runId }: { runId: string }) {
  const { save } = useApp();
  const pack = getPack(save!.grade);
  const cfg = pack.clothing!;
  const ko = save!.settings.koreanHelp, sp = save!.settings.speech;
  const rounds = useMemo(() => generateDressRounds(pack, mulberry32(seedOf(runId))), [pack, runId]);
  const [idx, setIdx] = useState(0);
  const [item, setItem] = useState<string | null>(null);
  const [color, setColor] = useState<string | null>(null);
  const [wrong, setWrong] = useState(0);
  const [total, setTotal] = useState(0);
  const [msg, setMsg] = useState<string | null>(null);
  const [phase, setPhase] = useState<'play' | 'done' | 'result'>('play');
  const round = rounds[idx];
  useAutoSpeak(round?.sentence, idx);
  const cl = (id: string) => cfg.clothes.find((c) => c.id === id)!;
  const co = (id: string) => cfg.colors.find((c) => c.id === id)!;
  // hint level 2 keeps the right choice and two wrong ones
  const keepItems = useMemo(() => new Set([round.clothesId, ...shuffle(cfg.clothes.filter((c) => c.id !== round.clothesId), mulberry32(idx + 5)).slice(0, 2).map((c) => c.id)]), [round, cfg.clothes, idx]);
  const keepColors = useMemo(() => new Set([round.colorId, ...shuffle(cfg.colors.filter((c) => c.id !== round.colorId), mulberry32(idx + 9)).slice(0, 2).map((c) => c.id)]), [round, cfg.colors, idx]);

  const dress = () => {
    const r = judgeDress(round, item, color);
    if (r === 'incomplete') { setMsg('Pick a colour AND a clothing item. · 색과 옷을 모두 골라요.'); return; }
    if (r === 'correct') {
      setPhase('done'); setMsg(null); speak(round.sentence, sp);
      setTimeout(() => {
        if (idx + 1 >= rounds.length) { setPhase('result'); return; }
        setIdx(idx + 1); setItem(null); setColor(null); setWrong(0); setPhase('play');
      }, 1600);
      return;
    }
    const w = wrong + 1;
    setWrong(w); setTotal((t) => t + 1);
    if (r === 'wrong-item') setItem(null); else setColor(null);
    if (w === 1) setMsg(r === 'wrong-item' ? 'Not that clothing. Listen again! · 그 옷이 아니에요. 다시 들어 봐요!' : 'Not that colour. Listen for the colour word! · 그 색이 아니에요. 색깔 낱말을 들어 봐요!');
    else if (w === 2) setMsg('Fewer choices now. · 보기를 줄였어요.');
    else setMsg(`${round.sentence} Tap the glowing ones! · 반짝이는 것을 눌러요!`);
  };

  if (phase === 'result') {
    return <ResultCard gameId="clothing" runId={runId} totalWrong={total} rounds={rounds.length} wordIds={rounds.flatMap((r) => [r.clothesId, r.colorId])}
      summary={<div>{rounds.map((r) => <div key={r.sentence} className="chip" style={{ margin: 3 }}>{cl(r.clothesId).emoji} {r.colorId} {cl(r.clothesId).noun}</div>)}</div>} />;
  }
  const shownColor = color ? co(color).hex : '#eee';
  const dimmed = wrong >= 2;
  return (
    <GameFrame gameId="clothing" step={idx} total={rounds.length}>
      <SpeechBubble text={round.sentence} />
      <div className="fitting">
        <div className="mannequin" style={{ background: shownColor }} aria-label="Preview">
          <span className="pe">{item ? cl(item).emoji : '🙂'}</span>
        </div>
        <div className="grow">
          <b>Colour · 색깔</b>
          <div className="chips" style={{ justifyContent: 'flex-start' }}>
            {cfg.colors.filter((c) => !dimmed || keepColors.has(c.id)).map((c) => (
              <button key={c.id} className={'btn swatch' + (color === c.id ? ' picked' : '') + (wrong >= 3 && c.id === round.colorId ? ' glow' : '')} style={{ background: c.hex }} disabled={phase !== 'play'} onClick={() => { setColor(c.id); setMsg(null); }}>{c.id}{ko && <span className="kr"> {c.ko}</span>}</button>
            ))}
          </div>
          <b>Clothes · 옷</b>
          <div className="chips" style={{ justifyContent: 'flex-start' }}>
            {cfg.clothes.filter((c) => !dimmed || keepItems.has(c.id)).map((c) => (
              <button key={c.id} className={'btn' + (item === c.id ? ' picked' : '') + (wrong >= 3 && c.id === round.clothesId ? ' glow' : '')} disabled={phase !== 'play'} onClick={() => { setItem(c.id); setMsg(null); }}>{c.emoji} {c.noun}{ko && <span className="kr"> {c.ko}</span>}</button>
            ))}
          </div>
        </div>
      </div>
      <div style={{ textAlign: 'center' }}><button className="btn green big" disabled={phase !== 'play'} onClick={dress}>Dress up! 입혀 주기</button></div>
      {msg && <HintBox>{msg}</HintBox>}
      {phase === 'done' && <div className="hint" style={{ textAlign: 'center', fontSize: 24 }}>👗 {round.sentence}</div>}
    </GameFrame>
  );
}
