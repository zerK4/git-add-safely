<script lang="ts">
  import { Loader2 } from "@lucide/svelte";
  import { Separator } from "$lib/components/ui/separator";
  import { store } from "$lib/stores/app.svelte";
  import PRDiffLine from "./PRDiffLine.svelte";
</script>

<div class="flex flex-col flex-1 overflow-hidden min-w-0">
  <div class="flex items-center gap-3 px-4 py-2 bg-card shrink-0">
    <span class="font-mono text-xs text-muted-foreground truncate flex-1">
      {store.prSelectedFile ?? ""}
    </span>
    <span class="text-[10px] text-muted-foreground/40 font-sans">PR #{store.activePR}</span>
  </div>
  <Separator />

  {#if store.prDiffLoading}
    <div class="flex items-center justify-center h-40 gap-2 text-muted-foreground text-sm">
      <Loader2 class="size-4 animate-spin" />
      Loading diff...
    </div>
  {:else if !store.prParsedDiff || store.prParsedDiff.hunks.length === 0}
    <div class="flex items-center justify-center h-40 text-muted-foreground text-sm font-sans">
      No changes to display
    </div>
  {:else}
    <div class="diff-scroll flex-1 overflow-auto bg-background [container-type:inline-size]" style="height:0">
      <div class="min-w-max">
        {#each store.prParsedDiff.hunks as hunk}
          <div class="flex items-center text-xs font-mono bg-primary/5 border-y border-primary/10 px-4 py-0.5 text-primary/50 select-none">
            {hunk.header}
          </div>
          {#each hunk.lines as line}
            <PRDiffLine {line} />
          {/each}
        {/each}
      </div>
    </div>
  {/if}
</div>
