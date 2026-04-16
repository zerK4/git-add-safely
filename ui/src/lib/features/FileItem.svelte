<script lang="ts">
  import { AlertTriangle } from "@lucide/svelte";
  import { Badge } from "$lib/components/ui/badge";
  import type { FileStatus } from "$lib/types";

  let {
    file,
    isSelected,
    hasWarning,
    onclick,
  }: {
    file: FileStatus;
    isSelected: boolean;
    hasWarning: boolean;
    onclick: () => void;
  } = $props();

  const statusMeta: Record<string, { label: string; class: string }> = {
    added:    { label: "A", class: "bg-status-good/15 text-status-good border-status-good/25 hover:bg-status-good/20" },
    modified: { label: "M", class: "bg-status-warn/15 text-status-warn border-status-warn/25 hover:bg-status-warn/20" },
    deleted:  { label: "D", class: "bg-destructive/15 text-destructive border-destructive/25 hover:bg-destructive/20" },
    renamed:  { label: "R", class: "bg-primary/15 text-primary border-primary/25 hover:bg-primary/20" },
  };

  const meta = $derived(statusMeta[file.status] ?? { label: "?", class: "bg-muted text-muted-foreground" });
  const filename = $derived(file.path.split("/").pop() ?? file.path);
</script>

<button
  class="w-full flex items-center gap-2 px-3 py-1 text-left transition-colors rounded-none
    {isSelected ? 'bg-accent text-accent-foreground' : 'hover:bg-accent/60'}
    {hasWarning && !isSelected ? 'bg-destructive/5 hover:bg-destructive/10' : ''}"
  {onclick}
>
  <Badge class="text-[10px] px-1 py-0 h-4 font-bold shrink-0 {meta.class}">{meta.label}</Badge>
  <span class="font-mono text-xs truncate">{filename}</span>
  {#if hasWarning}
    <AlertTriangle class="size-3 text-status-warn shrink-0 ml-auto" />
  {/if}
</button>
