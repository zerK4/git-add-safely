<script lang="ts">
  import { MessageSquare, Pencil, Trash2 } from "@lucide/svelte";
  import { marked } from "marked";
  import type { NoteEntry } from "$lib/api/client";

  let {
    note,
    rawIndex,
    quotedContent,
    quotedPrefix,
    quotedBg,
    quotedText,
    onEdit,
    onDelete,
    paddingClass = "px-4 py-2",
  }: {
    note: NoteEntry;
    rawIndex: number;
    quotedContent: string;
    quotedPrefix: string;
    quotedBg: string;
    quotedText: string;
    onEdit: () => void;
    onDelete: () => void;
    paddingClass?: string;
  } = $props();

  let confirmDelete = $state(false);

  const renderedContent = $derived(marked.parse(note.content) as string);

  function relativeTime(iso: string): string {
    if (!iso) return "";
    const diff = Date.now() - new Date(iso + "Z").getTime();
    const mins = Math.floor(diff / 60000);
    if (mins < 1) return "just now";
    if (mins < 60) return `${mins}m ago`;
    const hrs = Math.floor(mins / 60);
    if (hrs < 24) return `${hrs}h ago`;
    const days = Math.floor(hrs / 24);
    if (days < 30) return `${days}d ago`;
    const months = Math.floor(days / 30);
    return `${months}mo ago`;
  }

  const prefixColor = $derived(
    quotedPrefix === "+" ? "text-status-good" :
    quotedPrefix === "-" ? "text-destructive" :
    "text-muted-foreground/40"
  );

  const lineBg = $derived(
    quotedPrefix === "+" ? "bg-status-good/8" :
    quotedPrefix === "-" ? "bg-destructive/8" :
    "bg-muted/20"
  );
</script>

