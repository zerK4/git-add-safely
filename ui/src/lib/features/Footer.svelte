<script lang="ts">
  import { Check, X, Sparkles, GitCommit, GitBranch, Loader2, CheckCircle } from "@lucide/svelte";
  import { Button } from "$lib/components/ui/button";
  import { Separator } from "$lib/components/ui/separator";
  import { Badge } from "$lib/components/ui/badge";
  import { approve, cancel, store } from "$lib/stores/app.svelte";
  import { postCommit, postPush } from "$lib/api/client";
  import ClaudeStatusBar from "./ClaudeStatusBar.svelte";

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

<div>
  <Separator />
  <footer class="px-5 py-3 bg-card">

    <!-- Commit message area -->
    <div class="mb-3">
      <div class="flex items-center gap-2 mb-1.5">
        <span class="text-[11px] font-semibold uppercase tracking-wider text-muted-foreground font-sans">Commit message</span>
        <Button
          variant="ghost"
          size="sm"
          class="h-6 px-2 text-[11px] gap-1 text-primary/70 hover:text-primary ml-auto"
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
        class="w-full text-xs font-mono bg-input border border-input rounded px-3 py-2 resize-none focus:outline-none focus:ring-1 focus:ring-primary/50 text-foreground placeholder:text-muted-foreground/40 min-h-[56px]"
        placeholder="feat(scope): describe your changes…"
        rows={2}
        bind:value={commitMessage}
      ></textarea>
      {#if errorMsg}
        <p class="text-[11px] text-destructive mt-1 font-sans">{errorMsg}</p>
      {:else if successMsg}
        <p class="text-[11px] text-status-good mt-1 font-sans flex items-center gap-1">
          <CheckCircle class="size-3" />{successMsg}
        </p>
      {/if}
    </div>

    <!-- Actions row -->
    <div class="flex items-center gap-2">
      <ClaudeStatusBar />
      <span class="text-xs text-muted-foreground font-sans mr-auto">
        {fileCount} file{fileCount !== 1 ? "s" : ""} staged
        {#if store.warningCount > 0}
          &middot;
          <Badge variant="destructive" class="text-[10px] px-1.5 py-0 h-4 ml-1">
            {store.warningCount} warning{store.warningCount !== 1 ? "s" : ""}
          </Badge>
        {/if}
      </span>
      <Button variant="outline" size="sm" class="gap-1.5" onclick={handleCancel}>
        <X class="size-3.5" />
        Cancel
      </Button>
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
        Commit only
      </Button>
      <Button
        size="sm"
        class="gap-1.5 bg-status-good hover:bg-status-good/80 text-background"
        disabled={!commitMessage.trim() || committing || pushing}
        onclick={handleCommitAndPush}
      >
        {#if pushing}
          <Loader2 class="size-3.5 animate-spin" />
        {:else}
          <GitBranch class="size-3.5" />
        {/if}
        Commit &amp; Push → <span class="font-mono opacity-80">{branch}</span>
      </Button>
    </div>

  </footer>
</div>
