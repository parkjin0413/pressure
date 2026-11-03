'use client';

import { useEffect, useRef, useState, type FormEvent } from 'react';
import type { User } from '@supabase/supabase-js';
import { Activity, ArrowDownLeft, ArrowUpRight, CalendarDays, Check, ChevronRight, Download, Heart, History, LayoutDashboard, Leaf, LogOut, Plus, ShieldCheck, TrendingUp, Trash2, X } from 'lucide-react';
import { supabase } from '@/lib/supabase';
import { average, csv, dateLabel, loginEmail, periodReadings, validateReading, type Reading } from '@/lib/records';

type Tab = 'home' | 'history' | 'stats';
const tabs = [{ id: 'home' as Tab, label: '오늘의 혈압', icon: LayoutDashboard }, { id: 'history' as Tab, label: '기록 내역', icon: History }, { id: 'stats' as Tab, label: '통계 보기', icon: TrendingUp }];

export default function Home() {
  const [user, setUser] = useState<User | null>(null);
  const [ready, setReady] = useState(false);
  const [demo, setDemo] = useState(false);
  const [readings, setReadings] = useState<Reading[]>([]);
  const [tab, setTab] = useState<Tab>('home');
  const [days, setDays] = useState(7);
  const [modal, setModal] = useState(false);
  const [busy, setBusy] = useState(false);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState('');
  const [notice, setNotice] = useState('');
  const [clock, setClock] = useState<Date | null>(null);
  const [deleteId, setDeleteId] = useState<string | null>(null);
  const addButton = useRef<HTMLButtonElement>(null);
  const firstInput = useRef<HTMLInputElement>(null);
  const requestVersion = useRef(0);

  useEffect(() => {
    setClock(new Date());
    const timer = setInterval(() => setClock(new Date()), 30000);
    if (!supabase) { setReady(true); return () => clearInterval(timer); }
    const { data: { subscription } } = supabase.auth.onAuthStateChange((_event, session) => {
      setUser(session?.user ?? null); setReady(true);
    });
    return () => { clearInterval(timer); subscription.unsubscribe(); };
  }, []);

  useEffect(() => {
    const version = ++requestVersion.current;
    if (!user || demo || !supabase) return;
    setLoading(true); setReadings([]); setError('');
    const client = supabase;
    void (async () => {
      const membership = await client.from('pressure_members').select('user_id').eq('user_id', user.id).maybeSingle();
      if (version !== requestVersion.current) return;
      if (membership.error || !membership.data) { setError('사용이 허용된 계정이 아니거나 데이터베이스가 연결되지 않았어요. 설정을 확인해 주세요.'); setLoading(false); return; }
      // Paginate so statistics and exports include every record, beyond Supabase's default row limit.
      const all: Reading[] = [];
      for (let offset = 0; ; offset += 1000) {
        const { data, error } = await client.from('pressure_readings').select('id,systolic,diastolic,pulse,note,measured_at').order('measured_at', { ascending: false }).order('id').range(offset, offset + 999);
        if (version !== requestVersion.current) return;
        if (error) { setError('기록을 불러오지 못했어요. 연결을 확인한 후 다시 시도해 주세요.'); setLoading(false); return; }
        all.push(...data as Reading[]);
        if (data.length < 1000) break;
      }
      setReadings(all); setLoading(false);
    })();
  }, [user, demo]);

  useEffect(() => {
    if (!modal) return;
    firstInput.current?.focus();
    const previous = document.body.style.overflow;
    document.body.style.overflow = 'hidden';
    return () => { document.body.style.overflow = previous; addButton.current?.focus(); };
  }, [modal]);

  useEffect(() => {
    if (!notice) return;
    const timeout = setTimeout(() => setNotice(''), 4500);
    return () => clearTimeout(timeout);
  }, [notice]);

  function enterDemo() {
    setDemo(true); setError(''); setReadings([]);
    try { setReadings(JSON.parse(localStorage.getItem('maeil-demo-v1') ?? '[]')); } catch { /* Empty demo if browser storage is unavailable. */ }
  }

  function storeDemo(next: Reading[]) {
    try { localStorage.setItem('maeil-demo-v1', JSON.stringify(next)); }
    catch { throw new Error('브라우저 저장 공간에 접근할 수 없어요. 저장 설정을 확인해 주세요.'); }
    setReadings(next);
  }

  async function login(event: FormEvent<HTMLFormElement>) {
    event.preventDefault(); if (!supabase) return;
    const data = new FormData(event.currentTarget);
    setBusy(true); setError('');
    try {
      const result = await supabase.auth.signInWithPassword({ email: loginEmail(String(data.get('email'))), password: String(data.get('password')) });
      if (result.error) setError('로그인하지 못했어요. 아이디와 비밀번호 또는 네트워크 연결을 확인해 주세요.');
    } catch { setError('서버에 연결할 수 없어요. 잠시 후 다시 시도해 주세요.'); }
    finally { setBusy(false); }
  }

  async function logout() {
    setBusy(true); setError('');
    try {
      if (!demo && supabase) { const { error } = await supabase.auth.signOut({ scope: 'local' }); if (error) throw error; }
      requestVersion.current++; setDemo(false); setUser(null); setReadings([]); setTab('home'); setNotice('');
    } catch { setError('로그아웃하지 못했어요. 다시 시도해 주세요.'); }
    finally { setBusy(false); }
  }

  async function save(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();
    const data = new FormData(event.currentTarget);
    const systolic = Number(data.get('systolic')), diastolic = Number(data.get('diastolic'));
    const pulse = data.get('pulse') ? Number(data.get('pulse')) : null;
    const validation = validateReading(systolic, diastolic, pulse);
    if (validation) { setError(validation); return; }
    setBusy(true); setError('');
    const values = { systolic, diastolic, pulse, note: String(data.get('note') ?? '').trim() };
    try {
      if (demo) storeDemo([{ ...values, id: crypto.randomUUID(), measured_at: new Date().toISOString() }, ...readings]);
      else if (supabase && user) {
        const { data: row, error } = await supabase.from('pressure_readings').insert(values).select('id,systolic,diastolic,pulse,note,measured_at').single();
        if (error) throw error;
        setReadings(prev => [row as Reading, ...prev]);
      } else throw new Error('로그인이 필요해요.');
      setModal(false); setNotice(demo ? '체험 기록을 이 브라우저에 저장했어요.' : '혈압을 기록했어요. 오늘도 잘 챙기셨어요!');
    } catch { setError('저장하지 못했어요. 로그인 상태와 연결을 확인한 뒤 다시 시도해 주세요.'); }
    finally { setBusy(false); }
  }

  async function remove(id: string) {
    setBusy(true); setError('');
    try {
      if (demo) storeDemo(readings.filter(r => r.id !== id));
      else if (supabase) {
        const { data, error } = await supabase.from('pressure_readings').delete().eq('id', id).select('id');
        if (error || !data?.length) throw error ?? new Error('Missing record');
        setReadings(prev => prev.filter(r => r.id !== id));
      }
      setDeleteId(null); setNotice('기록을 삭제했어요.');
    } catch { setError('삭제하지 못했어요. 다시 시도해 주세요.'); }
    finally { setBusy(false); }
  }

  function download() {
    const url = URL.createObjectURL(new Blob([csv(filtered)], { type: 'text/csv;charset=utf-8;' }));
    const link = document.createElement('a'); link.href = url; link.download = `매일혈압_${days}일_${new Date().toISOString().slice(0, 10)}.csv`; link.click(); URL.revokeObjectURL(url);
  }

  const filtered = periodReadings(readings, days);
  const latest = readings[0];
  const displayName = demo ? '체험' : (user?.user_metadata?.display_name || '회원');
  const recordedDays = new Set(filtered.map(r => new Date(r.measured_at).toLocaleDateString('sv-SE'))).size;

  if (!ready) return <main className="splash"><Activity size={34} /><p>매일혈압을 준비하고 있어요…</p></main>;

  if (!user && !demo) return <main className="login-page">
    <div className="login-intro"><Brand /><span className="eyebrow">A LITTLE CARE, EVERY DAY</span><h1>오늘의 작은 기록,<br />내일의 건강한 일상.</h1><p>나와 가족을 위한 혈압 기록장.<br />복잡한 과정 없이, 매일 가볍게 챙겨보세요.</p><div className="login-art" aria-hidden="true"><Heart size={86} strokeWidth={1} /><Activity size={138} strokeWidth={1.1} /><span>매일, 나를 돌보는 시간</span></div><span className="intro-bottom"><Leaf size={17} /> 작은 습관이 쌓이는 곳, 매일혈압</span></div>
    <section className="login-card"><span className="pill"><ShieldCheck size={15} /> 우리 가족만의 건강 기록</span><h2>반가워요 <span className="wave">☀</span></h2><p>로그인하고 오늘의 혈압을 남겨보세요.</p><form onSubmit={login}><label>아이디<input type="text" name="email" autoCapitalize="none" spellCheck={false} autoComplete="username" placeholder="parkjin0413 또는 ksn4962" required disabled={!supabase} /></label><label>비밀번호<input type="password" name="password" autoComplete="current-password" placeholder="비밀번호를 입력해 주세요" required disabled={!supabase} /></label>{error && <p role="alert" className="error">{error}</p>}<button className="primary" disabled={busy || !supabase}>{busy ? '로그인 중…' : '로그인'}<ChevronRight size={19} /></button></form><p className="login-help">미리 등록된 두 분의 계정으로 이용할 수 있어요.<br />계정과 비밀번호는 가족 관리자에게 확인해 주세요.</p>{!supabase && <p className="setup-note">Supabase 연결 설정 전입니다.<br />아래 체험하기에서 화면과 기능을 확인할 수 있어요.</p>}<button className="text-button demo-link" onClick={enterDemo}>먼저 체험해 보기 <ArrowUpRight size={16} /></button><small>체험 기록은 현재 브라우저에만 저장됩니다.</small></section>
  </main>;

  return <div className="app-shell">
    <aside className="sidebar"><Brand /><div className="side-label">나의 건강 노트</div><nav aria-label="메인 메뉴">{tabs.map(t => <button key={t.id} className={tab === t.id ? 'nav-item active' : 'nav-item'} onClick={() => { setTab(t.id); setError(''); }}><t.icon size={20} />{t.label}{tab === t.id && <span className="nav-dot" />}</button>)}</nav><div className="side-bottom"><div className="side-note"><span className="leaf-icon"><Leaf size={22} /></span><strong>하루 한 번, 나를 돌보기</strong><p>작은 기록이 모여<br />건강한 일상을 만들어요.</p></div><div className="side-footer">매일혈압 <span>우리 가족 건강 기록장</span></div></div></aside>
    <div className="workspace"><header className="topbar"><div className="mobile-brand"><Brand /></div><span className="desktop-breadcrumb">나의 건강 노트 <ChevronRight size={14} /> <b>{tabs.find(t => t.id === tab)?.label}</b></span><div className="account"><span className="account-avatar">{String(displayName).slice(0, 1)}</span><span>{displayName}님</span><button aria-label={demo ? '체험 종료' : '로그아웃'} title={demo ? '체험 종료' : '로그아웃'} onClick={logout} disabled={busy}><LogOut size={18} /></button></div></header>
    <main className="content">
      {demo && <div className="demo-banner"><ShieldCheck size={16} /><span>체험 모드 · 기록은 이 브라우저에만 저장돼요.</span><button onClick={logout}>체험 종료</button></div>}
      <div className="page-heading"><div><div className="today-date"><span className="little-dot" />{clock?.toLocaleDateString('ko-KR', { year: 'numeric', month: 'long', day: 'numeric', weekday: 'long' })}</div><h1>{tab === 'home' ? <>오늘도, 건강한 하루 <span className="sun">☀</span></> : tab === 'history' ? '차곡차곡 쌓인 나의 기록' : '한눈에 보는 혈압의 변화'}</h1><p>{tab === 'home' ? '혈압을 기록하는 작은 습관, 오늘도 함께해요.' : tab === 'history' ? '매일의 기록을 확인하고 필요한 기간을 내려받으세요.' : '꾸준히 기록한 혈압의 흐름과 평균을 살펴보세요.'}</p></div><button ref={addButton} className="primary add-button" onClick={() => { setError(''); setModal(true); }} disabled={loading}><Plus size={20} /> 혈압 기록하기</button></div>
      {!modal && error && <div role="alert" className="error">{error}<button className="text-button" onClick={() => window.location.reload()}>다시 불러오기</button></div>}
      {loading && <p role="status">기록을 불러오고 있어요…</p>}

      {tab === 'home' && <><div className="overview-grid"><section className="latest-card"><div className="card-top"><h2><Activity size={19} /> 최근 측정 혈압</h2><span className="soft-tag">{latest ? dateLabel(latest.measured_at, { month: 'numeric', day: 'numeric', hour: '2-digit', minute: '2-digit' }) : '첫 기록을 기다려요'}</span></div><div className="bp-value"><span>{latest?.systolic ?? '—'}</span><i>/</i><span>{latest?.diastolic ?? '—'}</span><small>mmHg</small></div><div className="bp-labels"><span><span className="legend-dot green" />수축기</span><span><span className="legend-dot gold" />이완기</span></div><div className="latest-footer"><span><Heart size={16} /> 맥박 <strong>{latest?.pulse ?? '—'}</strong> bpm</span><span>{latest ? '기록 완료' : '혈압계로 측정 후 입력해 주세요'}<Check size={14} /></span></div></section><section className="habit-card"><span className="habit-icon"><Leaf size={26} strokeWidth={1.6} /></span><span className="eyebrow">MY DAILY ROUTINE</span><h2>기록하는 것부터<br />건강한 변화의 시작.</h2><p>측정한 숫자만 입력해 주세요.<br />날짜와 시간은 자동으로 남겨둘게요.</p><span className="habit-decoration" aria-hidden="true">✳</span></section></div></>}

      <section className="trends-section"><div className="section-heading"><div><h2>{tab === 'history' ? '기록 내역' : '나의 혈압 흐름'} <span className="subtle">{tab === 'history' ? `${filtered.length}개의 기록` : '조금씩 쌓이는 건강 습관'}</span></h2></div><div className="period-control" aria-label="조회 기간">{[7, 30, 90].map(d => <button key={d} aria-pressed={days === d} className={days === d ? 'selected' : ''} onClick={() => setDays(d)}>최근 {d}일</button>)}</div></div>
      {tab !== 'history' && <><div className="stats-grid"><Stat label="평균 수축기" value={average(filtered, 'systolic')} unit="mmHg" icon={<ArrowUpRight size={18} />} tone="green" /><Stat label="평균 이완기" value={average(filtered, 'diastolic')} unit="mmHg" icon={<ArrowDownLeft size={18} />} tone="gold" /><Stat label="평균 맥박" value={average(filtered, 'pulse')} unit="bpm" icon={<Heart size={18} />} tone="rose" /><Stat label="기록한 날" value={recordedDays} unit={`/ ${days}일`} icon={<CalendarDays size={18} />} tone="blue" /></div><section className="chart-card"><div className="chart-heading"><h3>혈압 변화</h3><div className="chart-legend"><span><i className="legend-dot green" />수축기</span><span><i className="legend-dot gold" />이완기</span><small>단위: mmHg</small></div></div><TrendChart readings={filtered} days={days} /></section></>}
      </section>

      {tab !== 'stats' && <section className="history-section"><div className="section-heading"><h2>{tab === 'home' ? '최근 기록' : '측정 기록'} <span className="subtle">{tab === 'home' ? '최근 측정 순으로 보여드려요' : `최근 ${days}일`}</span></h2>{tab === 'home' ? <button className="text-button" onClick={() => setTab('history')}>전체 보기 <ChevronRight size={16} /></button> : <button className="text-button" disabled={!filtered.length} onClick={download}><Download size={16} /> CSV 저장</button>}</div><div className="records-card">{(tab === 'home' ? readings.slice(0, 4) : filtered).length === 0 ? <div className="empty-state"><span><History size={26} /></span><h3>{tab === 'home' ? '아직 기록이 없어요' : '이 기간에는 기록이 없어요'}</h3><p>혈압을 측정하고 첫 번째 기록을 남겨보세요.</p><button className="text-button" onClick={() => { setError(''); setModal(true); }}><Plus size={16} /> 첫 혈압 기록하기</button></div> : <><div className="record-table-head"><span>측정 일시</span><span>혈압 <small>mmHg</small></span><span>맥박 <small>bpm</small></span><span>메모</span><span /></div>{(tab === 'home' ? readings.slice(0, 4) : filtered).map(r => <article className="record-row" key={r.id}><time dateTime={r.measured_at}>{dateLabel(r.measured_at)}</time><strong className="record-bp">{r.systolic}<span>/</span>{r.diastolic}</strong><span className="record-pulse"><Heart size={13} />{r.pulse ?? '—'}</span><span className="record-note">{r.note || '메모 없음'}</span><button className="delete-button" aria-label={`${dateLabel(r.measured_at)} 기록 삭제`} onClick={() => setDeleteId(r.id)}><Trash2 size={16} /></button></article>)}</>}</div></section>}
      <footer className="content-footer"><ShieldCheck size={15} /><span>나의 기록은 나만 볼 수 있어요.</span><span className="footer-divider">·</span><span>진단을 위한 도구가 아닌 개인 기록장입니다.</span><span className="footer-brand">매일혈압</span></footer>
    </main></div>
    <nav className="mobile-nav" aria-label="모바일 메뉴">{tabs.map(t => <button key={t.id} className={tab === t.id ? 'active' : ''} onClick={() => setTab(t.id)}><t.icon size={22} /><span>{t.label}</span></button>)}</nav>
    {notice && <div className="toast" role="status"><Check size={18} />{notice}</div>}
    {modal && <div className="modal-backdrop" onMouseDown={e => { if (e.target === e.currentTarget && !busy) { setModal(false); setError(''); } }}><section role="dialog" aria-modal="true" aria-labelledby="record-title" className="modal" onKeyDown={e => {
      if (e.key === 'Escape' && !busy) { setModal(false); setError(''); }
      if (e.key === 'Tab') {
        const items = Array.from(e.currentTarget.querySelectorAll<HTMLElement>('button:not(:disabled), input:not(:disabled), textarea:not(:disabled)'));
        const first = items[0], last = items[items.length - 1];
        if (e.shiftKey && document.activeElement === first) { e.preventDefault(); last?.focus(); }
        else if (!e.shiftKey && document.activeElement === last) { e.preventDefault(); first?.focus(); }
      }
    }}><button className="modal-close" aria-label="닫기" disabled={busy} onClick={() => { setModal(false); setError(''); }}><X size={22} /></button><span className="pill"><Activity size={15} /> 오늘의 작은 건강 습관</span><h2 id="record-title">혈압 기록하기</h2><p>혈압계에 표시된 숫자를 입력해 주세요.</p><div className="auto-time"><CalendarDays size={17} /> 저장하는 시각이 자동으로 기록돼요.</div><form onSubmit={save}><div className="input-pair"><label>수축기 <span>최고 혈압</span><div className="number-input"><input ref={firstInput} name="systolic" type="number" inputMode="numeric" min="40" max="300" step="1" placeholder="120" required /><small>mmHg</small></div></label><label>이완기 <span>최저 혈압</span><div className="number-input"><input name="diastolic" type="number" inputMode="numeric" min="20" max="200" step="1" placeholder="80" required /><small>mmHg</small></div></label></div><label>맥박 <span>선택</span><div className="number-input pulse-input"><input name="pulse" type="number" inputMode="numeric" min="20" max="250" step="1" placeholder="예: 72" /><small>bpm</small></div></label><label>메모 <span>선택</span><textarea name="note" maxLength={300} placeholder="오늘의 컨디션을 간단히 남겨보세요." rows={2} /></label>{error && <p role="alert" className="error">{error}</p>}<button className="primary" disabled={busy}>{busy ? '저장 중…' : '이대로 기록하기'}<Check size={19} /></button></form></section></div>}
    {deleteId && <div className="modal-backdrop"><section className="modal confirm-modal" role="alertdialog" aria-modal="true" aria-labelledby="delete-title" onKeyDown={e => { if (e.key === 'Escape' && !busy) setDeleteId(null); if (e.key === 'Tab') { e.preventDefault(); const buttons = Array.from(e.currentTarget.querySelectorAll('button')); (document.activeElement === buttons[0] ? buttons[1] : buttons[0])?.focus(); } }}><h2 id="delete-title">이 기록을 삭제할까요?</h2><p>삭제한 기록은 복구할 수 없어요.</p>{error && <p role="alert" className="error">{error}</p>}<div className="confirm-actions"><button autoFocus className="secondary" disabled={busy} onClick={() => setDeleteId(null)}>취소</button><button className="danger" disabled={busy} onClick={() => remove(deleteId)}>{busy ? '삭제 중…' : '삭제하기'}</button></div></section></div>}
  </div>;
}

