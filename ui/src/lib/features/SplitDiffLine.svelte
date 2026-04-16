<script lang="ts">
  import { Plus, MessageSquare } from "@lucide/svelte";
  import { Tooltip, TooltipContent, TooltipTrigger, TooltipProvider } from "$lib/components/ui/tooltip";
  import type { SplitRow } from "$lib/types";
  import InlineNote from "./InlineNote.svelte";
  import { store, openNoteEditor, closeNoteEditor, saveNote, getNote } from "$lib/stores/app.svelte";

  let { row }: { row: SplitRow } = $props();

  function cellBg(side: "left" | "right") {
    const line = side === "left" ? row.left : row.right;
    if (!line) return "";
    if (line.type === "remove") return "bg-destructive/8";
    if (line.type === "add") return "bg-status-good/8";
    return "";
  }

  function linePrefix(side: "left" | "right") {
    const line = side === "left" ? row.left : row.right;
    if (!line) return " ";
    if (line.type === "remove") return "-";
    if (line.type === "add") return "+";
    return " ";
  }

  function prefixColor(side: "left" | "right") {
    const p = linePrefix(side);
    if (p === "+") return "text-status-good";
    if (p === "-") return "text-destructive";
    return "text-muted-foreground/30";
  }

  const anchor = $derived(row.right ?? row.left);
  const anchorLineNo = $derived(anchor?.newLineNo ?? anchor?.oldLineNo ?? anchor?.rawIndex ?? 0);
  const isNoteOpen = $derived(store.activeNoteIndex === anchorLineNo);
  const existingNote = $derived(
    store.selectedFile ? getNote(store.selectedFile, anchorLineNo) : undefined
  );

  const lineWarnings = $derived(
    store.selectedFile
      ? (store.context?.scanResults ?? []).filter(
          (r) =>
            r.file === store.selectedFile &&
            (r.line === row.left?.oldLineNo || r.line === row.right?.newLineNo)
        )
      : []
  );
</script>

<div class="group">
  <div class="grid grid-cols-2 text-xs font-mono relative">
    <!-- Left -->
    <div class="flex items-stretch border-r border-border {cellBg('left')} hover:brightness-110 transition-all">
      <span class="w-10 text-right pr-2 py-0.5 text-muted-foreground/30 border-r border-border shrink-0 select-none">
        {row.left?.oldLineNo ?? ""}
      </span>
      <span class="w-4 text-center py-0.5 shrink-0 select-none {prefixColor('left')}">{linePrefix('left')}</span>
      <span class="flex-1 py-0.5 px-2 whitespace-pre">{row.left?.content ?? ""}</span>
    </div>

    <!-- Right -->
    <div class="flex items-stretch {cellBg('right')} hover:brightness-110 transition-all">
      <span class="w-10 text-right pr-2 py-0.5 text-muted-foreground/30 border-r border-border shrink-0 select-none">
        {row.right?.newLineNo ?? ""}
      </span>
      <span class="w-4 text-center py-0.5 shrink-0 select-none {prefixColor('right')}">{linePrefix('right')}</span>
      <span class="flex-1 py-0.5 px-2 whitespace-pre">{row.right?.content ?? ""}</span>
    </div>

    <!-- Note button — right edge -->
    <div class="absolute right-1.5 top-0 bottom-0 flex items-center justify-center z-10">
      <TooltipProvider delayDuration={500}>
        <Tooltip>
          <TooltipTrigger asChild>
            <button
              class="flex items-center justify-center w-6 h-6 rounded-md
                     bg-primary/20 border border-primary/40 text-primary
                     hover:bg-primary/35 hover:border-primary/60
                     opacity-0 group-hover:opacity-100 scale-75 group-hover:scale-100
                     transition-all duration-150 ease-out
                     {existingNote ? '!opacity-100 !scale-100 bg-primary/30 border-primary/60' : ''}"
              onclick={() => openNoteEditor(anchorLineNo)}
            >
              {#if existingNote}
                <MessageSquare class="size-3" />
              {:else}
                <Plus class="size-3.5" />
              {/if}
            </button>
          </TooltipTrigger>
          <TooltipContent side="left" class="text-xs">
            {existingNote ? "Edit note" : "Add note"}
          </TooltipContent>
        </Tooltip>
      </TooltipProvider>
    </div>
  </div>

  {#each lineWarnings as warning}
    <div class="flex items-start gap-2 bg-status-warn/8 border-b border-status-warn/25 px-4 py-1.5">
      <span class="text-[10px] font-semibold bg-status-warn/20 text-status-warn border border-status-warn/30 px-1.5 py-0.5 rounded shrink-0 font-sans mt-0.5">
        {warning.pattern}
      </span>
      <span class="text-xs text-status-warn/80 font-sans">Potential secret detected on this line</span>
    </div>
  {/each}

  {#if existingNote && !isNoteOpen}
    <div class="flex gap-2 bg-primary/5 border-b border-primary/15 px-4 py-2">
      <MessageSquare class="size-3 text-primary mt-0.5 shrink-0" />
      <pre class="text-xs text-muted-foreground whitespace-pre-wrap font-sans">{existingNote}</pre>
    </div>
  {/if}

  {#if isNoteOpen}
    <InlineNote
      rawIndex={anchorLineNo}
      initialContent={existingNote ?? ""}
      onSave={(text) => saveNote(anchorLineNo, text)}
      onCancel={closeNoteEditor}
    />
  {/if}
</div>
