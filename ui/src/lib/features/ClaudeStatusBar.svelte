<script lang="ts">
  import { Bot, Loader2, CheckCircle2, AlertCircle } from "@lucide/svelte";
  import { store, toggleClaudePanel } from "$lib/stores/app.svelte";
</script>

{#if store.claudeStatus !== "idle"}
  <button
    class="flex items-center gap-1.5 px-2.5 py-1 rounded-md border text-[11px] font-sans font-medium transition-all
      {store.claudeStatus === 'working'
        ? 'bg-primary/10 border-primary/30 text-primary hover:bg-primary/20'
        : store.claudeStatus === 'done'
        ? 'bg-status-good/10 border-status-good/30 text-status-good hover:bg-status-good/20'
        : 'bg-destructive/10 border-destructive/30 text-destructive hover:bg-destructive/20'}"
    onclick={toggleClaudePanel}
  >
    {#if store.claudeStatus === "working"}
      <Loader2 class="size-3 animate-spin shrink-0" />
      Claude working...
    {:else if store.claudeStatus === "done"}
      <CheckCircle2 class="size-3 shrink-0" />
      Claude finished reviewing
    {:else}
      <AlertCircle class="size-3 shrink-0" />
      Review error
    {/if}
  </button>
{/if}
