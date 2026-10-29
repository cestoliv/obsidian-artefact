import { ItemView, MarkdownView, Notice, setIcon, TFile, type WorkspaceLeaf } from 'obsidian';
import { locate } from './anchor.ts';
import { openComposer } from './composer.ts';
import { cardQuote, formatPrompt, lineLabel } from './format.ts';
import type ArtefactPlugin from './main.ts';
import type { Comment } from './types.ts';

export const VIEW_TYPE = 'obsidian-artefact-panel';

export class CommentsPanel extends ItemView {
	private plugin: ArtefactPlugin;
	private file: TFile | null = null;
	private resolvedOpen = false;

	constructor(leaf: WorkspaceLeaf, plugin: ArtefactPlugin) {
		super(leaf);
		this.plugin = plugin;
	}

	getViewType(): string {
		return VIEW_TYPE;
	}

	getDisplayText(): string {
		return 'Comments';
	}

	getIcon(): string {
		return 'message-square';
	}

	async onOpen(): Promise<void> {
		this.register(this.plugin.store.onChange(() => this.render()));
		this.registerEvent(this.app.workspace.on('file-open', () => this.render()));
		this.registerEvent(this.app.workspace.on('active-leaf-change', () => this.render()));
		this.render();
	}

	focus(id: string): void {
		if (this.plugin.store.get(id)?.status === 'resolved' && !this.resolvedOpen) {
			this.resolvedOpen = true;
			this.render();
		}
		const item = this.contentEl.querySelector<HTMLElement>(`[data-oa-id="${id}"]`);
		if (!item) return;
		item.scrollIntoView({ block: 'nearest' });
		item.addClass('oa-item-flash');
		window.setTimeout(() => item.removeClass('oa-item-flash'), 1200);
	}

	private render(): void {
		const active = this.app.workspace.getActiveFile();
		if (active?.extension === 'md') this.file = active;
		const file = this.file;
		const el = this.contentEl;
		el.empty();
		el.addClass('oa-panel');

		const comments = file ? this.plugin.store.forFile(file.path).sort((a, b) => a.startLine - b.startLine) : [];
		const open = comments.filter((c) => c.status === 'open');
		const resolved = comments.filter((c) => c.status === 'resolved');

		const toolbar = el.createDiv({ cls: 'nav-header' }).createDiv({ cls: 'nav-buttons-container' });
		this.iconButton(toolbar, 'copy', `Copy ${open.length} open comment${open.length === 1 ? '' : 's'}`, open.length > 0, () => {
			if (file) void this.copyAll(file, open);
		});
		this.iconButton(toolbar, 'check-check', 'Clear resolved', resolved.length > 0, () => {
			if (file) this.plugin.store.clearResolved(file.path);
		});
		this.iconButton(toolbar, 'trash-2', 'Clear all', comments.length > 0, () => {
			if (file && window.confirm(`Delete all ${comments.length} comments of ${file.basename}?`)) {
				this.plugin.store.clearAll(file.path);
			}
		});

		if (!file || !comments.length) {
			el.createDiv({
				cls: 'pane-empty',
				text: file ? 'No comments yet. Hover a block or select text to add one.' : 'Open a note to see its comments.',
			});
			return;
		}

		const list = el.createDiv({ cls: 'oa-list' });
		for (const c of open) this.renderItem(list, file, c);

		if (resolved.length) {
			const group = el.createDiv({ cls: 'oa-group' });
			const title = group.createDiv({ cls: 'oa-group-title' });
			const chevron = title.createDiv({ cls: 'oa-group-chevron' });
			setIcon(chevron, 'chevron-right');
			title.createSpan({ text: 'Resolved' });
			title.createSpan({ cls: 'oa-group-count', text: String(resolved.length) });
			title.toggleClass('is-open', this.resolvedOpen);
			title.onclick = () => {
				this.resolvedOpen = !this.resolvedOpen;
				this.render();
			};
			if (this.resolvedOpen) {
				const items = group.createDiv({ cls: 'oa-list' });
				for (const c of resolved) this.renderItem(items, file, c);
			}
		}
	}

	private renderItem(parent: HTMLElement, file: TFile, c: Comment): void {
		const item = parent.createDiv({ cls: 'oa-item', attr: { 'data-oa-id': c.id } });
		item.toggleClass('is-resolved', c.status === 'resolved');

		const meta = item.createDiv({ cls: 'oa-meta' });
		meta.createSpan({ cls: c.detached ? 'oa-detached' : '', text: lineLabel(c) });
		const actions = meta.createDiv({ cls: 'oa-actions' });
		if (c.status === 'open') {
			this.iconButton(actions, 'check', 'Resolve', true, () => this.plugin.store.resolve(c.id, 'user'));
		} else {
			this.iconButton(actions, 'rotate-ccw', 'Reopen', true, () => this.plugin.store.reopen(c.id));
		}
		this.iconButton(actions, 'x', 'Delete', true, () => this.plugin.store.remove(c.id));

		const quote = item.createDiv({ cls: 'oa-quote', text: cardQuote(c.selectedText), attr: { 'aria-label': 'Show in note' } });
		quote.onclick = () => void this.reveal(file, c);

		const body = item.createDiv({ cls: 'oa-body', text: c.body });
		body.onclick = () => openComposer(body.getBoundingClientRect(), c.body, (text) => this.plugin.store.edit(c.id, text));

		if (c.status === 'resolved') {
			const by = c.resolvedBy === 'agent' ? 'Agent' : 'You';
			item.createDiv({ cls: 'oa-resolution', text: c.resolution ? `${by}: ${c.resolution}` : `Resolved by ${by.toLowerCase()}` });
		}
	}

	private iconButton(parent: HTMLElement, icon: string, label: string, enabled: boolean, onClick: () => void): void {
		const button = parent.createDiv({ cls: 'clickable-icon', attr: { 'aria-label': label } });
		setIcon(button, icon);
		button.toggleClass('is-disabled', !enabled);
		if (enabled) button.onclick = onClick;
	}

	private async copyAll(file: TFile, open: Comment[]): Promise<void> {
		const prompt = formatPrompt(open, this.plugin.absolutePath(file.path), this.app.vault.getName());
		try {
			await navigator.clipboard.writeText(prompt);
			new Notice(`Copied ${open.length} comment${open.length === 1 ? '' : 's'}`);
		} catch (error) {
			new Notice(`Copy failed: ${error instanceof Error ? error.message : String(error)}`);
		}
	}

	private async reveal(file: TFile, c: Comment): Promise<void> {
		let leaf = this.app.workspace
			.getLeavesOfType('markdown')
			.find((l) => l.view instanceof MarkdownView && l.view.file?.path === file.path);
		if (!leaf) {
			leaf = this.app.workspace.getLeaf(false);
			await leaf.openFile(file);
		}
		await this.app.workspace.revealLeaf(leaf);
		if (!(leaf.view instanceof MarkdownView)) return;
		const editor = leaf.view.editor;
		const range = locate(editor.getValue(), c);
		const from = range ? editor.offsetToPos(range.from) : { line: c.startLine - 1, ch: 0 };
		const to = range ? editor.offsetToPos(range.to) : from;
		editor.setSelection(from, to);
		editor.scrollIntoView({ from, to }, true);
		editor.focus();
	}
}
