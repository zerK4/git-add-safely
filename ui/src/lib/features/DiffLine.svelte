<script lang="ts">
  import { Plus, MessageSquare, Trash2 } from "@lucide/svelte";
  import { Tooltip, TooltipContent, TooltipTrigger, TooltipProvider } from "$lib/components/ui/tooltip";
  import type { DiffLine } from "$lib/types";
  import InlineNote from "./InlineNote.svelte";
  import { store, openNoteEditor, closeNoteEditor, saveNote, deleteNote, getNote } from "$lib/stores/app.svelte";

  let { line }: { line: DiffLine } = $props();
  let confirmDeleteIdx = $state<number | null>(null);

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

<div class="group">
  <div class="flex items-stretch text-xs font-mono {bgClass} transition-colors relative">

    <!-- Note button — left gutter, visible on hover -->
    <div class="absolute left-0 top-0 bottom-0 w-6 flex items-center justify-center z-10">
      <TooltipProvider delayDuration={500}>
        <Tooltip>
          <TooltipTrigger asChild>
            <button
              class="flex items-center justify-center w-6 h-6 rounded-md
                     bg-primary/20 border border-primary/40 text-primary
                     hover:bg-primary/35 hover:border-primary/60 hover:text-primary
                     opacity-0 group-hover:opacity-100 scale-75 group-hover:scale-100
                     transition-all duration-150 ease-out
                     {existingNote ? '!opacity-100 !scale-100 bg-primary/30 border-primary/60' : ''}"
              onclick={() => openNoteEditor(line.rawIndex)}
            >
              {#if existingNote}
                <MessageSquare class="size-3" />
              {:else}
                <Plus class="size-3.5" />
              {/if}
            </button>
          </TooltipTrigger>
          <TooltipContent side="right" class="text-xs">
            {existingNote ? "Edit note" : "Add note"}
          </TooltipContent>
        </Tooltip>
      </TooltipProvider>
    </div>

    <!-- Line numbers -->
    <div class="flex shrink-0 pl-6 select-none">
      <span class="w-12 text-right pr-3 py-0.5 text-muted-foreground/30 border-r border-border">
        {line.oldLineNo ?? ""}
      </span>
      <span class="w-12 text-right pr-3 py-0.5 text-muted-foreground/30 border-r border-border">
        {line.newLineNo ?? ""}
      </span>
    </div>

    <!-- Prefix -->
    <span class="w-5 text-center py-0.5 shrink-0 select-none {prefixColor}">{linePrefix}</span>

    <!-- Content -->
    <span class="py-0.5 px-2 whitespace-pre">{line.content}</span>
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
    {@const noteIdx = line.rawIndex}
    <div class="flex items-start gap-2 bg-primary/5 border-b border-primary/15 px-4 py-2 pl-7">
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
        {#if confirmDeleteIdx === noteIdx}
          <span class="text-xs text-destructive font-sans">Sure?</span>
          <button
            class="text-xs px-1.5 py-0.5 rounded bg-destructive/15 border border-destructive/40 text-destructive hover:bg-destructive/25 transition-colors font-sans"
            onclick={() => { confirmDeleteIdx = null; deleteNote(noteIdx); }}
          >Yes</button>
          <button
            class="text-xs px-1.5 py-0.5 rounded border border-border text-muted-foreground hover:bg-accent/40 transition-colors font-sans"
            onclick={() => confirmDeleteIdx = null}
          >No</button>
        {:else}
          <button
            class="flex items-center gap-1 text-xs px-1.5 py-0.5 rounded border border-border text-muted-foreground hover:border-destructive/50 hover:text-destructive hover:bg-destructive/8 transition-colors font-sans"
            onclick={() => confirmDeleteIdx = noteIdx}
          >
            <Trash2 class="size-3" />
          </button>
        {/if}
      </div>
    </div>
  {/if}

  {#if isNoteOpen}
    <InlineNote
      rawIndex={line.rawIndex}
      initialContent={existingNote?.content ?? ""}
      onSave={(text) => saveNote(line.rawIndex, text)}
      onCancel={closeNoteEditor}
      onDelete={() => deleteNote(line.rawIndex)}
    />
  {/if}
</div>
