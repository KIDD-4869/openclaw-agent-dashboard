import { useState, useEffect, useCallback, useRef } from 'react';
import './MenuPage.css';

/**
 * 菜谱页面 — 坐标系可视化菜品管理 + 一键生成一周菜单
 * X轴：口味（重/适中/淡） Y轴：荤素（素上荤下）
 * 设计：东方食谱美学 · 黑金主题
 */

const STORAGE_DISHES = 'menu-dishes';
const STORAGE_WEEKLY = 'menu-weekly';
const FLAVORS = ['重', '适中', '淡'];
const WEEKDAYS = ['周一', '周二', '周三', '周四', '周五', '周六', '周日'];
const WEEKDAY_EMOJI = ['🌙', '🔥', '💧', '🌿', '⚡', '🌸', '☀️'];
const WEEKDAY_VERSE = [
  '月出皎兮', '烈火烹油', '上善若水',
  '春风又绿', '雷霆万钧', '花开见佛', '日出东方'
];

const FLAVOR_CLS = { '重': 'heavy', '适中': 'medium', '淡': 'light' };
const TYPE_CLS = { '荤': 'meat', '素': 'veg' };

function isFlavorOk(a, b) { return !(a === b && (a === '重' || a === '淡')); }
function shuffle(a) { const r = [...a]; for (let i = r.length - 1; i > 0; i--) { const j = Math.floor(Math.random() * (i + 1)); [r[i], r[j]] = [r[j], r[i]]; } return r; }

// 菜品气泡
function Bubble({ d, onDel, idx }) {
  return (
    <span
      className={`menu-bubble menu-bubble--${TYPE_CLS[d.type]}`}
      style={{ animationDelay: `${idx * 40}ms` }}
    >
      <span className="menu-bubble__name">{d.name}</span>
      <span className="menu-bubble__del" onClick={e => { e.stopPropagation(); onDel(d.id); }} title="删除">✕</span>
    </span>
  );
}

// 坐标系格子
function Cell({ flavor, type, dishes, onDel, onCell }) {
  const list = dishes.filter(d => d.flavor === flavor && d.type === type);
  const empty = list.length === 0;
  return (
    <div
      className={`menu-cell menu-cell--${FLAVOR_CLS[flavor]}-${TYPE_CLS[type]} ${empty ? 'menu-cell--empty' : ''}`}
      onClick={() => empty && onCell(flavor, type)}
    >
      {list.length > 0 && <span className="menu-cell__count">{list.length}品</span>}
      <div className="menu-cell__items">
        {list.map((d, i) => <Bubble key={d.id} d={d} onDel={onDel} idx={i} />)}
      </div>
      {empty && (
        <div className="menu-cell__placeholder">
          <span className="menu-cell__plus">+</span>
          <span className="menu-cell__hint">{type}{flavor}味</span>
        </div>
      )}
    </div>
  );
}

// 口味/荤素标签
function Tag({ text, kind }) {
  return <span className={`menu-tag menu-tag--${kind}`}>{text}</span>;
}

