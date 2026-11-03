'use client';

import { useEffect, useRef, useState, type FormEvent } from 'react';
import { createPortal } from 'react-dom';
import { Check, KeyRound, X } from 'lucide-react';
import { supabase } from '@/lib/supabase';
import { validatePasswordChange } from '@/lib/passwords';
import { updatePassword } from '@/lib/change-password';

export function PasswordSettings({ onChanged }: { onChanged: () => void }) {
  const [open, setOpen] = useState(false);
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState('');
  const trigger = useRef<HTMLButtonElement>(null);
  const firstInput = useRef<HTMLInputElement>(null);

  useEffect(() => {
    if (!open) return;
    const previous = document.body.style.overflow;
    document.body.style.overflow = 'hidden';
    firstInput.current?.focus();
    return () => { document.body.style.overflow = previous; trigger.current?.focus(); };
  }, [open]);

  function close() { if (!busy) { setOpen(false); setError(''); } }

  async function submit(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();
    if (busy || !supabase) return;
    const form = event.currentTarget;
    const values = new FormData(form);
    const current = String(values.get('current') ?? '');
    const next = String(values.get('next') ?? '');
    const validation = validatePasswordChange(current, next, String(values.get('confirmation') ?? ''));
    if (validation) { setError(validation); return; }
    setBusy(true); setError('');
    try {
      const error = await updatePassword(supabase, current, next);
      if (error) {
        const code = error.code;
        if (code === 'invalid_credentials' || code === 'invalid_password') setError('현재 비밀번호가 맞지 않아요. 다시 확인해 주세요.');
        else if (code === 'same_password') setError('현재 비밀번호와 다른 비밀번호를 입력해 주세요.');
        else if (code === 'weak_password') setError('더 안전한 비밀번호가 필요해요. 영문·숫자·특수문자를 조합해 주세요.');
        else if (code === 'reauthentication_needed' || code === 'reauthentication_not_valid' || code === 'session_not_found' || error.status === 401) setError('로그아웃 후 다시 로그인한 다음 변경해 주세요.');
        else if (error.status === 429) setError('변경 요청이 많아요. 잠시 후 다시 시도해 주세요.');
        else setError('변경하지 못했어요. 현재 비밀번호와 연결 상태를 확인해 주세요.');
        return;
      }
      form.reset(); setOpen(false); onChanged();
    } catch { setError('서버에 연결하지 못했어요. 잠시 후 다시 시도해 주세요.'); }
    finally { setBusy(false); }
  }

  return <><button ref={trigger} className="password-menu-button" title="비밀번호 변경" aria-label="비밀번호 변경" onClick={() => { setError(''); setOpen(true); }}><KeyRound size={18} /><span>비밀번호 변경</span></button>
    {open && createPortal(<div className="modal-backdrop" onMouseDown={e => { if (e.target === e.currentTarget) close(); }}><section className="modal password-modal" role="dialog" aria-modal="true" aria-labelledby="password-title" aria-describedby="password-description" onKeyDown={e => {
      if (e.key === 'Escape') close();
      if (e.key === 'Tab') {
        const items = Array.from(e.currentTarget.querySelectorAll<HTMLElement>('button:not(:disabled),input:not(:disabled)'));
        const first = items[0], last = items[items.length - 1];
        if (e.shiftKey && document.activeElement === first) { e.preventDefault(); last?.focus(); }
        else if (!e.shiftKey && document.activeElement === last) { e.preventDefault(); first?.focus(); }
      }
    }}><button className="modal-close" aria-label="닫기" disabled={busy} onClick={close}><X size={22} /></button><span className="pill"><KeyRound size={15} /> 내 계정 관리</span><h2 id="password-title">비밀번호 변경</h2><p id="password-description">현재 비밀번호를 확인하고 새 비밀번호를 설정해 주세요.</p><form onSubmit={submit} className="password-form"><label>현재 비밀번호<input ref={firstInput} type="password" name="current" autoComplete="current-password" required disabled={busy} /></label><label>새 비밀번호<input type="password" name="next" autoComplete="new-password" minLength={8} placeholder="8자 이상 입력해 주세요" required disabled={busy} /></label><label>새 비밀번호 확인<input type="password" name="confirmation" autoComplete="new-password" minLength={8} placeholder="새 비밀번호를 한 번 더 입력해 주세요" required disabled={busy} /></label>{error && <p className="error" role="alert">{error}</p>}<button className="primary" disabled={busy}>{busy ? '변경 중…' : '비밀번호 변경하기'}<Check size={18} /></button></form></section></div>, document.body)}
  </>;
}
