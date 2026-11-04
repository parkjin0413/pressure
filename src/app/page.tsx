'use client';

import { useEffect, useRef, useState, type FormEvent } from 'react';
import type { User } from '@supabase/supabase-js';
import { Activity, CalendarDays, Check, Download, History, LogOut, ShieldCheck, Trash2, TrendingUp } from 'lucide-react';
import { supabase } from '@/lib/supabase';
import { PasswordSettings } from '@/components/password-settings';
import { accountDisplayName, average, csv, dateLabel, groupReadingsByDay, loginEmail, periodReadings, localDateTimeValue, measurementTime, newestReadings, validateReading, type Reading } from '@/lib/records';

type Tab = 'home' | 'history' | 'stats';
type ReadingInput = Pick<Reading, 'systolic' | 'diastolic' | 'pulse' | 'note'> & { measured_at?: string };
const tabs = [
  { id: 'home' as Tab, label: '입력', icon: Activity },
  { id: 'history' as Tab, label: '기록', icon: History },
  { id: 'stats' as Tab, label: '통계', icon: TrendingUp },
];

export default function Home() {
  const [user, setUser] = useState<User | null>(null);
  const [ready, setReady] = useState(false);
  const [demo, setDemo] = useState(false);
  const [readings, setReadings] = useState<Reading[]>([]);
  const [tab, setTab] = useState<Tab>('home');
  const [days, setDays] = useState(7);
  const [busy, setBusy] = useState(false);
  const [loading, setLoading] = useState(false);
  const [authorized, setAuthorized] = useState(false);
  const [error, setError] = useState('');
  const [notice, setNotice] = useState('');
  const [clock, setClock] = useState<Date | null>(null);
  const requestVersion = useRef(0);
  const actionInProgress = useRef(false);
  const userId = user?.id;

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
    setAuthorized(false);
    if (demo || !userId || !supabase) return;
    const client = supabase;
    setLoading(true); setReadings([]); setError('');
    void (async () => {
      try {
        const membership = await client.from('pressure_members').select('user_id').eq('user_id', userId).maybeSingle();
        if (version !== requestVersion.current) return;
        if (membership.error || !membership.data) throw new Error();
        const all: Reading[] = [];
        for (let offset = 0; ; offset += 1000) {
          const { data, error } = await client.from('pressure_readings')
            .select('id,systolic,diastolic,pulse,note,measured_at')
            .order('measured_at', { ascending: false }).order('id').range(offset, offset + 999);
          if (version !== requestVersion.current) return;
          if (error) throw error;
          all.push(...data as Reading[]);
          if (data.length < 1000) break;
        }
        setReadings(all); setAuthorized(true);
      } catch {
        if (version === requestVersion.current) setError('기록을 불러오지 못했어요. 계정과 연결 상태를 확인한 후 새로고침해 주세요.');
      } finally {
        if (version === requestVersion.current) setLoading(false);
      }
    })();
  }, [userId, demo]);

  function enterDemo() {
    setDemo(true); setError(''); setReadings([]); setLoading(false);
    try {
      const saved: unknown = JSON.parse(localStorage.getItem('maeil-demo-v1') ?? '[]');
      if (Array.isArray(saved)) setReadings(saved.filter(r => r && typeof r.id === 'string' && typeof r.measured_at === 'string' && Number.isFinite(r.systolic) && Number.isFinite(r.diastolic)));
    } catch { /* Start with an empty demo if local storage is unavailable. */ }
  }

  function storeDemo(next: Reading[]) {
    localStorage.setItem('maeil-demo-v1', JSON.stringify(next));
    setReadings(next);
  }

  async function login(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();
    if (!supabase || actionInProgress.current) return;
    const data = new FormData(event.currentTarget);
    actionInProgress.current = true; setBusy(true); setError('');
    try {
      const { error } = await supabase.auth.signInWithPassword({
        email: loginEmail(String(data.get('email'))), password: String(data.get('password')),
      });
      if (error) setError('로그인하지 못했어요. 아이디와 비밀번호를 확인해 주세요.');
    } catch { setError('연결하지 못했어요. 잠시 후 다시 시도해 주세요.'); }
    finally { actionInProgress.current = false; setBusy(false); }
  }

  async function logout() {
    if (actionInProgress.current) return;
    actionInProgress.current = true; setBusy(true); setError('');
    try {
      if (!demo && supabase) {
        const { error } = await supabase.auth.signOut({ scope: 'local' });
        if (error) throw error;
      }
      requestVersion.current++; setDemo(false); setUser(null); setReadings([]);
      setTab('home'); setNotice(''); setAuthorized(false);
    } catch { setError('로그아웃하지 못했어요. 다시 시도해 주세요.'); }
    finally { actionInProgress.current = false; setBusy(false); }
  }

  async function save(values: ReadingInput) {
    if (actionInProgress.current || (!demo && !authorized)) return false;
    const validation = validateReading(values.systolic, values.diastolic, values.pulse);
    if (validation) { setError(validation); setNotice(''); return false; }
    actionInProgress.current = true; setBusy(true); setError(''); setNotice('');
    try {
      let saved: Reading;
      if (demo) {
        saved = { ...values, id: crypto.randomUUID(), measured_at: values.measured_at ?? new Date().toISOString() };
        storeDemo(newestReadings([saved, ...readings]));
      } else {
        if (!supabase || !user) throw new Error();
        const { data, error } = await supabase.from('pressure_readings').insert(values)
          .select('id,systolic,diastolic,pulse,note,measured_at').single();
        if (error) throw error;
        saved = data as Reading;
        setReadings(prev => newestReadings([saved, ...prev]));
      }
      setNotice('혈압 ' + saved.systolic + ' / ' + saved.diastolic + '을 저장했어요. (' + dateLabel(saved.measured_at) + ')' + (demo ? ' 체험 기록입니다.' : ''));
      return true;
    } catch {
      setError('저장하지 못했어요. 입력한 내용은 그대로 있으니 연결을 확인하고 다시 저장해 주세요.');
      return false;
    } finally { actionInProgress.current = false; setBusy(false); }
  }

  async function remove(record: Reading) {
    if (actionInProgress.current || !window.confirm(dateLabel(record.measured_at) + ' 기록을 삭제할까요? 삭제하면 복구할 수 없어요.')) return;
    actionInProgress.current = true; setBusy(true); setError('');
    try {
      if (demo) storeDemo(readings.filter(r => r.id !== record.id));
      else if (supabase) {
        const { data, error } = await supabase.from('pressure_readings').delete().eq('id', record.id).select('id');
        if (error || !data?.length) throw new Error();
        setReadings(prev => prev.filter(r => r.id !== record.id));
      }
      setNotice('기록을 삭제했어요.');
    } catch { setError('삭제하지 못했어요. 다시 시도해 주세요.'); }
    finally { actionInProgress.current = false; setBusy(false); }
  }

  const filtered = periodReadings(readings, days);
  function download() {
    const url = URL.createObjectURL(new Blob([csv(filtered)], { type: 'text/csv;charset=utf-8;' }));
    const link = document.createElement('a');
    link.href = url; link.download = '매일혈압_' + days + '일.csv'; link.click();
    URL.revokeObjectURL(url);
  }

  const displayName = demo ? '체험' : accountDisplayName(user?.email, user?.user_metadata?.display_name || '회원');
  if (!ready) return <main className="splash"><Activity size={32} /><p>잠시만 기다려 주세요.</p></main>;

  if (!user && !demo) return <main className="login-page">
    <Brand />
    <section className="panel login-card" aria-labelledby="login-title">
      <h1 id="login-title">로그인</h1><p className="muted">로그인하고 혈압을 기록해 주세요.</p>
      <form onSubmit={login}>
        <label>아이디<input type="text" name="email" autoCapitalize="none" spellCheck={false} autoComplete="username" required disabled={!supabase || busy} /></label>
        <p className="field-help">parkjin0413 또는 ksn4962</p>
        <label>비밀번호<input type="password" name="password" autoComplete="current-password" required disabled={!supabase || busy} /></label>
        {error && <p role="alert" className="error">{error}</p>}
        <button className="primary full-width" disabled={busy || !supabase}>{busy ? '로그인 중…' : '로그인'}</button>
      </form>
      {!supabase && <p className="muted">서버 연결 전입니다. 체험하기로 화면을 확인할 수 있어요.</p>}
      <button className="text-button" onClick={enterDemo}>체험하기</button>
    </section>
  </main>;

  function switchTab(next: Tab) { setTab(next); setNotice(''); setError(''); }

  return <div className="app-shell">
    <header className="topbar">
      <Brand />
      <span className="account-name">{displayName}님</span>
    </header>
    <main className="content">
      <nav className="main-nav" aria-label="메인 메뉴">{tabs.map(t => <button key={t.id} aria-current={tab === t.id ? 'page' : undefined} className={tab === t.id ? 'selected' : ''} onClick={() => switchTab(t.id)}><t.icon size={21} />{t.label}</button>)}</nav>
      {demo && <p className="demo-banner">체험 모드 · 이 브라우저에만 저장돼요.</p>}
      <div className="page-heading">
        <h1>{tab === 'home' ? '혈압 입력' : tab === 'history' ? '기록' : '통계'}</h1>
      </div>
      {tab !== 'home' && error && <p role="alert" className="error">{error}</p>}
      {tab !== 'home' && notice && <p role="status" className="success">{notice}</p>}
      {loading && <p role="status" className="muted">기록을 불러오고 있어요…</p>}

      {tab === 'home' && <ReadingForm onSave={save} disabled={busy || loading || (!demo && !authorized)} busy={busy} error={error} notice={notice} clock={clock} />}

      {tab !== 'home' && <section className="period-section" aria-label="조회 기간">
        <h2>조회 기간</h2><div className="period-control">{[7, 30, 90].map(d => <button key={d} aria-pressed={days === d} className={days === d ? 'selected' : ''} onClick={() => setDays(d)}>{d}일</button>)}</div>
        <p className="muted">최근 {days}일 · {filtered.length}회 측정</p>
      </section>}

      {tab === 'history' && filtered.length > 0 && <section className="panel history-summary" aria-label="기간 평균">
        <h2>{displayName}님 · 최근 {days}일 평균</h2>
        <p><strong>{average(filtered, 'systolic')} / {average(filtered, 'diastolic')}</strong> mmHg</p>
        <span className="muted">최고 / 최저 혈압 · 아래는 개별 측정값입니다.</span>
      </section>}

      {tab === 'stats' && <>
        <div className="stats-grid">
          <Stat label="평균 최고 혈압" value={average(filtered, 'systolic')} unit="mmHg" />
          <Stat label="평균 최저 혈압" value={average(filtered, 'diastolic')} unit="mmHg" />
          <Stat label="평균 맥박" value={average(filtered, 'pulse')} unit="회/분" />
          <Stat label="기록한 날" value={new Set(filtered.map(r => new Date(r.measured_at).toLocaleDateString('sv-SE'))).size} unit="일" />
        </div>
        <section className="panel chart-card"><h2>혈압 변화</h2><div className="chart-legend"><span><i className="legend-dot green" />최고 혈압</span><span><i className="legend-dot gold" />최저 혈압</span></div><TrendChart readings={filtered} days={days} /></section>
      </>}

      {tab !== 'stats' && <section className="history-section" aria-labelledby="history-title">
        <div className="section-heading"><h2 id="history-title">{tab === 'home' ? '최근 기록' : '측정 기록'}</h2>
          {tab === 'home' ? <button className="text-button" onClick={() => switchTab('history')}>모든 기록 보기</button> : <button className="text-button" disabled={!filtered.length} onClick={download}><Download size={18} />파일로 저장</button>}
        </div>
        {(tab === 'home' ? readings.slice(0, 3) : filtered).length === 0
          ? <div className="panel empty-state"><p>{loading ? '기록을 불러오는 중입니다.' : '아직 기록이 없어요.'}</p>{!loading && <p className="muted">{tab === 'home' ? '위 입력칸에 첫 혈압을 남겨보세요.' : '이 기간에 저장한 기록이 없습니다.'}</p>}</div>
          : <DailyRecords readings={tab === 'home' ? readings.slice(0, 3) : filtered} busy={busy} onRemove={remove} />}
      </section>}
      <footer className="content-footer">
        <div className="privacy-note"><ShieldCheck size={18} /><p>기록은 본인만 볼 수 있어요.<br />개인 기록용이며 진단을 대신하지 않습니다.</p></div>
        <div className="account-actions" aria-label="계정 관리">
          {!demo && <PasswordSettings onChanged={() => setNotice('비밀번호를 변경했어요. 다음 로그인부터 새 비밀번호를 사용해 주세요.')} />}
          <button className="text-button" onClick={logout} disabled={busy}><LogOut size={18} />{demo ? '체험 종료' : '로그아웃'}</button>
        </div>
      </footer>
    </main>
  </div>;
}

