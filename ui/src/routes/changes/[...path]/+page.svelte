<script lang="ts">
  import { page } from "$app/stores";
  import { selectFile } from "$lib/stores/app.svelte";
  import DiffView from "$lib/features/DiffView.svelte";

  const filePath = $derived($page.params.path);

  $effect(() => {
    if (filePath) selectFile(filePath, false);
  });
</script>

<DiffView />
