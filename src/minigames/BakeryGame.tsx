import { useEffect, useMemo, useRef, useState } from 'react';
import { actions, useApp } from '../app/store';
import { getPack, type Food } from '../content';
import { generateBakeryOrders, hintLevel, judgeTray, narrowShelf, starsFor, type BakeryOrder } from '../systems/learning';
import { mulberry32 } from '../utils/rng';
import { canSpeak, speak } from '../utils/speech';

const seedOf = (s: string) => [...s].reduce((a, c) => (a * 31 + c.charCodeAt(0)) >>> 0, 7);

export function BakeryGame({ runId }: { runId: string }) {
  const { save } = useApp();
  const pack = getPack(save!.grade);
  const sp = save!.settings.speech, ko = save!.settings.koreanHelp;
  const built = useMemo(() => {
    try { return { orders: generateBakeryOrders(pack, mulberry32(seedOf(runId))), error: null as string | null }; }
    catch (e) { return { orders: [] as BakeryOrder[], error: (e as Error).message }; }
  }, [pack, runId]);
  const orders = built.orders;

  const [idx, setIdx] = useState(0);
  const [tray, setTray] = useState<string[]>([]);
  const [wrong, setWrong] = useState(0);        // wrong serves for the current order
  const [totalWrong, setTotalWrong] = useState(0);
  const [shelf, setShelf] = useState<Food[]>(orders[0]?.shelf ?? []);
  const [msg, setMsg] = useState<string | null>(null);
  const [phase, setPhase] = useState<'play' | 'serving' | 'result'>('play');
  const [mood, setMood] = useState<'' | 'happy' | 'sad'>('');
  const [collecting, setCollecting] = useState(false);
  const [drag, setDrag] = useState<{ food: Food; x: number; y: number } | null>(null);
  const trayRef = useRef<HTMLDivElement>(null);
  const start = useRef<{ x: number; y: number; moved: boolean } | null>(null);
  const order = orders[idx];
  const level = hintLevel(wrong);

  useEffect(() => { if (order && phase === 'play') speak(order.sentence, sp); }, [idx]); // eslint-disable-line react-hooks/exhaustive-deps

  if (built.error || !order) {
    return (
      <div className="overlay"><div className="panel reward"><h2>Content problem</h2><p>{built.error ?? 'No orders.'}</p><button className="btn" onClick={() => actions.closeModal()}>Close</button></div></div>
    );
  }

  const add = (f: Food) => { if (phase !== 'play') return; setTray((t) => (t.includes(f.id) || t.length >= 3 ? t : [...t, f.id])); setMsg(null); };
  const remove = (id: string) => phase === 'play' && setTray((t) => t.filter((x) => x !== id));

  const serve = () => {
    const j = judgeTray(order, tray);
    if (j === 'correct') {
      setMood('happy'); setPhase('serving'); setMsg('Yum! Thank you! 🎉');
      setTimeout(() => {
        setMood('');
        if (idx + 1 >= orders.length) { setPhase('result'); return; }
        const next = orders[idx + 1];
        setIdx(idx + 1); setTray([]); setWrong(0); setShelf(next.shelf); setMsg(null); setPhase('play');
      }, 900);
    } else if (j === 'partial') {
      setMsg('Good! There is one more. · 하나 더 있어요!');
    } else {
      const w = wrong + 1;
      setWrong(w); setTotalWrong((t) => t + 1); setMood('sad'); setTimeout(() => setMood(''), 600);
      const ans = new Set(order.answer.map((f) => f.id));
      setTray((t) => t.filter((id) => ans.has(id)));
      const first = order.answer[0].word[0];
      if (w === 1) setMsg(`Hmm, not that one. Hint: it starts with “${first}”. · 힌트: “${first}”로 시작해요.`);
      else if (w === 2) { setShelf(narrowShelf(order, mulberry32(seedOf(runId) + idx))); setMsg('Fewer choices now. Listen again! · 보기를 줄였어요. 다시 들어 봐요!'); }
      else setMsg('Here is the answer! Tap the glowing food. · 정답이에요! 반짝이는 음식을 눌러요.');
    }
  };

  const collect = () => {
    if (collecting) return;
    setCollecting(true);
    actions.finishMinigame('bakery', { runId, stars: starsFor(totalWrong), correct: orders.length, wrong: totalWrong, wordIds: orders.flatMap((o) => o.answer.map((f) => f.id)) });
    actions.closeModal();
  };

  if (phase === 'result') {
    const stars = starsFor(totalWrong);
    return (
      <div className="overlay"><div className="panel reward">
        <div className="ribbon">ALL ORDERS DONE!</div>
        <div className="stars" aria-label={`${stars} stars`}>{'⭐'.repeat(stars)}{'☆'.repeat(3 - stars)}</div>
        <p>{orders.map((o) => <span key={o.index} className="chip" style={{ margin: 3 }}>{o.answer.map((f) => f.emoji).join('')} {o.sentence}</span>)}</p>
        <p className="kr">{totalWrong === 0 ? 'Perfect! 완벽해요!' : `Mistakes: ${totalWrong} — you can try again for more stars. 다시 하면 별을 더 받을 수 있어요.`}</p>
        <button className="btn green big" disabled={collecting} onClick={collect}>Collect reward 🪙</button>
      </div></div>
    );
  }

  const textHidden = order.kind === 'listen' && level < 2;
  const showEn = (f: Food) => f.word;

  const onDown = (e: React.PointerEvent, f: Food) => {
    if (phase !== 'play' || tray.includes(f.id)) return;
    (e.currentTarget as HTMLElement).setPointerCapture(e.pointerId);
    start.current = { x: e.clientX, y: e.clientY, moved: false };
  };
  const onMove = (e: React.PointerEvent, f: Food) => {
    const s = start.current; if (!s) return;
    if (!s.moved && Math.hypot(e.clientX - s.x, e.clientY - s.y) > 10) s.moved = true;
    if (s.moved) setDrag({ food: f, x: e.clientX, y: e.clientY });
  };
  const onUp = (e: React.PointerEvent, f: Food) => {
    const s = start.current; start.current = null; setDrag(null);
    if (!s) return;
    if (!s.moved) return add(f);
    const r = trayRef.current?.getBoundingClientRect();
    if (r && e.clientX >= r.left && e.clientX <= r.right && e.clientY >= r.top && e.clientY <= r.bottom) add(f);
  };

  return (
    <div className="overlay">
      <div className="panel bake" role="dialog" aria-label="Bakery Order">
        <div className="modal-head" style={{ background: 'var(--sun)' }}>
          <span>🍞</span><span className="grow">Bakery Order <span className="kr">빵집 주문</span></span>
          <div className="dots" aria-label={`Order ${idx + 1} of ${orders.length}`}>{orders.map((o, i) => <span key={o.index} className={'dot' + (i < idx ? ' on' : i === idx ? ' cur' : '')} />)}</div>
          <button className="btn icon-btn small" aria-label="Leave" onClick={() => { if (window.confirm('Leave the bakery? Your orders will not be saved.\n나가면 이번 주문은 저장되지 않아요.')) actions.closeModal(); }}>✕</button>
        </div>
        <div className="bake-top">
          <div className={'customer ' + mood} aria-label={order.customer.name}>{order.customer.emoji}</div>
          <div className="bubble">
            <span className="grow">{textHidden ? <span className="muted">🔊 Listen carefully… <span className="kr">잘 들어 보세요</span></span> : order.sentence}</span>
            {canSpeak() && <button className="btn blue small" aria-label="Listen" onClick={() => speak(order.sentence, true)}>🔊 Listen</button>}
          </div>
        </div>
        <div className="bake-main">
          <div>
            <div className="shelf" aria-label="Shelf">
              {shelf.map((f) => {
                const inTray = tray.includes(f.id);
                const glow = level >= 3 && order.answer.includes(f);
                return (
                  <div key={f.id} className={'food' + (inTray ? ' gone' : '') + (glow ? ' glow' : '')} role="button" tabIndex={0} aria-label={f.word}
                    onPointerDown={(e) => onDown(e, f)} onPointerMove={(e) => onMove(e, f)} onPointerUp={(e) => onUp(e, f)} onPointerCancel={() => { start.current = null; setDrag(null); }}
                    onKeyDown={(e) => { if (e.key === 'Enter' || e.key === ' ') add(f); }}>
                    <div className="e">{f.emoji}</div><div className="w">{showEn(f)}</div>{ko && <div className="kr">{f.ko}</div>}
                  </div>
                );
              })}
            </div>
            {msg && <div className="hint" role="status">{msg}{level >= 3 && <> <br />{order.answer.map((f) => `${f.plural} = ${f.ko} ${f.emoji}`).join(' · ')}</>}</div>}
          </div>
          <div>
            <div ref={trayRef} className={'tray' + (drag ? ' over' : '') + (phase === 'serving' ? ' serve' : '')} aria-label="Tray">
              <b>Tray · 쟁반</b>
              <div className="items">
                {tray.length === 0 && <span className="muted kr">Drag or tap food here · 음식을 끌어다 놓거나 눌러요</span>}
                {tray.map((id) => { const f = shelf.find((x) => x.id === id) ?? order.shelf.find((x) => x.id === id)!; return <button key={id} className="food" style={{ minHeight: 70, width: 84 }} onClick={() => remove(id)} aria-label={`Remove ${f.word}`}><div className="e">{f.emoji}</div></button>; })}
              </div>
              <button className="btn green" disabled={tray.length === 0 || phase !== 'play'} onClick={serve}>Serve! 드려요</button>
            </div>
          </div>
        </div>
      </div>
      {drag && <div className="food dragging" style={{ left: drag.x, top: drag.y }}><div className="e">{drag.food.emoji}</div></div>}
    </div>
  );
}
