import { useMemo, useState } from 'react';
import { actions, useApp } from '../app/store';
import { getNpc, getPack, getQuest, substitute, type DialogueChoice } from '../content';
import { npcQuest, questState } from '../systems/quests';
import { mulberry32, shuffle } from '../utils/rng';
import { speak, canSpeak } from '../utils/speech';
import { portraitUrl, spriteUrl, useManifest } from './useManifest';
import { usePrimaryKey } from './usePrimaryKey';
import type { Bilingual } from '../types';

function Say({ line, speech, ko }: { line: Bilingual; speech: boolean; ko: boolean }) {
  return (
    <div className="say">
      <div className="row">
        <span className="grow">{line.en}</span>
        {canSpeak() && <button className="btn small blue" aria-label="Listen" onClick={() => speak(line.en, speech)}>🔊</button>}
      </div>
      {ko && <span className="kr">{line.ko}</span>}
    </div>
  );
}

/** NPC dialogue: offers a quest, runs the English conversation step, or reminds what to do. */
export function Dialogue({ npcId }: { npcId: string }) {
  const { save } = useApp();
  const m = useManifest();
  usePrimaryKey(true);
  const [page, setPage] = useState(0);
  if (!save) return null;
  const npc = getNpc(npcId);
  const pack = getPack(save.grade);
  if (!npc) return null;
  const nq = npcQuest(save, npcId);
  const sp = save.settings.speech, ko = save.settings.koreanHelp;
  const art = portraitUrl(m, npcId) ?? spriteUrl(m, 'n', npcId);

  const close = () => actions.closeModal();
  const script = nq ? pack.scripts[nq.quest.id] : undefined;
  const needsDialogue = !!nq && nq.quest.requirements.some((r) => r.type === 'flag' && r.flag === 'dialogue') && !questState(save, nq.quest.id).flags.dialogue;

  let body: React.ReactElement;
  if (!nq || !script) {
    const lines = pack.idle[npcId] ?? [{ en: 'Hello!', ko: '안녕!' }];
    const line = lines[(save.npcRelationships[npcId] ?? 0) % lines.length];
    body = (<><Say line={line} speech={sp} ko={ko} /><div className="row" style={{ marginTop: 12 }}><div className="grow" /><button className="btn" data-primary onClick={close}>Bye! 👋 <span className="kr">(Space)</span></button></div></>);
  } else if (nq.status === 'available') {
    const last = page >= script.offer.length - 1;
    body = (
      <>
        <Say line={script.offer[Math.min(page, script.offer.length - 1)]} speech={sp} ko={ko} />
        <div className="row" style={{ marginTop: 12 }}>
          <div className="chip">📜 {nq.quest.title.en}{ko && <span className="kr">· {nq.quest.title.ko}</span>}</div>
          <div className="grow" />
          {!last ? <button className="btn sun" data-primary onClick={() => setPage(page + 1)}>Next ▶ <span className="kr">(Space)</span></button> : (
            <>
              <button className="btn" onClick={close}>Later 나중에</button>
              <button className="btn green" data-primary onClick={() => { actions.acceptQuest(nq.quest.id); if (!nq.quest.requirements.some((r) => r.type === 'flag')) close(); }}>Accept! 수락</button>
            </>
          )}
        </div>
      </>
    );
  } else if (needsDialogue && script.dialogue) {
    body = <Challenge questId={nq.quest.id} onDone={close} />;
  } else {
    body = (<><Say line={script.remind} speech={sp} ko={ko} /><div className="row" style={{ marginTop: 12 }}><div className="chip">📜 {nq.quest.title.en}</div><div className="grow" /><button className="btn green" data-primary onClick={close}>OK! <span className="kr">(Space)</span></button></div></>);
  }

  return (
    <div className="overlay bottom" onClick={() => { /* keep open: avoid accidental dismissal */ }}>
      <div className="panel dlg">
        <div className="modal-head" style={{ background: 'var(--pink)' }}>
          <span className="grow">{npc.name} <span className="kr">{npc.ko}</span></span>
          <button className="btn icon-btn small" onClick={close} aria-label="Close">✕</button>
        </div>
        <div className="dlg-body">
          <div className="portrait">{art ? <img src={art} alt={npc.name} /> : npc.emoji}</div>
          <div className="grow">{body}</div>
        </div>
      </div>
    </div>
  );
}

/** Choose-the-right-reply conversation with the 3-step hint ladder. */
function Challenge({ questId, onDone }: { questId: string; onDone: () => void }) {
  const { save } = useApp();
  const [wrong, setWrong] = useState<string[]>([]);
  const [picked, setPicked] = useState<string | null>(null);
  const script = getPack(save!.grade).scripts[questId];
  const d = script.dialogue!;
  const nick = save!.nickname;
  const quest = getQuest(questId)!;
  const sp = save!.settings.speech, ko = save!.settings.koreanHelp;
  const order = useMemo(() => shuffle(d.choices, mulberry32(questId.length * 97 + nick.length)), [d, questId, nick]);
  const attempts = wrong.length;
  const correct = order.find((c) => c.correct)!;
  const hidden = attempts >= 2 ? order.filter((c) => !c.correct && !wrong.includes(c.en)).slice(0, 1).map((c) => c.en) : [];
  const done = picked === correct.en;

  const choose = (c: DialogueChoice) => {
    if (done) return;
    if (c.correct) { setPicked(c.en); speak(substitute(c.en, nick), sp); return; }
    setWrong((w) => (w.includes(c.en) ? w : [...w, c.en]));
  };

  return (
    <>
      <Say line={d.prompt} speech={sp} ko={ko} />
      <div className="choices">
        {order.map((c) => {
          const gone = wrong.includes(c.en) || hidden.includes(c.en);
          if (gone && !wrong.includes(c.en)) return null;
          const cls = 'btn choice' + (wrong.includes(c.en) ? ' wrong' : '') + (done && c.correct ? ' right' : '') + (attempts >= 3 && c.correct && !done ? ' glow' : '');
          return (
            <button key={c.en} className={cls} disabled={wrong.includes(c.en) || done} onClick={() => choose(c)}>
              {substitute(c.en, nick)} {ko && <span className="kr">{substitute(c.ko, nick)}</span>}
            </button>
          );
        })}
      </div>
      {attempts === 1 && <div className="hint">💡 {d.hint.en} {ko && <span className="kr">{d.hint.ko}</span>}</div>}
      {attempts === 2 && <div className="hint">💡 {d.hint.en} · One wrong answer was taken away. <span className="kr">틀린 보기 하나를 지웠어요.</span></div>}
      {attempts >= 3 && !done && <div className="hint">📘 {d.explain.en} {ko && <span className="kr">{d.explain.ko}</span>}<br />Tap the glowing answer! <span className="kr">반짝이는 답을 눌러 봐요!</span></div>}
      {done && (
        <div className="row" style={{ marginTop: 12 }}>
          <div className="say grow">{substitute(d.success.en, nick)} {ko && <span className="kr">{substitute(d.success.ko, nick)}</span>}</div>
          <button className="btn green" data-primary onClick={() => { actions.passDialogue(quest.id); onDone(); }}>Continue ▶ <span className="kr">(Space)</span></button>
        </div>
      )}
    </>
  );
}
