<script lang="ts">
  import { store, stageFileAction, unstageFileAction } from "$lib/stores/app.svelte";
  import { goto } from "$app/navigation";
  import { page } from "$app/stores";
  import { AlertTriangle, MessageSquare, Plus, Minus } from "@lucide/svelte";

  let loadingAll = $state(false);

  async function stageAll() {
    loadingAll = true;
    await Promise.all(store.unstagedFiles.map(f => stageFileAction(f.path)));
    loadingAll = false;
  }

  async function unstageAll() {
    loadingAll = true;
    await Promise.all((store.context?.stagedFiles ?? []).map(f => unstageFileAction(f.path)));
    loadingAll = false;
  }

  const stagedFiles = $derived(store.context?.stagedFiles ?? []);
  const unstagedFiles = $derived(store.unstagedFiles);
  const hasBoth = $derived(stagedFiles.length > 0 && unstagedFiles.length > 0);

  function hasWarning(path: string) {
    return (store.context?.scanResults ?? []).some(r => r.file === path);
  }

  function isSelectedStaged(path: string) {
    return $page.url.pathname === `/files/${path}`;
  }

  function isSelectedUnstaged(path: string) {
    return $page.url.pathname === `/changes/${path}`;
  }

  function filename(path: string) {
    return path.split("/").pop() ?? path;
  }

  function dirname(path: string) {
    const parts = path.split("/");
    return parts.length > 1 ? parts.slice(0, -1).join("/") : "";
  }

  const statusDot: Record<string, string> = {
    added:    "bg-[#3fb950]",
    modified: "bg-[#d29922]",
    deleted:  "bg-[#f85149]",
    renamed:  "bg-[#58a6ff]",
  };
</script>

