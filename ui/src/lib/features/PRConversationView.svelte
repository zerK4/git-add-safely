<script lang="ts">
  import { store } from "$lib/stores/app.svelte";
  import { marked } from "marked";
  import { GitPullRequest, CheckCircle, XCircle, MessageSquare, Reply, ExternalLink, FileCode, GitCommit, Eye } from "@lucide/svelte";
  import type { PRReviewComment, PRTimelineEvent } from "$lib/api/client";

  const pr = $derived(store.prData);

  function formatDate(iso: string) {
    if (!iso) return "";
    const d = new Date(iso);
    if (isNaN(d.getTime())) return "";
    const now = new Date();
    const todayStart = new Date(now.getFullYear(), now.getMonth(), now.getDate()).getTime();
    const dStart = new Date(d.getFullYear(), d.getMonth(), d.getDate()).getTime();
    const days = Math.round((todayStart - dStart) / 86400000);
    if (days === 0) return "today";
    if (days === 1) return "yesterday";
    if (days < 30) return `${days}d ago`;
    return d.toLocaleDateString(undefined, { month: "short", day: "numeric" });
  }

  function initials(login: string) {
    return (login ?? "?").slice(0, 2).toUpperCase();
  }

  function avatarUrl(login: string) {
    if (!login || login === "unknown" || login === "?" || /\s/.test(login)) return null;
    return `https://github.com/${login}.png?size=56`;
  }

  function reviewStateColor(state: string) {
    if (state === "APPROVED") return "text-status-good border-status-good/30 bg-status-good/10";
    if (state === "CHANGES_REQUESTED") return "text-destructive border-destructive/30 bg-destructive/10";
    return "text-muted-foreground/50 border-border bg-muted/20";
  }

  function reviewStateLabel(state: string) {
    if (state === "APPROVED") return "Approved";
    if (state === "CHANGES_REQUESTED") return "Changes requested";
    return "Reviewed";
  }

  type FeedItem =
    | { type: "review"; date: string; data: any }
    | { type: "comment"; date: string; data: any }
    | { type: "thread"; date: string; parent: PRReviewComment; replies: PRReviewComment[] }
    | { type: "event"; date: string; data: PRTimelineEvent };

  function buildFeed(pr: NonNullable<typeof store.prData>): FeedItem[] {
    const items: FeedItem[] = [];

    for (const r of pr.reviews ?? []) {
      if (r.body?.trim()) {
        items.push({ type: "review", date: r.submittedAt ?? r.createdAt ?? "", data: r });
      }
    }

    for (const c of pr.comments ?? []) {
      items.push({ type: "comment", date: c.createdAt ?? "", data: c });
    }

    const reviewComments: PRReviewComment[] = pr.reviewComments ?? [];
    const parents = reviewComments.filter(c => !c.inReplyToId);
    const repliesMap = new Map<number, PRReviewComment[]>();
    for (const c of reviewComments) {
      if (c.inReplyToId) {
        const arr = repliesMap.get(c.inReplyToId) ?? [];
        arr.push(c);
        repliesMap.set(c.inReplyToId, arr);
      }
    }
    for (const parent of parents) {
      const replies = (repliesMap.get(parent.id) ?? [])
        .sort((a, b) => new Date(a.createdAt).getTime() - new Date(b.createdAt).getTime());
      items.push({ type: "thread", date: parent.createdAt, parent, replies });
    }

    for (const e of pr.timelineEvents ?? []) {
      items.push({ type: "event", date: e.createdAt, data: e });
    }

    return items.sort((a, b) => new Date(a.date).getTime() - new Date(b.date).getTime());
  }

  // Build feed: reviews (with body) + PR-level comments + review threads (grouped parent+replies)
  const feed = $derived(pr ? buildFeed(pr) : []);

  // Reply state keyed by comment id
  let replyOpen = $state<Record<number | string, boolean>>({});
  let replyText = $state<Record<number | string, string>>({});
  let replying = $state<Record<number | string, boolean>>({});

  async function submitThreadReply(parentId: number) {
    if (!replyText[parentId]?.trim() || store.activePR === null) return;
    replying[parentId] = true;
    await fetch("/api/pr-reply", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ pr: store.activePR, commentId: parentId, body: replyText[parentId].trim() }),
    });
    replyText[parentId] = "";
    replyOpen[parentId] = false;
    replying[parentId] = false;
  }

  async function submitCommentReply(key: string) {
    if (!replyText[key]?.trim() || store.activePR === null) return;
    replying[key] = true;
    await fetch("/api/pr-comment", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ pr: store.activePR, body: replyText[key].trim() }),
    });
    replyText[key] = "";
    replyOpen[key] = false;
    replying[key] = false;
  }

  let newComment = $state("");
  let postingComment = $state(false);

  async function postComment() {
    if (!newComment.trim() || store.activePR === null) return;
    postingComment = true;
    await fetch("/api/pr-comment", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ pr: store.activePR, body: newComment.trim() }),
    });
    newComment = "";
    postingComment = false;
  }

  function md(body: string) {
    return marked.parse(body ?? "") as string;
  }
