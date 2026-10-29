import { test } from 'node:test';
import assert from 'node:assert/strict';
import { cardQuote, excerpt, formatPrompt, lineLabel } from './format.ts';
import type { Comment } from './types.ts';

const comment = (over: Partial<Comment>): Comment => ({
	id: 'aaaa',
	filePath: 'notes/plan.md',
	startLine: 1,
	endLine: 1,
	selectedText: '',
	body: '',
	status: 'open',
	detached: false,
	createdAt: 0,
	...over,
});

test('lineLabel', () => {
	assert.equal(lineLabel({ startLine: 12, endLine: 12, detached: false }), 'Line 12');
	assert.equal(lineLabel({ startLine: 12, endLine: 14, detached: false }), 'Lines 12-14');
	assert.equal(lineLabel({ startLine: 12, endLine: 14, detached: true }), 'Detached, last seen line 12');
});

test('excerpt quotes each line and handles CRLF', () => {
	assert.equal(excerpt('a\r\nb'), '> a\n> b');
});

test('excerpt keeps first 4 and last 4 lines past 8', () => {
	const ten = Array.from({ length: 10 }, (_, i) => `l${i + 1}`).join('\n');
	assert.equal(excerpt(ten), '> l1\n> l2\n> l3\n> l4\n> ...\n> l7\n> l8\n> l9\n> l10');
});

test('cardQuote collapses whitespace and truncates at 60', () => {
	assert.equal(cardQuote('a\n  b'), 'a b');
	assert.equal(cardQuote('x'.repeat(80)), 'x'.repeat(57) + '...');
});

test('formatPrompt sorts, escapes and skips resolved comments', () => {
	const comments = [
		comment({ id: 'p02x', startLine: 20, endLine: 20, selectedText: 'another excerpt', body: 'is this still true?' }),
		comment({ id: 'zzzz', startLine: 1, endLine: 1, selectedText: 'done', body: 'x', status: 'resolved' }),
		comment({ id: 'k3f9', startLine: 12, endLine: 14, selectedText: 'the selected text', body: 'say "hi"\nnow\\' }),
	];
	assert.equal(
		formatPrompt(comments, '/v/notes/plan.md', 'Work'),
		[
			'File: /v/notes/plan.md',
			'',
			'ID: k3f9',
			'Lines 12-14',
			'Excerpt:',
			'> the selected text',
			'User comment: "say \\"hi\\"\\nnow\\\\"',
			'',
			'ID: p02x',
			'Line 20',
			'Excerpt:',
			'> another excerpt',
			'User comment: "is this still true?"',
			'',
			'When you have addressed a comment, mark it resolved:',
			'obsidian vault="Work" obsidian-artefact:resolve id=<ID> note="<one line on what you changed>"',
		].join('\n'),
	);
});
