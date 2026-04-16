<script lang="ts">
  import { AlertTriangle, ShieldCheck } from "@lucide/svelte";
  import { Badge } from "$lib/components/ui/badge";
  import { ScrollArea } from "$lib/components/ui/scroll-area";
  import { store } from "$lib/stores/app.svelte";
</script>

<ScrollArea class="flex-1">
  <div class="p-6">
    {#if store.warningCount > 0}
      <div class="flex items-center gap-2 text-destructive font-semibold text-sm mb-4 font-sans">
        <AlertTriangle class="size-4" />
        Potential secrets detected
      </div>

      <div class="flex flex-col gap-3">
        {#each store.context?.scanResults ?? [] as result}
          <div class="bg-card border border-border border-l-2 border-l-destructive rounded-md p-3">
            <div class="flex items-center gap-2 mb-2">
              <Badge variant="destructive" class="text-[10px]">{result.pattern}</Badge>
              <span class="text-[11px] font-mono text-muted-foreground">
                {result.file}:{result.line}
              </span>
            </div>
            <pre class="text-xs font-mono bg-background border border-border rounded px-3 py-2 overflow-x-auto text-status-warn whitespace-pre">{result.content}</pre>
          </div>
        {/each}
      </div>
    {:else}
      <div class="flex flex-col items-center justify-center h-48 gap-3 text-muted-foreground">
        <ShieldCheck class="size-10 text-status-good/50" />
        <span class="text-sm font-sans">No sensitive patterns found</span>
        <span class="text-xs font-sans">Select a file from the sidebar to view its diff</span>
      </div>
    {/if}
  </div>
</ScrollArea>
