import { useMemo, useState } from 'react';
import { useApp } from '../app/store';
import { getPack } from '../content';
import { generateParkRounds, parkProgress } from '../systems/learning/games';
import { mulberry32 } from '../utils/rng';
import { speak } from '../utils/speech';
import { GameFrame, HintBox, ResultCard, SpeechBubble, useAutoSpeak } from './shared';

const seedOf = (s: string) => [...s].reduce((a, c) => (a * 31 + c.charCodeAt(0)) >>> 0, 19);

/** Watch the action, then complete the sentence ("I'm dancing."). A correct sentence makes the character perform it. */
export function ParkGame({ runId }: { runId: string }) {
  const { save } = useApp();
  const pack = getPack(save!.grade);
  const cfg = pack.park!;
  const ko = save!.settings.koreanHelp;
  const sp = save!.settings.speech;
  const rounds = useMemo(() => generateParkRounds(pack, mulberry32(seedOf(runId))), [pack, runId]);
  const [idx, setIdx] = useState(0);
  const [picked, setPicked] = useState<string[]>([]);
  const [wrong, setWrong] = useState(0);
  const [total, setTotal] = useState(0);
  const [msg, setMsg] = useState<string | null>(null);
  const [phase, setPhase] = useState<'play' | 'perform' | 'result'>('play');
  const round = rounds[idx];
  const action = cfg.actions.find((a) => a.id === round.actionId)!;
  const build = cfg.mode === 'build';
  useAutoSpeak(round?.question, idx);

  const finishRound = () => {
    setPhase('perform'); setMsg(null); speak(round.answer, sp);
    setTimeout(() => {
      if (idx + 1 >= rounds.length) { setPhase('result'); return; }
      setIdx(idx + 1); setPicked([]); setWrong(0); setPhase('play');
    }, 2200);
  };
  const miss = (hint: string) => {
    const w = wrong + 1;
    setWrong(w); setTotal((t) => t + 1); setPicked([]);
    if (w === 1) setMsg(`${hint} · Look at the picture! · 그림을 잘 봐요!`);
    else if (w === 2) setMsg('Some choices are gone. · 보기를 줄였어요.');
    else setMsg(`“${round.answer}” — tap the glowing ${build ? 'words in order' : 'sentence'}! · 반짝이는 것을 눌러요!`);
  };

  const pick = (opt: string) => {
    if (phase !== 'play') return;
    if (!build) {
      if (opt === round.answer) finishRound(); else miss(`It starts with “${round.answer.slice(0, 4)}…”.`);
      return;
    }
    const next = [...picked, opt];
    const r = parkProgress(round, next);
    if (r === 'wrong') miss(`Start with “${round.tokens[0]}”.`);
    else { setPicked(next); setMsg(null); if (r === 'correct') finishRound(); }
  };

  // hint ladder 2: keep only the right chips plus one wrong one; 3: glow the next right chip
  const keepWrong = round.options.find((o) => !round.tokens.includes(o) && o !== round.answer);
  const visible = wrong >= 2 ? round.options.filter((o) => round.tokens.includes(o) || o === round.answer || o === keepWrong) : round.options;
  const nextToken = build ? round.tokens[picked.length] : round.answer;

  if (phase === 'result') {
    return <ResultCard gameId="park" runId={runId} totalWrong={total} rounds={rounds.length} wordIds={rounds.map((r) => r.actionId)}
      summary={<div>{rounds.map((r) => <div key={r.actionId} className="chip" style={{ margin: 3 }}>{cfg.actions.find((a) => a.id === r.actionId)!.emoji} {r.answer}</div>)}</div>} />;
  }
  return (
    <GameFrame gameId="park" step={idx} total={rounds.length}>
      <SpeechBubble text={round.question} />
      <div className="stage-park" aria-label={`${action.base} picture`}>
        <span className={'actor ' + (phase === 'perform' ? 'do-' + action.anim : '')}>{cfg.actor}</span>
        <span className={'act-emoji ' + (phase === 'perform' ? 'do-' + action.anim : '')}>{action.emoji}</span>
        <span className="act-ko">{ko ? action.ko : ''}</span>
      </div>
      {build && (
        <div className="sentence-slots" aria-label="Your sentence">
          {round.tokens.map((_, i) => <span key={i} className={'slot' + (picked[i] ? ' filled' : '')}>{picked[i] ?? '…'}</span>)}
          <button className="btn small" disabled={picked.length === 0 || phase !== 'play'} onClick={() => setPicked([])}>↺ Clear</button>
        </div>
      )}
      <div className="chips">
        {visible.map((o) => (
          <button key={o} className={'btn' + (wrong >= 3 && o === nextToken ? ' glow' : '') + (build && picked.includes(o) ? ' picked' : '')} disabled={phase !== 'play' || (build && picked.includes(o))} onClick={() => pick(o)}>{o}</button>
        ))}
      </div>
      {msg && <HintBox>{msg}</HintBox>}
      {phase === 'perform' && <div className="hint" style={{ textAlign: 'center', fontSize: 24 }}>🎉 {round.answer}</div>}
    </GameFrame>
  );
}
