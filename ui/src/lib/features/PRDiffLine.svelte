<script lang="ts">
  import type { DiffLine } from "$lib/types";
  import PRCommentCard from "./PRCommentCard.svelte";
  import { store } from "$lib/stores/app.svelte";

  let { line }: { line: DiffLine } = $props();

  const bgClass = $derived(
    line.type === "add" ? "bg-status-good/8 hover:bg-status-good/12" :
    line.type === "remove" ? "bg-destructive/8 hover:bg-destructive/12" :
    "hover:bg-accent/40"
  );
  const linePrefix = $derived(line.type === "add" ? "+" : line.type === "remove" ? "-" : " ");
  const prefixColor = $derived(
    line.type === "add" ? "text-status-good" :
    line.type === "remove" ? "text-destructive" : "text-muted-foreground/30"
  );

  // PR review comments for this line
  const prComments = $derived(
    store.prSelectedFile && line.newLineNo
      ? (store.prReviewThreads[store.prSelectedFile]?.[line.newLineNo] ?? [])
      : []
  );
</script>

<div>
  <div class="flex items-stretch text-xs font-mono {bgClass} transition-colors">
    <div class="flex shrink-0 select-none">
      <span class="w-9 text-right pr-2 py-0.5 text-muted-foreground/30 border-r border-border">{line.oldLineNo ?? ""}</span>
      <span class="w-9 text-right pr-2 py-0.5 text-muted-foreground/30 border-r border-border">{line.newLineNo ?? ""}</span>
    </div>
    <span class="w-5 text-center py-0.5 shrink-0 select-none {prefixColor}">{linePrefix}</span>
    <span class="py-0.5 px-2 whitespace-pre flex-1">{line.content}</span>
  </div>

  {#if prComments.length > 0}
    <PRCommentCard comments={prComments} quotedContent={line.content} quotedPrefix={linePrefix} />
  {/if}
</div>