export default function MenuPage({ inModal }) {
  const [dishes, setDishes] = useState(() => { try { return JSON.parse(localStorage.getItem(STORAGE_DISHES)) || []; } catch { return []; } });
  const [name, setName] = useState('');
  const [flavor, setFlavor] = useState('适中');
  const [type, setType] = useState('荤');
  const [weekly, setWeekly] = useState(() => { try { return JSON.parse(localStorage.getItem(STORAGE_WEEKLY)) || null; } catch { return null; } });
  const [msg, setMsg] = useState('');
  const [msgType, setMsgType] = useState('error'); // 'error' | 'success'
  const [tab, setTab] = useState('dishes');
  const [genAnim, setGenAnim] = useState(false);
  const inputRef = useRef(null);

  useEffect(() => { localStorage.setItem(STORAGE_DISHES, JSON.stringify(dishes)); }, [dishes]);
  useEffect(() => { if (weekly) localStorage.setItem(STORAGE_WEEKLY, JSON.stringify(weekly)); }, [weekly]);

  const showMsg = useCallback((text, type = 'error') => {
    setMsg(text);
    setMsgType(type);
    if (type === 'success') setTimeout(() => setMsg(''), 2000);
  }, []);

  const handleAdd = useCallback(() => {
    const t = name.trim();
    if (!t) { showMsg('请输入菜名'); inputRef.current?.focus(); return; }
    if (dishes.some(d => d.name === t)) { showMsg('「' + t + '」已在菜谱中'); return; }
    setDishes(p => [...p, { id: Date.now(), name: t, flavor, type }]);
    setName('');
    showMsg(`已添加「${t}」`, 'success');
    inputRef.current?.focus();
  }, [name, flavor, type, dishes, showMsg]);

  const handleDel = useCallback((id) => {
    setDishes(prev => {
      const del = prev.find(d => d.id === id);
      const next = prev.filter(d => d.id !== id);
      if (del) setWeekly(w => {
        if (!w) return w;
        if (w.some(i => i.meat.name === del.name || i.veg.name === del.name)) { localStorage.removeItem(STORAGE_WEEKLY); return null; }
        return w;
      });
      return next;
    });
  }, []);

  const handleCellClick = useCallback((f, t) => { setFlavor(f); setType(t); inputRef.current?.focus(); }, []);

  const handleGen = useCallback(() => {
    const m = dishes.filter(d => d.type === '荤'), v = dishes.filter(d => d.type === '素');
    if (m.length < 7) { showMsg(`荤菜尚缺 ${7 - m.length} 道（当前 ${m.length}/7）`); return; }
    if (v.length < 7) { showMsg(`素菜尚缺 ${7 - v.length} 道（当前 ${v.length}/7）`); return; }
    setGenAnim(true);
    setTimeout(() => {
      for (let a = 0; a < 200; a++) {
        const ms = shuffle(m).slice(0, 7), vs = shuffle(v).slice(0, 7);
        if (ms.every((x, i) => isFlavorOk(x.flavor, vs[i].flavor))) {
          setWeekly(WEEKDAYS.map((d, i) => ({ day: d, meat: ms[i], veg: vs[i] })));
          setMsg(''); setTab('weekly'); setGenAnim(false); return;
        }
      }
      showMsg('口味约束下无法生成，请添加更多不同口味的菜品');
      setGenAnim(false);
    }, 800);
  }, [dishes, showMsg]);

  const meatCount = dishes.filter(d => d.type === '荤').length;
  const vegCount = dishes.filter(d => d.type === '素').length;

  return (
    <div className="menu-page">
      {/* 装饰性背景纹理 */}
      <div className="menu-page__texture" />

      {/* Tab 切换 */}
      <div className="menu-tabs">
        <button className={`menu-tab ${tab === 'dishes' ? 'menu-tab--active' : ''}`} onClick={() => setTab('dishes')}>
          <span className="menu-tab__icon">🥘</span>
          <span className="menu-tab__text">菜品管理</span>
          <span className="menu-tab__count">{dishes.length}</span>
        </button>
        <button className={`menu-tab ${tab === 'weekly' ? 'menu-tab--active' : ''}`} onClick={() => setTab('weekly')}>
          <span className="menu-tab__icon">📅</span>
          <span className="menu-tab__text">一周菜单</span>
          {weekly && <span className="menu-tab__dot" />}
        </button>
        <div className="menu-tabs__stats">
          <span className="menu-tabs__meat">荤 {meatCount}</span>
          <span className="menu-tabs__divider" />
          <span className="menu-tabs__veg">素 {vegCount}</span>
        </div>
      </div>

      {msg && (
        <div className={`menu-msg menu-msg--${msgType}`} onClick={() => setMsg('')}>
          <span className="menu-msg__icon">{msgType === 'error' ? '⚠' : '✓'}</span>
          {msg}
        </div>
      )}

      {/* ── 菜品管理 ── */}
      {tab === 'dishes' && (
        <div className="menu-dishes">
          {/* 添加表单 */}
          <div className="menu-form">
            <div className="menu-form__row">
              <div className="menu-form__input-wrap">
                <input
                  ref={inputRef}
                  className="menu-form__input"
                  value={name}
                  onChange={e => setName(e.target.value)}
                  onKeyDown={e => { if (e.key === 'Enter') handleAdd(); }}
                  placeholder="添一道拿手菜…"
                  maxLength={20}
                />
                <span className="menu-form__input-line" />
              </div>
              <button className="menu-form__add" onClick={handleAdd}>
                <span className="menu-form__add-icon">+</span>
              </button>
            </div>
            <div className="menu-form__selectors">
              <div className="menu-form__group">
                <span className="menu-form__label">口味</span>
                <div className="menu-form__pills">
                  {FLAVORS.map(f => (
                    <button
                      key={f}
                      className={`menu-pill menu-pill--${FLAVOR_CLS[f]} ${flavor === f ? 'menu-pill--active' : ''}`}
                      onClick={() => setFlavor(f)}
                    >{f}</button>
                  ))}
                </div>
              </div>
              <div className="menu-form__group">
                <span className="menu-form__label">荤素</span>
                <div className="menu-form__pills">
                  {['荤', '素'].map(t => (
                    <button
                      key={t}
                      className={`menu-pill menu-pill--${TYPE_CLS[t]} ${type === t ? 'menu-pill--active' : ''}`}
                      onClick={() => setType(t)}
                    >{t}</button>
                  ))}
                </div>
              </div>
            </div>
          </div>

          {/* 坐标系 */}
          {dishes.length === 0 ? (
            <div className="menu-empty">
              <div className="menu-empty__bowl">🍜</div>
              <div className="menu-empty__text">灶台尚冷</div>
              <div className="menu-empty__hint">添几道拿手菜，让烟火气升起来</div>
            </div>
          ) : (
            <div className="menu-grid">
              {/* Y轴标签 */}
              <div className="menu-grid__y-axis">
                <div className="menu-grid__y-item menu-grid__y-item--veg">
                  <span className="menu-grid__y-icon">🥬</span>
                  <span className="menu-grid__y-text">素</span>
                </div>
                <div className="menu-grid__y-item menu-grid__y-item--meat">
                  <span className="menu-grid__y-icon">🥩</span>
                  <span className="menu-grid__y-text">荤</span>
                </div>
              </div>
              {/* 网格 */}
              <div className="menu-grid__body">
                <div className="menu-grid__row">
                  {FLAVORS.map(f => <Cell key={'素' + f} flavor={f} type="素" dishes={dishes} onDel={handleDel} onCell={handleCellClick} />)}
                </div>
                <div className="menu-grid__divider">
                  <span className="menu-grid__divider-text">· · ·</span>
                </div>
                <div className="menu-grid__row">
                  {FLAVORS.map(f => <Cell key={'荤' + f} flavor={f} type="荤" dishes={dishes} onDel={handleDel} onCell={handleCellClick} />)}
                </div>
                {/* X轴标签 */}
                <div className="menu-grid__x-axis">
                  {FLAVORS.map(f => (
                    <span key={f} className={`menu-grid__x-label menu-grid__x-label--${FLAVOR_CLS[f]}`}>
                      <span className="menu-grid__x-dot" />
                      {f}
                    </span>
                  ))}
                </div>
              </div>
            </div>
          )}

          {/* 生成按钮 */}
          {dishes.length > 0 && (
            <div className="menu-gen-wrap">
              <button
                className={`menu-gen-btn ${genAnim ? 'menu-gen-btn--spin' : ''}`}
                onClick={handleGen}
                disabled={genAnim}
              >
                <span className="menu-gen-btn__dice">🎲</span>
                <span className="menu-gen-btn__text">{genAnim ? '掷骰中…' : '生成一周菜单'}</span>
                <span className="menu-gen-btn__shine" />
              </button>
            </div>
          )}
        </div>
      )}

      {/* ── 一周菜单 ── */}
      {tab === 'weekly' && (
        <div className="menu-weekly">
          {!weekly ? (
            <div className="menu-empty">
              <div className="menu-empty__bowl">📜</div>
              <div className="menu-empty__text">食单未成</div>
              <div className="menu-empty__hint">先去菜品管理添菜，再掷骰生成</div>
            </div>
          ) : (
            <>
              <div className="menu-weekly__toolbar">
                <span className="menu-weekly__title">本周食单</span>
                <button className="menu-weekly__regen" onClick={handleGen} disabled={genAnim}>
                  🎲 {genAnim ? '掷骰中…' : '换一组'}
                </button>
              </div>
              <div className="menu-weekly__list">
                {weekly.map((item, i) => (
                  <div key={i} className="menu-weekly__card" style={{ animationDelay: `${i * 70}ms` }}>
                    <div className="menu-weekly__day">
                      <span className="menu-weekly__day-emoji">{WEEKDAY_EMOJI[i]}</span>
                      <span className="menu-weekly__day-text">{item.day}</span>
                      <span className="menu-weekly__day-verse">{WEEKDAY_VERSE[i]}</span>
                    </div>
                    <div className="menu-weekly__dishes">
                      <div className="menu-weekly__dish">
                        <Tag text="荤" kind="meat" />
                        <span className="menu-weekly__dish-name">{item.meat.name}</span>
                        <Tag text={item.meat.flavor} kind={FLAVOR_CLS[item.meat.flavor]} />
                      </div>
                      <div className="menu-weekly__sep" />
                      <div className="menu-weekly__dish">
                        <Tag text="素" kind="veg" />
                        <span className="menu-weekly__dish-name">{item.veg.name}</span>
                        <Tag text={item.veg.flavor} kind={FLAVOR_CLS[item.veg.flavor]} />
                      </div>
                    </div>
                  </div>
                ))}
              </div>
            </>
          )}
        </div>
      )}
    </div>
  );
}
