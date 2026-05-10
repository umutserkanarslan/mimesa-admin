import { fail, redirect } from '@sveltejs/kit';
import type { Actions, PageServerLoad } from './$types';

export const load: PageServerLoad = async ({ url }) => {
	return {
		redirectTo: url.searchParams.get('redirect') ?? '/'
	};
};

export const actions: Actions = {
	signin: async ({ request, locals: { supabase }, url }) => {
		const form = await request.formData();
		const email = String(form.get('email') ?? '').trim();
		const password = String(form.get('password') ?? '');
		const redirectTo = String(form.get('redirect') ?? '/');

		if (!email || !password) {
			return fail(400, { email, error: 'E-posta ve şifre zorunlu.' });
		}

		const { error } = await supabase.auth.signInWithPassword({ email, password });
		if (error) {
			return fail(400, { email, error: error.message });
		}

		throw redirect(303, redirectTo.startsWith('/') ? redirectTo : '/');
	}
};
