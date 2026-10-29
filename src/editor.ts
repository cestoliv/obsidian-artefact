import { StateField, type EditorState, type Extension } from '@codemirror/state';
import {
	Decoration,
	EditorView,
	showTooltip,
	ViewPlugin,
	type DecorationSet,
	type PluginValue,
	type Tooltip,
	type ViewUpdate,
} from '@codemirror/view';
import { editorInfoField, setIcon } from 'obsidian';
import { locate, type Range } from './anchor.ts';
import { blockAt } from './blocks.ts';
import { openComposer } from './composer.ts';
import type ArtefactPlugin from './main.ts';

const filePath = (state: EditorState): string | undefined => state.field(editorInfoField, false)?.file?.path;

export function commentOn(plugin: ArtefactPlugin, view: EditorView, range: Range): void {
	const file = view.state.field(editorInfoField, false)?.file;
	if (!file) return;
	const start = view.coordsAtPos(range.from);
	const end = view.coordsAtPos(range.to) ?? start;
	const anchor = start && end ? new DOMRect(start.left, start.top, 0, end.bottom - start.top) : view.dom.getBoundingClientRect();
	const doc = view.state.doc;
	const target = {
		filePath: file.path,
		startLine: doc.lineAt(range.from).number,
		endLine: doc.lineAt(Math.max(range.from, range.to - 1)).number,
		selectedText: doc.sliceString(range.from, range.to),
	};
	openComposer(anchor, '', (body) => plugin.onCommentAdded(plugin.store.add({ ...target, body }).id));
}

export function blockRange(state: EditorState, pos: number, lines = state.doc.toJSON()): Range | null {
	const doc = state.doc;
	const block = blockAt(lines, doc.lineAt(pos).number - 1);
	if (!block) return null;
	return { from: doc.line(block.start + 1).from, to: doc.line(block.end + 1).to };
}

class Highlights implements PluginValue {
	decorations: DecorationSet = Decoration.none;
	private ranges = new Map<string, Range>();
	private dirty = true;
	private view: EditorView;
	private plugin: ArtefactPlugin;
	private off: () => void;
	private destroyed = false;

	constructor(view: EditorView, plugin: ArtefactPlugin) {
		this.view = view;
		this.plugin = plugin;
		this.off = plugin.store.onChange(() => {
			this.dirty = true;
			// CodeMirror refuses a dispatch while an update is in progress.
			window.setTimeout(() => this.destroyed || this.view.dispatch({}), 0);
		});
		this.rebuild();
	}

	update(update: ViewUpdate): void {
		if (update.docChanged) this.follow(update);
		if (this.dirty) this.rebuild();
		else if (update.docChanged) this.decorate();
	}

	destroy(): void {
		this.destroyed = true;
		this.off();
	}

	private follow(update: ViewUpdate): void {
		// Obsidian reloads a file changed on disk with a "set" transaction. The vault
		// modify re-anchor owns those changes, so rebuild from the store instead.
		if (update.transactions.some((tr) => tr.isUserEvent('set'))) {
			this.dirty = true;
			return;
		}
		const doc = update.state.doc;
		for (const [id, range] of this.ranges) {
			const from = update.changes.mapPos(range.from, 1);
			const to = update.changes.mapPos(range.to, -1);
			if (from >= to) {
				this.ranges.delete(id);
				continue;
			}
			this.ranges.set(id, { from, to });
			this.plugin.store.setAnchor(id, {
				startLine: doc.lineAt(from).number,
				endLine: doc.lineAt(to - 1).number,
				selectedText: doc.sliceString(from, to),
			});
		}
	}

	private rebuild(): void {
		this.dirty = false;
		this.ranges.clear();
		const path = filePath(this.view.state);
		if (path) {
			const content = this.view.state.doc.toString();
			for (const c of this.plugin.store.forFile(path)) {
				if (c.status !== 'open' || c.detached) continue;
				const range = locate(content, c);
				if (range) this.ranges.set(c.id, range);
			}
		}
		this.decorate();
	}

