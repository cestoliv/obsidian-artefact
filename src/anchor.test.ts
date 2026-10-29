import { test } from 'node:test';
import assert from 'node:assert/strict';
import { lineOf, locate, reanchor } from './anchor.ts';
import type { Comment } from './types.ts';

const base: Comment = {
	id: 'aaaa',
	filePath: 'a.md',
	startLine: 1,
	endLine: 1,
	selectedText: '',
	body: 'b',
	status: 'open',
	detached: false,
	createdAt: 0,
};

const doc = 'intro\nfoo bar\nmiddle\nfoo bar\nend';

test('lineOf', () => {
	assert.equal(lineOf(doc, 0), 1);
	assert.equal(lineOf(doc, 6), 2);
});

test('locate keeps a match inside the stored lines', () => {
	assert.deepEqual(locate(doc, { startLine: 4, endLine: 4, selectedText: 'foo bar' }), { from: 21, to: 28 });
});

test('locate takes the occurrence nearest to the old line', () => {
	assert.deepEqual(locate(doc, { startLine: 5, endLine: 5, selectedText: 'foo bar' }), { from: 21, to: 28 });
	assert.deepEqual(locate(doc, { startLine: 1, endLine: 1, selectedText: 'foo bar' }), { from: 6, to: 13 });
});

test('locate returns null for empty selectedText', () => {
	assert.equal(locate(doc, { startLine: 1, endLine: 1, selectedText: '' }), null);
});

test('reanchor detaches when the text is gone and keeps old lines', () => {
	assert.deepEqual(reanchor('a\nb', { ...base, startLine: 4, endLine: 4, selectedText: 'zzz' }), {
		startLine: 4,
		endLine: 4,
		detached: true,
	});
});

test('reanchor attaches again when the text comes back', () => {
	assert.deepEqual(reanchor('x\nzzz', { ...base, startLine: 4, endLine: 4, selectedText: 'zzz', detached: true }), {
		startLine: 2,
		endLine: 2,
		detached: false,
	});
});

test('reanchor computes multi-line ranges and CRLF lines', () => {
	assert.deepEqual(reanchor('a\r\nb\r\nc', { ...base, startLine: 1, endLine: 1, selectedText: 'b\r\nc' }), {
		startLine: 2,
		endLine: 3,
		detached: false,
	});
});
