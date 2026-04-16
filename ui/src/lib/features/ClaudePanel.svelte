<script lang="ts">
  import { Bot, X, Send, Save, Loader2 } from "@lucide/svelte";
  import { Button } from "$lib/components/ui/button";
  import { Separator } from "$lib/components/ui/separator";
  import AuroraLoadingBar from "$lib/components/ui/aurora-loading-bar.svelte";
  import { store, closeClaudePanel, sendChatMessage, saveReviewToFile } from "$lib/stores/app.svelte";
  import { tick } from "svelte";

  let inputText = $state("");
  let messagesEl = $state<HTMLElement | null>(null);
  let saveStatus = $state<"idle" | "saving" | "saved">("idle");

  // Resize state
  let panelWidth = $state(420);
  let isResizing = $state(false);

  function startResize(e: MouseEvent) {
    isResizing = true;
    const startX = e.clientX;
    const startWidth = panelWidth;

    function onMove(e: MouseEvent) {
      const delta = startX - e.clientX; // dragging left = wider
      panelWidth = Math.max(320, Math.min(900, startWidth + delta));
    }

    function onUp() {
      isResizing = false;
      window.removeEventListener("mousemove", onMove);
      window.removeEventListener("mouseup", onUp);
    }

    window.addEventListener("mousemove", onMove);
    window.addEventListener("mouseup", onUp);
  }

  // Auto-scroll to bottom when new content arrives
  $effect(() => {
    const msgs = store.chatMessages;
    const streaming = store.chatStreaming;
    tick().then(() => {
      if (messagesEl) {
        messagesEl.scrollTop = messagesEl.scrollHeight;
      }
    });
  });

  async function handleSend() {
    const text = inputText.trim();
    if (!text || store.chatStreaming) return;
    inputText = "";
    await sendChatMessage(text);
  }

  function handleKeydown(e: KeyboardEvent) {
    if (e.key === "Enter" && !e.shiftKey) {
      e.preventDefault();
      handleSend();
    }
  }

  async function handleSave() {
    saveStatus = "saving";
    await saveReviewToFile();
    saveStatus = "saved";
    setTimeout(() => (saveStatus = "idle"), 2500);
  }

  function renderMarkdown(text: string): string {
    // Extract code blocks first to protect them from other transforms
    const blocks: string[] = [];
    let s = text.replace(/```[\w]*\n?([\s\S]*?)```/g, (_, code) => {
      const idx = blocks.length;
      blocks.push(`<pre class="bg-muted/60 border border-border rounded px-3 py-2 my-2 text-xs overflow-x-auto whitespace-pre font-mono">${escHtml(code.trim())}</pre>`);
      return `\x00BLOCK${idx}\x00`;
    });

    // Process line by line for block-level elements
    const lines = s.split("\n");
    const out: string[] = [];
    let i = 0;
    while (i < lines.length) {
      const line = lines[i];

      // Headings
      if (/^### /.test(line)) { out.push(`<h3 class="text-sm font-semibold mt-3 mb-0.5">${inlineMarkdown(line.slice(4))}</h3>`); i++; continue; }
      if (/^## /.test(line))  { out.push(`<h2 class="text-sm font-bold mt-4 mb-0.5">${inlineMarkdown(line.slice(3))}</h2>`); i++; continue; }
      if (/^# /.test(line))   { out.push(`<h1 class="text-base font-bold mt-4 mb-0.5">${inlineMarkdown(line.slice(2))}</h1>`); i++; continue; }

      // HR
      if (/^---+$/.test(line.trim())) { out.push(`<hr class="border-border my-3">`); i++; continue; }

      // Unordered list — collect consecutive items
      if (/^[-*] /.test(line)) {
        const items: string[] = [];
        while (i < lines.length && /^[-*] /.test(lines[i])) {
          items.push(`<li>${inlineMarkdown(lines[i].slice(2))}</li>`);
          i++;
        }
        out.push(`<ul class="list-disc ml-5 my-1 space-y-0.5">${items.join("")}</ul>`);
        continue;
      }

      // Ordered list — collect consecutive items
      if (/^\d+\. /.test(line)) {
        const items: string[] = [];
        while (i < lines.length && /^\d+\. /.test(lines[i])) {
          items.push(`<li>${inlineMarkdown(lines[i].replace(/^\d+\. /, ""))}</li>`);
          i++;
        }
        out.push(`<ol class="list-decimal ml-5 my-1 space-y-0.5">${items.join("")}</ol>`);
        continue;
      }

      // Blank line → paragraph break
      if (line.trim() === "") { out.push(`<div class="h-2"></div>`); i++; continue; }

      // Normal paragraph line
      out.push(`<p class="leading-relaxed">${inlineMarkdown(line)}</p>`);
      i++;
    }

    // Restore code blocks
    let result = out.join("");
    result = result.replace(/\x00BLOCK(\d+)\x00/g, (_, idx) => blocks[parseInt(idx)]);
    return result;
  }

  function inlineMarkdown(s: string): string {
    return s
      .replace(/`([^`]+)`/g, (_, code) =>
        `<code class="bg-muted/60 border border-border rounded px-1 py-0.5 text-xs font-mono">${escHtml(code)}</code>`
      )
      .replace(/\*\*(.+?)\*\*/g, "<strong>$1</strong>")
      .replace(/\*(.+?)\*/g, "<em>$1</em>");
  }

  function escHtml(s: string): string {
    return s.replace(/&/g, "&amp;").replace(/</g, "&lt;").replace(/>/g, "&gt;");
  }

  const hasReview = $derived(
    store.chatMessages.some((m) => m.role === "assistant" && m.content.trim().length > 0)
  );
</script>

<!-- Resize handle (left edge) -->
<div
  class="w-1 shrink-0 cursor-col-resize hover:bg-primary/40 active:bg-primary/60 transition-colors {isResizing ? 'bg-primary/60' : 'bg-border'}"
  onmousedown={startResize}
  role="separator"
  aria-orientation="vertical"
></div>

<div
  class="flex flex-col shrink-0 border-l border-border bg-card overflow-hidden"
  style="width: {panelWidth}px"
>
  <!-- Header -->
  <div class="relative flex flex-col px-4 pt-2.5 pb-2 bg-card shrink-0">
    <!-- Row 1: title + actions -->
    <div class="flex items-center gap-2">
      <Bot class="size-3.5 text-primary shrink-0" />
      <span class="text-xs font-semibold text-foreground flex-1">Claude Review</span>
      <div class="flex items-center gap-1">
        {#if hasReview}
          <Button
            variant="ghost"
            size="sm"
            class="h-6 px-2 text-[10px] gap-1 text-muted-foreground hover:text-foreground"
            onclick={handleSave}
            disabled={saveStatus === "saving"}
          >
            <Save class="size-3" />
            {saveStatus === "saved" ? "Saved!" : saveStatus === "saving" ? "Saving..." : "Save to .reviews/"}
          </Button>
        {/if}
        <button
          class="flex items-center justify-center w-6 h-6 rounded hover:bg-muted text-muted-foreground hover:text-foreground transition-colors"
          onclick={closeClaudePanel}
        >
          <X class="size-3.5" />
        </button>
      </div>
    </div>
    <!-- Row 2: file path -->
    {#if store.reviewedFile}
      <span class="text-[10px] text-muted-foreground font-mono truncate mt-0.5 pl-5">
        {store.reviewedFile}
      </span>
    {/if}
  </div>

  <!-- Aurora bar sits flush under header, above separator -->
  <div class="relative h-px shrink-0">
    <AuroraLoadingBar active={store.chatStreaming} />
    {#if !store.chatStreaming}
      <div class="absolute inset-0 bg-border"></div>
    {/if}
  </div>

  <!-- Messages -->
  <div
    bind:this={messagesEl}
    class="flex-1 overflow-y-auto px-4 py-3 space-y-4 diff-scroll"
  >
    {#if store.chatMessages.length === 0}
      <div class="flex flex-col items-center justify-center h-full gap-3 text-center py-10">
        <Bot class="size-8 text-muted-foreground/30" />
        <p class="text-xs text-muted-foreground font-sans">
          Claude will review the diff and flag any issues.
        </p>
      </div>
    {/if}

    {#each store.chatMessages as msg}
      {#if msg.role === "user"}
        <div class="flex justify-end">
          <div class="max-w-[85%] bg-primary/15 border border-primary/25 rounded-lg px-3 py-2 text-xs text-foreground font-sans whitespace-pre-wrap">
            {msg.content}
          </div>
        </div>
      {:else}
        <div class="flex flex-col gap-1">
          <div class="flex items-center gap-1.5 text-[10px] text-muted-foreground">
            <Bot class="size-3 text-primary" />
            <span>Claude</span>
            {#if msg.streaming}
              <Loader2 class="size-2.5 animate-spin text-primary ml-0.5" />
            {/if}
          </div>
          <div class="text-xs text-foreground font-sans leading-relaxed">
            {#if msg.content}
              <!-- eslint-disable-next-line svelte/no-at-html-tags -->
              {@html renderMarkdown(msg.content)}
            {:else if msg.streaming}
              <span class="inline-block w-1.5 h-3.5 bg-primary/60 animate-pulse rounded-sm"></span>
            {/if}
          </div>
        </div>
      {/if}
    {/each}
  </div>

  <Separator />

  <!-- Input -->
  <div class="px-3 py-2 shrink-0">
    <div class="flex items-end gap-2 bg-muted/40 border border-border rounded-lg px-3 py-2 focus-within:border-primary/50 transition-colors">
      <textarea
        class="flex-1 bg-transparent text-xs text-foreground placeholder:text-muted-foreground resize-none outline-none font-sans leading-relaxed min-h-[20px] max-h-[120px]"
        placeholder={store.chatStreaming ? "Claude is thinking..." : "Ask a follow-up question..."}
        rows={1}
        disabled={store.chatStreaming}
        bind:value={inputText}
        onkeydown={handleKeydown}
        oninput={(e) => {
          const t = e.currentTarget;
          t.style.height = "auto";
          t.style.height = Math.min(t.scrollHeight, 120) + "px";
        }}
      ></textarea>
      <button
        class="flex items-center justify-center w-6 h-6 rounded-md shrink-0
               bg-primary/20 border border-primary/40 text-primary
               hover:bg-primary/35 hover:border-primary/60
               disabled:opacity-30 disabled:cursor-not-allowed
               transition-colors"
        disabled={store.chatStreaming || !inputText.trim()}
        onclick={handleSend}
      >
        <Send class="size-3" />
      </button>
    </div>
    <p class="text-[10px] text-muted-foreground/50 mt-1 font-sans">Enter to send · Shift+Enter for newline</p>
  </div>
</div>
