import type { Comment } from './types.ts';

type Anchor = Pick<Comment, 'startLine' | 'endLine' | 'selectedText' | 'detached'>;

export class CommentStore {
	private comments: Comment[];
	private save: (comments: Comment[]) => void;
	private listeners = new Set<() => void>();

	constructor(comments: Comment[], save: (comments: Comment[]) => void) {
		this.comments = comments;
		this.save = save;
	}

	all(): Comment[] {
		return this.comments;
	}

	forFile(path: string): Comment[] {
		return this.comments.filter((c) => c.filePath === path);
	}

	get(id: string): Comment | undefined {
		return this.comments.find((c) => c.id === id);
	}

	onChange(listener: () => void): () => void {
		this.listeners.add(listener);
		return () => this.listeners.delete(listener);
	}

	add(input: Pick<Comment, 'filePath' | 'startLine' | 'endLine' | 'selectedText' | 'body'>): Comment {
		const comment: Comment = { ...input, id: this.newId(), status: 'open', detached: false, createdAt: Date.now() };
		this.comments.push(comment);
		this.changed();
		return comment;
	}

	edit(id: string, body: string): void {
		this.update(id, { body });
	}

	resolve(id: string, by: 'user' | 'agent', note?: string): boolean {
		if (!this.get(id)) return false;
		this.update(id, { status: 'resolved', resolvedBy: by, resolution: note });
		return true;
	}

	reopen(id: string): void {
		this.update(id, { status: 'open', resolvedBy: undefined, resolution: undefined });
	}

	remove(id: string): void {
		this.replace(this.comments.filter((c) => c.id !== id));
	}

	clearResolved(path: string): void {
		this.replace(this.comments.filter((c) => c.filePath !== path || c.status !== 'resolved'));
	}

	clearAll(path: string): void {
		this.replace(this.comments.filter((c) => c.filePath !== path));
	}

	setAnchor(id: string, anchor: Partial<Anchor>): void {
		const comment = this.get(id);
		if (!comment) return;
		const keys = Object.keys(anchor) as (keyof Anchor)[];
		if (keys.every((key) => comment[key] === anchor[key])) return;
		Object.assign(comment, anchor);
		this.changed();
	}

	renameFile(oldPath: string, newPath: string): void {
		const moved = this.forFile(oldPath);
		if (!moved.length) return;
		for (const c of moved) c.filePath = newPath;
		this.changed();
	}

	removeFile(path: string): void {
		this.clearAll(path);
	}

	private update(id: string, patch: Partial<Comment>): void {
		const comment = this.get(id);
		if (!comment) return;
		Object.assign(comment, patch, { updatedAt: Date.now() });
		this.changed();
	}

	private replace(comments: Comment[]): void {
		if (comments.length === this.comments.length) return;
		this.comments = comments;
		this.changed();
	}

	private changed(): void {
		this.save(this.comments);
		for (const listener of this.listeners) listener();
	}

	private newId(): string {
		let id: string;
		do id = Math.random().toString(36).slice(2, 6).padEnd(4, '0');
		while (this.get(id));
		return id;
	}
}
