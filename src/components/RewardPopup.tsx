import { actions, useApp } from '../app/store';
import { Icon } from './Icon';
import { usePrimaryKey } from './usePrimaryKey';

export function RewardPopup() {
  const { rewards } = useApp();
  const r = rewards[0];
  usePrimaryKey(!!r);
  if (!r) return null;
  return (
    <div className="overlay" style={{ zIndex: 80 }} role="dialog" aria-label="Reward">
      <div className="panel reward">
        <div className="ribbon">{r.levelUp ? 'LEVEL UP!' : r.quest ? 'QUEST CLEAR!' : 'NICE JOB!'}</div>
        <div style={{ display: 'grid', placeItems: 'center' }}>{r.levelUp ? <Icon name="star" fallback="🌟" size={72} /> : r.quest ? <Icon name="nav_quest" fallback="📜" size={72} /> : <Icon name="nav_shop" fallback="🍞" size={72} />}</div>
        <h2>{r.title}</h2>
        {r.quest && <div className="kr">{r.quest.title.ko}</div>}
        {r.levelUp ? <p>Your town is growing! <span className="kr">마을이 자라고 있어요! 새 장식이 열릴 수 있어요.</span></p> : (
          <div className="rwd-row"><span className="chip"><Icon name="coin" fallback="🪙" size={22} /> +{r.coins}</span><span className="chip"><Icon name="star" fallback="⭐" size={22} /> +{r.exp} EXP</span></div>
        )}
        <button className="btn green big" data-primary onClick={() => actions.dismissReward()}>OK! 확인 <span className="kr">(Space)</span></button>
      </div>
    </div>
  );
}
