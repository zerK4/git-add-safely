<script lang="ts">
  import { Check, X, Sparkles, GitCommit, GitBranch, Loader2, CheckCircle } from "@lucide/svelte";
  import { Button } from "$lib/components/ui/button";
  import { Badge } from "$lib/components/ui/badge";
  import { approve, cancel, store } from "$lib/stores/app.svelte";
  import { postCommit, postPush } from "$lib/api/client";
  import ClaudeStatusBar from "./ClaudeStatusBar.svelte";
  import AuroraLoadingBar from "$lib/components/ui/aurora-loading-bar.svelte";

  let commitMessage = $state("");
  let generating = $state(false);
  let committing = $state(false);
  let pushing = $state(false);
  let errorMsg = $state<string | null>(null);
  let successMsg = $state<string | null>(null);

  const branch = $derived(store.context?.branchName ?? "HEAD");
  const fileCount = $derived(store.context?.stagedFiles.length ?? 0);
  const generateLabel = $derived(
    (() => {
      const settings = store.settings;
      if (!settings) return "Claude";
      const id = settings.featureAssignments.generateCommit;
      if (!id) return "Claude";
      return settings.providers.find((p) => p.id === id)?.name ?? "Claude";
    })()
  );

  async function handleGenerate() {
    generating = true;
    commitMessage = "";
    errorMsg = null;
    successMsg = null;
    try {
      const res = await fetch("/api/generate-commit", { method: "POST" });
      if (!res.ok || !res.body) throw new Error("Request failed");

      const reader = res.body.getReader();
      const decoder = new TextDecoder();
      let buffer = "";

      while (true) {
        const { done, value } = await reader.read();
        if (done) break;
        buffer += decoder.decode(value, { stream: true });
        const lines = buffer.split("\n");
        buffer = lines.pop() ?? "";
        for (const line of lines) {
          if (!line.startsWith("data: ")) continue;
          const data = line.slice(6).trim();
          if (data === "[DONE]") break;
          try {
            const parsed = JSON.parse(data);
            if (parsed.type === "text") commitMessage += parsed.text;
            else if (parsed.type === "error") throw new Error(parsed.error);
          } catch (e) { if (e instanceof Error && e.message) throw e; }
        }
      }
      commitMessage = commitMessage.trim();
    } catch (e) {
      errorMsg = (e as Error).message;
    } finally {
      generating = false;
    }
  }

  async function handleCommit() {
    if (!commitMessage.trim()) return;
    committing = true;
    errorMsg = null;
    successMsg = null;
    try {
      const res = await postCommit(commitMessage.trim());
      if (!res.ok) { errorMsg = res.error ?? "Commit failed"; return; }
      successMsg = "Committed successfully";
      commitMessage = "";
    } catch (e) {
      errorMsg = (e as Error).message;
    } finally {
      committing = false;
    }
  }

  async function handleCommitAndPush() {
    if (!commitMessage.trim()) return;
    committing = true;
    errorMsg = null;
    successMsg = null;
    try {
      const commitRes = await postCommit(commitMessage.trim());
      if (!commitRes.ok) { errorMsg = commitRes.error ?? "Commit failed"; return; }
      pushing = true;
      committing = false;
      const pushRes = await postPush();
      if (!pushRes.ok) { errorMsg = pushRes.error ?? "Push failed"; return; }
      successMsg = `Pushed to ${branch}`;
      commitMessage = "";
    } catch (e) {
      errorMsg = (e as Error).message;
    } finally {
      committing = false;
      pushing = false;
    }
  }

  async function handleCancel() {
    await cancel();
  }
</script>

