<script lang="ts">
  import { AlertTriangle, MessageSquare, Plus, Minus } from "@lucide/svelte";
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

  const statusColor: Record<string, string> = {
    added:    "bg-status-good",
    modified: "bg-status-warn",
    deleted:  "bg-destructive",
    renamed:  "bg-primary",
  };

  const dot = $derived(statusColor[file.status] ?? "bg-muted-foreground/40");
  const filename = $derived(file.path.split("/").pop() ?? file.path);
  const dir = $derived((() => {
    const parts = file.path.split("/");
    return parts.length > 1 ? parts.slice(0, -1).join("/") + "/" : "";
  })());

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
    class="w-full flex items-center gap-2 px-3 py-1.5 text-left transition-colors
      {isSelected
        ? 'bg-accent/80 text-accent-foreground'
        : 'text-foreground/80 hover:bg-accent/40 hover:text-foreground'}
      {hasWarning && !isSelected ? 'bg-status-warn/5' : ''}
      {loading ? 'opacity-50 pointer-events-none' : ''}"
    {onclick}
  >
    <!-- Status dot -->
    <span class="size-1.5 rounded-full shrink-0 {dot} {isSelected ? 'opacity-100' : 'opacity-70'}"></span>

    <!-- Filename -->
    <span class="flex-1 min-w-0 overflow-hidden" title={file.path}>
      <span class="font-mono text-xs truncate leading-none block">{filename}</span>
    </span>

    <!-- Right-side indicators -->
    <span class="flex items-center gap-1.5 shrink-0 {watchMode ? 'mr-5' : ''}">
      {#if diffStats && (diffStats.added > 0 || diffStats.removed > 0)}
        <span class="font-mono text-[10px] leading-none tabular-nums">
          {#if diffStats.added > 0}<span class="text-status-good">+{diffStats.added}</span>{/if}{#if diffStats.added > 0 && diffStats.removed > 0}<span class="text-muted-foreground/30"> </span>{/if}{#if diffStats.removed > 0}<span class="text-destructive">-{diffStats.removed}</span>{/if}
        </span>
      {/if}
      {#if noteCount > 0}
        <span class="flex items-center gap-0.5 text-primary/60">
          <MessageSquare class="size-2.5" />
          <span class="text-[9px] font-sans leading-none">{noteCount}</span>
        </span>
      {/if}
      {#if hasWarning}
        <AlertTriangle class="size-3 text-status-warn/80" />
      {/if}
    </span>
  </button>

  <!-- Stage / Unstage button -->
  {#if watchMode}
    {#if staged && onUnstage}
      <button
        class="absolute right-2 top-1/2 -translate-y-1/2 opacity-0 group-hover:opacity-100
               flex items-center justify-center w-5 h-5 rounded
               text-destructive bg-destructive/15 border border-destructive/30
               hover:bg-destructive/25 hover:border-destructive/50
               transition-all duration-150 hover:scale-110 active:scale-95
               hover:shadow-[0_0_6px_1px_color-mix(in_oklch,var(--destructive)_30%,transparent)]
               disabled:opacity-30"
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
               text-status-good bg-status-good/15 border border-status-good/30
               hover:bg-status-good/25 hover:border-status-good/50
               transition-all duration-150 hover:scale-110 active:scale-95
               hover:shadow-[0_0_6px_1px_color-mix(in_oklch,var(--status-good)_30%,transparent)]
               disabled:opacity-30"
        title="Stage"
        disabled={loading}
        onclick={handleStage}
      >
        <Plus class="size-3" />
      </button>
    {/if}
  {/if}
</div>