</script>

<div class="flex flex-col flex-1 overflow-hidden min-w-0 bg-background">
  {#if !pr}
    <div class="flex items-center justify-center flex-1 text-muted-foreground/40 text-sm">No PR selected</div>
  {:else}
    <!-- Header -->
    <div class="flex items-center gap-3 px-6 py-3 bg-card border-b border-border shrink-0">
      <GitPullRequest class="size-4 text-status-good shrink-0" />
      <div class="flex-1 min-w-0">
        <span class="text-sm font-semibold text-foreground">{pr.title}</span>
        <span class="text-xs text-muted-foreground/60 ml-2">#{pr.number}</span>
      </div>
      <a href={pr.url} target="_blank" rel="noopener"
        class="text-muted-foreground/40 hover:text-muted-foreground transition-colors shrink-0">
        <ExternalLink class="size-3.5" />
      </a>
    </div>

    <!-- Feed -->
    <div class="flex-1 overflow-y-auto min-h-0 px-6 py-4" style="height:0">
      <div class="relative">
        <div class="absolute left-3.5 top-2 bottom-2 w-px bg-border/30"></div>

        <div class="flex flex-col gap-5">
          {#each feed as item}
            {@const avatarLogin = item.type === "thread" ? item.parent.author : item.type === "event" ? item.data.actor : (item.data.author?.login ?? item.data.author ?? "?")}
            {@const avatarDisplayName = item.type === "event" ? (item.data.actorName ?? item.data.actor) : avatarLogin}
            {@const avatarImg = avatarUrl(avatarLogin)}
            <div class="flex {item.type === 'event' ? 'items-center' : 'items-start'} gap-4">

              <!-- Avatar dot -->
              <div class="shrink-0 relative z-10 {item.type !== 'event' ? 'mt-0.5' : ''}">
                {#if item.type === "event"}
                  <div class="relative size-7">
                    {#if avatarImg}
                      <img src={avatarImg} alt={avatarLogin} class="size-7 rounded-full object-cover" style="border: 1px solid rgba(84,153,232,0.25);" />
                    {:else}
                      <div class="size-7 rounded-full flex items-center justify-center text-[10px] font-bold"
                        style="background: rgba(84,153,232,0.15); border: 1px solid rgba(84,153,232,0.25); color: #5499e8;">
                        {initials(avatarDisplayName)}
                      </div>
                    {/if}
                    <div class="absolute -bottom-0.5 -right-0.5 size-3.5 rounded-full flex items-center justify-center"
                      style="background:#0d1117; border: 1px solid rgba(255,255,255,0.1);">
                      {#if item.data.event === "committed"}
                        <GitCommit class="size-2 text-muted-foreground/60" />
                      {:else}
                        <Eye class="size-2 text-muted-foreground/60" />
                      {/if}
                    </div>
                  </div>
                {:else if avatarImg}
                  <img src={avatarImg} alt={avatarLogin} class="size-7 rounded-full object-cover" style="border: 1px solid rgba(84,153,232,0.25);" />
                {:else}
                  <div class="size-7 rounded-full flex items-center justify-center text-[10px] font-bold"
                    style="background: rgba(84,153,232,0.15); border: 1px solid rgba(84,153,232,0.25); color: #5499e8;">
                    {initials(avatarDisplayName)}
                  </div>
                {/if}
              </div>

              <!-- Content -->
              <div class="flex-1 min-w-0">

                {#if item.type === "review"}
                  <!-- Review with body -->
                  {@const key = `review-${item.data.id ?? item.date}`}
                  <div class="flex items-center gap-2 mb-1.5">
                    <span class="text-xs font-semibold text-foreground/80">{item.data.author?.login}</span>
                    <span class="text-[10px] px-1.5 py-0.5 rounded border font-medium {reviewStateColor(item.data.state)}">
                      {reviewStateLabel(item.data.state)}
                    </span>
                    <span class="text-[10px] text-muted-foreground/40">{formatDate(item.date)}</span>
                  </div>
                  <div class="rounded-xl overflow-hidden" style="background:#161c26;border:1px solid rgba(255,255,255,0.07);box-shadow:0 1px 3px rgba(0,0,0,0.3);">
                    <div class="px-4 py-3 prose-note">{@html md(item.data.body)}</div>
                    <div style="border-top:1px solid rgba(255,255,255,0.05);" class="px-4 py-2">
                      {#if replyOpen[key]}
                        <textarea class="w-full bg-muted/30 border border-border rounded p-2 text-xs text-foreground resize-none focus:outline-none focus:border-primary/50" rows="2" placeholder="Write a reply…" bind:value={replyText[key]}></textarea>
                        <div class="flex gap-2 mt-1.5">
                          <button class="text-[11px] px-3 py-1 rounded bg-primary/20 border border-primary/40 text-primary hover:bg-primary/30 transition-colors disabled:opacity-50" onclick={() => submitCommentReply(key)} disabled={replying[key] || !replyText[key]?.trim()}>Reply</button>
                          <button class="text-[11px] px-3 py-1 rounded text-muted-foreground hover:text-foreground" onclick={() => { replyOpen[key] = false; replyText[key] = ""; }}>Cancel</button>
                        </div>
                      {:else}
                        <button class="flex items-center gap-1.5 text-[11px] text-muted-foreground/50 hover:text-muted-foreground transition-colors" onclick={() => (replyOpen[key] = true)}>
                          <Reply class="size-3" />Reply
                        </button>
                      {/if}
                    </div>
                  </div>

                {:else if item.type === "comment"}
                  <!-- PR-level comment -->
                  {@const key = `comment-${item.data.id ?? item.date}`}
                  <div class="flex items-center gap-2 mb-1.5">
                    <span class="text-xs font-semibold text-foreground/80">{item.data.author?.login}</span>
                    <span class="flex items-center gap-1 text-[10px] text-muted-foreground/50"><MessageSquare class="size-2.5" />commented</span>
                    <span class="text-[10px] text-muted-foreground/40">{formatDate(item.date)}</span>
                  </div>
                  {#if item.data.body?.trim()}
                    <div class="rounded-xl overflow-hidden" style="background:#161c26;border:1px solid rgba(255,255,255,0.07);box-shadow:0 1px 3px rgba(0,0,0,0.3);">
                      <div class="px-4 py-3 prose-note">{@html md(item.data.body)}</div>
                      <div style="border-top:1px solid rgba(255,255,255,0.05);" class="px-4 py-2">
                        {#if replyOpen[key]}
                          <textarea class="w-full bg-muted/30 border border-border rounded p-2 text-xs text-foreground resize-none focus:outline-none focus:border-primary/50" rows="2" placeholder="Write a reply…" bind:value={replyText[key]}></textarea>
                          <div class="flex gap-2 mt-1.5">
                            <button class="text-[11px] px-3 py-1 rounded bg-primary/20 border border-primary/40 text-primary hover:bg-primary/30 transition-colors disabled:opacity-50" onclick={() => submitCommentReply(key)} disabled={replying[key] || !replyText[key]?.trim()}>Reply</button>
                            <button class="text-[11px] px-3 py-1 rounded text-muted-foreground hover:text-foreground" onclick={() => { replyOpen[key] = false; replyText[key] = ""; }}>Cancel</button>
                          </div>
                        {:else}
                          <button class="flex items-center gap-1.5 text-[11px] text-muted-foreground/50 hover:text-muted-foreground transition-colors" onclick={() => (replyOpen[key] = true)}>
                            <Reply class="size-3" />Reply
                          </button>
                        {/if}
                      </div>
                    </div>
                  {/if}

                {:else if item.type === "thread"}
                  <!-- Review thread (inline code comment + replies) -->
                  <div class="flex items-center gap-2 mb-1.5">
                    <span class="text-xs font-semibold text-foreground/80">{item.parent.author}</span>
                    <span class="flex items-center gap-1 text-[10px] text-muted-foreground/50"><FileCode class="size-2.5" />{item.parent.path?.split("/").pop() ?? item.parent.path}</span>
                    <span class="text-[10px] text-muted-foreground/40">{formatDate(item.date)}</span>
                  </div>
                  <div class="rounded-xl overflow-hidden" style="background:#161c26;border:1px solid rgba(255,255,255,0.07);box-shadow:0 1px 3px rgba(0,0,0,0.3);">
                    <!-- Diff hunk snippet -->
                    {#if item.parent.diffHunk}
                      <div class="px-3 py-2 overflow-x-auto" style="background:rgba(0,0,0,0.25);border-bottom:1px solid rgba(255,255,255,0.06);">
                        <pre class="text-[10px] font-mono text-muted-foreground/60 whitespace-pre leading-relaxed">{item.parent.diffHunk.split("\n").slice(-4).join("\n")}</pre>
                      </div>
                    {/if}
                    <!-- Parent comment -->
                    <div style="border-bottom:1px solid rgba(255,255,255,0.05);" class="px-4 py-3 prose-note">
                      {@html md(item.parent.body)}
                    </div>
                    <!-- Replies -->
                    {#each item.replies as reply}
                      {@const replyImg = avatarUrl(reply.author)}
                      <div class="flex items-start gap-3 px-4 py-2.5" style="border-bottom:1px solid rgba(255,255,255,0.04);">
                        {#if replyImg}
                          <img src={replyImg} alt={reply.author} class="size-5 rounded-full object-cover shrink-0 mt-0.5" style="border:1px solid rgba(84,153,232,0.2);" />
                        {:else}
                          <div class="size-5 rounded-full flex items-center justify-center text-[9px] font-bold shrink-0 mt-0.5"
                            style="background:rgba(84,153,232,0.1);border:1px solid rgba(84,153,232,0.2);color:#5499e8;">
                            {initials(reply.author)}
                          </div>
                        {/if}
                        <div class="flex-1 min-w-0">
                          <div class="flex items-center gap-2 mb-1">
                            <span class="text-[11px] font-semibold text-foreground/80">{reply.author}</span>
                            <span class="text-[10px] text-muted-foreground/40">{formatDate(reply.createdAt)}</span>
                          </div>
                          <div class="prose-note text-[12px]">{@html md(reply.body)}</div>
                        </div>
                      </div>
                    {/each}
                    <!-- Reply box -->
                    <div class="px-4 py-2">
                      {#if replyOpen[item.parent.id]}
                        <textarea class="w-full bg-muted/30 border border-border rounded p-2 text-xs text-foreground resize-none focus:outline-none focus:border-primary/50" rows="2" placeholder="Write a reply…" bind:value={replyText[item.parent.id]}></textarea>
                        <div class="flex gap-2 mt-1.5">
                          <button class="text-[11px] px-3 py-1 rounded bg-primary/20 border border-primary/40 text-primary hover:bg-primary/30 transition-colors disabled:opacity-50" onclick={() => submitThreadReply(item.parent.id)} disabled={replying[item.parent.id] || !replyText[item.parent.id]?.trim()}>Reply</button>
                          <button class="text-[11px] px-3 py-1 rounded text-muted-foreground hover:text-foreground" onclick={() => { replyOpen[item.parent.id] = false; replyText[item.parent.id] = ""; }}>Cancel</button>
                        </div>
                      {:else}
                        <button class="flex items-center gap-1.5 text-[11px] text-muted-foreground/50 hover:text-muted-foreground transition-colors" onclick={() => (replyOpen[item.parent.id] = true)}>
                          <Reply class="size-3" />Reply
                        </button>
                      {/if}
                    </div>
                  </div>
                {:else if item.type === "event"}
                  {@const e = item.data}
                  <div class="flex items-center gap-2">
                    {#if e.event === "committed"}
                      <span class="text-xs text-muted-foreground/70 font-mono">{e.sha}</span>
                      <span class="text-xs text-muted-foreground/60 truncate">{e.message}</span>
                      <span class="text-[10px] text-muted-foreground/40">{formatDate(e.createdAt)}</span>
                    {:else if e.event === "review_requested"}
                      <span class="text-xs text-muted-foreground/80"><span class="font-semibold">{e.actor}</span> requested a review from <span class="font-semibold">{e.requestedReviewer}</span></span>
                      <span class="text-[10px] text-muted-foreground/40">{formatDate(e.createdAt)}</span>
                    {:else if e.event === "review_request_removed"}
                      <span class="text-xs text-muted-foreground/60"><span class="font-semibold">{e.actor}</span> removed review request from <span class="font-semibold">{e.requestedReviewer}</span></span>
                      <span class="text-[10px] text-muted-foreground/40">{formatDate(e.createdAt)}</span>
                    {/if}
                  </div>

                {/if}

              </div>
            </div>
          {/each}

          {#if feed.length === 0}
            <div class="flex items-center justify-center py-12 text-muted-foreground/40 text-xs">No conversation yet.</div>
          {/if}
        </div>
      </div>
    </div>

    <!-- New comment -->
    <div class="shrink-0 border-t border-border px-6 py-4 bg-card">
      <textarea class="w-full bg-muted/20 border border-border rounded-xl p-3 text-xs text-foreground resize-none focus:outline-none focus:border-primary/40 transition-colors" rows="3" placeholder="Leave a comment…" bind:value={newComment}></textarea>
      <div class="flex justify-end mt-2">
        <button class="text-xs px-4 py-1.5 rounded-lg bg-primary/20 border border-primary/40 text-primary hover:bg-primary/30 transition-colors disabled:opacity-40" onclick={postComment} disabled={postingComment || !newComment.trim()}>
          {postingComment ? "Posting…" : "Comment"}
        </button>
      </div>
    </div>
  {/if}
</div>

<style>
  .prose-note :global(p) { font-size: 0.875rem; line-height: 1.6; color: rgba(226,232,240,0.85); margin: 0 0 0.5rem 0; }
  .prose-note :global(p:last-child) { margin-bottom: 0; }
  .prose-note :global(code) { font-size: 0.8rem; background: rgba(255,255,255,0.07); border: 1px solid rgba(255,255,255,0.08); border-radius: 4px; padding: 0.1em 0.4em; color: #93c5fd; font-family: ui-monospace, monospace; }
  .prose-note :global(pre) { background: rgba(0,0,0,0.3); border: 1px solid rgba(255,255,255,0.07); border-radius: 8px; padding: 0.75rem 1rem; overflow-x: auto; margin: 0.5rem 0; }
  .prose-note :global(pre code) { background: none; border: none; padding: 0; color: #e2e8f0; }
  .prose-note :global(strong) { color: #e2e8f0; font-weight: 600; }
  .prose-note :global(em) { color: rgba(226,232,240,0.75); }
  .prose-note :global(ul), .prose-note :global(ol) { padding-left: 1.25rem; margin: 0.25rem 0; color: rgba(226,232,240,0.85); font-size: 0.875rem; line-height: 1.6; }
  .prose-note :global(li) { margin: 0.1rem 0; }
  .prose-note :global(blockquote) { border-left: 3px solid rgba(255,255,255,0.15); padding-left: 0.75rem; margin: 0.5rem 0; color: rgba(226,232,240,0.55); font-style: italic; }
</style>
