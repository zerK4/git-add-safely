<script lang="ts">
    import { loadContext, store } from "$lib/stores/app.svelte";
    import Header from "$lib/features/Header.svelte";
    import Sidebar from "$lib/features/Sidebar.svelte";
    import MainArea from "$lib/features/MainArea.svelte";
    import Footer from "$lib/features/Footer.svelte";
    import { Loader2 } from "@lucide/svelte";

    $effect(() => {
        loadContext();
    });
</script>

<div
    class="dark h-screen flex flex-col bg-background text-foreground overflow-hidden!"
>
    {#if store.contextLoading}
        <div
            class="flex items-center justify-center h-full gap-2 text-muted-foreground text-sm"
        >
            <Loader2 class="size-4 animate-spin" />
            Loading...
        </div>
    {:else if store.contextError}
        <div
            class="flex items-center justify-center h-full text-red-400 text-sm"
        >
            Failed to load: {store.contextError}
        </div>
    {:else}
        <Header />
        <div class="flex flex-1 overflow-hidden">
            <Sidebar />
            <MainArea />
        </div>
        <Footer />
    {/if}
</div>
