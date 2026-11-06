import { useRef } from 'react';
import { actions, useApp } from '../app/store';
import { GameCanvas } from '../components/GameCanvas';
import { Dialogue } from '../components/Dialogue';
import { BagPanel, BuildPanel, ProgressPanel, QuestsPanel, SettingsPanel, ShopPanel } from '../components/Panels';
import { RewardPopup } from '../components/RewardPopup';
import { MINIGAMES } from '../minigames';
import { bridge } from '../game/bridge';
import { expProgress } from '../systems/progression';
import { QUESTS } from '../content';
import { questState } from '../systems/quests';
import characters from '../content/characters.json';
import { spriteUrl, useManifest } from '../components/useManifest';
import { Icon } from '../components/Icon';
import type { SaveData } from '../types';

export function objective(save: SaveData): { en: string; ko: string } {
  if (!save.tutorial.moved) return { en: 'Walk around! Arrow keys, the pad, or tap the ground.', ko: '마을을 걸어 봐요! 방향키·화면 패드·땅 누르기' };
  // the next unfinished quest in the story chain tells the student what to do
  const withGoal = QUESTS.filter((q) => q.goal && questState(save, q.id).status !== 'completed');
  const next = withGoal.find((q) => questState(save, q.id).status === 'active') ?? withGoal.find((q) => questState(save, q.id).status === 'available') ?? withGoal[0];
  if (next?.goal) return next.goal;
  return { en: 'Keep going! Replay the games, upgrade buildings and decorate your town.', ko: '계속해 봐요! 게임을 또 하고, 건물을 키우고, 마을을 꾸며요.' };
}

function Dpad() {
  const set = (x: number, y: number) => { bridge.dir = { x, y }; };
  const b = (label: string, x: number, y: number, name: string) => (
    <button aria-label={name} style={{ gridColumn: x + 2, gridRow: y + 2 }}
      onPointerDown={(e) => { (e.currentTarget as HTMLElement).setPointerCapture(e.pointerId); set(x, y); }}
      onPointerUp={() => set(0, 0)} onPointerCancel={() => set(0, 0)} onLostPointerCapture={() => set(0, 0)}>{label}</button>
  );
  return <div className="dpad" aria-label="Move pad">{b('▲', 0, -1, 'Up')}{b('◀', -1, 0, 'Left')}{b('▶', 1, 0, 'Right')}{b('▼', 0, 1, 'Down')}</div>;
}

export function TownScreen() {
  const { save, modal, placement, rewards } = useApp();
  const m = useManifest();
  const placeMsg = useRef('');
  if (!save) return null;
  const { level, into, need } = expProgress(save.exp);
  const obj = objective(save);
  const ch = characters.find((c) => c.id === save.selectedCharacter);
  const face = spriteUrl(m, 'p', save.selectedCharacter);
  const busy = !!modal || !!placement;

  const nav = (icon: string, fallback: string, label: string, ko: string, type: 'build' | 'shop' | 'quests' | 'bag' | 'progress' | 'settings') => (
    <button key={type} className="btn nav" onClick={() => actions.openModal({ type } as never)} disabled={!!placement}>
      <span className="ic"><Icon name={icon} fallback={fallback} size={30} /></span><span>{label}</span><span className="kr">{ko}</span>
    </button>
  );

  return (
    <div className="town">
      <div className="hud">
        <div className="chip" title={ch?.name}>{face ? <img src={face} alt="" style={{ height: 28 }} /> : '🧑'} {save.nickname}</div>
        <span className="name">{save.townName}</span>
        <span className="chip">Lv.{level}</span>
        <div className="expbar" aria-label="Experience"><i style={{ width: need ? `${(into / need) * 100}%` : '100%' }} /><span>{need ? `EXP ${into}/${need}` : 'MAX'}</span></div>
        <div className="grow" />
        <span className="chip" aria-label="Coins"><Icon name="coin" fallback="🪙" size={24} /> {save.coins}</span>
        <button className="btn icon-btn small" aria-label="Settings" onClick={() => actions.openModal({ type: 'settings' })} disabled={!!placement}><Icon name="gear" fallback="⚙" size={28} /></button>
      </div>

      <div className="stage">
        <GameCanvas />
        <div className="objective panel" aria-live="polite"><b>Goal</b> · {obj.en}{save.settings.koreanHelp && <div className="kr">{obj.ko}</div>}</div>
        <div className="zoom">
          <button className="btn icon-btn small" aria-label="Zoom in" onClick={() => bridge.zoomBy(0.4)}>＋</button>
          <button className="btn icon-btn small" aria-label="Zoom out" onClick={() => bridge.zoomBy(-0.4)}>－</button>
        </div>
        {!busy && <Dpad />}
        {!busy && <div className="side-btns"><button className="btn green big" onClick={() => bridge.interact()}>✋ Talk / Enter</button></div>}
        {placement && (
          <div className="panel place-bar">
            <span className="chip">{placement.valid ? '✅ OK' : '❌ Cannot place here'}</span>
            <button className="btn" onClick={() => actions.cancelPlacement()}>Cancel</button>
            <button className="btn green" disabled={!placement.valid} onClick={() => { const r = actions.confirmPlacement(); placeMsg.current = r.message; if (!r.ok) actions.setToast(r.message); }}>
              Confirm ✔
            </button>
          </div>
        )}
      </div>

      <div className="bottombar">
        <button className="btn nav" onClick={() => { bridge.recenter(); actions.closeModal(); }} disabled={!!placement}><span className="ic"><Icon name="nav_home" fallback="🏘" size={30} /></span><span>Town</span><span className="kr">마을</span></button>
        {nav('nav_build', '🔨', 'Build', '건설', 'build')}
        {nav('nav_shop', '🛍', 'Shop', '상점', 'shop')}
        {nav('nav_quest', '📜', 'Quests', '퀘스트', 'quests')}
        {nav('nav_bag', '🎒', 'Bag', '가방', 'bag')}
        {nav('nav_map', '📚', 'Progress', '학습 기록', 'progress')}
      </div>

      {modal?.type === 'dialogue' && <Dialogue npcId={modal.npcId} />}
      {modal?.type === 'minigame' && MINIGAMES[modal.gameId] && (() => { const G = MINIGAMES[modal.gameId]; return <G key={modal.runId} runId={modal.runId} />; })()}
      {modal?.type === 'build' && <BuildPanel />}
      {modal?.type === 'shop' && <ShopPanel />}
      {modal?.type === 'quests' && <QuestsPanel />}
      {modal?.type === 'bag' && <BagPanel />}
      {modal?.type === 'progress' && <ProgressPanel />}
      {modal?.type === 'settings' && <SettingsPanel />}
      {!modal && rewards.length > 0 && <RewardPopup />}
    </div>
  );
}
