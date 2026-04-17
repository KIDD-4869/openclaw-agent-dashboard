import { useState, useMemo, useCallback } from 'react';
import DATA from '../data/sbti-data';

const { questions, specialQuestions, typeLibrary, normalTypes, dimExplanations, dimensionMeta, dimensionOrder } = DATA;

/** Fisher-Yates 洗牌 */
function shuffle(arr) {
  const a = [...arr];
  for (let i = a.length - 1; i > 0; i--) {
    const j = Math.floor(Math.random() * (i + 1));
    [a[i], a[j]] = [a[j], a[i]];
  }
  return a;
}

/** 分值转等级 */
function sumToLevel(score) {
  if (score <= 3) return 'L';
  if (score === 4) return 'M';
  return 'H';
}
function levelNum(l) { return { L: 1, M: 2, H: 3 }[l]; }
function parsePattern(p) { return p.replace(/-/g, '').split(''); }

/** 计算测试结果 */
function computeResult(answers) {
  const rawScores = {};
  dimensionOrder.forEach(d => { rawScores[d] = 0; });
  questions.forEach(q => { rawScores[q.dim] += Number(answers[q.id] || 0); });

  const levels = {};
  Object.entries(rawScores).forEach(([dim, score]) => { levels[dim] = sumToLevel(score); });

  const userVector = dimensionOrder.map(d => levelNum(levels[d]));
  const ranked = normalTypes.map(type => {
    const vector = parsePattern(type.pattern).map(levelNum);
    let distance = 0, exact = 0;
    for (let i = 0; i < vector.length; i++) {
      distance += Math.abs(userVector[i] - vector[i]);
      if (userVector[i] === vector[i]) exact++;
    }
    const similarity = Math.max(0, Math.round((1 - distance / 30) * 100));
    return { ...type, ...typeLibrary[type.code], distance, exact, similarity };
  }).sort((a, b) => a.distance !== b.distance ? a.distance - b.distance : b.exact - a.exact);

  const bestNormal = ranked[0];
  const drunkTriggered = answers['drink_gate_q2'] === 2;

  let finalType, modeKicker = '你的主类型', badge, sub;
  if (drunkTriggered) {
    finalType = typeLibrary['DRUNK'];
    modeKicker = '隐藏人格已激活';
    badge = '匹配度 100% · 酒精异常因子已接管';
    sub = '乙醇亲和性过强，系统已直接跳过常规人格审判。';
  } else if (bestNormal.similarity < 60) {
    finalType = typeLibrary['HHHH'];
    modeKicker = '系统强制兜底';
    badge = `标准人格库最高匹配仅 ${bestNormal.similarity}%`;
    sub = '标准人格库对你的脑回路集体罢工了。';
  } else {
    finalType = bestNormal;
    badge = `匹配度 ${bestNormal.similarity}% · 精准命中 ${bestNormal.exact}/15 维`;
    sub = '维度命中度较高，当前结果可视为你的第一人格画像。';
  }

  return { rawScores, levels, ranked, finalType, modeKicker, badge, sub };
}

const btnStyle = {
  background: 'rgba(201, 168, 76, 0.12)', color: 'var(--gold-light)', border: '1px solid var(--border)', borderRadius: 6,
  padding: '6px 14px', fontSize: 13, cursor: 'pointer',
};
const btnPrimary = {
  background: 'linear-gradient(135deg, #8a6d2e, #c9a84c)', color: 'var(--bg-card)', border: 'none', borderRadius: 10,
  padding: '12px 24px', fontSize: 15, fontWeight: 700, cursor: 'pointer',
};

