import { useState, type ReactNode } from 'react';
import { actions, flushSave, useApp } from '../app/store';
import { BUILDINGS, DECORATIONS, QUESTS, getBuilding, getDecor, getNpc, getPack } from '../content';
import { Icon } from './Icon';
import { GAME_INFO } from '../minigames/shared';
import { buildingUnlockState, nextUpgrade } from '../systems/building';
import { questState, requirementProgress } from '../systems/quests';
import { buildingUrl, decorUrl, useManifest } from './useManifest';

export function Shell({ title, icon, children, tone = 'var(--lav)' }: { title: string; icon: ReactNode; children: ReactNode; tone?: string }) {
  return (
    <div className="overlay" role="dialog" aria-label={title}>
      <div className="panel modal">
        <div className="modal-head" style={{ background: tone }}>
          <span>{icon}</span><span className="grow">{title}</span>
          <button className="btn icon-btn small" aria-label="Close" onClick={() => actions.closeModal()}>✕</button>
        </div>
        <div className="modal-body">{children}</div>
      </div>
    </div>
  );
}

const reasonText: Record<string, string> = {
  DISABLED: 'Coming soon · 준비 중', LOCKED_LEVEL: 'Need a higher Town Level · 마을 레벨이 더 필요해요',
  LOCKED_QUEST: 'Finish Ms. Rose\'s first request · 로즈 선생님의 첫 의뢰를 끝내요', ALREADY_BUILT: 'Already built · 이미 지었어요',
};

export function BuildPanel() {
  const { save } = useApp();
  const m = useManifest();
  const [tab, setTab] = useState<'new' | 'mine'>('new');
  if (!save) return null;
  const emoji = (id: string) => (id === 'house' ? '🏠' : '🏘');
  return (
    <Shell title="Build · 건설" icon={<Icon name="nav_build" fallback="🔨" />} tone="var(--sky)">
      <div className="tabs">
        <button className={'btn small' + (tab === 'new' ? ' on' : '')} onClick={() => setTab('new')}>Buildings</button>
        <button className={'btn small' + (tab === 'mine' ? ' on' : '')} onClick={() => setTab('mine')}>My buildings · 내 건물</button>
      </div>
      {tab === 'new' ? (
        <div className="grid">
          {BUILDINGS.filter((b) => !b.starter).map((b) => {
            const st = buildingUnlockState(save, b.id);
            const poor = save.coins < b.cost;
            const can = st === 'ok' && !poor;
            const url = buildingUrl(m, b.id, 1);
            return (
              <div key={b.id} className={'card' + (st === 'ok' ? '' : ' locked')}>
                <div className="pic">{url ? <img src={url} alt="" /> : <span style={{ fontSize: 40 }}>{emoji(b.id)}</span>}</div>
                <b>{b.name}</b><span className="kr">{b.ko} · {b.footprint.w}×{b.footprint.h}</span>
                <span className="chip"><Icon name="coin" fallback="🪙" size={18} /> {b.cost}</span>
                {st !== 'ok' ? <span className="kr">{reasonText[st]}{st === 'LOCKED_LEVEL' ? ` (Lv.${b.townLevel})` : ''}</span> : poor ? <span className="kr">Need {b.cost - save.coins} more coins · 코인이 부족해요</span> : null}
                <button className="btn green small" disabled={!can} onClick={() => actions.startPlacement('building', b.id)}>Build 짓기</button>
              </div>
            );
          })}
        </div>
      ) : (
        <div className="grid">
          {save.buildings.map((b) => {
            const d = getBuilding(b.defId)!;
            const up = nextUpgrade(save, b.id);
            const lockedLv = up && save.townLevel < up.townLevel;
            const poor = up && save.coins < up.cost;
            const url = buildingUrl(m, b.defId, b.level);
            return (
              <div key={b.id} className="card">
                <div className="pic">{url ? <img src={url} alt="" /> : <span style={{ fontSize: 40 }}>{emoji(b.defId)}</span>}</div>
                <b>{d.name} · Lv.{b.level}</b><span className="kr">{d.ko}</span>
                <div className="row wrap" style={{ justifyContent: 'center' }}>
                  <button className="btn blue small" onClick={() => actions.startPlacement('building', b.defId, b.id)}>Move 옮기기</button>
                  {b.level >= 3 ? <span className="chip">MAX ⭐</span> : up ? (
                    <button className="btn sun small" disabled={!!lockedLv || !!poor} onClick={() => { const r = actions.upgradeBuilding(b.id); actions.setToast(r.message); }}>
                      Upgrade ↑ <Icon name="coin" fallback="🪙" size={16} /> {up.cost}
                    </button>
                  ) : <span className="kr">No upgrades yet</span>}
                </div>
                {up && lockedLv && <span className="kr">Needs Town Lv.{up.townLevel} · 마을 레벨 {up.townLevel} 필요</span>}
              </div>
            );
          })}
        </div>
      )}
    </Shell>
  );
}

