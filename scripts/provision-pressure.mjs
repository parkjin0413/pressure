import { readFileSync, writeFileSync, existsSync } from 'node:fs';
import { randomBytes } from 'node:crypto';
import { createClient } from '@supabase/supabase-js';
import { projectKeys, projectUrl, sqlFile } from './supabase-connection.mjs';

const credentialsPath = '.env.accounts.local';
const baselinePath = '.env.isolation-baseline.local';
const users = [{ email: 'parkjin0413@pressure.com', name: '박진' }, { email: 'ksn4962@pressure.com', name: '김순녀' }];

try {
  const { publicKey, adminKey } = projectKeys();
  const client = createClient(projectUrl, adminKey, { auth: { persistSession: false, autoRefreshToken: false } });
  const snapshot = sqlFile('supabase/isolation-snapshot.sql', true)[0].snapshot;
  if (!existsSync(baselinePath)) writeFileSync(baselinePath, JSON.stringify(snapshot, null, 2));

  const tables = await client.from('pressure_members').select('user_id').limit(1);
  if (tables.error?.code === 'PGRST205' || tables.error?.code === '42P01') {
    sqlFile('supabase/migrations/001_initial.sql');
    console.log('Created pressure_members and pressure_readings with RLS.');
  } else if (tables.error) throw new Error('Cannot inspect pressure tables.');

  let credentials;
  if (existsSync(credentialsPath)) credentials = JSON.parse(readFileSync(credentialsPath, 'utf8'));
  else {
    credentials = users.map(u => ({ ...u, password: `P!${randomBytes(18).toString('base64url')}9a` }));
    writeFileSync(credentialsPath, JSON.stringify(credentials, null, 2));
  }

  for (const account of credentials) {
    if (!users.some(u => u.email === account.email)) throw new Error('Unexpected account in local credentials.');
    if (!account.id) {
      const { data, error } = await client.auth.admin.createUser({ email: account.email, password: account.password, email_confirm: true,
        user_metadata: { display_name: account.name }, app_metadata: { pressure_managed: true } });
      if (error) throw new Error(`Account creation failed for ${account.email}: ${error.code ?? 'unknown'}. No existing user was modified.`);
      account.id = data.user.id;
      writeFileSync(credentialsPath, JSON.stringify(credentials, null, 2));
    } else {
      const { data, error } = await client.auth.admin.getUserById(account.id);
      if (error || data.user.email !== account.email || data.user.app_metadata.pressure_managed !== true) throw new Error('Account ownership check failed.');
    }
    const { error } = await client.from('pressure_members').upsert({ user_id: account.id, display_name: account.name }, { onConflict: 'user_id' });
    if (error) throw new Error(`Membership setup failed: ${error.code}.`);
    console.log(`Ready: ${account.email} (password saved only in ${credentialsPath})`);
  }

  let env = existsSync('.env.local') ? readFileSync('.env.local', 'utf8') : '';
  for (const [name, value] of Object.entries({ NEXT_PUBLIC_SUPABASE_URL: projectUrl, NEXT_PUBLIC_SUPABASE_PUBLISHABLE_KEY: publicKey })) {
    env = env.replace(new RegExp(`^${name}=.*(?:\\r?\\n|$)`, 'gm'), '');
    env += `\n${name}=${value}\n`;
  }
  writeFileSync('.env.local', env);
  const after = sqlFile('supabase/isolation-snapshot.sql', true)[0].snapshot;
  if (JSON.stringify(snapshot) !== JSON.stringify(after)) throw new Error('Existing schema changed during setup; inspect before deployment.');
  console.log('Existing work tables, grants, policies and auth triggers are unchanged. Shared Auth settings were not modified.');
} catch (error) {
  // Never print captured CLI errors, access tokens, or SDK response bodies.
  console.error(error instanceof Error && !('stdout' in error) ? error.message : 'Setup failed; credentials were not logged.');
  process.exitCode = 1;
}
