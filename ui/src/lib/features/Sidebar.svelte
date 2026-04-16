<script lang="ts">
    import { ScrollArea } from "$lib/components/ui/scroll-area";
    import { Separator } from "$lib/components/ui/separator";
    import { store, selectFile, stageFileAction, unstageFileAction } from "$lib/stores/app.svelte";
    import FileItem from "./FileItem.svelte";
    import { Plus, Minus } from "@lucide/svelte";

    let loadingAll = $state(false);

    async function stageAll() {
        loadingAll = true;
        await Promise.all(store.unstagedFiles.map(f => stageFileAction(f.path)));
        loadingAll = false;
    }

    async function unstageAll() {
        loadingAll = true;
        await Promise.all((store.context?.stagedFiles ?? []).map(f => unstageFileAction(f.path)));
        loadingAll = false;
    }

    const sortedStagedGroups = $derived(
        Object.entries(
            (store.context?.stagedFiles ?? []).reduce<Record<string, typeof store.context.stagedFiles>>((map, f) => {
                const parts = f.path.split("/");
                const dir = parts.length > 1 ? parts.slice(0, -1).join("/") : "";
                if (!map[dir]) map[dir] = [];
                map[dir].push(f);
                return map;
            }, {})
        ).sort(([a], [b]) => a.localeCompare(b))
    );

    const sortedUnstagedGroups = $derived(
        Object.entries(
            store.unstagedFiles.reduce<Record<string, typeof store.unstagedFiles>>((map, f) => {
                const parts = f.path.split("/");
                const dir = parts.length > 1 ? parts.slice(0, -1).join("/") : "";
                if (!map[dir]) map[dir] = [];
                map[dir].push(f);
                return map;
            }, {})
        ).sort(([a], [b]) => a.localeCompare(b))
    );

    function hasWarning(path: string) {
        return (store.context?.scanResults ?? []).some((r) => r.file === path);
    }
</script>

<aside class="w-64 shrink-0 border-r border-border bg-sidebar flex flex-col overflow-hidden">

    <!-- Staged section -->
    <div class="flex flex-col min-h-0" style="max-height: 50%;">
        <div class="px-4 py-2.5 shrink-0 flex items-center justify-between">
            <span class="text-[11px] font-semibold uppercase tracking-wider text-muted-foreground font-sans">
                Staged &middot; {store.context?.stagedFiles.length ?? 0}
            </span>
            {#if store.watchMode && (store.context?.stagedFiles.length ?? 0) > 0}
                <button
                    class="flex items-center justify-center w-5 h-5 rounded text-muted-foreground/50 hover:text-destructive hover:bg-destructive/10 transition-colors disabled:opacity-30"
                    title="Unstage all"
                    disabled={loadingAll}
                    onclick={unstageAll}
                >
                    <Minus class="size-3" />
                </button>
            {/if}
        </div>
        <Separator />
        <ScrollArea class="min-h-0 overflow-y-auto">
            <div class="py-1">
                {#each sortedStagedGroups as [dir, files], i}
                    {#if i > 0}
                        <Separator class="my-1 opacity-50" />
                    {/if}
                    <div>
                        {#if dir}
                            <div class="px-3 py-1 text-[11px] text-muted-foreground font-mono truncate select-none">
                                {dir}/
                            </div>
                        {/if}
                        {#each files as file}
                            <FileItem
                                {file}
                                isSelected={store.selectedFile === file.path && store.selectedFileStaged}
                                hasWarning={hasWarning(file.path)}
                                noteCount={store.noteCountsByFile[file.path] ?? 0}
                                diffStats={store.diffStats[file.path]}
                                staged={true}
                                watchMode={store.watchMode}
                                onclick={() => selectFile(file.path, true)}
                                onUnstage={store.watchMode ? () => unstageFileAction(file.path) : undefined}
                            />
                        {/each}
                    </div>
                {/each}
                {#if (store.context?.stagedFiles.length ?? 0) === 0}
                    <div class="px-4 py-3 text-xs text-muted-foreground/60 font-sans italic">
                        No staged files
                    </div>
                {/if}
            </div>
        </ScrollArea>
    </div>

    <!-- Unstaged section — only in watch mode -->
    {#if store.watchMode && store.unstagedFiles.length > 0}
        <Separator />
        <div class="flex flex-col min-h-0" style="max-height: 50%;">
            <div class="px-4 py-2.5 shrink-0 flex items-center justify-between">
                <span class="text-[11px] font-semibold uppercase tracking-wider text-muted-foreground font-sans">
                    Changes &middot; {store.unstagedFiles.length}
                </span>
                <button
                    class="flex items-center justify-center w-5 h-5 rounded text-muted-foreground/50 hover:text-status-good hover:bg-status-good/10 transition-colors disabled:opacity-30"
                    title="Stage all"
                    disabled={loadingAll}
                    onclick={stageAll}
                >
                    <Plus class="size-3" />
                </button>
            </div>
            <Separator />
            <ScrollArea class="min-h-0 overflow-y-auto">
                <div class="py-1">
                    {#each sortedUnstagedGroups as [dir, files], i}
                        {#if i > 0}
                            <Separator class="my-1 opacity-50" />
                        {/if}
                        <div>
                            {#if dir}
                                <div class="px-3 py-1 text-[11px] text-muted-foreground font-mono truncate select-none">
                                    {dir}/
                                </div>
                            {/if}
                            {#each files as file}
                                <FileItem
                                    {file}
                                    isSelected={store.selectedFile === file.path && !store.selectedFileStaged}
                                    hasWarning={false}
                                    noteCount={0}
                                    staged={false}
                                    watchMode={true}
                                    onclick={() => selectFile(file.path, false)}
                                    onStage={() => stageFileAction(file.path)}
                                />
                            {/each}
                        </div>
                    {/each}
                </div>
            </ScrollArea>
        </div>
    {/if}
</aside>
