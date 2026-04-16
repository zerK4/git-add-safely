<script lang="ts">
  import { Plus, MessageSquare } from "@lucide/svelte";
  import { Tooltip, TooltipContent, TooltipTrigger, TooltipProvider } from "$lib/components/ui/tooltip";
  import type { DiffLine } from "$lib/types";
  import InlineNote from "./InlineNote.svelte";
  import NoteCard from "./NoteCard.svelte";
  import { store, openNoteEditor, closeNoteEditor, saveNote, deleteNote, getNote } from "$lib/stores/app.svelte";

  let { line }: { line: DiffLine } = $props();

  const bgClass = $derived(
    line.type === "add"
      ? "bg-status-good/8 hover:bg-status-good/12"
      : line.type === "remove"
        ? "bg-destructive/8 hover:bg-destructive/12"
        : "hover:bg-accent/40"
  );

  const linePrefix = $derived(
    line.type === "add" ? "+" : line.type === "remove" ? "-" : " "
  );

  const prefixColor = $derived(
    line.type === "add"
      ? "text-status-good"
      : line.type === "remove"
        ? "text-destructive"
        : "text-muted-foreground/30"
  );

  const isNoteOpen = $derived(store.activeNoteIndex === line.rawIndex);
  const existingNote = $derived(
    store.selectedFile ? getNote(store.selectedFile, line.rawIndex) : undefined
  );

  const quotedLineBg = $derived(
    line.type === "add"
      ? "bg-status-good/6"
      : line.type === "remove"
        ? "bg-destructive/6"
        : "bg-muted/30"
  );

  const quotedLineText = $derived(
    line.type === "add"
      ? "text-status-good/70"
      : line.type === "remove"
        ? "text-destructive/70"
        : "text-muted-foreground/60"
  );

  // Warnings that match this line (by new or old line number)
  const lineWarnings = $derived(
    store.selectedFile
      ? (store.context?.scanResults ?? []).filter(
          (r) =>
            r.file === store.selectedFile &&
            (r.line === line.newLineNo || r.line === line.oldLineNo)
        )
      : []
  );
</script>

<div class="group" data-rawindex={line.rawIndex}>
  <!-- Outer row: full viewport width, no overflow -->
  <div class="flex items-stretch text-xs font-mono {bgClass} transition-colors">

    <!-- Scrollable content: line numbers + prefix + code -->
    <div class="flex items-stretch overflow-x-auto flex-1 min-w-0">
      <!-- Line numbers -->
      <div class="flex shrink-0 select-none">
        {#if store.diffLineNumbers === 2}
          <span class="w-9 text-right pr-2 py-0.5 text-muted-foreground/30 border-r border-border">
            {line.oldLineNo ?? ""}
          </span>
        {/if}
        <span class="w-9 text-right pr-2 py-0.5 text-muted-foreground/30 border-r border-border">
          {line.newLineNo ?? ""}
        </span>
      </div>

      <!-- Prefix -->
      <span class="w-5 text-center py-0.5 shrink-0 select-none {prefixColor}">{linePrefix}</span>

      <!-- Content -->
      <span class="py-0.5 px-2 whitespace-pre">{line.content}</span>
    </div>

    <!-- Note button — outside scroll, always visible at right -->
    <div class="flex items-center px-1.5 shrink-0">
      <TooltipProvider delayDuration={500}>
        <Tooltip>
          <TooltipTrigger asChild>
            <button
              class="flex items-center justify-center w-5 h-5 rounded
                     bg-primary/20 border border-primary/40 text-primary
                     hover:bg-primary/35 hover:border-primary/60
                     opacity-0 group-hover:opacity-100 scale-75 group-hover:scale-100
                     transition-all duration-150 ease-out
                     {existingNote ? '!opacity-100 !scale-100 bg-primary/30 border-primary/60' : ''}"
              onclick={() => openNoteEditor(line.rawIndex)}
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
  </div>

  {#each lineWarnings as warning}
    <div class="flex items-start gap-2 bg-status-warn/8 border-b border-status-warn/25 px-4 py-1.5 pl-7">
      <span class="text-[10px] font-semibold bg-status-warn/20 text-status-warn border border-status-warn/30 px-1.5 py-0.5 rounded shrink-0 font-sans mt-0.5">
        {warning.pattern}
      </span>
      <span class="text-xs text-status-warn/80 font-sans">Potential secret detected on this line</span>
    </div>
  {/each}

  {#if existingNote && !isNoteOpen}
    <NoteCard
      note={existingNote}
      rawIndex={line.rawIndex}
      quotedContent={line.content}
      quotedPrefix={linePrefix}
      quotedBg={quotedLineBg}
      quotedText={quotedLineText}
      onEdit={() => openNoteEditor(line.rawIndex)}
      onDelete={() => deleteNote(line.rawIndex)}
    />
  {/if}

  {#if isNoteOpen}
    <InlineNote
      rawIndex={line.rawIndex}
      initialContent={existingNote?.content ?? ""}
      quotedContent={line.content}
      quotedPrefix={linePrefix}
      quotedBg={quotedLineBg}
      quotedText={quotedLineText}
      onSave={(text) => saveNote(line.rawIndex, text)}
      onCancel={closeNoteEditor}
      onDelete={() => deleteNote(line.rawIndex)}
    />
  {/if}
</div>
