<script lang="ts">
  import { store } from "$lib/stores/app.svelte";
  import DiffView from "./DiffView.svelte";
  import WarningsPanel from "./WarningsPanel.svelte";
</script>

<main class="flex-1 flex overflow-hidden">
  {#if store.selectedFile}
    <DiffView />
  {:else}
    <WarningsPanel />
  {/if}
</main>
