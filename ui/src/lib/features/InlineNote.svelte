<script lang="ts">
  import { EditorState } from "@codemirror/state";
  import { EditorView, keymap } from "@codemirror/view";
  import { defaultKeymap } from "@codemirror/commands";
  import { markdown } from "@codemirror/lang-markdown";
  import { Trash2 } from "@lucide/svelte";

  let {
    rawIndex,
    initialContent = "",
    quotedContent = "",
    quotedPrefix = " ",
    quotedBg = "bg-muted/20",
    quotedText = "text-muted-foreground/60",
    paddingClass = "px-4 py-2",
    onSave,
    onCancel,
    onDelete,
  }: {
    rawIndex: number;
    initialContent?: string;
    quotedContent?: string;
    quotedPrefix?: string;
    quotedBg?: string;
    quotedText?: string;
    paddingClass?: string;
    onSave: (text: string) => void;
    onCancel: () => void;
    onDelete?: () => void;
  } = $props();

  let containerEl = $state<HTMLDivElement | null>(null);
  let editorView = $state<EditorView | null>(null);
  let confirmDelete = $state(false);

  const prefixColor =
    quotedPrefix === "+" ? "text-status-good" :
    quotedPrefix === "-" ? "text-destructive" :
    "text-muted-foreground/40";

  const lineBg =
    quotedPrefix === "+" ? "bg-status-good/8" :
    quotedPrefix === "-" ? "bg-destructive/8" :
    "bg-muted/20";

  $effect(() => {
    if (!containerEl) return;

    const view = new EditorView({
      state: EditorState.create({
        doc: initialContent,
        extensions: [
          keymap.of(defaultKeymap),
          markdown(),
          EditorView.lineWrapping,
          EditorView.theme({
            "&": {
              fontSize: "13px",
              minHeight: "80px",
              background: "transparent",
              color: "rgba(226,232,240,0.85)",
            },
            ".cm-content": {
              padding: "12px 16px",
              fontFamily: "ui-sans-serif, system-ui, sans-serif",
              caretColor: "#5499e8",
            },
            ".cm-line": { lineHeight: "1.6" },
            ".cm-focused": { outline: "none" },
            ".cm-editor": { background: "transparent" },
            ".cm-scroller": { overflow: "hidden" },
            ".cm-cursor": { borderLeftColor: "#5499e8" },
            ".cm-selectionBackground": { background: "rgba(84,153,232,0.2) !important" },
            ".cm-gutters": { display: "none" },
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

<div class="sticky left-0 {paddingClass} border-y border-white/[0.04]" style="width: 100cqw; background: #0d1117;">
  <div
    class="relative rounded-xl overflow-hidden font-sans"
    style="background: #161c26; box-shadow: 0 1px 2px rgba(0,0,0,0.4), 0 8px 32px rgba(0,0,0,0.5); border: 1px solid rgba(84,153,232,0.25);"
  >

    <!-- HEADER -->
    <div class="flex items-center gap-2 px-4 py-2.5" style="border-bottom: 1px solid rgba(255,255,255,0.06);">
      <span class="text-xs text-muted-foreground/70 font-sans">
        {initialContent ? "Edit comment" : "Add comment"} · Markdown supported
      </span>
    </div>

    <!-- Diff line reference -->
    {#if quotedContent}
      <div class="flex items-center text-xs font-mono {lineBg}" style="border-bottom: 1px solid rgba(255,255,255,0.05);">
        <span class="w-5 text-center py-1 shrink-0 select-none {prefixColor}">{quotedPrefix}</span>
        <span class="py-1 px-2 whitespace-pre {quotedText} flex-1">{quotedContent}</span>
      </div>
    {/if}

    <!-- Editor -->
    <div bind:this={containerEl} class="w-full"></div>

    <!-- Footer actions -->
    <div class="flex items-center gap-2 px-4 py-2.5" style="border-top: 1px solid rgba(255,255,255,0.06);">
      {#if initialContent && onDelete}
        {#if confirmDelete}
          <span class="text-xs font-medium text-red-400 mr-1">Delete?</span>
          <button
            class="text-xs px-2.5 py-1 rounded-lg transition-colors"
            style="background: rgba(248,113,113,0.12); border: 1px solid rgba(248,113,113,0.35); color: #f87171;"
            onclick={() => onDelete?.()}
          >Yes</button>
          <button
            class="text-xs px-2.5 py-1 rounded-lg ml-1 transition-colors text-muted-foreground"
            style="border: 1px solid rgba(255,255,255,0.08);"
            onclick={() => confirmDelete = false}
          >No</button>
        {:else}
          <button
            class="flex items-center gap-1.5 text-xs px-2.5 py-1 rounded-lg transition-colors text-muted-foreground/50 hover:text-red-400 hover:bg-red-400/8"
            style="border: 1px solid rgba(255,255,255,0.07);"
            onclick={() => confirmDelete = true}
          >
            <Trash2 class="size-3" />
            Delete
          </button>
        {/if}
      {/if}

      <div class="ml-auto flex items-center gap-2">
        <button
          class="text-xs px-3 py-1.5 rounded-lg transition-colors text-muted-foreground hover:text-foreground"
          style="border: 1px solid rgba(255,255,255,0.08);"
          onclick={onCancel}
        >Cancel</button>
        <button
          class="text-xs px-3 py-1.5 rounded-lg font-medium transition-colors text-primary-foreground hover:opacity-90"
          style="background: hsl(var(--primary)); border: 1px solid hsl(var(--primary) / 0.8);"
          onclick={() => onSave(editorView?.state.doc.toString() ?? "")}
        >Save</button>
      </div>
    </div>
  </div>
</div>
