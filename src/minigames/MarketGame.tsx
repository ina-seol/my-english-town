import { useMemo, useState } from 'react';
import { useApp } from '../app/store';
import { getPack } from '../content';
import { generateMarketRounds, judgeSale, numberWords } from '../systems/learning/games';
import { mulberry32, shuffle } from '../utils/rng';
import { speak } from '../utils/speech';
import { GameFrame, HintBox, ResultCard, SpeechBubble, useAutoSpeak } from './shared';

const seedOf = (s: string) => [...s].reduce((a, c) => (a * 31 + c.charCodeAt(0)) >>> 0, 13);

/** Pick the item the customer wants, read its price tag, choose the price in words, then sell. */
export function MarketGame({ runId }: { runId: string }) {
  const { save } = useApp();
  const pack = getPack(save!.grade);
  const cfg = pack.market!;
  const ko = save!.settings.koreanHelp;
  const sp = save!.settings.speech;
  const rounds = useMemo(() => generateMarketRounds(pack, mulberry32(seedOf(runId))), [pack, runId]);
  const [idx, setIdx] = useState(0);
  const [item, setItem] = useState<string | null>(null);
  const [price, setPrice] = useState<number | null>(null);
  const [wrong, setWrong] = useState(0);
  const [total, setTotal] = useState(0);
  const [msg, setMsg] = useState<string | null>(null);
  const [shelf, setShelf] = useState<string[]>(rounds[0]?.shelf ?? []);
  const [phase, setPhase] = useState<'play' | 'sold' | 'result'>('play');
  const round = rounds[idx];
  useAutoSpeak(round?.sentence, idx);
  const it = (id: string) => cfg.items.find((x) => x.id === id)!;
  const fmt = (n: number) => n.toLocaleString('en-US');
  const answerItem = it(round.itemId);
  const answerPrice = answerItem.price;

  const sell = () => {
    const r = judgeSale(round, answerPrice, item, price);
    if (r === 'incomplete') { setMsg('Choose the item AND its price. · 물건과 가격을 모두 골라요.'); return; }
    if (r === 'correct') {
      setPhase('sold'); setMsg(null); speak(round.answerSentence, sp);
      setTimeout(() => {
        if (idx + 1 >= rounds.length) { setPhase('result'); return; }
        const next = rounds[idx + 1];
        setIdx(idx + 1); setItem(null); setPrice(null); setWrong(0); setShelf(next.shelf); setPhase('play');
      }, 1500);
      return;
    }
    const w = wrong + 1;
    setWrong(w); setTotal((t) => t + 1);
    if (r === 'wrong-item') setItem(null); else setPrice(null);
    if (w === 1) setMsg(r === 'wrong-item' ? 'Not that one. Listen to what the customer wants! · 손님이 원하는 물건을 다시 들어 봐요!' : `Not that price. Read the price tag again: ${fmt(answerPrice)}. · 가격표를 다시 읽어 봐요.`);
    else if (w === 2) { setShelf(shuffle([round.itemId, ...shelf.filter((x) => x !== round.itemId).slice(0, 2)], mulberry32(seedOf(runId) + idx))); setMsg('Fewer items now. · 물건을 줄였어요.'); }
    else setMsg(`${fmt(answerPrice)} = ${numberWords(answerPrice)}. Tap the glowing item and price! · 반짝이는 물건과 가격을 눌러요!`);
  };

  if (phase === 'result') {
    return <ResultCard gameId="market" runId={runId} totalWrong={total} rounds={rounds.length} wordIds={rounds.map((r) => r.itemId)}
      summary={<div>{rounds.map((r) => <div key={r.itemId} className="chip" style={{ margin: 3 }}>{it(r.itemId).emoji} {r.answerSentence}</div>)}</div>} />;
  }
  return (
    <GameFrame gameId="market" step={idx} total={rounds.length}>
      <SpeechBubble text={round.sentence} />
      <div className="shop-shelf" aria-label="Shelf">
        {shelf.map((id) => {
          const x = it(id);
          const glow = wrong >= 3 && id === round.itemId;
          return (
            <button key={id} className={'food' + (item === id ? ' picked' : '') + (glow ? ' glow' : '')} disabled={phase !== 'play'} onClick={() => { setItem(id); setMsg(null); }} aria-label={x.name}>
              <div className="e">{x.emoji}</div><div className="w">{x.name.replace('the ', '')}</div>{ko && <div className="kr">{x.ko}</div>}
              <div className="tag">{fmt(x.price)} {cfg.unit}</div>
            </button>
          );
        })}
      </div>
      <div className="counter">
        <b>Price · 가격</b>
        <div className="row wrap">
          {round.priceChoices.map((p) => (
            <button key={p} className={'btn' + (price === p ? ' sun' : '') + (wrong >= 3 && p === answerPrice ? ' glow' : '')} disabled={phase !== 'play'} onClick={() => { setPrice(p); setMsg(null); }}>
              {numberWords(p)} {cfg.unit}
            </button>
          ))}
        </div>
        <button className="btn green big" disabled={phase !== 'play'} onClick={sell}>Sell! 판매</button>
      </div>
      {msg && <HintBox>{msg}</HintBox>}
      {phase === 'sold' && <div className="hint" style={{ textAlign: 'center', fontSize: 24 }}>🪙 Sold! {round.answerSentence}</div>}
    </GameFrame>
  );
}
