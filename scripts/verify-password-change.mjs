import assert from 'node:assert/strict';
import { randomBytes, randomUUID } from 'node:crypto';
import { createClient } from '@supabase/supabase-js';
import { projectKeys, projectUrl } from './supabase-connection.mjs';
import { updatePassword } from '../src/lib/change-password.ts';

const options = { auth: { persistSession: false, autoRefreshToken: false } };
let admin, testUserId;
let phase = 'initialization';
try {
  const { publicKey, adminKey } = projectKeys();
  admin = createClient(projectUrl, adminKey, options);
  const client = createClient(projectUrl, publicKey, options);
  const email = `pressure-verification-${randomUUID()}@example.invalid`;
  const current = `P!${randomBytes(18).toString('base64url')}9a`;
  const next = `N!${randomBytes(18).toString('base64url')}8b`;
  phase = 'temporary account creation';
  const created = await admin.auth.admin.createUser({ email, password: current, email_confirm: true, app_metadata: { pressure_verification: true } });
  assert.equal(created.error, null);
  testUserId = created.data.user.id;
  assert.equal((await client.auth.signInWithPassword({ email, password: current })).error, null);
  phase = 'current password verification';
  const invalid = await updatePassword(client, 'IncorrectPassword!123', next);
  assert.ok(invalid, 'An incorrect current password must be rejected');
  phase = 'password update';
  assert.equal(await updatePassword(client, current, next), null);
  await client.auth.signOut({ scope: 'local' });
  phase = 'old and new password login checks';
  assert.ok((await client.auth.signInWithPassword({ email, password: current })).error);
  assert.equal((await client.auth.signInWithPassword({ email, password: next })).error, null);
  await client.auth.signOut({ scope: 'local' });
  console.log('PASS: incorrect current password rejected, password updated, old login rejected, new login accepted.');
  console.log('The two real accounts and their passwords were not modified.');
} catch {
  console.error(`Password verification failed during ${phase}. Credentials were not logged.`);
  process.exitCode = 1;
} finally {
  if (admin && testUserId) {
    const { error } = await admin.auth.admin.deleteUser(testUserId);
    if (error) { console.error('Temporary verification account cleanup failed.'); process.exitCode = 1; }
    else console.log('Temporary verification account removed.');
  }
}
