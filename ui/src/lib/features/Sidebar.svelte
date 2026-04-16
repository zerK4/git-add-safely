<script lang="ts">
    import { store, selectFile, stageFileAction, unstageFileAction } from "$lib/stores/app.svelte";
    import FileItem from "./FileItem.svelte";
    import { Plus, Minus, CheckCheck, Layers } from "@lucide/svelte";

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

    const stagedFiles = $derived(store.context?.stagedFiles ?? []);
    const unstagedFiles = $derived(store.unstagedFiles);
    const hasBoth = $derived(stagedFiles.length > 0 && unstagedFiles.length > 0);

    function hasWarning(path: string) {
        return (store.context?.scanResults ?? []).some((r) => r.file === path);
    }
</script>

<aside class="w-full border-r border-border bg-sidebar flex flex-col overflow-hidden">

    <!-- Staged section -->
    <div class="flex flex-col min-h-0 flex-1" style={hasBoth ? "max-height: 50%" : ""}>

        <!-- Section header -->
        <div class="flex items-center gap-2 px-3 py-2 shrink-0">
            <CheckCheck class="size-3 text-muted-foreground/50 shrink-0" />
            <span class="text-[10px] font-semibold uppercase tracking-widest text-muted-foreground/60 font-sans flex-1">
                Staged
            </span>
            <span class="text-[10px] font-mono text-muted-foreground/40 tabular-nums">{stagedFiles.length}</span>
            {#if store.watchMode && stagedFiles.length > 0}
                <button
                    class="flex items-center justify-center w-4 h-4 rounded text-muted-foreground/40
                           hover:text-destructive hover:bg-destructive/10 transition-colors disabled:opacity-30"
                    title="Unstage all"
                    disabled={loadingAll}
                    onclick={unstageAll}
                >
                    <Minus class="size-2.5" />
                </button>
            {/if}
        </div>

        <!-- File list -->
        <div class="flex-1 overflow-y-auto min-h-0">
            {#if stagedFiles.length === 0}
                <div class="px-3 py-2 text-[11px] text-muted-foreground/35 font-sans italic">
                    No staged files
                </div>
            {:else}
                <div class="pb-1">
                    {#each stagedFiles as file (file.path)}
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
            {/if}
        </div>
    </div>

    <!-- Changes section — watch mode only, when there are unstaged files -->
    {#if store.watchMode && unstagedFiles.length > 0}

        <!-- Divider between sections -->
        <div class="shrink-0 border-t border-border/60 mx-3"></div>

        <div class="flex flex-col min-h-0 flex-1" style={hasBoth ? "max-height: 50%" : ""}>

            <!-- Section header -->
            <div class="flex items-center gap-2 px-3 py-2 shrink-0">
                <Layers class="size-3 text-muted-foreground/50 shrink-0" />
                <span class="text-[10px] font-semibold uppercase tracking-widest text-muted-foreground/60 font-sans flex-1">
                    Changes
                </span>
                <span class="text-[10px] font-mono text-muted-foreground/40 tabular-nums">{unstagedFiles.length}</span>
                <button
                    class="flex items-center justify-center w-4 h-4 rounded text-muted-foreground/40
                           hover:text-status-good hover:bg-status-good/10 transition-colors disabled:opacity-30"
                    title="Stage all"
                    disabled={loadingAll}
                    onclick={stageAll}
                >
                    <Plus class="size-2.5" />
                </button>
            </div>

            <!-- File list -->
            <div class="flex-1 overflow-y-auto min-h-0">
                <div class="pb-1">
                    {#each unstagedFiles as file (file.path)}
                        <FileItem
                            {file}
                            isSelected={store.selectedFile === file.path && !store.selectedFileStaged}
                            hasWarning={false}
                            noteCount={0}
                            diffStats={store.diffStats[file.path]}
                            staged={false}
                            watchMode={true}
                            onclick={() => selectFile(file.path, false)}
                            onStage={() => stageFileAction(file.path)}
                        />
                    {/each}
                </div>
            </div>
        </div>
    {/if}
</aside>
