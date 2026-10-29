import { test } from 'node:test';
import assert from 'node:assert/strict';
import { blockAt } from './blocks.ts';

const lines = [
	'# Title', // 0 heading
	'para one', // 1 paragraph
	'para two', // 2
	'', // 3
	'- item a', // 4 list item
	'  continued', // 5
	'- item b', // 6
	'', // 7
	'```js', // 8 fence
	'code', // 9
	'```', // 10
	'| a | b |', // 11 table
	'| - | - |', // 12
	'> [!note] Callout', // 13 quote / callout
	'> body', // 14
];

test('blockAt finds each block kind', () => {
	assert.deepEqual(blockAt(lines, 0), { start: 0, end: 0 });
	assert.deepEqual(blockAt(lines, 2), { start: 1, end: 2 });
	assert.equal(blockAt(lines, 3), null);
	assert.deepEqual(blockAt(lines, 5), { start: 4, end: 5 });
	assert.deepEqual(blockAt(lines, 6), { start: 6, end: 6 });
	assert.deepEqual(blockAt(lines, 9), { start: 8, end: 10 });
	assert.deepEqual(blockAt(lines, 10), { start: 8, end: 10 });
	assert.deepEqual(blockAt(lines, 12), { start: 11, end: 12 });
	assert.deepEqual(blockAt(lines, 13), { start: 13, end: 14 });
});

test('blockAt treats blank lines inside a fence as code', () => {
	assert.deepEqual(blockAt(['```', 'a', '', 'b', '```'], 2), { start: 0, end: 4 });
});

test('blockAt keeps an unclosed fence until the end', () => {
	assert.deepEqual(blockAt(['text', '```', 'a'], 2), { start: 1, end: 2 });
});
