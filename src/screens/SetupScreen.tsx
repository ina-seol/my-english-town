import { useState } from 'react';
import { actions } from '../app/store';
import characters from '../content/characters.json';
import { spriteUrl, useManifest } from '../components/useManifest';
import type { Grade } from '../types';

export function SetupScreen() {
  const m = useManifest();
  const [grade, setGrade] = useState<Grade>(3);
  const [nick, setNick] = useState('');
  const [town, setTown] = useState('Sunny Village');
  const [ch, setCh] = useState('c1');
  const [busy, setBusy] = useState(false);
  const ok = nick.trim().length > 0;
  return (
    <div className="screen" style={{ background: 'linear-gradient(#bfe6ff,#e8f8ff 60%,#b9f0c9)' }}>
      <div className="panel setup">
        <h2>Welcome, new mayor! <span className="kr">새 촌장님, 환영해요!</span></h2>
        <div className="field">Grade · 학년
          <div className="seg">
            {([3, 4] as Grade[]).map((g) => (
              <button key={g} className={'btn' + (grade === g ? ' on' : '')} aria-pressed={grade === g} onClick={() => setGrade(g)}>{g}학년 · Grade {g}</button>
            ))}
          </div>
        </div>
        <label className="field">Nickname or number · 닉네임 또는 번호
          <input value={nick} maxLength={12} onChange={(e) => setNick(e.target.value)} placeholder="Amy / 12" autoComplete="off" />
          <span className="kr">진짜 이름 대신 닉네임이나 번호를 써요.</span>
        </label>
        <div className="field">Pick your character · 캐릭터
          <div className="chars">
            {characters.map((c) => {
              const url = spriteUrl(m, 'p', c.id);
              return (
                <button key={c.id} className={'char' + (ch === c.id ? ' on' : '')} aria-pressed={ch === c.id} onClick={() => setCh(c.id)}>
                  {url ? <img src={url} alt={c.name} /> : (
                    <div style={{ height: 80, display: 'grid', placeItems: 'center' }}>
                      <div style={{ width: 44, height: 60, background: c.shirt, borderRadius: 12, border: '3px solid var(--brown)', position: 'relative' }}>
                        <div style={{ position: 'absolute', top: -20, left: 4, width: 30, height: 24, background: c.hair, borderRadius: 14, border: '3px solid var(--brown)' }} />
                      </div>
                    </div>
                  )}
                  <div>{c.name}</div>
                </button>
              );
            })}
          </div>
        </div>
        <label className="field">Town name · 마을 이름
          <input value={town} maxLength={20} onChange={(e) => setTown(e.target.value)} autoComplete="off" />
        </label>
        <div className="row">
          <button className="btn" onClick={() => actions.goto('start')}>← Back</button>
          <div className="grow" />
          <button className="btn green big" disabled={!ok || busy} onClick={() => { setBusy(true); void actions.newGame({ nickname: nick, grade, townName: town, character: ch }); }}>Start! 시작</button>
        </div>
      </div>
    </div>
  );
}
