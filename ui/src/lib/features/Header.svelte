<script lang="ts">
  import { AlertTriangle, CheckCircle, GitBranch, History, Bot, Settings } from "@lucide/svelte";
  import { Badge } from "$lib/components/ui/badge";
  import { Button } from "$lib/components/ui/button";
  import { store, openReviewAll, closeReviewAll, openSettings, closeSettings } from "$lib/stores/app.svelte";

  let { onToggleHistory }: { onToggleHistory?: () => void } = $props();
</script>

<header class="flex items-center gap-3 px-5 py-3 border-b border-border bg-card shrink-0">
  <GitBranch class="size-4 text-muted-foreground" />
  <span class="text-sm font-semibold tracking-tight font-sans">
    git<span class="text-primary">-add-safely</span>
  </span>
  {#if store.context?.repoName}
    <span class="text-muted-foreground">/</span>
    <span class="text-sm text-muted-foreground font-sans">{store.context.repoName}</span>
  {/if}
  {#if store.context?.branchName}
    <span class="text-muted-foreground">·</span>
    <span class="text-xs font-mono text-primary/70 bg-primary/8 border border-primary/20 px-1.5 py-0.5 rounded">{store.context.branchName}</span>
  {/if}

  <div class="ml-auto flex items-center gap-2">
    <Button
      variant="ghost"
      size="sm"
      class="h-7 px-2 text-xs gap-1.5 text-muted-foreground hover:text-foreground"
      onclick={onToggleHistory}
    >
      <History class="size-3.5" />
      History
    </Button>
    <Button
      variant={store.reviewAllOpen ? "secondary" : "ghost"}
      size="sm"
      class="h-7 px-2 text-xs gap-1.5 {store.reviewAllOpen ? 'text-primary' : 'text-muted-foreground hover:text-foreground'}"
      onclick={() => store.reviewAllOpen ? closeReviewAll() : openReviewAll()}
    >
      <Bot class="size-3.5" />
      Review changes
    </Button>
    <Button
      variant={store.settingsOpen ? "secondary" : "ghost"}
      size="sm"
      class="h-7 w-7 p-0 {store.settingsOpen ? 'text-primary' : 'text-muted-foreground hover:text-foreground'}"
      onclick={() => store.settingsOpen ? closeSettings() : openSettings()}
    >
      <Settings class="size-3.5" />
    </Button>
    <div class="w-px h-4 bg-border"></div>

    {#if store.warningCount > 0}
      <Badge variant="destructive" class="gap-1.5">
        <AlertTriangle class="size-3" />
        {store.warningCount} warning{store.warningCount !== 1 ? "s" : ""}
      </Badge>
    {:else if store.context}
      <Badge class="gap-1.5 bg-status-good/15 text-status-good border-status-good/30 hover:bg-status-good/20">
        <CheckCircle class="size-3" />
        No issues found
      </Badge>
    {/if}
  </div>
</header>