function Brand() {
  return <div className="brand"><Activity size={27} aria-hidden="true" /><span>매일혈압</span></div>;
}

function ReadingForm({ onSave, disabled, busy, error, notice, clock }: {
  onSave: (values: ReadingInput) => Promise<boolean>; disabled: boolean; busy: boolean; error: string; notice: string; clock: Date | null;
}) {
  const [selectedTime, setSelectedTime] = useState<string | null>(null);
  const [timeError, setTimeError] = useState('');
  const saveAction = useRef<HTMLDivElement>(null);

  useEffect(() => {
    const viewport = window.visualViewport;
    if (!viewport) return;
    // Older Android browsers resize only the visual viewport when the keyboard opens.
    const update = () => {
      const inset = viewport.scale === 1 ? Math.max(0, window.innerHeight - viewport.height - viewport.offsetTop) : 0;
      saveAction.current?.style.setProperty('--keyboard-inset', `${inset}px`);
    };
    update();
    viewport.addEventListener('resize', update);
    viewport.addEventListener('scroll', update);
    window.addEventListener('resize', update);
    return () => {
      viewport.removeEventListener('resize', update);
      viewport.removeEventListener('scroll', update);
      window.removeEventListener('resize', update);
    };
  }, []);

  async function submit(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();
    if (disabled) return;
    const form = event.currentTarget;
    const data = new FormData(form);
    const measuredAt = selectedTime === null ? undefined : measurementTime(selectedTime);
    if (measuredAt === null) { setTimeError('올바른 측정 날짜와 시간을 입력해 주세요.'); return; }
    setTimeError('');
    const success = await onSave({
      systolic: Number(data.get('systolic')), diastolic: Number(data.get('diastolic')),
      pulse: data.get('pulse') ? Number(data.get('pulse')) : null,
      note: String(data.get('note') ?? '').trim(),
      ...(measuredAt ? { measured_at: measuredAt } : {}),
    });
    if (success) { form.reset(); setSelectedTime(null); }
  }
  return <section className="panel entry-panel" aria-label="혈압 입력">
    <form onSubmit={submit}>
      <details className="measurement-time">
        <summary><CalendarDays size={20} /><span>{selectedTime && measurementTime(selectedTime)
          ? dateLabel(measurementTime(selectedTime)!, { year: 'numeric', month: 'long', day: 'numeric', hour: '2-digit', minute: '2-digit' })
          : clock?.toLocaleString('ko-KR', { month: 'long', day: 'numeric', weekday: 'short', hour: '2-digit', minute: '2-digit' })}</span><small>변경</small></summary>
        <div className="time-controls">
          <label>측정 날짜·시간<input type="datetime-local" name="measured_at" aria-describedby="time-help" value={selectedTime ?? (clock ? localDateTimeValue(clock) : '')} onChange={event => { setSelectedTime(event.target.value); setTimeError(''); }} disabled={disabled} /></label>
          <p id="time-help" className="muted">날짜와 시간을 눌러 직접 설정할 수 있어요.</p>
          <button type="button" className="text-button" onClick={() => { setSelectedTime(null); setTimeError(''); }} disabled={disabled}>현재 시각으로 되돌리기</button>
        </div>
      </details>
      {timeError && <p role="alert" className="error">{timeError}</p>}
      <div className="reading-grid">
        <label className="pressure-field"><span>최고 혈압 <small>수축기</small></span><input name="systolic" type="number" inputMode="numeric" min={40} max={300} step={1} required disabled={disabled} aria-describedby="systolic-unit" /><small id="systolic-unit">단위: mmHg</small></label>
        <label className="pressure-field"><span>최저 혈압 <small>이완기</small></span><input name="diastolic" type="number" inputMode="numeric" min={20} max={200} step={1} required disabled={disabled} aria-describedby="diastolic-unit" /><small id="diastolic-unit">단위: mmHg</small></label>
      </div>
      {error && <p role="alert" className="error">{error}</p>}
      <div className="save-action" ref={saveAction}><button className="primary save-button" disabled={disabled}><Check size={23} />{busy ? '저장 중…' : '혈압 저장'}</button></div>
      <div className="save-feedback" role="status" aria-live="polite" aria-atomic="true">{notice && <p className="success">{notice}</p>}</div>
      <details className="optional-fields"><summary>맥박·메모 입력 <span>(선택)</span></summary><div className="optional-content">
        <label>맥박 <small>회/분</small><input name="pulse" type="number" inputMode="numeric" min={20} max={250} step={1} disabled={disabled} /></label>
        <label>메모<textarea name="note" maxLength={300} rows={3} disabled={disabled} /></label>
      </div></details>
    </form>
  </section>;
}