function Brand() { return <div className="brand"><span className="brand-icon"><Activity size={24} strokeWidth={2} /></span><span>매일혈압<small>DAILY PRESSURE</small></span></div>; }
function Stat({ label, value, unit, icon, tone }: { label: string; value: number | null; unit: string; icon: React.ReactNode; tone: string }) {
  return <div className="stat-card"><div className="stat-label">{label}<span className={`stat-icon ${tone}`}>{icon}</span></div><div className="stat-value">{value ?? '—'}<small>{unit}</small></div></div>;
}

function TrendChart({ readings, days }: { readings: Reading[]; days: number }) {
  if (!readings.length) return <div className="chart-empty"><div className="empty-chart-lines" /><TrendingUp size={32} strokeWidth={1.4} /><strong>나의 혈압 흐름을 만들어보세요</strong><p>기록을 남기면 이곳에 변화가 그려져요.</p></div>;
  const sorted = [...readings].reverse();
  const buckets = new Map<string, Reading[]>();
  sorted.forEach(r => { const day = new Date(r.measured_at).toLocaleDateString('sv-SE'); buckets.set(day, [...(buckets.get(day) ?? []), r]); });
  const daily = [...buckets.entries()].map(([day, entries]) => ({ day, systolic: average(entries, 'systolic')!, diastolic: average(entries, 'diastolic')! }));
  const min = Math.floor((Math.min(...daily.map(r => r.diastolic)) - 15) / 20) * 20;
  const max = Math.ceil((Math.max(...daily.map(r => r.systolic)) + 15) / 20) * 20;
  const now = new Date(), end = new Date(now.getFullYear(), now.getMonth(), now.getDate()).getTime();
  const startDate = new Date(now.getFullYear(), now.getMonth(), now.getDate()); startDate.setDate(startDate.getDate() - days + 1);
  const start = startDate.getTime();
  const x = (day: string) => 52 + ((new Date(day + 'T00:00:00').getTime() - start) / (end - start || 1)) * 800;
  const y = (v: number) => 188 - ((v - min) / (max - min)) * 160;
  return <div className="chart-wrap"><svg viewBox="0 0 900 245" role="img" aria-label={`최근 ${days}일 일별 평균 혈압 변화, 수축기 ${average(readings, 'systolic')}, 이완기 ${average(readings, 'diastolic')} mmHg`}>
    {[0, 1, 2, 3, 4].map(i => { const value = min + (max - min) * i / 4; return <g key={i}><line x1="52" x2="866" y1={y(value)} y2={y(value)} stroke="#e9ede8" strokeDasharray="4 5" /><text x="28" y={y(value) + 4} textAnchor="middle" fill="#929991" fontSize="12">{Math.round(value)}</text></g>; })}
    {(['systolic', 'diastolic'] as const).map(field => <g key={field}><polyline fill="none" stroke={field === 'systolic' ? '#2c795e' : '#c99c54'} strokeWidth="2.5" strokeLinejoin="round" points={daily.map(r => `${x(r.day)},${y(r[field])}`).join(' ')} />{daily.map(r => <circle key={r.day} cx={x(r.day)} cy={y(r[field])} r="4" fill={field === 'systolic' ? '#2c795e' : '#c99c54'} stroke="white" strokeWidth="2"><title>{r.day} · {field === 'systolic' ? '수축기' : '이완기'} 평균 {r[field]} mmHg</title></circle>)}</g>)}
    {[0, 1, 2, 3, 4, 5, 6].map(i => { const d = new Date(startDate); d.setDate(d.getDate() + Math.round((days - 1) * i / 6)); return <text key={i} x={52 + i * 800 / 6} y="227" textAnchor="middle" fill="#929991" fontSize="12">{d.getMonth() + 1}.{d.getDate()}</text>; })}
  </svg><p className="chart-caption">여러 번 측정한 날은 하루 평균으로 표시해요.</p></div>;
}
