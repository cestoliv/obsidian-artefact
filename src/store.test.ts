import { test } from 'node:test';
import assert from 'node:assert/strict';
import { CommentStore } from './store.ts';

const input = { filePath: 'a.md', startLine: 1, endLine: 1, selectedText: 'x', body: 'b' };

function setup() {
	let saves = 0;
	let changes = 0;
	const store = new CommentStore([], () => saves++);
	store.onChange(() => changes++);
	return { store, saves: () => saves, changes: () => changes };
}

test('add creates an open comment with a 4-character id', () => {
	const { store, saves, changes } = setup();
	const c = store.add(input);
	assert.match(c.id, /^[0-9a-z]{4}$/);
	assert.equal(c.status, 'open');
	assert.equal(c.detached, false);
	assert.equal(saves(), 1);
	assert.equal(changes(), 1);
});

test('ids are unique', () => {
	const { store } = setup();
	const ids = new Set(Array.from({ length: 200 }, () => store.add(input).id));
	assert.equal(ids.size, 200);
});

test('resolve with an unknown id returns false and changes nothing', () => {
	const { store, saves, changes } = setup();
	assert.equal(store.resolve('nope', 'agent'), false);
	assert.equal(saves(), 0);
	assert.equal(changes(), 0);
});

test('resolve sets status, resolver and note, and a second resolve updates the note', () => {
	const { store } = setup();
	const { id } = store.add(input);
	assert.equal(store.resolve(id, 'agent', 'done'), true);
	assert.deepEqual(
		(({ status, resolvedBy, resolution }) => ({ status, resolvedBy, resolution }))(store.get(id)!),
		{ status: 'resolved', resolvedBy: 'agent', resolution: 'done' },
	);
	store.resolve(id, 'agent', 'again');
	assert.equal(store.get(id)?.resolution, 'again');
});

test('reopen clears the resolution', () => {
	const { store } = setup();
	const { id } = store.add(input);
	store.resolve(id, 'user', 'n');
	store.reopen(id);
	const c = store.get(id)!;
	assert.equal(c.status, 'open');
	assert.equal(c.resolution, undefined);
	assert.equal(c.resolvedBy, undefined);
});

test('edit and remove', () => {
	const { store } = setup();
	const { id } = store.add(input);
	store.edit(id, 'new');
	assert.equal(store.get(id)?.body, 'new');
	store.remove(id);
	assert.equal(store.get(id), undefined);
});

test('clearResolved and clearAll only touch the given file', () => {
	const { store } = setup();
	const open = store.add(input);
	const done = store.add(input);
	const other = store.add({ ...input, filePath: 'b.md' });
	store.resolve(done.id, 'user');
	store.clearResolved('a.md');
	assert.deepEqual(store.all().map((c) => c.id), [open.id, other.id]);
	store.clearAll('a.md');
	assert.deepEqual(store.all().map((c) => c.id), [other.id]);
});

test('renameFile moves comments and removeFile deletes them', () => {
	const { store } = setup();
	store.add(input);
	store.renameFile('a.md', 'x/a.md');
	assert.equal(store.forFile('x/a.md').length, 1);
	assert.equal(store.forFile('a.md').length, 0);
	store.removeFile('x/a.md');
	assert.equal(store.all().length, 0);
});

test('setAnchor with the same values notifies nobody', () => {
	const { store, changes } = setup();
	const { id } = store.add(input);
	store.setAnchor(id, { startLine: 1, endLine: 1, selectedText: 'x', detached: false });
	assert.equal(changes(), 1);
	store.setAnchor(id, { startLine: 2 });
	assert.equal(changes(), 2);
	assert.equal(store.get(id)?.startLine, 2);
});

test('unsubscribe stops notifications', () => {
	const store = new CommentStore([], () => {});
	let changes = 0;
	const off = store.onChange(() => changes++);
	off();
	store.add(input);
	assert.equal(changes, 0);
});
