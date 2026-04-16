<script lang="ts">
    import Header from "./Header.svelte";
    import Sidebar from "./Sidebar.svelte";
    import MainArea from "./MainArea.svelte";
    import Footer from "./Footer.svelte";

    let historyOpen = $state(false);
</script>

<Header onToggleHistory={() => (historyOpen = !historyOpen)} />
<div class="flex flex-1 overflow-hidden">
    <Sidebar />
    <MainArea {historyOpen} onCloseHistory={() => (historyOpen = false)} />
</div>
<Footer />
