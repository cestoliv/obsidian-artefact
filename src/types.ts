export const PLUGIN_ID = 'obsidian-artefact';

export type Comment = {
	/** 4 lowercase base36 characters, unique in the vault */
	id: string;
	/** Vault-relative path */
	filePath: string;
	/** 1-based, inclusive */
	startLine: number;
	/** 1-based, inclusive */
	endLine: number;
	/** Exact selected text, or the full block text for a block comment */
	selectedText: string;
	body: string;
	status: 'open' | 'resolved';
	detached: boolean;
	resolution?: string;
	resolvedBy?: 'user' | 'agent';
	createdAt: number;
	updatedAt?: number;
};
