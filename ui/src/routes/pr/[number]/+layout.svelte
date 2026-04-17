<script lang="ts">
  import { page } from "$app/stores";
  import { enterPRMode, store } from "$lib/stores/app.svelte";
  import { fetchPRInfo } from "$lib/api/client";
  import { Loader2 } from "@lucide/svelte";

  let { children } = $props();

  const prNumber = $derived(parseInt($page.params.number));

  let loading = $state(false);
  let error = $state<string | null>(null);

  $effect(() => {
    const num = prNumber;
    if (!num || isNaN(num)) return;
    // Already loaded this PR
    if (store.activePR === num && store.prData) return;

    loading = true;
    error = null;
    fetchPRInfo().then((res) => {
      const pr = (res.prs ?? []).find(p => p.number === num);
      if (!pr) { error = `PR #${num} not found`; return; }
      const files = pr.diff
        ? [...pr.diff.matchAll(/^diff --git a\/(.+?) b\/.+$/gm)].map(m => m[1])
        : [];
      return enterPRMode(num, files, pr.diff, pr);
    }).catch(e => {
      error = e.message;
    }).finally(() => {
      loading = false;
    });
  });
</script>

{#if loading}
  <div class="flex items-center justify-center flex-1 gap-2 text-muted-foreground text-sm">
    <Loader2 class="size-4 animate-spin" />
    Loading PR #{prNumber}…
  </div>
{:else if error}
  <div class="flex items-center justify-center flex-1 text-red-400 text-sm">{error}</div>
{:else}
  {@render children()}
{/if}
