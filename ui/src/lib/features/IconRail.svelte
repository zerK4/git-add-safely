<script lang="ts">
    import { Files, GitPullRequest, Archive } from "@lucide/svelte";

    interface Props {
        activePanel: "files" | "pr" | "stash";
        onSelect: (panel: "files" | "pr" | "stash") => void;
    }

    let { activePanel, onSelect }: Props = $props();
</script>

<div class="flex flex-col items-center gap-1 py-2 w-10 shrink-0 border-r border-border bg-sidebar">
    <button
        class="flex items-center justify-center w-7 h-7 rounded transition-colors
               {activePanel === 'files'
                 ? 'bg-primary/15 text-primary'
                 : 'text-muted-foreground/40 hover:text-muted-foreground hover:bg-muted/50'}"
        title="Files"
        onclick={() => onSelect("files")}
    >
        <Files class="size-4" />
    </button>

    <button
        class="flex items-center justify-center w-7 h-7 rounded transition-colors
               {activePanel === 'pr'
                 ? 'bg-primary/15 text-primary'
                 : 'text-muted-foreground/40 hover:text-muted-foreground hover:bg-muted/50'}"
        title="Pull Request"
        onclick={() => onSelect("pr")}
    >
        <GitPullRequest class="size-4" />
    </button>

    <button
        class="flex items-center justify-center w-7 h-7 rounded transition-colors
               {activePanel === 'stash'
                 ? 'bg-primary/15 text-primary'
                 : 'text-muted-foreground/40 hover:text-muted-foreground hover:bg-muted/50'}"
        title="Stashes"
        onclick={() => onSelect("stash")}
    >
        <Archive class="size-4" />
    </button>
</div>
