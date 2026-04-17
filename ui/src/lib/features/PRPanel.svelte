<script lang="ts">
  import { fetchPRInfo } from "$lib/api/client";
  import type { PRInfo } from "$lib/api/client";
  import { store, exitPRMode } from "$lib/stores/app.svelte";
  import { goto } from "$app/navigation";
  import { GitPullRequest, FileCode, ArrowLeft, CheckCircle, XCircle, Clock, MessageSquare, Code, MessageCircle } from "@lucide/svelte";

  let loading = $state(true);
  let ghMissing = $state(false);
  let prs = $state<PRInfo[]>([]);

  $effect(() => {
    fetchPRInfo().then((res) => {
      loading = false;
      if (res.ghMissing) { ghMissing = true; return; }
      prs = res.prs ?? [];
    });
  });

  function openPR(pr: PRInfo) {
    goto(`/pr/${pr.number}`);
  }

  function formatDate(iso: string) {
    try { return new Date(iso).toLocaleDateString(undefined, { month: "short", day: "numeric" }); }
    catch { return iso; }
  }

  function reviewIcon(state: string) {
    if (state === "APPROVED") return "approved";
    if (state === "CHANGES_REQUESTED") return "changes";
    return "pending";
  }

  function threadCountForFile(file: string): number {
    const threads = store.prReviewThreads[file];
    if (!threads) return 0;
    return Object.values(threads).reduce((sum, arr) => sum + arr.length, 0);
  }
</script>

<aside class="w-full border-r border-border bg-sidebar flex flex-col overflow-hidden text-sm">
  {#if loading}
    <div class="flex items-center justify-center flex-1 text-muted-foreground/40 text-xs">Loading…</div>

  {:else if ghMissing}
    <div class="flex flex-col gap-2 p-4 text-xs text-muted-foreground">
      <GitPullRequest class="size-4 text-muted-foreground/40" />
      <p class="font-medium text-foreground/70">GitHub CLI not found</p>
      <p>Install <code class="bg-muted px-1 rounded">gh</code> to see PR info:</p>
      <code class="bg-muted px-2 py-1 rounded text-[10px] select-all">brew install gh && gh auth login</code>
    </div>

  {:else if store.prMode}
    <!-- PR file browser mode -->
    <div class="flex items-center gap-2 px-3 py-2 shrink-0 border-b border-border/60">
      <button
        class="flex items-center justify-center w-5 h-5 rounded text-muted-foreground/50 hover:text-foreground hover:bg-muted/50 transition-colors"
        onclick={() => { exitPRMode(); goto('/'); }}
        title="Back to PR list"
      >
        <ArrowLeft class="size-3.5" />
      </button>
      <span class="text-[10px] font-semibold uppercase tracking-widest text-muted-foreground/60 flex-1 truncate">
        #{store.activePR}
      </span>
    </div>

    <!-- Code / Conversation tabs -->
    <div class="flex shrink-0 border-b border-border/60 px-2 pt-1 gap-0.5">
      <button
        class="flex items-center gap-1.5 px-3 py-1.5 text-[11px] font-medium rounded-t transition-colors
               {store.prView === 'code'
                 ? 'text-foreground border-b-2 border-primary bg-accent/30'
                 : 'text-muted-foreground/60 hover:text-muted-foreground hover:bg-accent/20'}"
        onclick={() => goto(`/pr/${store.activePR}`)}
      >
        <Code class="size-3" />
        Code
      </button>
      <button
        class="flex items-center gap-1.5 px-3 py-1.5 text-[11px] font-medium rounded-t transition-colors
               {store.prView === 'conversation'
                 ? 'text-foreground border-b-2 border-primary bg-accent/30'
                 : 'text-muted-foreground/60 hover:text-muted-foreground hover:bg-accent/20'}"
        onclick={() => goto(`/pr/${store.activePR}/conversation`)}
      >
        <MessageCircle class="size-3" />
        Conversation
      </button>
    </div>

    {#if store.prView === "conversation"}
      <div class="flex items-center justify-center flex-1 text-muted-foreground/40 text-xs italic">
        Loading in main area…
      </div>
    {:else}
    <div class="flex-1 overflow-y-auto min-h-0 py-1">
      {#each store.prFiles as file}
        {@const threadCount = threadCountForFile(file)}
        {@const stats = store.prFileStats[file]}
        <button
          class="w-full flex items-center gap-2 px-3 py-1.5 text-left transition-colors
                 {store.prSelectedFile === file
                   ? 'bg-accent text-accent-foreground'
                   : 'text-muted-foreground hover:bg-accent/50 hover:text-foreground'}"
          onclick={() => goto(`/pr/${store.activePR}/files/${file}`)}
        >
          <FileCode class="size-3 shrink-0 opacity-50" />
          <span class="text-[11px] font-mono truncate flex-1">{file}</span>
          <span class="flex items-center gap-1.5 shrink-0">
            {#if threadCount > 0}
              <span class="flex items-center gap-0.5 text-[9px] text-primary/60">
                <MessageSquare class="size-2.5" />{threadCount}
              </span>
            {/if}
            {#if stats}
              <span class="text-[9px] font-mono text-status-good/70">+{stats.added}</span>
              <span class="text-[9px] font-mono text-destructive/70">-{stats.removed}</span>
            {/if}
          </span>
        </button>
      {/each}
    </div>
    {/if}

  {:else if prs.length === 0}
    <div class="flex flex-col items-center justify-center flex-1 gap-2 text-muted-foreground/40">
      <GitPullRequest class="size-5" />
      <span class="text-xs">No open PRs for this branch</span>
    </div>

  {:else}
    <!-- PR list -->
    <div class="flex items-center gap-2 px-3 py-2 shrink-0">
      <span class="text-[10px] font-semibold uppercase tracking-widest text-muted-foreground/60">Pull Requests</span>
    </div>
    <div class="flex-1 overflow-y-auto min-h-0 flex flex-col gap-1 px-2 pb-2">
      {#each prs as pr}
        <button
          class="w-full text-left rounded-lg p-3 border border-border/40 bg-background/20 hover:bg-accent/30 hover:border-border transition-colors"
          onclick={() => openPR(pr)}
        >
          <div class="flex items-start gap-2">
            <GitPullRequest class="size-3.5 text-status-good mt-0.5 shrink-0" />
            <div class="flex-1 min-w-0">
              <div class="text-[11px] font-medium text-foreground leading-snug truncate">{pr.title}</div>
              <div class="text-[10px] text-muted-foreground/60 mt-0.5">
                #{pr.number} · {pr.author.login} · {formatDate(pr.createdAt)}
              </div>
              {#if pr.reviews.length > 0}
                <div class="flex items-center gap-1 mt-1.5">
                  {#each pr.reviews.slice(0, 4) as review}
                    {#if reviewIcon(review.state) === "approved"}
                      <CheckCircle class="size-3 text-status-good" />
                    {:else if reviewIcon(review.state) === "changes"}
                      <XCircle class="size-3 text-destructive" />
                    {:else}
                      <Clock class="size-3 text-muted-foreground/40" />
                    {/if}
                  {/each}
                </div>
              {/if}
            </div>
          </div>
        </button>
      {/each}
    </div>
  {/if}
</aside>
