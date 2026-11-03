import type { SupabaseClient } from '@supabase/supabase-js';

export async function updatePassword(client: SupabaseClient, current: string, next: string): Promise<{ code?: string; status?: number } | null> {
  const { data: identity, error: identityError } = await client.auth.getUser();
  if (identityError || !identity.user?.email) return { code: 'session_not_found', status: 401 };
  // Explicit reauthentication also supports hosted Auth versions that ignore current_password.
  // Refresh only this app's session; never change shared project Auth configuration.
  const { data: verified, error: verificationError } = await client.auth.signInWithPassword({ email: identity.user.email, password: current });
  if (verificationError) return verificationError;
  if (verified.user?.id !== identity.user.id) return { code: 'session_not_found', status: 401 };
  const { error } = await client.auth.updateUser({ password: next, current_password: current });
  return error;
}
