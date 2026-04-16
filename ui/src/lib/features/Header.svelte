<script lang="ts">
  import { AlertTriangle, CheckCircle, GitBranch } from "@lucide/svelte";
  import { Badge } from "$lib/components/ui/badge";
  import { store } from "$lib/stores/app.svelte";
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

  <div class="ml-auto">
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
