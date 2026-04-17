<script lang="ts">
  import { page } from "$app/stores";
  import { selectPRFile, store } from "$lib/stores/app.svelte";
  import PRDiffView from "$lib/features/PRDiffView.svelte";

  const filePath = $derived($page.params.path);

  $effect(() => {
    if (filePath && store.activePR !== null) selectPRFile(filePath);
  });
</script>

<PRDiffView />
