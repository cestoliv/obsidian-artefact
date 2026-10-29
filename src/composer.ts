let closeCurrent: (() => void) | null = null;

export function closeComposer(): void {
	closeCurrent?.();
}

export function openComposer(anchor: DOMRect, initial: string, onSave: (body: string) => void): void {
	closeComposer();
	const doc = activeDocument;
	const box = doc.body.createDiv({ cls: 'oa-composer' });
	const input = box.createEl('textarea', {
		attr: { rows: '1', placeholder: 'Add a comment', 'aria-label': 'Comment' },
	});
	box.createDiv({ cls: 'oa-composer-hint', text: 'Enter to save · Shift+Enter for a new line · Esc to cancel' });
	input.value = initial;

	const width = Math.min(360, doc.body.clientWidth - 16);
	box.style.width = `${width}px`;
	box.style.left = `${Math.max(8, Math.min(anchor.left, doc.body.clientWidth - width - 8))}px`;
	box.style.top = `${anchor.bottom + 6}px`;

	const grow = () => {
		input.style.height = 'auto';
		input.style.height = `${input.scrollHeight + input.offsetHeight - input.clientHeight}px`;
	};
	const close = () => {
		box.remove();
		doc.removeEventListener('pointerdown', onOutside, true);
		closeCurrent = null;
	};
	const onOutside = (e: PointerEvent) => {
		if (!box.contains(e.target as Node) && !input.value.trim()) close();
	};

	input.addEventListener('input', grow);
	input.addEventListener('keydown', (e) => {
		if (e.isComposing) return;
		if (e.key === 'Escape') {
			e.preventDefault();
			e.stopPropagation();
			close();
		} else if (e.key === 'Enter' && !e.shiftKey) {
			e.preventDefault();
			const body = input.value.trim();
			if (!body) return;
			close();
			onSave(body);
		}
	});
	doc.addEventListener('pointerdown', onOutside, true);
	closeCurrent = close;

	if (box.getBoundingClientRect().bottom > doc.body.clientHeight) {
		box.style.top = `${Math.max(8, anchor.top - box.offsetHeight - 6)}px`;
	}
	grow();
	input.focus();
	input.setSelectionRange(input.value.length, input.value.length);
}