	private decorate(): void {
		this.decorations = Decoration.set(
			[...this.ranges].map(([id, { from, to }]) =>
				Decoration.mark({ class: 'oa-highlight', attributes: { 'data-oa-id': id } }).range(from, to),
			),
			true,
		);
	}
}

class BlockButton implements PluginValue {
	private button: HTMLElement;
	private block: Range | null = null;
	private lines: string[] | null = null;
	private view: EditorView;

	constructor(view: EditorView, plugin: ArtefactPlugin) {
		this.view = view;
		this.button = view.scrollDOM.createDiv({ cls: 'oa-block-button', attr: { 'aria-label': 'Comment on this block' } });
		setIcon(this.button, 'message-square-plus');
		this.button.addEventListener('mousedown', (e) => e.preventDefault());
		this.button.addEventListener('click', () => {
			if (this.block) commentOn(plugin, view, this.block);
		});
		view.dom.addEventListener('mousemove', this.onMove);
		view.dom.addEventListener('mouseleave', this.hide);
	}

	update(update: ViewUpdate): void {
		if (update.docChanged) {
			this.lines = null;
			this.hide();
		}
	}

	destroy(): void {
		this.view.dom.removeEventListener('mousemove', this.onMove);
		this.view.dom.removeEventListener('mouseleave', this.hide);
		this.button.remove();
	}

	private onMove = (e: MouseEvent): void => {
		if (this.button.contains(e.target as Node)) return;
		const view = this.view;
		const pos = view.posAtCoords({ x: e.clientX, y: e.clientY }, false);
		this.lines ??= view.state.doc.toJSON();
		this.block = blockRange(view.state, pos, this.lines);
		if (!this.block) return this.hide();
		const scroller = view.scrollDOM.getBoundingClientRect();
		const content = view.contentDOM.getBoundingClientRect();
		const top = view.lineBlockAt(this.block.from).top + view.documentTop - scroller.top + view.scrollDOM.scrollTop;
		this.button.style.top = `${top}px`;
		this.button.style.left = `${content.right - scroller.left + view.scrollDOM.scrollLeft + 4}px`;
		this.button.addClass('is-visible');
	};

	private hide = (): void => {
		this.button.removeClass('is-visible');
	};
}

function selectionTooltip(plugin: ArtefactPlugin): Extension {
	const tooltips = (state: EditorState): readonly Tooltip[] => {
		const selection = state.selection.main;
		if (selection.empty) return [];
		return [
			{
				pos: selection.head,
				above: true,
				arrow: false,
				create: (view) => {
					const dom = createDiv({ cls: 'oa-selection-button' });
					const button = dom.createEl('button', { text: 'Comment' });
					setIcon(button.createSpan({ prepend: true }), 'message-square-plus');
					button.addEventListener('mousedown', (e) => e.preventDefault());
					button.addEventListener('click', () => {
						const { from, to } = view.state.selection.main;
						if (from !== to) commentOn(plugin, view, { from, to });
					});
					return { dom };
				},
			},
		];
	};
	const field = StateField.define<readonly Tooltip[]>({
		create: tooltips,
		update: (value, tr) => (tr.docChanged || tr.selection ? tooltips(tr.state) : value),
		provide: (f) => showTooltip.computeN([f], (state) => state.field(f)),
	});
	return field;
}

export function commentsExtension(plugin: ArtefactPlugin): Extension {
	return [
		ViewPlugin.define((view) => new Highlights(view, plugin), { decorations: (v) => v.decorations }),
		ViewPlugin.define((view) => new BlockButton(view, plugin)),
		selectionTooltip(plugin),
		EditorView.domEventHandlers({
			click: (e) => {
				const id = (e.target as HTMLElement).closest('[data-oa-id]')?.getAttribute('data-oa-id');
				if (id) void plugin.openPanel(id);
			},
		}),
	];
}
