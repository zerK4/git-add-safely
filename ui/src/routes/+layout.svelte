<script lang="ts">
  import { loadContext, store, setPRView } from "$lib/stores/app.svelte";
  import { page } from "$app/stores";
  import { Loader2 } from "@lucide/svelte";
  import "../app.css";
  import Header from "$lib/features/Header.svelte";
  import IconRail from "$lib/features/IconRail.svelte";
  import Sidebar from "$lib/features/Sidebar.svelte";
  import PRPanel from "$lib/features/PRPanel.svelte";
  import StashPanel from "$lib/features/StashPanel.svelte";
  import Footer from "$lib/features/Footer.svelte";
  import ClaudePanel from "$lib/features/ClaudePanel.svelte";
  import PRAnalyzePanel from "$lib/features/PRAnalyzePanel.svelte";
  import HistoryPanel from "$lib/features/HistoryPanel.svelte";
  import ReviewAllView from "$lib/features/ReviewAllView.svelte";

  $effect(() => { loadContext(); });

  // Sync prView with URL
  $effect(() => {
    const path = $page.url.pathname;
    if (path.includes('/conversation')) setPRView('conversation');
    else if (path.match(/\/pr\/\d+/)) setPRView('code');
  });

  let { children } = $props();

  let historyOpen = $state(false);
  let activePanel = $state<"files" | "pr" | "stash">("files");
  let sidebarWidth = $state(224);
  const MIN_WIDTH = 160;
  const MAX_WIDTH = 480;
  let dragging = $state(false);

  function onDragStart(e: MouseEvent) {
    e.preventDefault();
    dragging = true;
    function onMove(e: MouseEvent) {
      sidebarWidth = Math.min(MAX_WIDTH, Math.max(MIN_WIDTH, e.clientX - 40));
    }
    function onUp() {
      dragging = false;
      window.removeEventListener("mousemove", onMove);
      window.removeEventListener("mouseup", onUp);
    }
    window.addEventListener("mousemove", onMove);
    window.addEventListener("mouseup", onUp);
  }
</script>

<div class="dark h-screen flex flex-col bg-background text-foreground overflow-hidden!">
  {#if store.contextLoading}
    <div class="flex items-center justify-center h-full gap-2 text-muted-foreground text-sm">
      <Loader2 class="size-4 animate-spin" />
      Loading...
    </div>
  {:else if store.contextError}
    <div class="flex items-center justify-center h-full text-red-400 text-sm">
      Failed to load: {store.contextError}
    </div>
  {:else}
    <Header onToggleHistory={() => (historyOpen = !historyOpen)} />
    <div class="flex flex-1 overflow-hidden">
      <!-- Icon rail -->
      <IconRail {activePanel} onSelect={(p) => (activePanel = p)} />

      <!-- Sidebar + drag handle -->
      <div class="flex shrink-0" style="width: {sidebarWidth}px">
        {#if activePanel === "files"}
          <Sidebar />
        {:else if activePanel === "pr"}
          <PRPanel />
        {:else}
          <StashPanel />
        {/if}
        <div
          class="w-1 shrink-0 cursor-col-resize group relative z-10 -mr-px
                 {dragging ? 'bg-primary/40' : 'hover:bg-primary/30'} transition-colors"
          onmousedown={onDragStart}
          role="separator"
          aria-orientation="vertical"
        >
          <div class="absolute inset-y-0 -left-0.5 -right-0.5"></div>
        </div>
      </div>

      <!-- Main content area -->
      <main class="flex-1 flex overflow-hidden min-w-0">
        {#if store.reviewAllOpen && !store.reviewAllPinned}
          <ReviewAllView />
        {:else}
          {@render children()}
        {/if}

        {#if store.claudePanelOpen}
          <ClaudePanel />
        {/if}

        {#if store.prAnalyzePanelOpen}
          <PRAnalyzePanel />
        {/if}

        {#if store.reviewAllOpen && store.reviewAllPinned}
          <ReviewAllView />
        {/if}

        {#if historyOpen}
          <HistoryPanel onClose={() => (historyOpen = false)} />
        {/if}
      </main>
    </div>
    <Footer />
  {/if}
</div>
