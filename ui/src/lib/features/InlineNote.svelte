<script lang="ts">
  import { EditorState } from "@codemirror/state";
  import { EditorView, keymap } from "@codemirror/view";
  import { defaultKeymap } from "@codemirror/commands";
  import { markdown } from "@codemirror/lang-markdown";
  import { oneDark } from "@codemirror/theme-one-dark";
  import { Button } from "$lib/components/ui/button";
  import { Separator } from "$lib/components/ui/separator";

  let {
    rawIndex,
    initialContent = "",
    onSave,
    onCancel,
  }: {
    rawIndex: number;
    initialContent?: string;
    onSave: (text: string) => void;
    onCancel: () => void;
  } = $props();

  let containerEl = $state<HTMLDivElement | null>(null);
  let editorView = $state<EditorView | null>(null);

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

<div class="bg-card border-b border-primary/20">
  <Separator class="bg-primary/20" />
  <div class="px-4 pt-2 pb-1">
    <span class="text-[11px] text-muted-foreground font-sans">Add review note · Markdown supported</span>
  </div>
  <div bind:this={containerEl} class="mx-4 rounded border border-input overflow-hidden"></div>
  <div class="flex gap-2 justify-end px-4 py-2">
    <Button variant="ghost" size="sm" onclick={onCancel}>Cancel</Button>
    <Button size="sm" onclick={() => onSave(editorView?.state.doc.toString() ?? "")}>
      Save note
    </Button>
  </div>
</div>