<div class="sticky left-0 {paddingClass} border-y border-white/[0.04]" style="width: 100cqw; background: #0d1117;">
  <div
    class="group/card relative rounded-xl overflow-hidden font-sans"
    style="background: #161c26; box-shadow: 0 1px 2px rgba(0,0,0,0.4), 0 8px 32px rgba(0,0,0,0.5); border: 1px solid rgba(255,255,255,0.07);"
  >

    <!-- HEADER: avatar + name + timestamp + actions -->
    <div class="flex items-center gap-2.5 px-4 py-3" style="border-bottom: 1px solid rgba(255,255,255,0.06);">
      {#if note.gravatarHash}
        <img
          src="https://www.gravatar.com/avatar/{note.gravatarHash}?s=72&d=identicon"
          alt={note.authorName}
          class="size-8 rounded-full shrink-0"
          style="box-shadow: 0 0 0 2px rgba(255,255,255,0.08);"
        />
      {:else}
        <div class="size-8 rounded-full shrink-0 flex items-center justify-center" style="background: rgba(84,153,232,0.15); border: 1px solid rgba(84,153,232,0.25);">
          <MessageSquare class="size-4 text-primary" />
        </div>
      {/if}

      <span class="text-sm font-semibold leading-none" style="color: #e2e8f0;">
        {note.authorName || "Anonymous"}
      </span>

      {#if note.createdAt}
        <span class="text-xs text-muted-foreground/50">·</span>
        <span class="text-xs text-muted-foreground/60">{relativeTime(note.createdAt)}</span>
      {/if}

      <div class="flex-1"></div>

      <!-- Actions — visible on hover -->
      <div class="flex items-center gap-0.5 opacity-0 group-hover/card:opacity-100 transition-opacity duration-150">
        {#if confirmDelete}
          <span class="text-xs font-medium text-red-400 mr-1.5">Delete?</span>
          <button
            class="text-xs px-2.5 py-1 rounded-lg transition-colors"
            style="background: rgba(248,113,113,0.12); border: 1px solid rgba(248,113,113,0.35); color: #f87171;"
            onclick={() => { confirmDelete = false; onDelete(); }}
          >Yes</button>
          <button
            class="text-xs px-2.5 py-1 rounded-lg ml-1 transition-colors text-muted-foreground"
            style="border: 1px solid rgba(255,255,255,0.08);"
            onclick={() => confirmDelete = false}
          >No</button>
        {:else}
          <button
            class="flex items-center justify-center w-7 h-7 rounded-lg transition-colors text-muted-foreground/40 hover:text-foreground hover:bg-white/6"
            onclick={onEdit}
            title="Edit"
          >
            <Pencil class="size-3.5" />
          </button>
          <button
            class="flex items-center justify-center w-7 h-7 rounded-lg transition-colors text-muted-foreground/40 hover:text-red-400 hover:bg-red-400/8"
            onclick={() => confirmDelete = true}
            title="Delete"
          >
            <Trash2 class="size-3.5" />
          </button>
        {/if}
      </div>
    </div>

    <!-- BODY -->
    <div>
      <!-- Diff line — full width, exact diff styling -->
      <div class="flex items-center text-xs font-mono {lineBg}" style="border-bottom: 1px solid rgba(255,255,255,0.05);">
        <span class="w-5 text-center py-1 shrink-0 select-none {prefixColor}">{quotedPrefix}</span>
        <span class="py-1 px-2 whitespace-pre {quotedText} flex-1">{quotedContent}</span>
      </div>

      <!-- Markdown content -->
      <div class="px-4 py-3.5 prose-note">
        {@html renderedContent}
      </div>
    </div>

  </div>
</div>

<style>
  .prose-note :global(p) {
    font-size: 0.875rem;
    line-height: 1.6;
    color: rgba(226, 232, 240, 0.85);
    margin: 0 0 0.5rem 0;
  }
  .prose-note :global(p:last-child) {
    margin-bottom: 0;
  }
  .prose-note :global(code) {
    font-size: 0.8rem;
    background: rgba(255,255,255,0.07);
    border: 1px solid rgba(255,255,255,0.08);
    border-radius: 4px;
    padding: 0.1em 0.4em;
    color: #93c5fd;
    font-family: ui-monospace, monospace;
  }
  .prose-note :global(pre) {
    background: rgba(0,0,0,0.3);
    border: 1px solid rgba(255,255,255,0.07);
    border-radius: 8px;
    padding: 0.75rem 1rem;
    overflow-x: auto;
    margin: 0.5rem 0;
  }
  .prose-note :global(pre code) {
    background: none;
    border: none;
    padding: 0;
    color: #e2e8f0;
    font-size: 0.8rem;
  }
  .prose-note :global(strong) {
    color: #e2e8f0;
    font-weight: 600;
  }
  .prose-note :global(em) {
    color: rgba(226,232,240,0.75);
  }
  .prose-note :global(ul) {
    list-style-type: disc;
    padding-left: 1.25rem;
    margin: 0.25rem 0;
    color: rgba(226,232,240,0.85);
    font-size: 0.875rem;
    line-height: 1.6;
  }
  .prose-note :global(ol) {
    list-style-type: decimal;
    padding-left: 1.25rem;
    margin: 0.25rem 0;
    color: rgba(226,232,240,0.85);
    font-size: 0.875rem;
    line-height: 1.6;
  }
  .prose-note :global(li) {
    margin: 0.1rem 0;
  }
  .prose-note :global(a) {
    color: #5499e8;
    text-decoration: underline;
    text-underline-offset: 2px;
  }
  .prose-note :global(blockquote) {
    border-left: 3px solid rgba(255,255,255,0.15);
    padding-left: 0.75rem;
    margin: 0.5rem 0;
    color: rgba(226,232,240,0.55);
    font-style: italic;
  }
  .prose-note :global(h1), .prose-note :global(h2), .prose-note :global(h3) {
    color: #e2e8f0;
    font-weight: 600;
    line-height: 1.3;
    margin: 0.5rem 0 0.25rem 0;
  }
  .prose-note :global(h1) { font-size: 1rem; }
  .prose-note :global(h2) { font-size: 0.9rem; }
  .prose-note :global(h3) { font-size: 0.85rem; }
</style>