export default function SBTITest({ onBack, inModal = false }) {
  const [phase, setPhase] = useState('intro'); // intro | test | result
  const [answers, setAnswers] = useState({});
  const [result, setResult] = useState(null);

  // 洗牌后的题目列表（含特殊题插入）
  const shuffledQuestions = useMemo(() => {
    const shuffled = shuffle(questions);
    const insertIdx = Math.floor(Math.random() * shuffled.length) + 1;
    return [...shuffled.slice(0, insertIdx), specialQuestions[0], ...shuffled.slice(insertIdx)];
  }, [phase]); // phase 变化时重新洗牌

  // 可见题目（饮酒门控）
  const visibleQuestions = useMemo(() => {
    const visible = [...shuffledQuestions];
    if (answers['drink_gate_q1'] === 3) {
      const gateIdx = visible.findIndex(q => q.id === 'drink_gate_q1');
      if (gateIdx !== -1) visible.splice(gateIdx + 1, 0, specialQuestions[1]);
    }
    return visible;
  }, [shuffledQuestions, answers]);

  const answeredCount = visibleQuestions.filter(q => answers[q.id] !== undefined).length;
  const allDone = answeredCount === visibleQuestions.length && visibleQuestions.length > 0;
  const progress = visibleQuestions.length ? (answeredCount / visibleQuestions.length) * 100 : 0;

  const handleAnswer = useCallback((qid, value) => {
    setAnswers(prev => {
      const next = { ...prev, [qid]: value };
      // 取消饮酒选项时清除触发题答案
      if (qid === 'drink_gate_q1' && value !== 3) delete next['drink_gate_q2'];
      return next;
    });
  }, []);

  const handleSubmit = useCallback(() => {
    const r = computeResult(answers);
    setResult(r);
    setPhase('result');
    window.scrollTo({ top: 0, behavior: 'smooth' });
  }, [answers]);

  const handleRestart = useCallback(() => {
    setAnswers({});
    setResult(null);
    setPhase('intro');
  }, []);

  const startTest = useCallback(() => {
    setAnswers({});
    setPhase('test');
    window.scrollTo({ top: 0, behavior: 'smooth' });
  }, []);

  // ===== 开始页 =====
  if (phase === 'intro') {
    return (
      <div style={{ minHeight: inModal ? 0 : '100vh', background: inModal ? 'transparent' : 'var(--bg-card)', color: 'var(--gold-light)', padding: inModal ? 0 : 20 }}>
        <div style={{ maxWidth: 640, margin: '0 auto' }}>
          {!inModal && <button onClick={onBack} style={btnStyle}>← 返回百宝箱</button>}
          <div style={{ textAlign: 'center', marginTop: 60 }}>
            <div style={{ fontSize: 48, marginBottom: 16 }}>🧠</div>
            <h1 style={{ fontSize: 32, margin: '0 0 12px' }}>SBTI 人格测试</h1>
            <p style={{ color: 'var(--gold-dim)', fontSize: 15, lineHeight: 1.8, maxWidth: 480, margin: '0 auto 8px' }}>
              MBTI 已经过时，SBTI 来了。
            </p>
            <p style={{ color: 'var(--gold-dim)', fontSize: 13, lineHeight: 1.7, maxWidth: 480, margin: '0 auto 32px' }}>
              31 道题，5 大模型 15 个维度，27 种人格类型。<br />
              本测试仅供娱乐，别拿它当诊断、面试、相亲或人生判决书。
            </p>
            <button onClick={startTest} style={{ ...btnPrimary, fontSize: 17, padding: '14px 36px' }}>
              开始测试
            </button>
            <p style={{ color: '#5a4a30', fontSize: 12, marginTop: 24 }}>
              原作者：B站@蛆肉儿串儿
            </p>
          </div>
        </div>
      </div>
    );
  }

  // ===== 结果页 =====
  if (phase === 'result' && result) {
    const { finalType, modeKicker, badge, sub, levels, rawScores } = result;
    return (
      <div style={{ minHeight: inModal ? 0 : '100vh', background: inModal ? 'transparent' : 'var(--bg-card)', color: 'var(--gold-light)', padding: inModal ? 0 : 20 }}>
        <div style={{ maxWidth: 640, margin: '0 auto' }}>
          {!inModal && <button onClick={onBack} style={btnStyle}>← 返回百宝箱</button>}

          {/* 主类型卡片 */}
          <div style={{ background: 'var(--bg-card)', borderRadius: 16, padding: 28, marginTop: 20, border: '1px solid var(--border)' }}>
            <div style={{ fontSize: 12, color: 'var(--gold)', letterSpacing: 1, marginBottom: 8 }}>{modeKicker}</div>
            <h1 style={{ fontSize: 36, margin: '0 0 8px', letterSpacing: -1 }}>
              {finalType.code}（{finalType.cn}）
            </h1>
            <div style={{
              display: 'inline-flex', alignItems: 'center', gap: 8, borderRadius: 999,
              padding: '8px 14px', background: 'var(--bg-card)', border: '1px solid var(--border)',
              color: 'var(--gold)', fontWeight: 700, fontSize: 13, marginBottom: 16,
              textShadow: '0 0 8px rgba(201,168,76,0.4)',
            }}>{badge}</div>
            <p style={{ color: 'var(--gold-dim)', fontSize: 14, marginBottom: 16 }}>{sub}</p>
            {finalType.intro && (
              <p style={{ color: '#c8c0b0', fontSize: 15, fontStyle: 'italic', marginBottom: 16 }}>
                「{finalType.intro}」
              </p>
            )}
            <p style={{ color: 'var(--gold-dim)', fontSize: 14, lineHeight: 1.85 }}>{finalType.desc}</p>
          </div>

          {/* 15 维度评分 */}
          <div style={{ background: 'var(--bg-card)', borderRadius: 16, padding: 24, marginTop: 16, border: '1px solid var(--border)' }}>
            <h3 style={{ fontSize: 16, margin: '0 0 16px' }}>十五维度评分</h3>
            <div style={{ display: 'flex', flexDirection: 'column', gap: 10 }}>
              {dimensionOrder.map(dim => {
                const level = levels[dim];
                const meta = dimensionMeta[dim];
                const explanation = dimExplanations[dim]?.[level] || '';
                return (
                  <div key={dim} style={{
                    background: 'var(--bg-card)', borderRadius: 12, padding: '12px 14px',
                    border: '1px solid rgba(201, 168, 76, 0.15)',
                  }}>
                    <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: 6 }}>
                      <span style={{ fontSize: 13, color: 'var(--gold-dim)' }}>{meta?.name || dim}</span>
                      <span style={{ fontSize: 16, fontWeight: 800, color: 'var(--gold)', textShadow: '0 0 6px rgba(201,168,76,0.4)' }}>{level} / {rawScores[dim]}分</span>
                    </div>
                    <p style={{ fontSize: 13, color: 'var(--gold-dim)', margin: 0, lineHeight: 1.6 }}>{explanation}</p>
                  </div>
                );
              })}
            </div>
          </div>

          {/* 操作按钮 */}
          <div style={{ display: 'flex', gap: 12, justifyContent: 'center', marginTop: 24, marginBottom: 40 }}>
            <button onClick={handleRestart} style={btnPrimary}>🔄 重新测试</button>
            {!inModal && <button onClick={onBack} style={btnStyle}>← 返回百宝箱</button>}
          </div>

          <p style={{ textAlign: 'center', color: '#5a4a30', fontSize: 12, marginBottom: 20 }}>
            本测试仅供娱乐。原作者：B站@蛆肉儿串儿
          </p>
        </div>
      </div>
    );
  }

  // =====
  return (
    <div style={{ minHeight: inModal ? 0 : '100vh', background: inModal ? 'transparent' : 'var(--bg-card)', color: 'var(--gold-light)', padding: inModal ? 0 : 20 }}>
      <div style={{ maxWidth: 640, margin: '0 auto' }}>
        {!inModal && <button onClick={onBack} style={btnStyle}>← 返回百宝箱</button>}

        {/* 进度条 */}
        <div style={{ display: 'flex', alignItems: 'center', gap: 12, margin: '16px 0' }}>
          <div style={{
            flex: 1, height: 10, background: 'var(--bg-card)', borderRadius: 999, overflow: 'hidden',
          }}>
            <div style={{
              width: `${progress}%`, height: '100%', borderRadius: 999,
              background: 'linear-gradient(90deg, #8a6d2e, #c9a84c)', transition: 'width 0.2s',
            }} />
          </div>
          <span style={{ color: 'var(--gold-dim)', fontSize: 13, whiteSpace: 'nowrap' }}>
            {answeredCount} / {visibleQuestions.length}
          </span>
        </div>

        {/* 题目列表 */}
        <div style={{ display: 'flex', flexDirection: 'column', gap: 16 }}>
          {visibleQuestions.map((q, idx) => (
            <div key={q.id} style={{
              background: 'var(--bg-card)', borderRadius: 14, padding: 18,
              border: `1px solid ${answers[q.id] !== undefined ? 'var(--gold)' : 'var(--border)'}`,
              boxShadow: answers[q.id] !== undefined ? '0 0 8px rgba(201,168,76,0.15)' : 'none',
              transition: 'border-color 0.2s',
            }}>
              <div style={{ display: 'flex', justifyContent: 'space-between', marginBottom: 10, fontSize: 12, color: 'var(--gold-dim)' }}>
                <span style={{
                  background: 'var(--bg-card)', border: '1px solid var(--border)', borderRadius: 999,
                  padding: '4px 10px',
                }}>第 {idx + 1} 题</span>
                <span>{q.special ? '补充题' : (dimensionMeta[q.dim]?.name || q.dim)}</span>
              </div>
              <div style={{ fontSize: 15, lineHeight: 1.7, marginBottom: 14, whiteSpace: 'pre-wrap' }}>{q.text}</div>
              <div style={{ display: 'flex', flexDirection: 'column', gap: 8 }}>
                {q.options.map((opt, oi) => {
                  const code = ['A', 'B', 'C', 'D'][oi] || String(oi + 1);
                  const selected = answers[q.id] === opt.value;
                  return (
                    <label key={oi} style={{
                      display: 'flex', alignItems: 'flex-start', gap: 12,
                      padding: '12px 14px', borderRadius: 10,
                      border: `1px solid ${selected ? 'var(--gold)' : 'rgba(201, 168, 76, 0.15)'}`,
                      background: selected ? 'rgba(201,168,76,0.12)' : 'var(--bg-card)',
                      cursor: 'pointer', transition: 'all 0.15s',
                    }}>
                      <input
                        type="radio"
                        name={q.id}
                        checked={selected}
                        onChange={() => handleAnswer(q.id, opt.value)}
                        style={{ marginTop: 3, accentColor: 'var(--gold)' }}
                      />
                      <span style={{ fontWeight: 800, color: 'var(--gold)', minWidth: 20 }}>{code}</span>
                      <span style={{ fontSize: 14, lineHeight: 1.6 }}>{opt.label}</span>
                    </label>
                  );
                })}
              </div>
            </div>
          ))}
        </div>

        {/* 提交按钮 */}
        <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginTop: 20, marginBottom: 40 }}>
          <span style={{ color: 'var(--gold-dim)', fontSize: 13 }}>
            {allDone ? '都做完了，可以提交了。' : '全选完才会放行。'}
          </span>
          <button
            onClick={handleSubmit}
            disabled={!allDone}
            style={{ ...btnPrimary, opacity: allDone ? 1 : 0.4, cursor: allDone ? 'pointer' : 'not-allowed' }}
          >
            提交答案
          </button>
        </div>
      </div>
    </div>
  );
}
