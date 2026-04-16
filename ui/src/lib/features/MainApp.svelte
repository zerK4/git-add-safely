<script lang="ts">
    import Header from "./Header.svelte";
    import Sidebar from "./Sidebar.svelte";
    import PRPanel from "./PRPanel.svelte";
    import IconRail from "./IconRail.svelte";
    import MainArea from "./MainArea.svelte";
    import Footer from "./Footer.svelte";

    let historyOpen = $state(false);
    let activePanel = $state<"files" | "pr">("files");
    let sidebarWidth = $state(224); // w-56 = 224px default
    const MIN_WIDTH = 160;
    const MAX_WIDTH = 480;

    let dragging = $state(false);

    function onDragStart(e: MouseEvent) {
        e.preventDefault();
        dragging = true;

        function onMove(e: MouseEvent) {
            // Subtract icon rail width (40px) from clientX
            sidebarWidth = Math.min(MAX_WIDTH, Math.max(MIN_WIDTH, e.clientX - 40));
        }
        function onUp() {
            dragging = false;
            window.removeEventListener("mousemove", onMove);
            window.removeEventListener("mouseup", onUp);
        }
        window.addEventListener("mousemove", onMove);
        window.addEventListener("mouseup", onUp);
    }
</script>

<Header onToggleHistory={() => (historyOpen = !historyOpen)} />
<div class="flex flex-1 overflow-hidden">
    <!-- Icon rail -->
    <IconRail {activePanel} onSelect={(p) => (activePanel = p)} />

    <!-- Content sidebar + drag handle -->
    <div class="flex shrink-0" style="width: {sidebarWidth}px">
        {#if activePanel === "files"}
            <Sidebar />
        {:else}
            <PRPanel />
        {/if}
        <!-- Drag handle -->
        <div
            class="w-1 shrink-0 cursor-col-resize group relative z-10 -mr-px
                   {dragging ? 'bg-primary/40' : 'hover:bg-primary/30'} transition-colors"
            onmousedown={onDragStart}
            role="separator"
            aria-orientation="vertical"
        >
            <div class="absolute inset-y-0 -left-0.5 -right-0.5"></div>
        </div>
    </div>
    <MainArea {historyOpen} onCloseHistory={() => (historyOpen = false)} />
</div>
<Footer />
