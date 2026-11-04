import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';
import { createClient } from '@supabase/supabase-js';
import { projectKeys, projectUrl, sqlFile } from './supabase-connection.mjs';

const options = { auth: { persistSession: false, autoRefreshToken: false } };
let admin;
const testRecordIds = [];
try {
  const { publicKey, adminKey } = projectKeys();
  admin = createClient(projectUrl, adminKey, options);
  const accounts = JSON.parse(readFileSync('.env.accounts.local', 'utf8'));
  const clients = accounts.map(() => createClient(projectUrl, publicKey, options));
  for (let i = 0; i < clients.length; i++) {
    const { error } = await clients[i].auth.signInWithPassword({ email: accounts[i].email, password: accounts[i].password });
    assert.equal(error, null, `Login failed for account ${i + 1}`);
    const membership = await clients[i].from('pressure_members').select('user_id');
    assert.equal(membership.error, null);
    assert.deepEqual(membership.data.map(m => m.user_id), [accounts[i].id]);
  }
  console.log('PASS: both account logins and own-membership visibility.');

  for (let i = 0; i < clients.length; i++) {
    const start = Date.now();
    const result = await clients[i].from('pressure_readings').insert({ systolic: 121 + i, diastolic: 81, pulse: 72, note: '__pressure_isolation_test__' }).select().single();
    assert.equal(result.error, null, 'Insert must succeed');
    testRecordIds.push(result.data.id);
    assert.equal(result.data.user_id, accounts[i].id);
    assert.ok(Math.abs(new Date(result.data.measured_at).getTime() - start) < 60000, 'Server timestamp must be current');
    const peer = clients[1 - i];
    const hidden = await peer.from('pressure_readings').select('id').eq('id', result.data.id);
    assert.equal(hidden.error, null);
    assert.deepEqual(hidden.data, []);
    const deniedDelete = await peer.from('pressure_readings').delete().eq('id', result.data.id).select('id');
    assert.equal(deniedDelete.error, null);
    assert.deepEqual(deniedDelete.data, []);
    const own = await clients[i].from('pressure_readings').select('id').eq('id', result.data.id);
    assert.equal(own.data.length, 1);
  }
  console.log('PASS: server timestamps, own record persistence, cross-account reads/deletes blocked.');

  const anon = createClient(projectUrl, publicKey, options);
  assert.ok((await anon.from('pressure_readings').select('id')).error, 'Anonymous read must be denied');
  assert.ok((await anon.from('pressure_members').select('user_id')).error, 'Anonymous membership read must be denied');
  assert.ok((await clients[0].from('pressure_members').insert({ user_id: accounts[1].id, display_name: 'test' })).error, 'Membership self-enrollment must be denied');
  assert.ok((await clients[0].from('pressure_readings').insert({ systolic: 120, diastolic: 80, user_id: accounts[1].id })).error, 'Identity override must be denied');
  const selectedTime = '2026-01-02T23:05:00+09:00';
  const backdated = await clients[0].from('pressure_readings').insert({ systolic: 120, diastolic: 80, measured_at: selectedTime, note: '__pressure_isolation_test__' }).select('id,measured_at').single();
  assert.equal(backdated.error, null, 'Selected measurement time must be accepted');
  testRecordIds.push(backdated.data.id);
  assert.equal(Date.parse(backdated.data.measured_at), Date.parse(selectedTime));
  const peerBackdated = await clients[1].from('pressure_readings').select('id').eq('id', backdated.data.id);
  assert.equal(peerBackdated.error, null);
  assert.deepEqual(peerBackdated.data, []);
  assert.ok((await clients[0].from('pressure_readings').insert({ systolic: 70, diastolic: 90 })).error, 'Invalid pressure order must be denied');
  assert.ok((await clients[0].from('pressure_readings').update({ systolic: 122 }).eq('id', testRecordIds[0])).error, 'Updates must be denied');
  console.log('PASS: selected measurement time persists; peer access, anonymous access, self-enrollment, identity overrides, invalid values and updates blocked.');
  sqlFile('supabase/verify-nonmember.sql');
  console.log('PASS: unrelated authenticated users cannot read or insert pressure data.');

  const baseline = JSON.parse(readFileSync('.env.isolation-baseline.local', 'utf8'));
  for (const table of baseline.existing_tables) {
    // Zero policies + enabled RLS is default-deny, even for new authenticated accounts.
    assert.equal(table.rls, true, `Existing table ${table.name} must enable RLS`);
    assert.equal(baseline.existing_policies.filter(p => p.table === table.name).length, 0, `Review existing policies on ${table.name}`);
    for (const client of clients) {
      const result = await client.from(table.name).select('*').limit(1);
      assert.ok(result.error || result.data.length === 0, 'Pressure accounts must not read existing work data');
    }
  }
  assert.deepEqual(sqlFile('supabase/isolation-snapshot.sql', true)[0].snapshot, baseline);
  console.log('PASS: pressure accounts cannot read existing work tables; existing structures and policies unchanged.');

  const secondSession = createClient(projectUrl, publicKey, options);
  assert.equal((await secondSession.auth.signInWithPassword({ email: accounts[0].email, password: accounts[0].password })).error, null);
  assert.equal((await clients[0].auth.signOut({ scope: 'local' })).error, null);
  assert.equal((await secondSession.auth.refreshSession()).error, null, 'Another session must survive local logout');
  await secondSession.auth.signOut({ scope: 'local' });
  await clients[1].auth.signOut({ scope: 'local' });
  console.log('PASS: local logout preserves another session.');
} catch {
  console.error('Live isolation verification failed. No credentials or data were logged. Inspect the failed operation before deploying.');
  process.exitCode = 1;
} finally {
  if (admin && testRecordIds.length) {
    const { error } = await admin.from('pressure_readings').delete().in('id', testRecordIds);
    if (error) { console.error('Test-record cleanup failed.'); process.exitCode = 1; }
    else console.log('Test records removed.');
  }
}