const CATEGORIES: [string, string, string][] = [
  ['plants', '🌳', 'Plants 식물'], ['flowers', '🌷', 'Flowers 꽃'], ['furniture', '🪑', 'Furniture 가구'], ['street', '🏮', 'Street 거리'],
  ['structures', '⛲', 'Structures 구조물'], ['play', '🛝', 'Play 놀이'], ['farm', '🥕', 'Farm 텃밭'], ['misc', '📮', 'More 기타'],
];

export function ShopPanel() {
  const { save } = useApp();
  const m = useManifest();
  const [cat, setCat] = useState('plants');
  if (!save) return null;
  const buy = (id: string) => { const r = actions.buyDecor(id); actions.setToast(r.message); };
  const list = DECORATIONS.filter((d) => (d.category ?? 'misc') === cat);
  return (
    <Shell title="Shop · 상점" icon={<Icon name="nav_shop" fallback="🛍" />} tone="var(--pink)">
      <p className="kr">장식을 사면 가방에 들어가요. 가방에서 마을에 놓아요. · Buy decorations, then place them from your Bag.</p>
      <div className="tabs">
        {CATEGORIES.map(([id, ic, label]) => <button key={id} className={'btn small' + (cat === id ? ' on' : '')} aria-pressed={cat === id} onClick={() => setCat(id)}>{ic} {label}</button>)}
      </div>
      <div className="grid">
        {list.map((d) => {
          const locked = save.townLevel < d.townLevel;
          const poor = save.coins < d.cost;
          const url = decorUrl(m, d.id);
          return (
            <div key={d.id} className={'card' + (locked ? ' locked' : '')}>
              <div className="pic">{url ? <img src={url} alt="" /> : d.emoji}</div>
              <b>{d.name}</b><span className="kr">{d.ko}{(save.inventory[d.id] ?? 0) > 0 ? ` · 🎒×${save.inventory[d.id]}` : ''}</span>
              <span className="chip"><Icon name="coin" fallback="🪙" size={18} /> {d.cost}</span>
              {locked && <span className="kr">Town Lv.{d.townLevel} needed · 마을 레벨 {d.townLevel}</span>}
              <button className="btn green small" disabled={locked || poor} onClick={() => buy(d.id)}>{poor && !locked ? 'Not enough coins' : 'Buy 사기'}</button>
            </div>
          );
        })}
      </div>
    </Shell>
  );
}

