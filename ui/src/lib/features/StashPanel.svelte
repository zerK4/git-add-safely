<script lang="ts">
  import { Archive, Plus, ChevronDown, ChevronRight, Trash2, Play, GitMerge, RefreshCw, FileCode } from "@lucide/svelte";
  import { fetchStashes, createStash, applyStash, popStash, dropStash, fetchStashDiff } from "$lib/api/client";
  import type { StashEntry } from "$lib/api/client";
  import { parseDiff } from "$lib/diff/parser";
  import { selectStashFile, store } from "$lib/stores/app.svelte";

  let stashes = $state<StashEntry[]>([]);
  let loading = $state(true);
  let error = $state<string | null>(null);

  // Create stash form
  let showCreate = $state(false);
  let createMessage = $state("");
  let includeUntracked = $state(false);
  let creating = $state(false);
  let createError = $state<string | null>(null);

  // Expanded stash + diff
  let expandedRef = $state<string | null>(null);
  let diffByRef = $state<Record<string, string>>({});
  let diffLoading = $state(false);

  // Action feedback
  let actionResult = $state<{ ok: boolean; output: string } | null>(null);
  let actionRef = $state<string | null>(null);

  async function load() {
    loading = true;
    error = null;
    try {
      stashes = await fetchStashes();
    } catch (e) {
      error = (e as Error).message;
    } finally {
      loading = false;
    }
  }

  $effect(() => { load(); });

  async function toggleExpand(ref: string) {
    if (expandedRef === ref) {
      expandedRef = null;
      return;
    }
    expandedRef = ref;
    if (!diffByRef[ref]) {
      diffLoading = true;
      const diff = await fetchStashDiff(ref);
      diffByRef = { ...diffByRef, [ref]: diff };
      diffLoading = false;
    }
  }

  async function handleCreate() {
    creating = true;
    createError = null;
    const result = await createStash(createMessage.trim() || undefined, includeUntracked);
    creating = false;
    if (!result.ok) {
      createError = result.output.trim();
      return;
    }
    createMessage = "";
    includeUntracked = false;
    showCreate = false;
    await load();
  }

  async function handleApply(ref: string) {
    actionRef = ref;
    const result = await applyStash(ref);
    actionResult = result;
    actionRef = null;
    if (result.ok) await load();
  }

  async function handlePop(ref: string) {
    actionRef = ref;
    const result = await popStash(ref);
    actionResult = result;
    actionRef = null;
    if (result.ok) { await load(); expandedRef = null; }
  }

  async function handleDrop(ref: string) {
    actionRef = ref;
    const result = await dropStash(ref);
    actionResult = result;
    actionRef = null;
    if (result.ok) { await load(); if (expandedRef === ref) expandedRef = null; }
  }

  function formatDate(iso: string) {
    try {
      const d = new Date(iso);
      const now = new Date();
      const diff = now.getTime() - d.getTime();
      const mins = Math.floor(diff / 60000);
      if (mins < 60) return `${mins}m ago`;
      const hrs = Math.floor(mins / 60);
      if (hrs < 24) return `${hrs}h ago`;
      return d.toLocaleDateString(undefined, { month: "short", day: "numeric" });
    } catch { return iso; }
  }

  function getDiffSummary(diff: string): { files: number; added: number; removed: number } {
    const parsed = parseDiff(diff);
    if (!parsed) return { files: 0, added: 0, removed: 0 };
    let added = 0, removed = 0;
    for (const hunk of parsed.hunks) {
      for (const line of hunk.lines) {
        if (line.type === "add") added++;
        else if (line.type === "remove") removed++;
      }
    }
    const files = (diff.match(/^diff --git /gm) ?? []).length;
    return { files, added, removed };
  }
</script>

