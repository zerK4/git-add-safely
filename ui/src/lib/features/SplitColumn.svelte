<script lang="ts">
  import { Plus, MessageSquare, Trash2 } from "@lucide/svelte";
  import { Tooltip, TooltipContent, TooltipTrigger, TooltipProvider } from "$lib/components/ui/tooltip";
  import type { SplitRow } from "$lib/types";
  import InlineNote from "./InlineNote.svelte";
  import { store, openNoteEditor, closeNoteEditor, saveNote, deleteNote, getNote } from "$lib/stores/app.svelte";

  let {
    rows,
    side,
    hunkHeader,
  }: {
    rows: SplitRow[];
    side: "left" | "right";
    hunkHeader: string;
  } = $props();

  let confirmDeleteIdx = $state<number | null>(null);

  function lineBgSolidStyle(row: SplitRow) {
    const line = side === "left" ? row.left : row.right;
    if (!line) return "";
    if (line.type === "remove") return "background-color: color-mix(in srgb, var(--destructive) 30%, var(--background))";
    if (line.type === "add") return "background-color: color-mix(in srgb, var(--status-good) 30%, var(--background))";
    return "";
  }

  function lineBg(row: SplitRow) {
    const line = side === "left" ? row.left : row.right;
    if (!line) return "";
    if (line.type === "remove") return "bg-destructive/8 hover:bg-destructive/12";
    if (line.type === "add") return "bg-status-good/8 hover:bg-status-good/12";
    return "hover:bg-accent/40";
  }

  function lineNo(row: SplitRow) {
    return side === "left" ? (row.left?.oldLineNo ?? "") : (row.right?.newLineNo ?? "");
  }

  function prefix(row: SplitRow) {
    const line = side === "left" ? row.left : row.right;
    if (!line) return " ";
    if (line.type === "remove") return "-";
    if (line.type === "add") return "+";
    return " ";
  }

  function prefixColor(row: SplitRow) {
    const p = prefix(row);
    if (p === "+") return "text-status-good";
    if (p === "-") return "text-destructive";
    return "text-muted-foreground/30";
  }

  function content(row: SplitRow) {
    return (side === "left" ? row.left?.content : row.right?.content) ?? "";
  }

  function anchorRawIndex(row: SplitRow) {
    return (row.right ?? row.left)?.rawIndex ?? 0;
  }
</script>

<div class="flex flex-col text-xs font-mono w-full">
  <!-- Hunk header -->
  <div class="flex items-center bg-primary/5 border-y border-primary/10 px-3 py-0.5 text-primary/50 select-none whitespace-pre shrink-0">
    {hunkHeader}
  </div>

  {#each rows as row}
    {@const rawIdx = anchorRawIndex(row)}
    {@const isNoteOpen = store.activeNoteIndex === rawIdx}
    {@const existingNote = store.selectedFile ? getNote(store.selectedFile, rawIdx) : undefined}
    <div class="group min-w-full">
      <div class="flex items-stretch min-w-full {lineBg(row)} transition-colors">
        <!-- Line number — sticky left -->
        <span class="w-10 text-right pr-2 py-0.5 text-muted-foreground/30 border-r border-border shrink-0 select-none sticky left-0 z-20 bg-background">
          {lineNo(row)}
        </span>
        <!-- Prefix — sticky after line number -->
        <span class="w-4 text-center py-0.5 shrink-0 select-none {prefixColor(row)} sticky left-10 z-20" style={lineBgSolidStyle(row)}>{prefix(row)}</span>
        <!-- Content — extends naturally, bg inherited -->
        <span class="py-0.5 px-2 whitespace-pre pr-8">{content(row)}</span>

        <!-- Note button — only on right column, sticky right -->
        {#if side === "right"}
          <div class="sticky right-1 ml-auto self-center z-10 opacity-0 group-hover:opacity-100 transition-opacity">
            <TooltipProvider delayDuration={500}>
              <Tooltip>
                <TooltipTrigger asChild>
                  <button
                    class="flex items-center justify-center w-5 h-5 rounded
                           bg-primary/20 border border-primary/40 text-primary
                           hover:bg-primary/35 scale-75 group-hover:scale-100
                           transition-all duration-150
                           {existingNote ? '!opacity-100 !scale-100 bg-primary/30' : ''}"
                    onclick={() => openNoteEditor(rawIdx)}
                  >
                    {#if existingNote}
                      <MessageSquare class="size-2.5" />
                    {:else}
                      <Plus class="size-3" />
                    {/if}
                  </button>
                </TooltipTrigger>
                <TooltipContent side="left" class="text-xs">
                  {existingNote ? "Edit note" : "Add note"}
                </TooltipContent>

              </Tooltip>
            </TooltipProvider>
          </div>
        {/if}
      </div>

      {#if side === "right" && existingNote && !isNoteOpen}
          <div class="flex items-start gap-2 bg-primary/5 border-b border-primary/15 px-3 py-2">
            {#if existingNote.gravatarHash}
              <img src="https://www.gravatar.com/avatar/{existingNote.gravatarHash}?s=20&d=identicon" alt={existingNote.authorName} class="size-4 rounded-full shrink-0 mt-0.5" />
            {:else}
              <MessageSquare class="size-3 text-primary mt-0.5 shrink-0" />
            {/if}
            <div class="flex flex-col flex-1 min-w-0 gap-0.5">
              {#if existingNote.authorName}
                <span class="text-[10px] text-muted-foreground/60 font-sans">{existingNote.authorName}</span>
              {/if}
              <pre class="text-xs text-muted-foreground whitespace-pre-wrap font-sans">{existingNote.content}</pre>
            </div>
            <div class="sticky right-2 shrink-0 flex items-center gap-1.5 ml-2">
              {#if confirmDeleteIdx === rawIdx}
                <span class="text-xs text-destructive font-sans">Sure?</span>
                <button
                  class="text-xs px-1.5 py-0.5 rounded bg-destructive/15 border border-destructive/40 text-destructive hover:bg-destructive/25 transition-colors font-sans"
                  onclick={() => { confirmDeleteIdx = null; deleteNote(rawIdx); }}
                >Yes</button>
                <button
                  class="text-xs px-1.5 py-0.5 rounded border border-border text-muted-foreground hover:bg-accent/40 transition-colors font-sans"
                  onclick={() => confirmDeleteIdx = null}
                >No</button>
              {:else}
                <button
                  class="flex items-center gap-1 text-xs px-1.5 py-0.5 rounded border border-border text-muted-foreground hover:border-destructive/50 hover:text-destructive hover:bg-destructive/8 transition-colors font-sans"
                  onclick={() => confirmDeleteIdx = rawIdx}
                >
                  <Trash2 class="size-3" />
                </button>
              {/if}
            </div>
          </div>
        {/if}
      {#if side === "right" && isNoteOpen}
        <InlineNote
          rawIndex={rawIdx}
          initialContent={existingNote?.content ?? ""}
          onSave={(text) => saveNote(rawIdx, text)}
          onCancel={closeNoteEditor}
          onDelete={() => deleteNote(rawIdx)}
        />
      {/if}
    </div>
  {/each}
</div>
