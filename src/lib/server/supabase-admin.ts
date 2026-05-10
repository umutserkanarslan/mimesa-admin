import { createClient } from '@supabase/supabase-js';
import { PUBLIC_SUPABASE_URL } from '$env/static/public';
import { SUPABASE_SERVICE_ROLE_KEY } from '$env/static/private';

/**
 * Server-only Supabase client using the service_role key.
 * Bypasses RLS, so it must only be used inside server-side code
 * (hooks, +page.server.ts, +server.ts) and never imported into
 * a `.svelte` component or non-server module.
 *
 * Note: we intentionally don't pass a Database generic — keeping the
 * client untyped lets us write JSONB payloads without fighting
 * Supabase's complex generic types. Result rows are cast via `as`
 * at the boundary using the hand-written DbCategory / DbItem types.
 */
export const supabaseAdmin = createClient(PUBLIC_SUPABASE_URL, SUPABASE_SERVICE_ROLE_KEY, {
	auth: {
		autoRefreshToken: false,
		persistSession: false
	}
});

export const STORAGE_BUCKET = 'menu-images';
