<script lang="ts">
  import { AlertTriangle, Loader2 } from "@lucide/svelte";
  import { fetchFileLines, type FileLinesResult } from "$lib/api/client";
  import type { ScanResult } from "$lib/types";

  let { warning }: { warning: ScanResult } = $props();

  let result = $state<FileLinesResult | null>(null);
  let loading = $state(true);

  $effect(() => {
    loading = true;
    fetchFileLines(warning.file, warning.line)
      .then((r) => { result = r; })
      .catch(() => { result = null; })
      .finally(() => { loading = false; });
  });
</script>

<div class="border-b border-status-warn/20">
  <!-- Phantom hunk header -->
  <div class="flex items-center gap-2 text-xs font-mono bg-status-warn/6 border-b border-status-warn/15 px-4 py-0.5 text-status-warn/60 select-none">
    <AlertTriangle class="size-3 text-status-warn shrink-0" />
    <span class="font-sans text-[11px] font-semibold text-status-warn">
      {warning.pattern}
    </span>
    <span class="text-status-warn/50 font-sans">— line {warning.line} (not in diff, showing file context)</span>
  </div>

  {#if loading}
    <div class="flex items-center gap-2 px-4 py-3 text-muted-foreground text-xs">
      <Loader2 class="size-3 animate-spin" />
      Loading context...
    </div>
  {:else if result}
    {#each result.lines as line}
      <div class="flex items-stretch text-xs font-mono
        {line.isTarget ? 'bg-status-warn/12' : 'bg-background'}">
        <!-- Gutter spacer (align with diff lines) -->
        <div class="flex shrink-0 pl-6 select-none">
          <span class="w-12 text-right pr-3 py-0.5 text-muted-foreground/30 border-r border-border">
            {line.lineNo}
          </span>
          <span class="w-12 py-0.5 border-r border-border"></span>
        </div>
        <span class="w-5 shrink-0"></span>
        <span class="py-0.5 px-2 whitespace-pre {line.isTarget ? 'text-status-warn' : ''}">
          {line.content}
        </span>
        {#if line.isTarget}
          <span class="ml-auto pr-3 py-0.5 flex items-center">
            <span class="text-[10px] font-semibold bg-status-warn/20 text-status-warn border border-status-warn/30 px-1.5 py-0.5 rounded font-sans">
              ← {warning.pattern}
            </span>
          </span>
        {/if}
      </div>
    {/each}
  {/if}
</div>
