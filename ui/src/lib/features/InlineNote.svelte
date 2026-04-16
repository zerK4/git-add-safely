<script lang="ts">
  import { EditorState } from "@codemirror/state";
  import { EditorView, keymap } from "@codemirror/view";
  import { defaultKeymap } from "@codemirror/commands";
  import { markdown } from "@codemirror/lang-markdown";
  import { oneDark } from "@codemirror/theme-one-dark";
  import { Trash2 } from "@lucide/svelte";

  let {
    rawIndex,
    initialContent = "",
    onSave,
    onCancel,
    onDelete,
  }: {
    rawIndex: number;
    initialContent?: string;
    onSave: (text: string) => void;
    onCancel: () => void;
    onDelete?: () => void;
  } = $props();

  let containerEl = $state<HTMLDivElement | null>(null);
  let editorView = $state<EditorView | null>(null);
  let confirmDelete = $state(false);

  $effect(() => {
    if (!containerEl) return;

    const view = new EditorView({
      state: EditorState.create({
        doc: initialContent,
        extensions: [
          keymap.of(defaultKeymap),
          markdown(),
          oneDark,
          EditorView.lineWrapping,
          EditorView.theme({
            "&": { fontSize: "12px", minHeight: "72px", background: "transparent" },
            ".cm-content": { padding: "8px 12px", fontFamily: "inherit" },
            ".cm-focused": { outline: "none" },
            ".cm-editor": { background: "transparent" },
            ".cm-scroller": { overflow: "hidden" },
          }),
        ],
      }),
      parent: containerEl,
    });

    editorView = view;
    setTimeout(() => view.focus(), 10);

    return () => {
      view.destroy();
      editorView = null;
    };
  });
</script>

<div class="bg-card border-b border-primary/20 w-full">
  <div class="px-4 pt-2 pb-1 flex items-center justify-between">
    <span class="text-[11px] text-muted-foreground font-sans">
      {initialContent ? "Edit note" : "Add note"} · Markdown supported
    </span>
  </div>

  <div bind:this={containerEl} class="mx-4 rounded border border-input overflow-hidden w-[calc(100%-2rem)]"></div>

  <div class="flex items-center gap-2 px-4 py-2">
    <!-- Delete button — only if editing existing note -->
    {#if initialContent && onDelete}
      {#if confirmDelete}
        <span class="text-xs text-destructive font-sans mr-1">Delete this note?</span>
        <button
          class="text-xs px-2 py-1 rounded bg-destructive/15 border border-destructive/40 text-destructive hover:bg-destructive/25 transition-colors font-sans"
          onclick={() => onDelete?.()}
        >
          Yes, delete
        </button>
        <button
          class="text-xs px-2 py-1 rounded border border-border text-muted-foreground hover:bg-accent/40 transition-colors font-sans"
          onclick={() => confirmDelete = false}
        >
          No
        </button>
      {:else}
        <button
          class="flex items-center gap-1 text-xs px-2 py-1 rounded border border-border text-muted-foreground hover:border-destructive/50 hover:text-destructive hover:bg-destructive/8 transition-colors font-sans"
          onclick={() => confirmDelete = true}
        >
          <Trash2 class="size-3" />
          Delete
        </button>
      {/if}
    {/if}

    <div class="ml-auto flex items-center gap-2">
      <button
        class="text-xs px-3 py-1 rounded border border-border text-muted-foreground hover:bg-accent/40 hover:text-foreground transition-colors font-sans"
        onclick={onCancel}
      >
        Cancel
      </button>
      <button
        class="text-xs px-3 py-1 rounded bg-primary text-primary-foreground hover:bg-primary/90 transition-colors font-sans font-medium"
        onclick={() => onSave(editorView?.state.doc.toString() ?? "")}
      >
        Save
      </button>
    </div>
  </div>
</div>
