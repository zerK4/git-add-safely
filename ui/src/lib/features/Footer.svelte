<script lang="ts">
  import { Check, X } from "@lucide/svelte";
  import { Button } from "$lib/components/ui/button";
  import { Separator } from "$lib/components/ui/separator";
  import { Badge } from "$lib/components/ui/badge";
  import { approve, cancel, store } from "$lib/stores/app.svelte";

  let status = $state<"idle" | "approved" | "cancelled">("idle");

  async function handleApprove() {
    status = "approved";
    await approve();
    setTimeout(() => window.close(), 1800);
  }

  async function handleCancel() {
    status = "cancelled";
    await cancel();
    setTimeout(() => window.close(), 1800);
  }

  const fileCount = $derived(store.context?.stagedFiles.length ?? 0);
</script>

<div>
  <Separator />
  <footer class="flex items-center gap-3 px-5 py-3 bg-card">
    {#if status === "idle"}
      <span class="text-xs text-muted-foreground mr-auto font-sans">
        {fileCount} file{fileCount !== 1 ? "s" : ""} staged
        {#if store.warningCount > 0}
          &middot;
          <Badge variant="destructive" class="text-[10px] px-1.5 py-0 h-4 ml-1">
            {store.warningCount} warning{store.warningCount !== 1 ? "s" : ""}
          </Badge>
        {/if}
      </span>
      <Button variant="outline" size="sm" class="gap-1.5" onclick={handleCancel}>
        <X class="size-3.5" />
        Cancel
      </Button>
      <Button
        size="sm"
        class="gap-1.5 bg-status-good hover:bg-status-good/80 text-background"
        onclick={handleApprove}
      >
        <Check class="size-3.5" />
        Approve &amp; Continue
      </Button>
    {:else if status === "approved"}
      <span class="text-sm text-status-good flex items-center gap-2 mx-auto font-sans">
        <Check class="size-4" />
        Approved — you can close this window
      </span>
    {:else}
      <span class="text-sm text-muted-foreground flex items-center gap-2 mx-auto font-sans">
        <X class="size-4" />
        Cancelled — you can close this window
      </span>
    {/if}
  </footer>
</div>
