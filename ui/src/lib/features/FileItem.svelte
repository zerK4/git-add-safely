<script lang="ts">
  import { AlertTriangle, MessageSquare, Plus, Minus } from "@lucide/svelte";
  import { Badge } from "$lib/components/ui/badge";
  import AuroraLoadingBar from "$lib/components/ui/aurora-loading-bar.svelte";
  import type { FileStatus } from "$lib/types";

  let {
    file,
    isSelected,
    hasWarning,
    noteCount = 0,
    diffStats,
    staged = true,
    watchMode = false,
    onclick,
    onStage,
    onUnstage,
  }: {
    file: FileStatus;
    isSelected: boolean;
    hasWarning: boolean;
    noteCount?: number;
    diffStats?: { added: number; removed: number };
    staged?: boolean;
    watchMode?: boolean;
    onclick: () => void;
    onStage?: () => Promise<void> | void;
    onUnstage?: () => Promise<void> | void;
  } = $props();

  let loading = $state(false);

  const statusMeta: Record<string, { label: string; class: string }> = {
    added:    { label: "A", class: "bg-status-good/15 text-status-good border-status-good/25 hover:bg-status-good/20" },
    modified: { label: "M", class: "bg-status-warn/15 text-status-warn border-status-warn/25 hover:bg-status-warn/20" },
    deleted:  { label: "D", class: "bg-destructive/15 text-destructive border-destructive/25 hover:bg-destructive/20" },
    renamed:  { label: "R", class: "bg-primary/15 text-primary border-primary/25 hover:bg-primary/20" },
  };

  const meta = $derived(statusMeta[file.status] ?? { label: "?", class: "bg-muted text-muted-foreground" });
  const filename = $derived(file.path.split("/").pop() ?? file.path);

  async function handleStage(e: MouseEvent) {
    e.stopPropagation();
    loading = true;
    await onStage?.();
    loading = false;
  }

  async function handleUnstage(e: MouseEvent) {
    e.stopPropagation();
    loading = true;
    await onUnstage?.();
    loading = false;
  }
</script>

<div class="group relative">
  <AuroraLoadingBar active={loading} />
  <button
    class="w-full flex items-center gap-2 px-3 py-1 text-left transition-colors rounded-none
      {isSelected ? 'bg-accent text-accent-foreground' : 'hover:bg-accent/60'}
      {hasWarning && !isSelected ? 'bg-destructive/5 hover:bg-destructive/10' : ''}
      {loading ? 'opacity-60 pointer-events-none' : ''}"
    {onclick}
  >
    <Badge class="text-[10px] px-1 py-0 h-4 font-bold shrink-0 {meta.class}">{meta.label}</Badge>
    <span class="font-mono text-xs truncate">{filename}</span>

    <div class="ml-auto flex items-center gap-1.5 shrink-0">
      {#if diffStats && (diffStats.added > 0 || diffStats.removed > 0)}
        <span class="font-mono text-[10px] leading-none">
          {#if diffStats.added > 0}<span class="text-status-good">+{diffStats.added}</span>{/if}
          {#if diffStats.added > 0 && diffStats.removed > 0}<span class="text-muted-foreground/40"> </span>{/if}
          {#if diffStats.removed > 0}<span class="text-destructive">-{diffStats.removed}</span>{/if}
        </span>
      {/if}
      {#if noteCount > 0}
        <span class="flex items-center gap-0.5 text-primary/70">
          <MessageSquare class="size-3" />
          <span class="text-[10px] font-sans leading-none">{noteCount}</span>
        </span>
      {/if}
      {#if hasWarning}
        <AlertTriangle class="size-3 text-status-warn" />
      {/if}
      <!-- Spacer for stage button -->
      {#if watchMode}
        <span class="w-5"></span>
      {/if}
    </div>
  </button>

  <!-- Stage / Unstage button — appears on hover, absolute right -->
  {#if watchMode}
    {#if staged && onUnstage}
      <button
        class="absolute right-2 top-1/2 -translate-y-1/2 opacity-0 group-hover:opacity-100
               flex items-center justify-center w-5 h-5 rounded
               text-muted-foreground/60 hover:text-destructive hover:bg-destructive/10
               transition-all duration-150 disabled:opacity-30"
        title="Unstage"
        disabled={loading}
        onclick={handleUnstage}
      >
        <Minus class="size-3" />
      </button>
    {:else if !staged && onStage}
      <button
        class="absolute right-2 top-1/2 -translate-y-1/2 opacity-0 group-hover:opacity-100
               flex items-center justify-center w-5 h-5 rounded
               text-muted-foreground/60 hover:text-status-good hover:bg-status-good/10
               transition-all duration-150 disabled:opacity-30"
        title="Stage"
        disabled={loading}
        onclick={handleStage}
      >
        <Plus class="size-3" />
      </button>
    {/if}
  {/if}
</div>
