export type Reading = {
  id: string;
  systolic: number;
  diastolic: number;
  pulse: number | null;
  note: string;
  measured_at: string;
};

export function loginEmail(identifier: string) {
  const value = identifier.trim().toLowerCase();
  return value.includes('@') ? value : `${value}@pressure.com`;
}

export function accountDisplayName(email?: string, fallback = '회원') {
  const names: Record<string, string> = { 'parkjin0413@pressure.com': '박진', 'ksn4962@pressure.com': '김순녀' };
  return names[email?.trim().toLowerCase() ?? ''] ?? fallback;
}

export function groupReadingsByDay(readings: Reading[]) {
  const groups = new Map<string, Reading[]>();
  for (const reading of [...readings].sort((a, b) => Date.parse(b.measured_at) - Date.parse(a.measured_at))) {
    const day = new Date(reading.measured_at).toLocaleDateString('sv-SE');
    const entries = groups.get(day) ?? [];
    entries.push(reading);
    groups.set(day, entries);
  }
  return [...groups.entries()];
}

export function validateReading(systolic: number, diastolic: number, pulse: number | null) {
  if (!Number.isInteger(systolic) || systolic < 40 || systolic > 300) return '수축기 혈압을 40~300 사이의 정수로 입력해 주세요.';
  if (!Number.isInteger(diastolic) || diastolic < 20 || diastolic > 200) return '이완기 혈압을 20~200 사이의 정수로 입력해 주세요.';
  if (systolic <= diastolic) return '수축기 혈압은 이완기 혈압보다 커야 해요. 입력값을 확인해 주세요.';
  if (pulse !== null && (!Number.isInteger(pulse) || pulse < 20 || pulse > 250)) return '맥박을 20~250 사이의 정수로 입력해 주세요.';
  return null;
}

export function periodReadings(readings: Reading[], days: number, now = new Date()) {
  const start = new Date(now);
  start.setHours(0, 0, 0, 0);
  start.setDate(start.getDate() - days + 1);
  return readings.filter(r => new Date(r.measured_at) >= start && new Date(r.measured_at) <= now);
}

export function average(readings: Reading[], field: 'systolic' | 'diastolic' | 'pulse') {
  const values = readings.map(r => r[field]).filter((n): n is number => n !== null);
  return values.length ? Math.round(values.reduce((a, b) => a + b, 0) / values.length) : null;
}

export const dateLabel = (value: string, options?: Intl.DateTimeFormatOptions) => new Date(value).toLocaleString('ko-KR', options ?? { month: 'long', day: 'numeric', hour: '2-digit', minute: '2-digit' });

export function csv(readings: Reading[]) {
  const cell = (v: string | number | null) => '"' + String(v ?? '').replace(/^[=+@\-\t\r]/, "'$&").replaceAll('"', '""') + '"';
  return '\uFEFF' + [['측정 시각(ISO 8601)', '수축기(mmHg)', '이완기(mmHg)', '맥박(bpm)', '메모'], ...readings.map(r => [r.measured_at, r.systolic, r.diastolic, r.pulse, r.note])].map(row => row.map(cell).join(',')).join('\r\n');
}
