<script lang="ts">
    import { ScrollArea } from "$lib/components/ui/scroll-area";
    import { Separator } from "$lib/components/ui/separator";
    import { store, selectFile } from "$lib/stores/app.svelte";
    import FileItem from "./FileItem.svelte";

    const sortedGroups = $derived(
        Object.entries(store.groupedFiles).sort(([a], [b]) =>
            a.localeCompare(b),
        ),
    );

    function hasWarning(path: string) {
        return (store.context?.scanResults ?? []).some((r) => r.file === path);
    }
</script>

<aside
    class="w-64 shrink-0 border-r border-border bg-sidebar flex flex-col overflow-hidden"
>
    <div class="px-4 py-2.5 shrink-0">
        <span
            class="text-[11px] font-semibold uppercase tracking-wider text-muted-foreground font-sans"
        >
            Files &middot; {store.context?.stagedFiles.length ?? 0}
        </span>
    </div>
    <Separator />

    <ScrollArea class="flex-1 overflow-y-auto">
        <div class="py-1">
            {#each sortedGroups as [dir, files], i}
                {#if i > 0}
                    <Separator class="my-1 opacity-50" />
                {/if}
                <div>
                    {#if dir}
                        <div
                            class="px-3 py-1 text-[11px] text-muted-foreground font-mono truncate select-none"
                        >
                            {dir}/
                        </div>
                    {/if}
                    {#each files as file}
                        <FileItem
                            {file}
                            isSelected={store.selectedFile === file.path}
                            hasWarning={hasWarning(file.path)}
                            onclick={() => selectFile(file.path)}
                        />
                    {/each}
                </div>
            {/each}
        </div>
    </ScrollArea>
</aside>
