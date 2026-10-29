import type { Comment } from './types.ts';

export type Range = { from: number; to: number };

export function lineOf(content: string, offset: number): number {
	let line = 1;
	for (let i = content.indexOf('\n'); i !== -1 && i < offset; i = content.indexOf('\n', i + 1)) line++;
	return line;
}

export function locate(content: string, c: Pick<Comment, 'startLine' | 'endLine' | 'selectedText'>): Range | null {
	if (!c.selectedText) return null;
	let best: Range | null = null;
	let bestDistance = Infinity;
	for (let at = content.indexOf(c.selectedText); at !== -1; at = content.indexOf(c.selectedText, at + 1)) {
		const line = lineOf(content, at);
		const distance = line >= c.startLine && line <= c.endLine ? 0 : Math.abs(line - c.startLine);
		if (distance < bestDistance) {
			best = { from: at, to: at + c.selectedText.length };
			bestDistance = distance;
		}
	}
	return best;
}

export function reanchor(content: string, c: Comment): Pick<Comment, 'startLine' | 'endLine' | 'detached'> {
	const range = locate(content, c);
	if (!range) return { startLine: c.startLine, endLine: c.endLine, detached: true };
	return { startLine: lineOf(content, range.from), endLine: lineOf(content, range.to - 1), detached: false };
}
