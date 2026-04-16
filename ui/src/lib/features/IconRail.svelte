<script lang="ts">
    import { Files, GitPullRequest } from "@lucide/svelte";

    interface Props {
        activePanel: "files" | "pr";
        onSelect: (panel: "files" | "pr") => void;
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
</div>
