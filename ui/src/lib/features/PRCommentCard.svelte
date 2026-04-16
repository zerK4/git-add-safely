<script lang="ts">
  import type { PRReviewComment } from "$lib/api/client";
  import { postPRReply } from "$lib/api/client";
  import { store } from "$lib/stores/app.svelte";
  import { marked } from "marked";
  import { Reply } from "@lucide/svelte";

  let { comments, quotedContent, quotedPrefix }: {
    comments: PRReviewComment[];
    quotedContent: string;
    quotedPrefix: string;
  } = $props();

  let replyOpen = $state(false);
  let replyText = $state("");
  let replying = $state(false);

  const lineBg = $derived(
    quotedPrefix === "+" ? "bg-status-good/8" :
    quotedPrefix === "-" ? "bg-destructive/8" : "bg-muted/20"
  );
  const prefixColor = $derived(
    quotedPrefix === "+" ? "text-status-good" :
    quotedPrefix === "-" ? "text-destructive" : "text-muted-foreground/40"
  );

  async function submitReply() {
    if (!replyText.trim() || store.activePR === null) return;
    replying = true;
    const lastComment = comments[comments.length - 1];
    await postPRReply(store.activePR, lastComment.id, replyText.trim());
    replyText = "";
    replyOpen = false;
    replying = false;
  }
</script>

<div class="sticky left-0 px-4 py-2 border-y border-white/[0.04]" style="width: 100cqw; background: #0d1117;">
  <div class="rounded-xl overflow-hidden font-sans" style="background: #161c26; box-shadow: 0 1px 2px rgba(0,0,0,0.4), 0 8px 32px rgba(0,0,0,0.5); border: 1px solid rgba(255,255,255,0.07);">

    <!-- Quoted line -->
    <div class="flex items-center text-xs font-mono {lineBg}" style="border-bottom: 1px solid rgba(255,255,255,0.05);">
      <span class="w-5 text-center py-1 shrink-0 select-none {prefixColor}">{quotedPrefix}</span>
      <span class="py-1 px-2 whitespace-pre text-muted-foreground/60 flex-1">{quotedContent}</span>
    </div>

    <!-- Each comment -->
    {#each comments as comment, i}
      <div style="{i > 0 ? 'border-top: 1px solid rgba(255,255,255,0.05);' : ''}">
        <div class="flex items-center gap-2 px-4 py-2.5" style="border-bottom: 1px solid rgba(255,255,255,0.04);">
          <div class="size-6 rounded-full shrink-0 flex items-center justify-center text-[10px] font-bold" style="background: rgba(84,153,232,0.15); border: 1px solid rgba(84,153,232,0.25); color: #5499e8;">
            {comment.author.slice(0, 2).toUpperCase()}
          </div>
          <span class="text-xs font-semibold" style="color: #e2e8f0;">{comment.author}</span>
          <span class="text-[10px] text-muted-foreground/50">{new Date(comment.createdAt).toLocaleDateString(undefined, { month: "short", day: "numeric" })}</span>
        </div>
        <div class="px-4 py-3 prose-note">
          {@html marked.parse(comment.body) as string}
        </div>
      </div>
    {/each}

    <!-- Reply -->
    <div style="border-top: 1px solid rgba(255,255,255,0.05);" class="px-4 py-2">
      {#if replyOpen}
        <textarea
          class="w-full bg-muted/30 border border-border rounded p-2 text-xs text-foreground resize-none focus:outline-none focus:border-primary/50"
          rows="3"
          placeholder="Write a reply..."
          bind:value={replyText}
        ></textarea>
        <div class="flex items-center gap-2 mt-1.5">
          <button
            class="text-[11px] px-3 py-1 rounded bg-primary/20 border border-primary/40 text-primary hover:bg-primary/30 transition-colors disabled:opacity-50"
            onclick={submitReply}
            disabled={replying || !replyText.trim()}
          >Reply</button>
          <button
            class="text-[11px] px-3 py-1 rounded text-muted-foreground hover:text-foreground transition-colors"
            onclick={() => { replyOpen = false; replyText = ""; }}
          >Cancel</button>
        </div>
      {:else}
        <button
          class="flex items-center gap-1.5 text-[11px] text-muted-foreground/50 hover:text-muted-foreground transition-colors"
          onclick={() => (replyOpen = true)}
        >
          <Reply class="size-3" />
          Reply
        </button>
      {/if}
    </div>
  </div>
</div>

<style>
  .prose-note :global(p) { font-size: 0.875rem; line-height: 1.6; color: rgba(226,232,240,0.85); margin: 0 0 0.5rem 0; }
  .prose-note :global(p:last-child) { margin-bottom: 0; }
  .prose-note :global(code) { font-size: 0.8rem; background: rgba(255,255,255,0.07); border: 1px solid rgba(255,255,255,0.08); border-radius: 4px; padding: 0.1em 0.4em; color: #93c5fd; font-family: ui-monospace, monospace; }
  .prose-note :global(pre) { background: rgba(0,0,0,0.3); border: 1px solid rgba(255,255,255,0.07); border-radius: 8px; padding: 0.75rem 1rem; overflow-x: auto; margin: 0.5rem 0; }
  .prose-note :global(pre code) { background: none; border: none; padding: 0; color: #e2e8f0; }
  .prose-note :global(strong) { color: #e2e8f0; font-weight: 600; }
  .prose-note :global(ul), .prose-note :global(ol) { padding-left: 1.25rem; margin: 0.25rem 0; color: rgba(226,232,240,0.85); font-size: 0.875rem; line-height: 1.6; }
</style>
