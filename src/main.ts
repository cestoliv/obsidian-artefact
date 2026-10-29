import { EditorView } from '@codemirror/view';
import { debounce, FileSystemAdapter, MarkdownView, Plugin, TFile, type TAbstractFile } from 'obsidian';
import { reanchor } from './anchor.ts';
import { closeComposer } from './composer.ts';
import { blockRange, commentOn, commentsExtension } from './editor.ts';
import { CommentsPanel, VIEW_TYPE } from './panel.ts';
import { CommentStore } from './store.ts';
import { PLUGIN_ID, type Comment } from './types.ts';

export default class ArtefactPlugin extends Plugin {
	store!: CommentStore;
	private panelShown = false;

	async onload(): Promise<void> {
		const data = (await this.loadData()) as { comments?: Comment[] } | null;
		const save = debounce((comments: Comment[]) => void this.saveData({ comments }), 500, true);
		this.register(() => save.run());
		this.store = new CommentStore(data?.comments ?? [], save);

		this.registerView(VIEW_TYPE, (leaf) => new CommentsPanel(leaf, this));
		this.addCommand({ id: 'open-panel', name: 'Open comments panel', callback: () => void this.openPanel() });
		this.addCommand({
			id: 'add-comment',
			name: 'Add comment',
			editorCheckCallback: (checking, editor, ctx) => {
				const dom = ctx instanceof MarkdownView ? ctx.contentEl.querySelector<HTMLElement>('.cm-editor') : null;
				const view = dom ? EditorView.findFromDOM(dom) : null;
				if (!view) return false;
				if (checking) return true;
				const { from, to, head } = view.state.selection.main;
				const range = from !== to ? { from, to } : blockRange(view.state, head);
				if (range) commentOn(this, view, range);
				return true;
			},
		});
		this.registerEditorExtension(commentsExtension(this));
		this.register(closeComposer);

		this.registerCliHandler(
			`${PLUGIN_ID}:resolve`,
			'Mark a comment as resolved',
			{
				id: { value: '<id>', description: 'Comment ID', required: true },
				note: { value: '<text>', description: 'One line on what you changed' },
			},
			({ id, note }) => {
				if (!id || id === 'true') return 'Missing id';
				return this.store.resolve(id, 'agent', note === 'true' ? undefined : note)
					? `Resolved ${id}`
					: `No comment with id ${id}`;
			},
		);

		this.registerEvent(this.app.vault.on('rename', (file, oldPath) => this.store.renameFile(oldPath, file.path)));
		this.registerEvent(this.app.vault.on('delete', (file) => this.store.removeFile(file.path)));
		this.registerEvent(this.app.vault.on('modify', (file) => void this.reanchorFile(file)));
		this.registerEvent(this.app.workspace.on('file-open', (file) => file && void this.reanchorFile(file)));
	}

	async openPanel(focusId?: string): Promise<void> {
		const leaf = await this.app.workspace.ensureSideLeaf(VIEW_TYPE, 'right', { active: false, reveal: true });
		await leaf.loadIfDeferred();
		if (focusId && leaf.view instanceof CommentsPanel) leaf.view.focus(focusId);
	}

	onCommentAdded(id: string): void {
		if (this.panelShown) return;
		this.panelShown = true;
		void this.openPanel(id);
	}

	absolutePath(path: string): string {
		const adapter = this.app.vault.adapter;
		return adapter instanceof FileSystemAdapter ? adapter.getFullPath(path) : path;
	}

	private async reanchorFile(file: TAbstractFile): Promise<void> {
		if (!(file instanceof TFile)) return;
		const comments = this.store.forFile(file.path);
		if (!comments.length) return;
		// The editor stores LF only, so compare against LF content.
		const content = (await this.app.vault.read(file)).replace(/\r\n?/g, '\n');
		for (const c of comments) this.store.setAnchor(c.id, reanchor(content, c));
	}
}
