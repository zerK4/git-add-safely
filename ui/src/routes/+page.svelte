<script lang="ts">
  import WarningsPanel from "$lib/features/WarningsPanel.svelte";
  import UserStatsPanel from "$lib/features/UserStatsPanel.svelte";
</script>

<div class="flex flex-col h-full w-full overflow-hidden">
  <UserStatsPanel />
  <div class="border-t border-border flex-1 overflow-hidden">
    <WarningsPanel />
  </div>
</div>
