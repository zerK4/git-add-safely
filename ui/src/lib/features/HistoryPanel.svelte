<script lang="ts">
  import { History, X, Trash2, FileText, Bot, ChevronRight } from "@lucide/svelte";
  import { Separator } from "$lib/components/ui/separator";
  import { fetchConversations, deleteConversation, type Conversation } from "$lib/api/client";
  import { loadConversation, store } from "$lib/stores/app.svelte";

  let { onClose }: { onClose: () => void } = $props();

  let conversations = $state<Conversation[]>([]);
  let loading = $state(true);
  let showAll = $state(false);

  async function load() {
    loading = true;
    try {
      conversations = await fetchConversations(showAll);
    } finally {
      loading = false;
    }
  }

  $effect(() => {
    load();
  });

  async function handleDelete(e: MouseEvent, id: number) {
    e.stopPropagation();
    await deleteConversation(id);
    conversations = conversations.filter((c) => c.id !== id);
  }

  async function handleOpen(conv: Conversation) {
    await loadConversation(conv.id, conv.file, conv.title);
    onClose();
  }

  function formatDate(iso: string): string {
    const d = new Date(iso + "Z"); // SQLite stores UTC without Z
    const now = new Date();
    const diffMs = now.getTime() - d.getTime();
    const diffMins = Math.floor(diffMs / 60000);
    const diffHours = Math.floor(diffMins / 60);
    const diffDays = Math.floor(diffHours / 24);

    if (diffMins < 1) return "just now";
    if (diffMins < 60) return `${diffMins}m ago`;
    if (diffHours < 24) return `${diffHours}h ago`;
    if (diffDays < 7) return `${diffDays}d ago`;
    return d.toLocaleDateString();
  }

  // Group by repo
  const grouped = $derived(
    conversations.reduce<Record<string, Conversation[]>>((acc, c) => {
      if (!acc[c.repo]) acc[c.repo] = [];
      acc[c.repo].push(c);
      return acc;
    }, {})
  );
</script>

<div class="flex flex-col w-80 shrink-0 border-l border-border bg-card overflow-hidden">
  <!-- Header -->
  <div class="flex items-center gap-2 px-4 py-2.5 bg-card shrink-0">
    <History class="size-3.5 text-primary shrink-0" />
    <span class="text-xs font-semibold text-foreground flex-1">Review History</span>
    <button
      class="flex items-center justify-center w-6 h-6 rounded hover:bg-muted text-muted-foreground hover:text-foreground transition-colors"
      onclick={onClose}
    >
      <X class="size-3.5" />
    </button>
  </div>
  <Separator />

  <!-- Filter -->
  <div class="flex items-center gap-2 px-4 py-2 shrink-0">
    <button
      class="text-[10px] font-medium px-2 py-0.5 rounded transition-colors
        {!showAll ? 'bg-primary/15 text-primary' : 'text-muted-foreground hover:text-foreground'}"
      onclick={() => { showAll = false; load(); }}
    >
      This repo
    </button>
    <button
      class="text-[10px] font-medium px-2 py-0.5 rounded transition-colors
        {showAll ? 'bg-primary/15 text-primary' : 'text-muted-foreground hover:text-foreground'}"
      onclick={() => { showAll = true; load(); }}
    >
      All repos
    </button>
  </div>
  <Separator />

  <!-- List -->
  <div class="flex-1 overflow-y-auto diff-scroll">
    {#if loading}
      <div class="flex items-center justify-center py-10 text-muted-foreground text-xs">
        Loading...
      </div>
    {:else if conversations.length === 0}
      <div class="flex flex-col items-center justify-center py-10 gap-2 text-muted-foreground text-xs text-center px-4">
        <Bot class="size-6 opacity-30" />
        No reviews yet
      </div>
    {:else}
      {#each Object.entries(grouped) as [repo, convs]}
        {#if showAll}
          <div class="px-4 py-1.5 text-[10px] font-semibold text-muted-foreground/60 uppercase tracking-wider bg-muted/20 border-b border-border">
            {repo}
          </div>
        {/if}
        {#each convs as conv}
          <div
            class="flex items-start gap-2.5 px-4 py-2.5 cursor-pointer hover:bg-muted/40 border-b border-border/50 transition-colors group
              {store.activeConversationId === conv.id ? 'bg-primary/8 border-l-2 border-l-primary pl-[14px]' : ''}"
            role="button"
            tabindex="0"
            onclick={() => handleOpen(conv)}
            onkeydown={(e) => e.key === 'Enter' && handleOpen(conv)}
          >
            <FileText class="size-3.5 text-muted-foreground/50 shrink-0 mt-0.5" />
            <div class="flex-1 min-w-0">
              <p class="text-xs text-foreground font-medium truncate">{conv.title}</p>
              <p class="text-[10px] text-muted-foreground font-mono truncate mt-0.5">{conv.file}</p>
              <p class="text-[10px] text-muted-foreground/50 mt-0.5">{formatDate(conv.updated_at)}</p>
            </div>
            <div class="flex items-center gap-1 opacity-0 group-hover:opacity-100 transition-opacity">
              <button
                class="flex items-center justify-center w-5 h-5 rounded hover:bg-destructive/20 text-muted-foreground hover:text-destructive transition-colors"
                onclick={(e) => handleDelete(e, conv.id)}
                title="Delete"
              >
                <Trash2 class="size-3" />
              </button>
            </div>
          </div>
        {/each}
      {/each}
    {/if}
  </div>
</div>
