import { execFileSync } from 'node:child_process';
import { projectKeys, projectUrl } from './supabase-connection.mjs';

try {
  const { publicKey } = projectKeys();
  for (const [name, value] of Object.entries({ NEXT_PUBLIC_SUPABASE_URL: projectUrl, NEXT_PUBLIC_SUPABASE_PUBLISHABLE_KEY: publicKey })) {
    // Public browser configuration only; no admin key or account password is uploaded.
    execFileSync('cmd.exe', ['/d', '/s', '/c', `vercel.cmd env add ${name} --environment production,development --force --yes --no-sensitive --project pressure --scope parkjin0413-4020s-projects`], {
      input: `${value}\n`, encoding: 'utf8', stdio: ['pipe', 'pipe', 'pipe'], timeout: 60000,
    });
    console.log(`Configured ${name} for pressure (production and development).`);
  }
} catch {
  console.error('Vercel environment setup failed. No key values were logged.'); process.exitCode = 1;
}
