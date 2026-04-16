<script lang="ts">
    import Router from "svelte-spa-router";
    import { loadContext, store } from "$lib/stores/app.svelte";
    import { Loader2 } from "@lucide/svelte";
    import MainApp from "$lib/features/MainApp.svelte";
    import SettingsPage from "$lib/features/SettingsPage.svelte";

    const routes = {
        "/": MainApp,
        "/settings": SettingsPage,
    };

    $effect(() => {
        loadContext();
    });
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
        <Router {routes} />
    {/if}
</div>
