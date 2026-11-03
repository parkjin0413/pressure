import { readFileSync, writeFileSync } from 'node:fs';
import { createClient } from '@supabase/supabase-js';
import { projectKeys, projectUrl } from './supabase-connection.mjs';

const path = '.env.accounts.local';
const names = { 'parkjin0413@pressure.com': '박진', 'ksn4962@pressure.com': '김순녀' };
try {
  const accounts = JSON.parse(readFileSync(path, 'utf8'));
  const { adminKey } = projectKeys();
  const client = createClient(projectUrl, adminKey, { auth: { persistSession: false, autoRefreshToken: false } });
  for (const account of accounts) {
    const name = names[account.email];
    if (!name || !account.id) throw new Error('Account identity is missing or unexpected.');
    const { data, error } = await client.auth.admin.getUserById(account.id);
    if (error || data.user.email !== account.email || data.user.app_metadata.pressure_managed !== true) throw new Error('Account ownership check failed.');
    const updated = await client.auth.admin.updateUserById(account.id, { user_metadata: { ...data.user.user_metadata, display_name: name } });
    if (updated.error) throw new Error('Display name update failed.');
    const member = await client.from('pressure_members').update({ display_name: name }).eq('user_id', account.id).select('user_id');
    if (member.error || member.data?.length !== 1) throw new Error('Membership name update failed.');
    account.name = name;
    writeFileSync(path, JSON.stringify(accounts, null, 2));
    console.log(`Updated display name: ${name}`);
  }
} catch {
  console.error('Account rename did not complete. Credentials were not logged.');
  process.exitCode = 1;
}
