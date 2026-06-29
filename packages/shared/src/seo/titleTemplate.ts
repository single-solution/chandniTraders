/**
 * Apply a simple `{placeholder}` template to a vars map.
 */

const PLACEHOLDER_RE = /\{([a-zA-Z][a-zA-Z0-9_]*)\}/g;

export function applyTitleTemplate(template: string, vars: Record<string, string>): string {
	const substituted = template.replace(PLACEHOLDER_RE, (match, key: string) => {
		if (Object.prototype.hasOwnProperty.call(vars, key)) {
			return vars[key];
		}
		return match;
	});

	return substituted
		.replace(/\s*[|·—–-]\s*$/g, "")
		.replace(/^\s*[|·—–-]\s*/g, "")
		.replace(/\s*[|·—–-]\s*[|·—–-]\s*/g, " — ")
		.trim();
}
