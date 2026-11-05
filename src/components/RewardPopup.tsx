import { actions, useApp } from '../app/store';

export function RewardPopup() {
  const { rewards } = useApp();
  const r = rewards[0];
  if (!r) return null;
  return (
    <div className="overlay" style={{ zIndex: 80 }} role="dialog" aria-label="Reward">
      <div className="panel reward">
        <div className="ribbon">{r.levelUp ? 'LEVEL UP!' : r.quest ? 'QUEST CLEAR!' : 'NICE JOB!'}</div>
        <div style={{ fontSize: 64 }}>{r.levelUp ? '🌟' : r.quest ? '📜' : '🍞'}</div>
        <h2>{r.title}</h2>
        {r.quest && <div className="kr">{r.quest.title.ko}</div>}
        {r.levelUp ? <p>Your town is growing! <span className="kr">마을이 자라고 있어요! 새 장식이 열릴 수 있어요.</span></p> : (
          <div className="rwd-row"><span className="chip">🪙 +{r.coins}</span><span className="chip">⭐ +{r.exp} EXP</span></div>
        )}
        <button className="btn green big" autoFocus onClick={() => actions.dismissReward()}>OK! 확인</button>
      </div>
    </div>
  );
}
