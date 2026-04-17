<script lang="ts">
  import { page } from "$app/stores";
  import { selectFile, store } from "$lib/stores/app.svelte";
  import DiffView from "$lib/features/DiffView.svelte";
  import { onMount } from "svelte";

  const filePath = $derived($page.params.path);

  $effect(() => {
    if (filePath) selectFile(filePath, true);
  });

  onMount(() => {
    const hash = window.location.hash.slice(1);
    if (hash) {
      const line = parseInt(hash);
      if (!isNaN(line)) {
        // Scroll after diff loads
        const unsub = $effect.root(() => {
          $effect(() => {
            if (!store.diffLoading) {
              setTimeout(() => {
                const el = document.querySelector(`[data-line="${line}"]`);
                el?.scrollIntoView({ block: "center" });
              }, 100);
            }
          });
          return () => {};
        });
        // Cleanup after 5s max
        setTimeout(unsub, 5000);
      }
    }
  });
</script>

<DiffView />
