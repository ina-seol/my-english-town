import { useMemo, useState } from 'react';
import { useApp } from '../app/store';
import { getPack } from '../content';
import { generateSchoolRounds } from '../systems/learning/games';
import { mulberry32, shuffle } from '../utils/rng';
import { GameFrame, HintBox, ResultCard, SpeechBubble, useAutoSpeak } from './shared';

const seedOf = (s: string) => [...s].reduce((a, c) => (a * 31 + c.charCodeAt(0)) >>> 0, 11);

/** Listen/read which subject is on which day, then place the right subject card in the right day column. */
export function SchoolGame({ runId }: { runId: string }) {
  const { save } = useApp();
  const pack = getPack(save!.grade);
  const cfg = pack.school!;
  const ko = save!.settings.koreanHelp;
  const rounds = useMemo(() => generateSchoolRounds(pack, mulberry32(seedOf(runId))), [pack, runId]);
  const hand = useMemo(() => shuffle(rounds.map((r) => r.subjectId), mulberry32(seedOf(runId) + 1)), [rounds, runId]);
  const [idx, setIdx] = useState(0);
  const [placed, setPlaced] = useState<Record<string, string>>({}); // dayId -> subjectId
  const [card, setCard] = useState<string | null>(null);
  const [wrong, setWrong] = useState(0);
  const [total, setTotal] = useState(0);
  const [msg, setMsg] = useState<string | null>(null);
  const [phase, setPhase] = useState<'play' | 'bell' | 'result'>('play');
  const round = rounds[idx];
  useAutoSpeak(round?.sentence, idx);

  const day = (id: string) => cfg.days.find((d) => d.id === id)!;
  const subj = (id: string) => cfg.subjects.find((s) => s.id === id)!;
  const answerDay = day(round.dayId), answerSubj = subj(round.subjectId);
  // hint ladder: 1 = first letters, 2 = fewer choices, 3 = show the answer
  const hideOthers = wrong >= 2;
  const keepDays = new Set([round.dayId, cfg.days.find((d) => d.id !== round.dayId && !placed[d.id])?.id]);
  const keepCards = new Set([round.subjectId, hand.find((c) => c !== round.subjectId && !Object.values(placed).includes(c))]);

  const tapDay = (dayId: string) => {
    if (phase !== 'play' || placed[dayId]) return;
    if (!card) { setMsg('Tap a subject card first! · 먼저 과목 카드를 눌러요.'); return; }
    if (card === round.subjectId && dayId === round.dayId) {
      setPlaced((p) => ({ ...p, [dayId]: card })); setCard(null); setWrong(0); setMsg(null);
      if (idx + 1 >= rounds.length) { setPhase('bell'); setTimeout(() => setPhase('result'), 1500); } else setIdx(idx + 1);
      return;
    }
    const w = wrong + 1;
    setWrong(w); setTotal((t) => t + 1); setCard(null);
    if (w === 1) setMsg(`Hint: the day starts with “${answerDay.en[0]}” and the subject starts with “${answerSubj.en[0].toLowerCase()}”. · 요일은 “${answerDay.en[0]}”, 과목은 “${answerSubj.en[0].toLowerCase()}”로 시작해요.`);
    else if (w === 2) setMsg('Fewer choices now. Listen again! · 보기를 줄였어요. 다시 들어 봐요!');
    else setMsg(`${answerDay.en} = ${answerDay.ko}, ${answerSubj.en} = ${answerSubj.ko}. Tap the glowing card, then the glowing day! · 반짝이는 카드와 요일을 눌러요!`);
  };

  if (phase === 'result') {
    return <ResultCard gameId="school" runId={runId} totalWrong={total} rounds={rounds.length} wordIds={rounds.flatMap((r) => [r.subjectId, r.dayId])}
      summary={<div className="row wrap" style={{ justifyContent: 'center' }}>{rounds.map((r) => <span key={r.dayId} className="chip">{subj(r.subjectId).emoji} {day(r.dayId).short}</span>)}</div>} />;
  }
  const textHidden = round.mode === 'listen' && wrong < 2;
  return (
    <GameFrame gameId="school" step={idx} total={rounds.length}>
      <SpeechBubble text={round.sentence} hidden={textHidden} />
      <div className="timetable" aria-label="Timetable">
        {cfg.days.map((d) => {
          const placedId = placed[d.id];
          const dim = hideOthers && !keepDays.has(d.id);
          const glow = wrong >= 3 && d.id === round.dayId;
          return (
            <button key={d.id} className={'tt-col' + (dim ? ' dim' : '') + (glow ? ' glow' : '')} disabled={!!placedId || dim} onClick={() => tapDay(d.id)} aria-label={d.en}>
              <b>{d.short}</b>{ko && <span className="kr">{d.ko}</span>}
              <div className="tt-slot">{placedId ? <span className="tt-card"><span className="e">{subj(placedId).emoji}</span>{subj(placedId).en}</span> : <span className="muted">1</span>}</div>
            </button>
          );
        })}
      </div>
      <div className="hand" aria-label="Subject cards">
        {hand.filter((c) => !Object.values(placed).includes(c)).map((c) => {
          const dim = hideOthers && !keepCards.has(c);
          const glow = wrong >= 3 && c === round.subjectId;
          return (
            <button key={c} className={'food' + (card === c ? ' picked' : '') + (dim ? ' dim' : '') + (glow ? ' glow' : '')} disabled={dim || phase !== 'play'} onClick={() => { setCard(c); setMsg(null); }}>
              <div className="e">{subj(c).emoji}</div><div className="w">{subj(c).en}</div>{ko && <div className="kr">{subj(c).ko}</div>}
            </button>
          );
        })}
      </div>
      {msg && <HintBox>{msg}</HintBox>}
      {phase === 'bell' && <div className="hint" style={{ textAlign: 'center', fontSize: 28 }}>🔔 Class starts! <span className="kr">수업 시작!</span></div>}
    </GameFrame>
  );
}
