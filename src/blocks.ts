type Kind = 'blank' | 'heading' | 'list' | 'table' | 'quote' | 'text';

const FENCE = /^\s*(```|~~~)/;

function kindOf(line: string): Kind {
	if (!line.trim()) return 'blank';
	if (/^\s*#{1,6}\s/.test(line)) return 'heading';
	if (/^\s*([-*+]|\d+[.)])\s/.test(line)) return 'list';
	if (/^\s*\|/.test(line)) return 'table';
	if (/^\s*>/.test(line)) return 'quote';
	return 'text';
}

/** 0-based inclusive line range of the Markdown block that contains `index`. */
export function blockAt(lines: string[], index: number): { start: number; end: number } | null {
	let fenceStart = -1;
	for (let i = 0; i < lines.length; i++) {
		if (!FENCE.test(lines[i] ?? '')) continue;
		if (fenceStart === -1) {
			fenceStart = i;
			continue;
		}
		if (index >= fenceStart && index <= i) return { start: fenceStart, end: i };
		fenceStart = -1;
	}
	if (fenceStart !== -1 && index >= fenceStart) return { start: fenceStart, end: lines.length - 1 };

	const kind = kindOf(lines[index] ?? '');
	if (kind === 'blank') return null;
	if (kind === 'heading') return { start: index, end: index };

	const sameBlock = (i: number): boolean => {
		const line = lines[i] ?? '';
		if (FENCE.test(line)) return false;
		return kind === 'text' ? kindOf(line) === 'text' : kindOf(line) === kind;
	};

	if (kind === 'list' || (kind === 'text' && /^\s/.test(lines[index] ?? ''))) {
		let start = index;
		while (kindOf(lines[start] ?? '') !== 'list' && start > 0 && kindOf(lines[start - 1] ?? '') !== 'blank') start--;
		if (kindOf(lines[start] ?? '') === 'list') {
			let end = start;
			while (end + 1 < lines.length && kindOf(lines[end + 1] ?? '') === 'text' && /^\s/.test(lines[end + 1] ?? '')) end++;
			return { start, end };
		}
	}

	let start = index;
	let end = index;
	while (start > 0 && sameBlock(start - 1)) start--;
	while (end + 1 < lines.length && sameBlock(end + 1)) end++;
	return { start, end };
}
