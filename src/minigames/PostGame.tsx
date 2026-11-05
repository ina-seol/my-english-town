import { useMemo, useState } from 'react';
import { useApp } from '../app/store';
import { getPack } from '../content';
import { generatePostRounds, postAnswer } from '../systems/learning/games';
import { mulberry32 } from '../utils/rng';
import { speak } from '../utils/speech';
import { GameFrame, HintBox, ResultCard, SpeechBubble, useAutoSpeak } from './shared';

const seedOf = (s: string) => [...s].reduce((a, c) => (a * 31 + c.charCodeAt(0)) >>> 0, 17);
const COLOR_HEX: Record<string, string> = { blue: '#bcd9ff', red: '#ffc2c2', yellow: '#fff0a8', green: '#c4f0c4' };

/** Read the clues on the parcel, ask residents "Is this your ...?", and deliver it to the right one. */
export function PostGame({ runId }: { runId: string }) {
  const { save } = useApp();
  const pack = getPack(save!.grade);
  const cfg = pack.post!;
  const ko = save!.settings.koreanHelp;
  const sp = save!.settings.speech;
  const rounds = useMemo(() => generatePostRounds(pack, mulberry32(seedOf(runId))), [pack, runId]);
  const [idx, setIdx] = useState(0);
  const [tried, setTried] = useState<string[]>([]);
  const [reply, setReply] = useState<{ id: string; yes: boolean } | null>(null);
  const [total, setTotal] = useState(0);
  const [msg, setMsg] = useState<string | null>(null);
  const [phase, setPhase] = useState<'play' | 'done' | 'result'>('play');
  const round = rounds[idx];
  const thing = cfg.things[round.thing];
  const wrong = tried.length;
  const resident = (id: string) => cfg.residents.find((r) => r.id === id)!;
  useAutoSpeak(round?.clue, idx);

  const ask = (id: string) => {
    if (phase !== 'play' || tried.includes(id)) return;
    const yes = postAnswer(round, id) === 'yes';
    const q = cfg.templates.ask.replace('{thing}', thing.en);
    speak(`${q} ${yes ? cfg.templates.yes : cfg.templates.no}`, sp);
    setReply({ id, yes });
    if (yes) {
      setPhase('done'); setMsg(null);
      setTimeout(() => {
        setReply(null);
        if (idx + 1 >= rounds.length) { setPhase('result'); return; }
        setIdx(idx + 1); setTried([]); setPhase('play');
      }, 1500);
      return;
    }
    const w = wrong + 1;
    setTried((t) => [...t, id]); setTotal((t) => t + 1);
    if (w === 1) setMsg(`Read the clue again: “${round.color}” and “${thing.en}”. · 단서를 다시 읽어 봐요.`);
    else if (w === 2) setMsg('Check the colour AND the thing. · 색깔과 물건을 모두 확인해요.');
    else setMsg(`The owner likes ${round.color} ${thing.en}s. Tap the glowing resident! · 반짝이는 주민을 눌러요!`);
  };

  if (phase === 'result') {
    return <ResultCard gameId="post" runId={runId} totalWrong={total} rounds={rounds.length} wordIds={rounds.map((r) => r.thing)}
      summary={<div className="row wrap" style={{ justifyContent: 'center' }}>{rounds.map((r) => <span key={r.ownerId} className="chip">{cfg.things[r.thing].emoji} → {resident(r.ownerId).name}</span>)}</div>} />;
  }
  return (
    <GameFrame gameId="post" step={idx} total={rounds.length}>
      <SpeechBubble text={round.clue} />
      <div className="parcel" style={{ background: COLOR_HEX[round.color] ?? '#eee' }} aria-label={`Parcel: ${round.color} ${thing.en}`}>
        <span className="pe">{thing.emoji}</span>
        <div><b>{round.color} {thing.en}</b>{ko && <div className="kr">{cfg.colors[round.color]} {thing.ko}</div>}</div>
        {phase === 'done' && <span className="stamp">DELIVERED ✔</span>}
      </div>
      <div className="residents">
        {round.residents.map((id) => {
          const r = resident(id);
          const glow = wrong >= 3 && id === round.ownerId;
          return (
            <button key={id} className={'resident' + (tried.includes(id) ? ' dim' : '') + (glow ? ' glow' : '')} disabled={phase !== 'play' || tried.includes(id)} onClick={() => ask(id)}>
              <div className="e">{r.emoji}</div><b>{r.name}</b>
              <span className="tag">likes: {r.color} {cfg.things[r.thing].en}</span>
              {reply?.id === id && (
                <span className={'reply ' + (reply.yes ? 'yes' : 'no')}>
                  <span className="kr">{cfg.templates.ask.replace('{thing}', thing.en)}</span><br />{reply.yes ? cfg.templates.yes : cfg.templates.no}
                </span>
              )}
            </button>
          );
        })}
      </div>
      <div className="muted kr">Tap a resident to ask: “{cfg.templates.ask.replace('{thing}', thing.en)}” · 주민을 눌러 물어봐요.</div>
      {msg && <HintBox>{msg}</HintBox>}
    </GameFrame>
  );
}
