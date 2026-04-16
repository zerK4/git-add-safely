<script lang="ts">
  import { store } from "$lib/stores/app.svelte";
  import DiffView from "./DiffView.svelte";
  import WarningsPanel from "./WarningsPanel.svelte";
  import ClaudePanel from "./ClaudePanel.svelte";
  import HistoryPanel from "./HistoryPanel.svelte";
  import ReviewAllView from "./ReviewAllView.svelte";

  let { historyOpen = false, onCloseHistory }: {
    historyOpen?: boolean;
    onCloseHistory?: () => void;
  } = $props();
</script>

<main class="flex-1 flex overflow-hidden min-w-0">
  <!-- Main content area -->
  {#if store.reviewAllOpen && !store.reviewAllPinned}
    <!-- Review All occupies full center -->
    <ReviewAllView />
  {:else if store.selectedFile}
    <DiffView />
  {:else}
    <WarningsPanel />
  {/if}

  <!-- Right panels (order: Claude → ReviewAll pinned → History) -->
  {#if store.claudePanelOpen}
    <ClaudePanel />
  {/if}

  {#if store.reviewAllOpen && store.reviewAllPinned}
    <ReviewAllView />
  {/if}

  {#if historyOpen}
    <HistoryPanel onClose={onCloseHistory} />
  {/if}
</main>
