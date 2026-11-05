import { useEffect, useRef, useState } from 'react';
import { actions, useApp } from '../app/store';
import { assetUrl } from '../game/assetManager/manifest';
import { loadManifestOnce } from '../components/useManifest';

export function StartScreen() {
  const { profiles, contentErrors } = useApp();
  const [art, setArt] = useState<string | null>(null);
  const [showList, setShowList] = useState(false);
  const [info, setInfo] = useState(false);
  const [msg, setMsg] = useState<string | null>(null);
  const file = useRef<HTMLInputElement>(null);

  useEffect(() => {
    void loadManifestOnce().then((m) => {
      if (!m?.title) return;
      const img = new Image();
      img.onload = () => setArt(assetUrl(m.title!.file));
      img.src = assetUrl(m.title.file);
    });
  }, []);

  const onFile = async (f?: File) => {
    if (!f) return;
    const text = await f.text();
    let r = await actions.importText(text);
    if (r.needsConfirm && window.confirm(r.message)) r = await actions.importText(text, true);
    if (!r.ok && !r.needsConfirm) setMsg(r.message);
  };
  const del = async (id: string, nick: string) => {
    if (window.confirm(`Delete the town of "${nick}"? This cannot be undone.\n\n"${nick}" 마을을 지울까요? 되돌릴 수 없어요.`)) await actions.deleteProfile(id);
  };
  const cont = async (id: string) => {
    const e = await actions.continueProfile(id);
    if (e) setMsg(e);
  };

  return (
    <div className="screen">
      <div className={'title-bg' + (art ? '' : ' fallback')} style={art ? { backgroundImage: `url(${art})` } : undefined} />
      <div className="title-wrap">
        {!art && <h1 className="title-logo">MY ENGLISH<br />TOWN</h1>}
        {showList ? (
          <div className="panel profile-list">
            <b>Choose your town · 이어할 마을을 골라요</b>
            {profiles.map((p) => (
              <div className="profile" key={p.playerId}>
                <div className="grow"><b>{p.nickname}</b> · {p.townName}<div className="kr">{p.grade}학년 · Lv.{p.townLevel}</div></div>
                <button className="btn green small" onClick={() => void cont(p.playerId)}>Play</button>
                <button className="btn red small" aria-label={`Delete ${p.nickname}`} onClick={() => void del(p.playerId, p.nickname)}>🗑</button>
              </div>
            ))}
            <button className="btn small" onClick={() => setShowList(false)}>Back</button>
          </div>
        ) : (
          <div className="menu">
            <button className="btn green big" onClick={() => actions.goto('setup')}>🌱 New Game <span className="kr">새 게임</span></button>
            <button className="btn sun big" disabled={profiles.length === 0} onClick={() => (profiles.length === 1 ? void cont(profiles[0].playerId) : setShowList(true))}>▶ Continue <span className="kr">이어하기</span></button>
            <button className="btn blue" onClick={() => file.current?.click()}>📂 Load backup file <span className="kr">저장 파일 불러오기</span></button>
            <button className="btn lav" onClick={() => setInfo(true)}>⚙ Settings <span className="kr">설정</span></button>
            <input ref={file} type="file" accept=".json,application/json" hidden onChange={(e) => { void onFile(e.target.files?.[0]); e.target.value = ''; }} />
          </div>
        )}
        {msg && <div className="chip" role="alert">⚠ {msg}</div>}
      </div>
      {info && (
        <div className="overlay" onClick={() => setInfo(false)}>
          <div className="panel modal" onClick={(e) => e.stopPropagation()}>
            <div className="modal-head"><span className="grow">Settings · 설정</span><button className="btn icon-btn small" onClick={() => setInfo(false)} aria-label="Close">✕</button></div>
            <div className="modal-body">
              <p><b>Where is my town saved?</b><br />Your town is saved only in <b>this browser on this device</b>. It does not sync to other devices.<br /><span className="kr">마을은 이 기기의 이 브라우저에만 저장돼요. 다른 기기와 자동으로 연결되지 않아요. 브라우저 데이터를 지우면 사라질 수 있으니 게임 안 설정에서 백업 파일을 저장해 두세요.</span></p>
              <p><b>Saved towns on this device:</b> {profiles.length}</p>
              <p><b>Content check:</b> {contentErrors.length === 0 ? '✅ OK' : `⚠ ${contentErrors.length} problem(s)`}</p>
              {contentErrors.length > 0 && <ul>{contentErrors.map((e) => <li key={e}>{e}</li>)}</ul>}
              <p className="kr">선생님: src/content 폴더의 JSON 파일에서 단어와 문장을 바꿀 수 있어요 (README 참고).</p>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}