export function BagPanel() {
  const { save } = useApp();
  const m = useManifest();
  if (!save) return null;
  const owned = Object.entries(save.inventory).filter(([, n]) => n > 0);
  return (
    <Shell title="Bag · 가방" icon={<Icon name="nav_bag" fallback="🎒" />} tone="var(--mint)">
      <h3 style={{ margin: '0 0 8px' }}>Ready to place · 놓을 수 있는 장식</h3>
      {owned.length === 0 ? <p className="muted">Empty. Buy decorations in the Shop! · 비어 있어요. 상점에서 장식을 사 보세요.</p> : (
        <div className="grid">
          {owned.map(([id, n]) => {
            const d = getDecor(id)!;
            return (
              <div key={id} className="card">
                <div className="pic">{decorUrl(m, id) ? <img src={decorUrl(m, id)!} alt="" /> : d.emoji}</div>
                <b>{d.name} ×{n}</b><span className="kr">{d.ko}</span>
                <button className="btn green small" onClick={() => actions.startPlacement('decor', id)}>Place 놓기</button>
              </div>
            );
          })}
        </div>
      )}
      <h3 style={{ margin: '16px 0 8px' }}>In your town · 마을에 놓은 장식 ({save.decorations.length})</h3>
      {save.decorations.length === 0 ? <p className="muted">None yet.</p> : (
        <div className="grid">
          {save.decorations.map((c) => {
            const d = getDecor(c.defId)!;
            return (
              <div key={c.id} className="card">
                <div className="pic">{decorUrl(m, c.defId) ? <img src={decorUrl(m, c.defId)!} alt="" /> : d.emoji}</div>
                <b>{d.name}</b>
                <div className="row">
                  <button className="btn blue small" onClick={() => actions.startPlacement('decor', c.defId, c.id)}>Move</button>
                  <button className="btn small" onClick={() => actions.pickUpDecor(c.id)}>Pick up</button>
                </div>
              </div>
            );
          })}
        </div>
      )}
    </Shell>
  );
}

export function QuestsPanel() {
  const { save } = useApp();
  const [tab, setTab] = useState<'active' | 'done'>('active');
  if (!save) return null;
  const list = QUESTS.filter((q) => {
    const s = questState(save, q.id).status;
    return tab === 'done' ? s === 'completed' : s === 'active' || s === 'available';
  });
  return (
    <Shell title="Quests · 퀘스트" icon={<Icon name="nav_quest" fallback="📜" />} tone="var(--sun)">
      <div className="tabs">
        <button className={'btn small' + (tab === 'active' ? ' on' : '')} onClick={() => setTab('active')}>In progress</button>
        <button className={'btn small' + (tab === 'done' ? ' on' : '')} onClick={() => setTab('done')}>Done</button>
      </div>
      {list.length === 0 && <p className="muted">{tab === 'done' ? 'No finished quests yet.' : 'No quests right now. Explore your town!'}</p>}
      {list.map((q) => {
        const st = questState(save, q.id).status;
        return (
          <div className="qrow" key={q.id}>
            <div className="grow">
              <b>{q.title.en}</b> <span className="kr">{q.title.ko}</span>{q.optional && <span className="chip" style={{ marginLeft: 6, fontSize: 12 }}>Bonus 보너스 (선택)</span>}
              <div>{q.description.en}</div><div className="kr">{q.description.ko}</div>
              {st === 'available' && <div className="kr">👉 Talk to {getNpc(q.npc)?.name} to accept. · 주민에게 말을 걸어 수락해요.</div>}
              {st === 'active' && q.requirements.map((r, i) => {
                const p = requirementProgress(save, q, r);
                return <div key={i} className="row"><div className="progress grow"><i style={{ width: `${Math.min(100, (p.current / p.target) * 100)}%` }} /></div><span>{Math.min(p.current, p.target)}/{p.target}</span></div>;
              })}
            </div>
            <span className="chip"><Icon name="coin" fallback="🪙" size={18} /> {q.reward.coins}</span><span className="chip"><Icon name="star" fallback="⭐" size={18} /> {q.reward.exp}</span>
            {st === 'completed' && <span>✅</span>}
          </div>
        );
      })}
    </Shell>
  );
}