<aside class="w-full border-r border-border bg-sidebar flex flex-col overflow-hidden text-sm">
  <!-- Header -->
  <div class="flex items-center justify-between px-3 py-2 border-b border-border/60 shrink-0">
    <span class="text-xs font-medium text-muted-foreground uppercase tracking-wider">Stashes</span>
    <div class="flex items-center gap-1">
      <button
        class="flex items-center justify-center w-5 h-5 rounded text-muted-foreground/50 hover:text-muted-foreground hover:bg-muted/50 transition-colors"
        title="Refresh"
        onclick={load}
      >
        <RefreshCw class="size-3" />
      </button>
      <button
        class="flex items-center justify-center w-5 h-5 rounded transition-colors
               {showCreate ? 'text-primary bg-primary/10' : 'text-muted-foreground/50 hover:text-muted-foreground hover:bg-muted/50'}"
        title="New stash"
        onclick={() => { showCreate = !showCreate; createError = null; }}
      >
        <Plus class="size-3" />
      </button>
    </div>
  </div>

  <!-- Create stash form -->
  {#if showCreate}
    <div class="px-3 py-2 border-b border-border/60 bg-muted/20 shrink-0 flex flex-col gap-2">
      <input
        type="text"
        placeholder="Message (optional)"
        bind:value={createMessage}
        class="w-full text-xs bg-background border border-border rounded px-2 py-1 outline-none focus:border-primary/60"
        onkeydown={(e) => { if (e.key === "Enter") handleCreate(); if (e.key === "Escape") showCreate = false; }}
      />
      <label class="flex items-center gap-2 text-xs text-muted-foreground cursor-pointer select-none">
        <input type="checkbox" bind:checked={includeUntracked} class="accent-primary" />
        Include untracked files
      </label>
      {#if createError}
        <p class="text-xs text-destructive">{createError}</p>
      {/if}
      <button
        class="w-full text-xs py-1 rounded bg-primary text-primary-foreground hover:bg-primary/90 transition-colors disabled:opacity-50"
        onclick={handleCreate}
        disabled={creating}
      >
        {creating ? "Stashing…" : "Stash changes"}
      </button>
    </div>
  {/if}

  <!-- Action result toast -->
  {#if actionResult}
    <div
      class="px-3 py-2 text-xs border-b border-border/60 shrink-0
             {actionResult.ok ? 'bg-green-500/10 text-green-600 dark:text-green-400' : 'bg-destructive/10 text-destructive'}"
    >
      <div class="flex items-center justify-between">
        <span>{actionResult.ok ? "Done" : "Error"}</span>
        <button class="text-xs opacity-60 hover:opacity-100" onclick={() => actionResult = null}>✕</button>
      </div>
      {#if actionResult.output.trim()}
        <p class="mt-0.5 opacity-80 font-mono text-[10px] break-all">{actionResult.output.trim().slice(0, 200)}</p>
      {/if}
    </div>
  {/if}

  <!-- Stash list -->
  <div class="flex-1 overflow-y-auto">
    {#if loading}
      <div class="flex items-center justify-center py-8 text-xs text-muted-foreground/40">Loading…</div>
    {:else if error}
      <div class="p-4 text-xs text-destructive">{error}</div>
    {:else if stashes.length === 0}
      <div class="flex flex-col items-center justify-center py-10 gap-2 text-muted-foreground/40">
        <Archive class="size-6" />
        <p class="text-xs">No stashes</p>
      </div>
    {:else}
      {#each stashes as stash (stash.ref)}
        {@const isExpanded = expandedRef === stash.ref}
        {@const isActing = actionRef === stash.ref}
        <div class="border-b border-border/40 last:border-0">
          <!-- Stash row -->
          <div
            class="flex items-start gap-1.5 px-3 py-2 cursor-pointer hover:bg-muted/30 transition-colors group"
            role="button"
            tabindex="0"
            onclick={() => toggleExpand(stash.ref)}
            onkeydown={(e) => { if (e.key === "Enter" || e.key === " ") toggleExpand(stash.ref); }}
          >
            <div class="mt-0.5 shrink-0 text-muted-foreground/40">
              {#if isExpanded}
                <ChevronDown class="size-3" />
              {:else}
                <ChevronRight class="size-3" />
              {/if}
            </div>
            <div class="flex-1 min-w-0">
              <div class="flex items-center justify-between gap-1">
                <span class="text-[10px] font-mono text-primary/70 shrink-0">{stash.ref}</span>
                <span class="text-[10px] text-muted-foreground/50 shrink-0">{formatDate(stash.date)}</span>
              </div>
              <p class="text-xs text-foreground/80 mt-0.5 truncate">{stash.message}</p>
            </div>
          </div>

          <!-- Expanded: diff summary + actions -->
          {#if isExpanded}
            <div class="px-3 pb-2 bg-muted/10">
              <!-- Actions -->
              <div class="flex items-center gap-1.5 mb-2">
                <button
                  class="flex items-center gap-1 text-[10px] px-2 py-0.5 rounded border border-border/60 hover:bg-muted/50 transition-colors disabled:opacity-40 text-muted-foreground hover:text-foreground"
                  title="Apply (keep stash)"
                  onclick={() => handleApply(stash.ref)}
                  disabled={isActing}
                >
                  <Play class="size-2.5" /> Apply
                </button>
                <button
                  class="flex items-center gap-1 text-[10px] px-2 py-0.5 rounded border border-border/60 hover:bg-muted/50 transition-colors disabled:opacity-40 text-muted-foreground hover:text-foreground"
                  title="Pop (apply + drop)"
                  onclick={() => handlePop(stash.ref)}
                  disabled={isActing}
                >
                  <GitMerge class="size-2.5" /> Pop
                </button>
                <button
                  class="flex items-center gap-1 text-[10px] px-2 py-0.5 rounded border border-destructive/40 hover:bg-destructive/10 transition-colors disabled:opacity-40 text-destructive/70 hover:text-destructive ml-auto"
                  title="Drop stash"
                  onclick={() => handleDrop(stash.ref)}
                  disabled={isActing}
                >
                  <Trash2 class="size-2.5" /> Drop
                </button>
              </div>

              <!-- Diff preview -->
              {#if diffLoading && expandedRef === stash.ref && !diffByRef[stash.ref]}
                <p class="text-[10px] text-muted-foreground/40">Loading diff…</p>
              {:else if diffByRef[stash.ref]}
                {@const summary = getDiffSummary(diffByRef[stash.ref])}
                <div class="flex items-center gap-2 text-[10px] text-muted-foreground/60 mb-1.5">
                  <span>{summary.files} file{summary.files !== 1 ? "s" : ""}</span>
                  {#if summary.added > 0}<span class="text-green-500">+{summary.added}</span>{/if}
                  {#if summary.removed > 0}<span class="text-red-500">-{summary.removed}</span>{/if}
                </div>
                <!-- File list from diff — clickable -->
                <div class="flex flex-col gap-0.5">
                  {#each (diffByRef[stash.ref].match(/^diff --git a\/(.+?) b\/.+$/gm) ?? []) as line}
                    {@const file = line.replace(/^diff --git a\//, "").replace(/ b\/.+$/, "")}
                    {@const isSelected = store.selectedFile === `${stash.ref}:${file}`}
                    <button
                      class="flex items-center gap-1.5 text-left text-[10px] font-mono px-1.5 py-0.5 rounded transition-colors truncate w-full
                             {isSelected
                               ? 'bg-primary/15 text-primary'
                               : 'text-muted-foreground/70 hover:text-foreground hover:bg-muted/40'}"
                      onclick={() => selectStashFile(stash.ref, file, diffByRef[stash.ref])}
                    >
                      <FileCode class="size-2.5 shrink-0" />
                      <span class="truncate">{file}</span>
                    </button>
                  {/each}
                </div>
              {/if}
            </div>
          {/if}
        </div>
      {/each}
    {/if}
  </div>
</aside>