function DailyRecords({ readings, busy, onRemove }: { readings: Reading[]; busy: boolean; onRemove: (reading: Reading) => void }) {
  return <div className="records-list">{groupReadingsByDay(readings).map(([day, entries]) => <section className="panel daily-records" key={day} aria-label={day + ' 혈압 기록'}>
    <div className="day-heading"><h3><time dateTime={day}>{dateLabel(entries[0].measured_at, { year: 'numeric', month: 'long', day: 'numeric', weekday: 'short' })}</time></h3><span>{entries.length}회 측정</span></div>
    <div className="reading-columns reading-column-labels" aria-hidden="true"><span>측정 시간</span><span>최고</span><span>최저</span></div>
    {entries.map(r => <article className="daily-reading" key={r.id}>
      <div className="reading-columns">
        <time dateTime={r.measured_at}>{dateLabel(r.measured_at, { hour: '2-digit', minute: '2-digit', hour12: false })}</time>
        <strong><span className="sr-only">최고 혈압 </span>{r.systolic}<span className="sr-only"> mmHg</span></strong>
        <strong><span className="sr-only">최저 혈압 </span>{r.diastolic}<span className="sr-only"> mmHg</span></strong>
      </div>
      <div className="reading-details">{r.pulse !== null && <span>맥박 {r.pulse}회/분</span>}
        <details className="record-actions"><summary aria-label={dateLabel(r.measured_at) + ' 기록 관리'}>관리</summary><button className="delete-button" disabled={busy} onClick={() => onRemove(r)} aria-label={dateLabel(r.measured_at) + ' 기록 삭제'}><Trash2 size={17} />기록 삭제</button></details>
      </div>
      {r.note && <p className="record-note">{r.note}</p>}
    </article>)}
    <p className="record-unit">혈압 단위: mmHg</p>
  </section>)}</div>;
}

function Stat({ label, value, unit }: { label: string; value: number | null; unit: string }) {
  return <section className="panel stat-card"><h2>{label}</h2><p className="stat-value">{value ?? '—'}<small>{unit}</small></p></section>;
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