<div class="relative shrink-0">
  <AuroraLoadingBar active={generating} />

  <footer
    class="bg-card px-4 pt-3 pb-3"
    style="box-shadow: 0 -1px 0 0 var(--border), 0 -8px 24px -4px color-mix(in srgb, var(--background) 60%, transparent);"
  >
    <!-- Textarea zone -->
    <div
      class="relative mb-2.5 rounded-lg transition-all duration-300"
      style={generating
        ? "box-shadow: 0 0 0 1px color-mix(in srgb, var(--primary) 40%, transparent), 0 0 16px 0 color-mix(in srgb, var(--primary) 12%, transparent);"
        : "box-shadow: 0 0 0 1px var(--border);"}
    >
      <!-- Generate button — floats inside top-right of textarea -->
      <div class="absolute top-2 right-2 z-10">
        <Button
          variant="ghost"
          size="sm"
          class="h-6 px-2 gap-1 text-[11px] font-sans {generating ? 'text-primary/60 pointer-events-none' : 'text-muted-foreground hover:text-primary hover:bg-primary/8'}"
          onclick={handleGenerate}
          disabled={generating}
        >
          {#if generating}
            <Loader2 class="size-3 animate-spin" />
            Generating…
          {:else}
            <Sparkles class="size-3" />
            Generate with {generateLabel}
          {/if}
        </Button>
      </div>

      <textarea
        class="w-full text-[13px] font-mono leading-relaxed bg-transparent rounded-lg px-3 pt-2.5 pb-2.5 pr-40 resize-none focus:outline-none text-foreground placeholder:text-muted-foreground/35 min-h-[62px] max-h-[140px]"
        placeholder="feat(scope): describe your changes…"
        rows={3}
        bind:value={commitMessage}
      ></textarea>
    </div>

    <!-- Status line -->
    {#if errorMsg}
      <div class="flex items-center gap-1.5 mb-2 px-1">
        <span class="size-1.5 rounded-full bg-destructive shrink-0"></span>
        <p class="text-[11px] text-destructive font-sans leading-none">{errorMsg}</p>
      </div>
    {:else if successMsg}
      <div class="flex items-center gap-1.5 mb-2 px-1">
        <CheckCircle class="size-3 text-status-good shrink-0" />
        <p class="text-[11px] text-status-good font-sans leading-none">{successMsg}</p>
      </div>
    {/if}

    <!-- Action bar -->
    <div class="flex items-center gap-2">
      <!-- Left: status info -->
      <div class="flex items-center gap-2 mr-auto min-w-0">
        <ClaudeStatusBar />
        <span class="text-[11px] text-muted-foreground font-sans tabular-nums shrink-0">
          {fileCount} file{fileCount !== 1 ? "s" : ""} staged
        </span>
        {#if store.warningCount > 0}
          <Badge variant="destructive" class="text-[10px] px-1.5 py-0 h-4 shrink-0">
            {store.warningCount} warning{store.warningCount !== 1 ? "s" : ""}
          </Badge>
        {/if}
      </div>

      <!-- Right: actions -->
      <div class="flex items-center gap-1.5 shrink-0">
        <Button
          variant="ghost"
          size="sm"
          class="gap-1.5 text-muted-foreground hover:text-foreground"
          onclick={handleCancel}
        >
          <X class="size-3.5" />
          Cancel
        </Button>

        <div class="w-px h-4 bg-border"></div>

        <Button
          variant="outline"
          size="sm"
          class="gap-1.5"
          disabled={!commitMessage.trim() || committing || pushing}
          onclick={handleCommit}
        >
          {#if committing && !pushing}
            <Loader2 class="size-3.5 animate-spin" />
          {:else}
            <GitCommit class="size-3.5" />
          {/if}
          Commit
        </Button>

        <Button
          size="sm"
          class="gap-1.5 bg-status-good hover:bg-status-good/85 text-background border-transparent"
          disabled={!commitMessage.trim() || committing || pushing}
          onclick={handleCommitAndPush}
        >
          {#if pushing}
            <Loader2 class="size-3.5 animate-spin" />
          {:else}
            <GitBranch class="size-3.5" />
          {/if}
          Push
          <span class="font-mono text-[11px] opacity-70 ml-0.5">→ {branch}</span>
        </Button>
      </div>
    </div>

  </footer>
</div>
