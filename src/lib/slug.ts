const TURKISH_MAP: Record<string, string> = {
	ç: 'c', Ç: 'c',
	ğ: 'g', Ğ: 'g',
	ı: 'i', İ: 'i',
	ö: 'o', Ö: 'o',
	ş: 's', Ş: 's',
	ü: 'u', Ü: 'u'
};

export function slugify(input: string): string {
	if (!input) return '';
	let out = '';
	for (const ch of input) {
		out += TURKISH_MAP[ch] ?? ch;
	}
	return out
		.toLowerCase()
		.normalize('NFD')
		.replace(/[̀-ͯ]/g, '')
		.replace(/[^a-z0-9]+/g, '-')
		.replace(/^-+|-+$/g, '');
}
