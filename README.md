# Artefact comments

An Obsidian plugin to comment on a note the way you comment on a Claude artifact.
Pin comments to blocks or selected text, then copy all comments as one prompt for your AI agent.
The agent marks each comment as resolved through the Obsidian CLI.

Requires Obsidian 1.12.2 or later, desktop only. Supports Live Preview and Source mode.

## Use

- **Comment on a block:** move the pointer over a paragraph, heading, list item, code block, table or callout, then click the comment button at its right edge.
- **Comment on a selection:** select text, then click **Comment**.
- **Command:** `Add comment` comments on the selection, or on the block at the cursor. Bind a hotkey to it.
- **Composer:** **Enter** saves, **Shift+Enter** adds a new line, **Esc** cancels.
- **Panel:** `Open comments panel` shows the comments of the open note. From the panel you can resolve, reopen, edit or delete each comment, and clear the resolved comments or all comments.
- **Copy all** copies the open comments of the note in this format:

```
File: /path/to/vault/notes/plan.md

ID: k3f9
Lines 12-14
Excerpt:
> the selected text
User comment: "make this shorter"

When you have addressed a comment, mark it resolved:
obsidian vault="Work" obsidian-artefact:resolve id=<ID> note="<one line on what you changed>"
```

## Agent resolve

To let an agent resolve comments, turn on the CLI in **Settings → General**. Obsidian must be running.

```sh
obsidian vault="Work" obsidian-artefact:resolve id=k3f9 note="Cut the intro to one sentence"
```

The command prints `Resolved k3f9`, or `No comment with id k3f9`.

## Comment storage

Comments live in the plugin `data.json`, never in your notes.
Each comment keeps its quoted text. When the note changes on disk, the plugin finds the text again.
If the text is gone, the comment stays in the panel as **detached**.

## Develop

```sh
npm install
npm test          # unit tests for the pure modules
npm run dev       # rebuild main.js on change
```

1. Link the repository into a vault: `ln -s "$PWD" <vault>/.obsidian/plugins/obsidian-artefact`.
2. Enable the plugin: `obsidian vault=<vault> plugin:enable id=obsidian-artefact`.
3. After each build, reload it: `obsidian vault=<vault> plugin:reload id=obsidian-artefact`.

`test-vault/Review.md` has one block of each kind for manual tests.