export function ProgressPanel() {
  const { save } = useApp();
  if (!save) return null;
  const pack = getPack(save.grade);
  const seen = save.learningProgress.wordsSeen;
  const acts = Object.entries(save.learningProgress.activities);
  return (
    <Shell title="My Progress · 학습 기록" icon={<Icon name="nav_map" fallback="📚" />} tone="var(--lav)">
      <div className="row wrap" style={{ marginBottom: 10 }}>
        <span className="chip">Grade {save.grade}</span><span className="chip">Words played: {Object.keys(seen).length}/{pack.foods.length}</span>
        <span className="chip">Quests done: {Object.values(save.questProgress).filter((q) => q.status === 'completed').length}/{QUESTS.length}</span>
      </div>
      {acts.length === 0 && <p className="muted">Play a mini-game to see your record! · 미니게임을 하면 기록이 보여요.</p>}
      {acts.map(([id, a]) => (
        <div className="qrow" key={id}>
          <b className="grow">{GAME_INFO[id] ? `${GAME_INFO[id].emoji} ${GAME_INFO[id].title}` : id}</b>
          <span>Plays {a.plays}</span><span>Best {'⭐'.repeat(a.bestStars)}</span><span className="kr">✔ {a.correct} · ✖ {a.wrong}</span>
        </div>
      ))}
      <h3>Words · 단어</h3>
      <div className="row wrap">
        {pack.foods.map((f) => <span key={f.id} className="chip" style={{ opacity: seen[f.id] ? 1 : 0.45 }}>{f.emoji} {f.word} <span className="kr">{f.ko}</span>{seen[f.id] ? ` ×${seen[f.id]}` : ''}</span>)}
      </div>
    </Shell>
  );
}

export function SettingsPanel() {
  const { save, saveStatus } = useApp();
  const [msg, setMsg] = useState('');
  if (!save) return null;
  const exportFile = () => {
    const text = actions.exportCurrent(); if (!text) return;
    const url = URL.createObjectURL(new Blob([text], { type: 'application/json' }));
    const a = document.createElement('a');
    a.href = url; a.download = `my-english-town-${save.nickname}-${new Date().toISOString().slice(0, 10)}.json`;
    document.body.appendChild(a); a.click(); a.remove(); setTimeout(() => URL.revokeObjectURL(url), 1000);
    setMsg('Backup file saved to your Downloads. · 백업 파일을 저장했어요.');
  };
  return (
    <Shell title="Settings · 설정" icon={<Icon name="gear" fallback="⚙" />} tone="var(--sky)">
      <div className="qrow"><b className="grow">Read aloud 🔊 소리 듣기</b><button className={'btn small' + (save.settings.speech ? ' green' : '')} aria-pressed={save.settings.speech} onClick={() => actions.updateSettings({ speech: !save.settings.speech })}>{save.settings.speech ? 'ON' : 'OFF'}</button></div>
      <div className="qrow"><b className="grow">Korean help 한국어 도움말</b><button className={'btn small' + (save.settings.koreanHelp ? ' green' : '')} aria-pressed={save.settings.koreanHelp} onClick={() => actions.updateSettings({ koreanHelp: !save.settings.koreanHelp })}>{save.settings.koreanHelp ? 'ON' : 'OFF'}</button></div>
      <div className="qrow"><div className="grow"><b>Save status</b><div className="kr">{saveStatus === 'saved' ? '✅ Saved on this device' : saveStatus === 'saving' ? 'Saving…' : saveStatus === 'error' ? '⚠ Save failed' : 'Auto-save is on'} · rev {save.revision}</div></div><button className="btn small" onClick={() => void flushSave()}>Save now</button></div>
      <div className="qrow"><div className="grow"><b>Backup file · 백업 파일</b><div className="kr">Your town lives only in this browser. Save a backup file to keep it safe or move to another device. 마을은 이 브라우저에만 있어요. 백업 파일로 안전하게 보관하세요.</div></div><button className="btn blue small" onClick={exportFile}>Download</button></div>
      {msg && <p>{msg}</p>}
      <div className="row" style={{ marginTop: 12 }}>
        <button className="btn" onClick={() => void actions.backToStart()}>🏠 Back to title (saves first)</button>
      </div>
    </Shell>
  );
}
