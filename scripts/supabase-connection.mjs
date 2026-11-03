import { execFileSync } from 'node:child_process';

export const projectRef = 'urcdwhuiszggdaeksmcz';
export const projectUrl = `https://${projectRef}.supabase.co`;

// Fixed CLI commands only. Capture their output so server keys never reach logs.
export function cliJson(command) {
  const output = execFileSync('cmd.exe', ['/d', '/s', '/c', `npm.cmd exec --offline --cache .npm-cache --yes --package supabase -- supabase ${command} --agent no --output json`], { encoding: 'utf8', stdio: ['pipe', 'pipe', 'pipe'], maxBuffer: 8 * 1024 * 1024 });
  const start = output.search(/[\[{]/);
  if (start < 0) throw new Error('Supabase CLI did not return JSON.');
  return JSON.parse(output.slice(start));
}

export function projectKeys() {
  const result = cliJson(`projects api-keys --remote=${projectRef} --reveal`);
  const keys = Array.isArray(result) ? result : result.keys ?? result.api_keys;
  if (!Array.isArray(keys)) throw new Error('Unexpected API key response format.');
  const publicKey = keys.find(k => k.type === 'publishable') ?? keys.find(k => k.name === 'anon');
  const adminKey = keys.find(k => k.type === 'secret') ?? keys.find(k => k.name === 'service_role');
  if (!publicKey?.api_key || !adminKey?.api_key) throw new Error('Required API keys unavailable.');
  return { publicKey: publicKey.api_key, adminKey: adminKey.api_key };
}

export function sqlFile(path, readOnly = false) {
  if (!/^[a-zA-Z0-9_./-]+$/.test(path)) throw new Error('Invalid SQL file path.');
  return cliJson(`db query --remote=${projectRef} --file ${path} ${readOnly ? '--read-only' : '--yes'}`);
}

if (process.argv[2] === 'check-keys') {
  try {
    const { publicKey, adminKey } = projectKeys();
    console.log(JSON.stringify({ projectRef, publicKeyAvailable: Boolean(publicKey), adminKeyAvailable: Boolean(adminKey) }));
  } catch { console.error('Could not load API keys. No key values were logged.'); process.exitCode = 1; }
}