<aside class="w-full flex flex-col overflow-hidden bg-sidebar border-r border-border/50">

  <!-- STAGED -->
  <div class="flex flex-col min-h-0 flex-1" style={hasBoth ? "max-height:50%" : ""}>

    <div class="flex items-center gap-2 px-4 pt-3 pb-1.5 shrink-0">
      <span class="text-[10px] font-bold uppercase tracking-[0.12em] text-muted-foreground/50 flex-1">Staged</span>
      <span class="text-[10px] font-mono tabular-nums text-muted-foreground/40">{stagedFiles.length}</span>
      {#if store.watchMode && stagedFiles.length > 0}
        <button
          title="Unstage all"
          disabled={loadingAll}
          onclick={unstageAll}
          class="size-4 flex items-center justify-center rounded text-muted-foreground/30 hover:text-destructive hover:bg-destructive/10 transition-colors disabled:opacity-30"
        ><Minus class="size-2.5" /></button>
      {/if}
    </div>

    <div class="flex-1 overflow-y-auto min-h-0 px-2 pb-2">
      {#if stagedFiles.length === 0}
        <p class="px-2 py-3 text-[11px] text-muted-foreground/25 italic">Nothing staged</p>
      {:else}
        {#each stagedFiles as file (file.path)}
          {@const selected = isSelectedStaged(file.path)}
          {@const warn = hasWarning(file.path)}
          {@const notes = store.noteCountsByFile[file.path] ?? 0}
          {@const stats = store.diffStats[file.path]}
          {@const dot = statusDot[file.status] ?? "bg-muted-foreground/30"}
          <div class="group relative">
            <button
              onclick={() => goto(`/files/${file.path}`)}
              class="w-full flex items-center gap-2.5 px-2 py-1.5 rounded-md text-left transition-all duration-100
                     {selected ? 'bg-accent/70 text-foreground' : 'text-muted-foreground hover:bg-accent/30 hover:text-foreground'}
                     {store.watchMode ? 'pr-8' : ''}"
            >
              <span class="size-1.5 rounded-full shrink-0 {dot}"></span>
              <span class="flex-1 min-w-0">
                <span class="block text-[12px] font-medium font-mono truncate leading-none mb-0.5">{filename(file.path)}</span>
                {#if dirname(file.path)}
                  <span class="block text-[10px] text-muted-foreground/40 font-mono truncate leading-none">{dirname(file.path)}/</span>
                {/if}
              </span>
              <span class="flex items-center gap-1 shrink-0 text-[10px] font-mono tabular-nums">
                {#if stats?.added}<span class="text-[#3fb950]/70">+{stats.added}</span>{/if}
                {#if stats?.removed}<span class="text-[#f85149]/70">-{stats.removed}</span>{/if}
                {#if notes > 0}
                  <span class="flex items-center gap-0.5 text-primary/50"><MessageSquare class="size-2.5" />{notes}</span>
                {/if}
                {#if warn}
                  <AlertTriangle class="size-3 text-[#d29922]/80" />
                {/if}
              </span>
            </button>
            {#if store.watchMode}
              <button
                onclick={() => unstageFileAction(file.path)}
                title="Unstage"
                class="absolute right-1.5 top-1/2 -translate-y-1/2 opacity-0 group-hover:opacity-100
                       size-5 flex items-center justify-center rounded z-10
                       text-destructive bg-destructive/10 border border-destructive/20
                       hover:bg-destructive/20 transition-all"
              ><Minus class="size-2.5" /></button>
            {/if}
          </div>
        {/each}
      {/if}
    </div>
  </div>

  <!-- CHANGES -->
  {#if store.watchMode && unstagedFiles.length > 0}
    <div class="shrink-0 mx-4 border-t border-border/40"></div>

    <div class="flex flex-col min-h-0 flex-1" style={hasBoth ? "max-height:50%" : ""}>

      <div class="flex items-center gap-2 px-4 pt-3 pb-1.5 shrink-0">
        <span class="text-[10px] font-bold uppercase tracking-[0.12em] text-muted-foreground/50 flex-1">Changes</span>
        <span class="text-[10px] font-mono tabular-nums text-muted-foreground/40">{unstagedFiles.length}</span>
        <button
          title="Stage all"
          disabled={loadingAll}
          onclick={stageAll}
          class="size-4 flex items-center justify-center rounded text-muted-foreground/30 hover:text-[#3fb950] hover:bg-[#3fb950]/10 transition-colors disabled:opacity-30"
        ><Plus class="size-2.5" /></button>
      </div>

      <div class="flex-1 overflow-y-auto min-h-0 px-2 pb-2">
        {#each unstagedFiles as file (file.path)}
          {@const selected = isSelectedUnstaged(file.path)}
          {@const stats = store.diffStats[file.path]}
          {@const dot = statusDot[file.status] ?? "bg-muted-foreground/30"}
          <div class="group relative">
            <button
              onclick={() => goto(`/changes/${file.path}`)}
              class="w-full flex items-center gap-2.5 px-2 py-1.5 pr-8 rounded-md text-left transition-all duration-100
                     {selected ? 'bg-accent/70 text-foreground' : 'text-muted-foreground hover:bg-accent/30 hover:text-foreground'}"
            >
              <span class="size-1.5 rounded-full shrink-0 {dot}"></span>
              <span class="flex-1 min-w-0">
                <span class="block text-[12px] font-medium font-mono truncate leading-none mb-0.5">{filename(file.path)}</span>
                {#if dirname(file.path)}
                  <span class="block text-[10px] text-muted-foreground/40 font-mono truncate leading-none">{dirname(file.path)}/</span>
                {/if}
              </span>
              <span class="flex items-center gap-1 shrink-0 text-[10px] font-mono tabular-nums">
                {#if stats?.added}<span class="text-[#3fb950]/70">+{stats.added}</span>{/if}
                {#if stats?.removed}<span class="text-[#f85149]/70">-{stats.removed}</span>{/if}
              </span>
            </button>
            <button
              onclick={() => stageFileAction(file.path)}
              title="Stage"
              class="absolute right-1.5 top-1/2 -translate-y-1/2 opacity-0 group-hover:opacity-100
                     size-5 flex items-center justify-center rounded z-10
                     text-[#3fb950] bg-[#3fb950]/10 border border-[#3fb950]/20
                     hover:bg-[#3fb950]/20 transition-all"
            ><Plus class="size-2.5" /></button>
          </div>
        {/each}
      </div>
    </div>
  {/if}
</aside>
