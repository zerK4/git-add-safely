<script lang="ts">
  import { store } from "$lib/stores/app.svelte";
  import { goto } from "$app/navigation";
  import { page } from "$app/stores";
  import { FileCode, MessageCircle } from "@lucide/svelte";

  const prNumber = $derived($page.params.number);

  function openFile(file: string) {
    goto(`/pr/${prNumber}/files/${file}`);
  }

  function openConversation() {
    goto(`/pr/${prNumber}/conversation`);
  }
</script>

<div class="flex-1 flex flex-col overflow-hidden min-w-0">
  {#if store.prData}
    <div class="flex items-center gap-3 px-6 py-3 border-b border-border shrink-0">
      <span class="text-sm font-semibold">{store.prData.title}</span>
      <span class="text-xs text-muted-foreground/60">#{store.prData.number}</span>
      <button
        onclick={openConversation}
        class="ml-auto flex items-center gap-1.5 text-[11px] px-2.5 py-1 rounded-lg border border-border text-muted-foreground/60 hover:text-foreground hover:border-border/80 transition-colors"
      >
        <MessageCircle class="size-3" />
        Conversation
      </button>
    </div>
    <div class="flex-1 overflow-y-auto py-2">
      {#each store.prFiles as file}
        {@const stats = store.prFileStats[file]}
        <button
          class="w-full flex items-center gap-2 px-6 py-1.5 text-left hover:bg-accent/40 transition-colors"
          onclick={() => openFile(file)}
        >
          <FileCode class="size-3 shrink-0 text-muted-foreground/50" />
          <span class="text-[11px] font-mono flex-1 truncate">{file}</span>
          {#if stats}
            <span class="text-[10px] font-mono text-status-good/70">+{stats.added}</span>
            <span class="text-[10px] font-mono text-destructive/70">-{stats.removed}</span>
          {/if}
        </button>
      {/each}
    </div>
  {/if}
</div>
