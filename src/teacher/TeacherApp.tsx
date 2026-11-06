import { useEffect, useMemo, useRef, useState } from 'react';
import { GRADES, PACKS, SUPPORTED_ORDER_KINDS, validatePack, type Food, type GradePack, type OrderKind } from '../content';
import { applyPack, overrideKey, readLocalOverride } from '../content/overrides';
import type { Grade } from '../types';

const clone = <T,>(x: T): T => JSON.parse(JSON.stringify(x));
const blankFood = (): Food => ({ id: '', word: '', plural: '', ko: '', emoji: '🍽️' });

/**
 * Teacher page (separate from the student game: /teacher.html). Edits the bakery words and sentence patterns of a grade,
 * checks them with the same validator the game uses, and either tries them on this device or downloads a JSON file
 * to deploy as public/content/gradeN.json. It does not need (and does not pretend to have) a password: nothing here
 * can change what other students see until a file is deployed.
 */
export function TeacherApp() {
  const [grade, setGrade] = useState<Grade>(3);
  const [pack, setPack] = useState<GradePack>(() => clone(readLocalOverride(3) ?? PACKS[3]));
  const [msg, setMsg] = useState('');
  const file = useRef<HTMLInputElement>(null);
  const errors = useMemo(() => validatePack(pack), [pack]);

  useEffect(() => { setPack(clone(readLocalOverride(grade) ?? PACKS[grade])); setMsg(''); }, [grade]);

  const setFood = (i: number, patch: Partial<Food>) => setPack((p) => ({ ...p, foods: p.foods.map((f, k) => (k === i ? { ...f, ...patch } : f)) }));
  const setBakery = (patch: Partial<GradePack['bakery']>) => setPack((p) => ({ ...p, bakery: { ...p.bakery, ...patch } }));
  const slug = (w: string) => w.toLowerCase().replace(/[^a-z0-9]+/g, '-').replace(/^-|-$/g, '');

  const tryHere = () => {
    const errs = applyPack(grade, pack);
    if (errs.length) { setMsg('고칠 곳이 있어요: ' + errs.join(' / ')); return; }
    try { localStorage.setItem(overrideKey(grade), JSON.stringify(pack)); setMsg('이 기기에서 학생 게임을 열면 바뀐 내용이 보여요. (다른 기기에는 영향 없음)'); }
    catch { setMsg('이 브라우저에는 저장할 수 없어요.'); }
  };
  const resetHere = () => { try { localStorage.removeItem(overrideKey(grade)); } catch { /* ignore */ } setPack(clone(PACKS[grade])); setMsg('이 기기의 바꾼 내용을 지웠어요.'); };
  const download = () => {
    if (errors.length) { setMsg('먼저 아래 문제를 고쳐 주세요.'); return; }
    const url = URL.createObjectURL(new Blob([JSON.stringify(pack, null, 1)], { type: 'application/json' }));
    const a = document.createElement('a'); a.href = url; a.download = `grade${grade}.json`; document.body.appendChild(a); a.click(); a.remove();
    setTimeout(() => URL.revokeObjectURL(url), 1000);
    setMsg(`grade${grade}.json을 받았어요. 이 파일을 my-english-town/public/content/ 폴더에 넣고 GitHub에 올리면 모든 학생에게 적용돼요.`);
  };
  const loadFile = async (f?: File) => {
    if (!f) return;
    try { const p = JSON.parse(await f.text()) as GradePack; if (p.grade !== grade) { setMsg(`이 파일은 ${p.grade}학년 파일이에요. 학년을 맞춰 주세요.`); return; } setPack(p); setMsg('파일을 불러왔어요.'); }
    catch { setMsg('JSON 파일을 읽을 수 없어요.'); }
  };

  return (
    <div style={{ maxWidth: 980, margin: '0 auto', padding: 16, height: '100%', overflow: 'auto' }}>
      <div className="panel" style={{ padding: 16, display: 'grid', gap: 12 }}>
        <h1 style={{ margin: 0 }}>교사용 내용 편집 <span className="kr">Teacher · bakery words & sentences</span></h1>
        <p className="kr" style={{ margin: 0 }}>학생 게임과 따로 열리는 페이지예요. 여기서 고쳐도 “이 기기에서 시험”을 누르기 전에는 아무것도 바뀌지 않고, “파일 받기”로 만든 파일을 올려야 모든 학생에게 적용돼요.</p>
        <div className="seg">{GRADES.map((g) => <button key={g} className={'btn' + (g === grade ? ' on' : '')} onClick={() => setGrade(g)}>{g}학년</button>)}</div>

        <h3 style={{ margin: 0 }}>빵집 낱말 (Bakery words)</h3>
        <div style={{ overflow: 'auto' }}>
          <table className="tbl">
            <thead><tr><th>그림</th><th>단어 word</th><th>“I like …” 형태 plural</th><th>관사 형태 a (선택)</th><th>뜻 ko</th><th /></tr></thead>
            <tbody>
              {pack.foods.map((f, i) => (
                <tr key={i}>
                  <td><input aria-label="emoji" value={f.emoji} style={{ width: 56, fontSize: 22 }} onChange={(e) => setFood(i, { emoji: e.target.value })} /></td>
                  <td><input aria-label="word" value={f.word} onChange={(e) => setFood(i, { word: e.target.value, id: f.id && f.id !== slug(f.word) ? f.id : slug(e.target.value) })} /></td>
                  <td><input aria-label="plural" value={f.plural} onChange={(e) => setFood(i, { plural: e.target.value })} /></td>
                  <td><input aria-label="a form" value={f.a ?? ''} placeholder="a cake" onChange={(e) => setFood(i, { a: e.target.value || undefined })} /></td>
                  <td><input aria-label="ko" value={f.ko} onChange={(e) => setFood(i, { ko: e.target.value })} /></td>
                  <td><button className="btn small red" aria-label="delete row" onClick={() => setPack((p) => ({ ...p, foods: p.foods.filter((_, k) => k !== i) }))}>✕</button></td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
        <div><button className="btn small green" onClick={() => setPack((p) => ({ ...p, foods: [...p.foods, blankFood()] }))}>＋ 낱말 추가</button></div>

        <h3 style={{ margin: 0 }}>주문 방식 (Orders)</h3>
        <div className="row wrap">
          {pack.bakery.plan.map((k, i) => (
            <label key={i} className="field">주문 {i + 1}
              <select value={k} onChange={(e) => setBakery({ plan: pack.bakery.plan.map((x, j) => (j === i ? (e.target.value as OrderKind) : x)) })}>
                {SUPPORTED_ORDER_KINDS.map((o) => <option key={o} value={o}>{o === 'text' ? 'text · 글로 보여 주기' : o === 'two' ? 'two · 음식 2개' : 'listen · 듣기만'}</option>)}
              </select>
            </label>
          ))}
          <label className="field">선반 칸 수<input type="number" min={3} max={pack.foods.length} value={pack.bakery.shelfSize} onChange={(e) => setBakery({ shelfSize: Number(e.target.value) })} style={{ width: 90 }} /></label>
        </div>
        {(['text', 'two', 'listen'] as const).map((k) => (
          <label key={k} className="field">문장 틀 {k} <span className="kr">{'{0}'}=복수형, {'{0:a}'}=관사 형태, {'{1}'}=두 번째 음식</span>
            <input value={pack.bakery.templates[k] ?? ''} onChange={(e) => setBakery({ templates: { ...pack.bakery.templates, [k]: e.target.value } })} />
          </label>
        ))}
        <div className="chip" style={{ justifySelf: 'start' }}>미리보기: {pack.foods.length >= 2 ? pack.bakery.templates.two?.replace(/\{0(:a)?\}/, (_, a) => (a ? pack.foods[0].a ?? pack.foods[0].plural : pack.foods[0].plural)).replace(/\{1(:a)?\}/, (_, a) => (a ? pack.foods[1].a ?? pack.foods[1].plural : pack.foods[1].plural)) : '낱말을 2개 이상 넣어 주세요'}</div>

        {errors.length > 0 ? (
          <div className="hint" role="alert"><b>고칠 곳 {errors.length}개</b><ul>{errors.map((e) => <li key={e}>{e}</li>)}</ul></div>
        ) : <div className="chip" style={{ justifySelf: 'start', background: 'var(--mint)' }}>✅ 검사 통과</div>}

        <div className="row wrap">
          <button className="btn green" disabled={errors.length > 0} onClick={tryHere}>이 기기에서 시험</button>
          <button className="btn" onClick={resetHere}>이 기기 변경 지우기</button>
          <button className="btn sun" disabled={errors.length > 0} onClick={download}>파일 받기 (JSON)</button>
          <button className="btn blue" onClick={() => file.current?.click()}>파일 불러오기</button>
          <input ref={file} type="file" accept=".json,application/json" hidden onChange={(e) => { void loadFile(e.target.files?.[0]); e.target.value = ''; }} />
        </div>
        {msg && <div className="hint" role="status">{msg}</div>}
        <p className="kr" style={{ margin: 0 }}>학교 시간표·시장·우체국·공원 문제는 같은 JSON 파일의 school / market / post / park 부분을 직접 고치면 돼요 (README 참고). 고친 파일도 같은 검사를 거쳐서, 틀린 파일은 무시되고 기본 내용이 그대로 쓰여요.</p>
      </div>
    </div>
  );
}
