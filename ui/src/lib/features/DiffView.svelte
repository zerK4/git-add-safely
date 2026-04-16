<script lang="ts">
    import { AlignLeft, Columns2, Loader2, AlertTriangle, Bot } from "@lucide/svelte";
    import { Button } from "$lib/components/ui/button";
    import { Separator } from "$lib/components/ui/separator";
    import { store, setDiffMode, startReview, openClaudePanel } from "$lib/stores/app.svelte";
    import DiffLine from "./DiffLine.svelte";
    import SplitDiffLine from "./SplitDiffLine.svelte";
    import WarningPhantomHunk from "./WarningPhantomHunk.svelte";

    const fileWarnings = $derived(
        store.selectedFile
            ? (store.context?.scanResults ?? []).filter((r) => r.file === store.selectedFile)
            : []
    );

    // Lines that actually appear in the diff
    const diffLineNumbers = $derived(
        new Set(
            store.parsedDiff?.hunks.flatMap((h) =>
                h.lines.flatMap((l) => [l.oldLineNo, l.newLineNo].filter((n) => n !== null))
            ) ?? []
        )
    );

    // Warnings whose line is NOT visible in the diff — need phantom hunks
    const phantomWarnings = $derived(
        fileWarnings.filter((w) => !diffLineNumbers.has(w.line))
    );
</script>

<div class="flex flex-col flex-1 overflow-hidden">
    <!-- Toolbar -->
    <div class="flex items-center gap-3 px-4 py-2 bg-card shrink-0">
        <span class="font-mono text-xs text-muted-foreground truncate flex-1">
            {store.selectedFile ?? ""}
        </span>
        <div class="flex items-center gap-1 shrink-0">
            <Button
                variant={store.diffMode === "unified" ? "secondary" : "ghost"}
                size="sm"
                class="h-7 px-2 text-xs gap-1.5"
                onclick={() => setDiffMode("unified")}
            >
                <AlignLeft class="size-3" />
                Unified
            </Button>
            <Button
                variant={store.diffMode === "split" ? "secondary" : "ghost"}
                size="sm"
                class="h-7 px-2 text-xs gap-1.5"
                onclick={() => setDiffMode("split")}
            >
                <Columns2 class="size-3" />
                Split
            </Button>
            <div class="w-px h-4 bg-border mx-1"></div>
            {#if store.claudeStatus === "idle" || store.claudeStatus === "error"}
                <Button
                    variant="ghost"
                    size="sm"
                    class="h-7 px-2 text-xs gap-1.5 text-primary hover:text-primary hover:bg-primary/10 border border-transparent hover:border-primary/25"
                    onclick={() => {
                        if (store.selectedFile && store.rawDiff) {
                            startReview(store.selectedFile, store.rawDiff, fileWarnings);
                        }
                    }}
                    disabled={!store.parsedDiff || store.diffLoading}
                >
                    <Bot class="size-3" />
                    Review with Claude
                </Button>
            {:else}
                <Button
                    variant="ghost"
                    size="sm"
                    class="h-7 px-2 text-xs gap-1.5 text-primary hover:text-primary hover:bg-primary/10"
                    onclick={openClaudePanel}
                >
                    <Bot class="size-3" />
                    {store.claudeStatus === "working" ? "Claude working..." : "View review"}
                </Button>
            {/if}
        </div>
    </div>
    <Separator />

    <!-- Warning banner for this file -->
    {#each fileWarnings as warning}
        <div class="flex items-center gap-3 px-4 py-2 bg-status-warn/8 border-b border-status-warn/20 shrink-0">
            <AlertTriangle class="size-3.5 text-status-warn shrink-0" />
            <span class="text-[11px] font-semibold bg-status-warn/20 text-status-warn border border-status-warn/30 px-1.5 py-0.5 rounded font-sans">
                {warning.pattern}
            </span>
            <span class="text-xs text-status-warn/80 font-sans">
                Line {warning.line} — <code class="font-mono text-status-warn">{warning.content}</code>
            </span>
        </div>
    {/each}

    <!-- Content -->
    {#if store.diffLoading}
        <div
            class="flex items-center justify-center h-40 gap-2 text-muted-foreground text-sm"
        >
            <Loader2 class="size-4 animate-spin" />
            Loading diff...
        </div>
    {:else if !store.parsedDiff || store.parsedDiff.hunks.length === 0}
        <div
            class="flex items-center justify-center h-40 text-muted-foreground text-sm font-sans"
        >
            No changes to display
        </div>
    {:else}
        <div class="diff-scroll flex-1 overflow-auto bg-background">
            <div class="min-w-max">
                {#if store.diffMode === "unified"}
                    {#each store.parsedDiff.hunks as hunk}
                        <div class="flex items-center text-xs font-mono bg-primary/5 border-y border-primary/10 px-4 py-0.5 text-primary/50 select-none">
                            {hunk.header}
                        </div>
                        {#each hunk.lines as line}
                            <DiffLine {line} />
                        {/each}
                    {/each}
                {:else if store.splitRows}
                    {#each store.splitRows as hunkRows, i}
                        <div class="flex items-center text-xs font-mono bg-primary/5 border-y border-primary/10 px-4 py-0.5 text-primary/50 select-none">
                            {store.parsedDiff.hunks[i]?.header ?? ""}
                        </div>
                        {#each hunkRows as row}
                            <SplitDiffLine {row} />
                        {/each}
                    {/each}
                {/if}

                <!-- Phantom hunks: warnings on lines not visible in diff -->
                {#each phantomWarnings as warning}
                    <WarningPhantomHunk {warning} />
                {/each}
            </div>
        </div>
    {/if}
</div>
