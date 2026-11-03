import { test } from 'node:test';
import assert from 'node:assert/strict';
import { average, csv, periodReadings, validateReading, type Reading } from '../src/lib/records.ts';

const reading = (date: string, pulse: number | null = null): Reading => ({ id: date, measured_at: date, systolic: 120, diastolic: 80, pulse, note: '' });
test('rejects invalid and reversed blood pressure readings', () => {
  assert.equal(validateReading(120, 80, null), null);
  for (const values of [[80, 120, 70], [120.5, 80, 70], [301, 80, 70], [120, 19, 70], [120, 80, 251], [NaN, 80, 70]]) assert.ok(validateReading(...values as [number, number, number]));
});
test('period includes start of local day and excludes future records', () => {
  const now = new Date(2026, 10, 3, 14);
  const start = new Date(2026, 9, 28, 0);
  const records = [reading(start.toISOString()), reading(new Date(start.getTime() - 1).toISOString()), reading(now.toISOString()), reading(new Date(now.getTime() + 1).toISOString())];
  assert.deepEqual(periodReadings(records, 7, now), [records[0], records[2]]);
});
test('averages ignore missing pulse and handle empty data', () => {
  assert.equal(average([], 'systolic'), null);
  assert.equal(average([reading('a'), reading('b', 72)], 'pulse'), 72);
  assert.equal(average([reading('a')], 'pulse'), null);
});
test('CSV escapes quotes, commas, newlines and spreadsheet formulas', () => {
  const row = { ...reading('2026-11-03T01:00:00Z', 72), note: '=HYPERLINK("bad"),\nhello' };
  const result = csv([row]);
  assert.ok(result.startsWith('\uFEFF'));
  assert.ok(result.includes('"\'=HYPERLINK(""bad""),\nhello"'));
});
