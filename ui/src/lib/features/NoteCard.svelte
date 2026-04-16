<script lang="ts">
  import { MessageSquare, Pencil, Trash2 } from "@lucide/svelte";
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
</script>

<div class="sticky left-0 {paddingClass} border-y border-white/[0.04]" style="width: 100cqw; background: #0d1117;">
  <div
    class="group/card relative rounded-xl overflow-hidden font-sans"
    style="background: #161c26; box-shadow: 0 1px 2px rgba(0,0,0,0.4), 0 8px 32px rgba(0,0,0,0.5); border: 1px solid rgba(255,255,255,0.07);"
  >
    <!-- Quoted code strip -->
    <div class="flex items-center gap-2 px-4 py-2 {quotedBg}" style="border-bottom: 1px solid rgba(255,255,255,0.05);">
      <span class="font-mono text-[11px] {quotedText} select-none shrink-0 opacity-50">{quotedPrefix}</span>
      <pre class="font-mono text-[11px] {quotedText} opacity-60 whitespace-pre truncate flex-1 min-w-0">{quotedContent}</pre>
    </div>

    <!-- Header: avatar + author + timestamp + actions -->
    <div class="flex items-center gap-3 px-4 pt-3.5 pb-3" style="border-bottom: 1px solid rgba(255,255,255,0.05);">
      {#if note.gravatarHash}
        <img
          src="https://www.gravatar.com/avatar/{note.gravatarHash}?s=72&d=identicon"
          alt={note.authorName}
          class="size-8 rounded-full shrink-0"
          style="box-shadow: 0 0 0 2px rgba(255,255,255,0.08);"
        />
      {:else}
        <div class="size-8 rounded-full shrink-0 flex items-center justify-center" style="background: rgba(84,153,232,0.15); border: 1px solid rgba(84,153,232,0.25);">
          <MessageSquare class="size-4" style="color: #5499e8;" />
        </div>
      {/if}

      <span class="text-sm font-semibold leading-none" style="color: #e2e8f0;">
        {note.authorName || "Anonymous"}
      </span>

      {#if note.createdAt}
        <span class="text-xs" style="color: rgba(139,149,161,0.8);">·</span>
        <span class="text-xs" style="color: rgba(139,149,161,0.8);">{relativeTime(note.createdAt)}</span>
      {/if}

      <div class="flex-1"></div>

      <!-- Actions -->
      <div class="flex items-center gap-0.5 opacity-0 group-hover/card:opacity-100 transition-opacity duration-150">
        {#if confirmDelete}
          <span class="text-xs font-medium mr-1.5" style="color: #f87171;">Delete?</span>
          <button
            class="text-xs px-2.5 py-1 rounded-lg transition-colors font-sans"
            style="background: rgba(248,113,113,0.12); border: 1px solid rgba(248,113,113,0.35); color: #f87171;"
            onclick={() => { confirmDelete = false; onDelete(); }}
          >Yes</button>
          <button
            class="text-xs px-2.5 py-1 rounded-lg ml-1 transition-colors font-sans"
            style="border: 1px solid rgba(255,255,255,0.08); color: rgba(139,149,161,0.9);"
            onclick={() => confirmDelete = false}
          >No</button>
        {:else}
          <button
            class="flex items-center justify-center w-7 h-7 rounded-lg transition-colors text-muted-foreground/50 hover:text-foreground hover:bg-white/6"
            onclick={onEdit}
            title="Edit"
          >
            <Pencil class="size-3.5" />
          </button>
          <button
            class="flex items-center justify-center w-7 h-7 rounded-lg transition-colors text-muted-foreground/50 hover:text-red-400 hover:bg-red-400/8"
            onclick={() => confirmDelete = true}
            title="Delete"
          >
            <Trash2 class="size-3.5" />
          </button>
        {/if}
      </div>
    </div>

    <!-- Body: comment text -->
    <div class="px-4 py-3.5" style="padding-left: calc(1rem + 2rem + 0.75rem);">
      <p class="text-sm leading-relaxed whitespace-pre-wrap" style="color: rgba(226,232,240,0.85);">{note.content}</p>
    </div>
  </div>
</div>
