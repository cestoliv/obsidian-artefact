import { PLUGIN_ID, type Comment } from './types.ts';

const MAX_EXCERPT_LINES = 8;
const MAX_QUOTE_LENGTH = 60;

export function lineLabel(c: Pick<Comment, 'startLine' | 'endLine' | 'detached'>): string {
	if (c.detached) return `Detached, last seen line ${c.startLine}`;
	return c.startLine === c.endLine ? `Line ${c.startLine}` : `Lines ${c.startLine}-${c.endLine}`;
}

export function excerpt(text: string): string {
	const lines = text.split(/\r\n|\r|\n/);
	const half = MAX_EXCERPT_LINES / 2;
	const kept = lines.length > MAX_EXCERPT_LINES ? [...lines.slice(0, half), '...', ...lines.slice(-half)] : lines;
	return kept.map((line) => `> ${line}`).join('\n');
}

export function cardQuote(text: string): string {
	const normalized = text.replace(/\s+/g, ' ').trim();
	return normalized.length > MAX_QUOTE_LENGTH ? `${normalized.slice(0, MAX_QUOTE_LENGTH - 3).trimEnd()}...` : normalized;
}

function escapeBody(body: string): string {
	return body.replace(/\\/g, '\\\\').replace(/"/g, '\\"').replace(/\r/g, '\\r').replace(/\n/g, '\\n');
}

export function formatPrompt(comments: Comment[], absolutePath: string, vaultName: string): string {
	const open = comments
		.filter((c) => c.status === 'open')
		.sort((a, b) => a.startLine - b.startLine || a.createdAt - b.createdAt);
	const blocks = open.map((c) =>
		[`ID: ${c.id}`, lineLabel(c), 'Excerpt:', excerpt(c.selectedText), `User comment: "${escapeBody(c.body)}"`].join('\n'),
	);
	return [
		`File: ${absolutePath}`,
		...blocks,
		[
			'When you have addressed a comment, mark it resolved:',
			`obsidian vault="${vaultName}" ${PLUGIN_ID}:resolve id=<ID> note="<one line on what you changed>"`,
		].join('\n'),
	].join('\n\n');
}
