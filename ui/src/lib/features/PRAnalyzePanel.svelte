<script lang="ts">
  import { Bot, X, Send, Sparkles, Loader2 } from "@lucide/svelte";
  import { Separator } from "$lib/components/ui/separator";
  import AuroraLoadingBar from "$lib/components/ui/aurora-loading-bar.svelte";
  import { store, closePRAnalyzePanel, sendPRAnalyzeMessage } from "$lib/stores/app.svelte";
  import { tick } from "svelte";

  let inputText = $state("");
  let messagesEl = $state<HTMLElement | null>(null);

  let panelWidth = $state(420);
  let isResizing = $state(false);

  function startResize(e: MouseEvent) {
    isResizing = true;
    const startX = e.clientX;
    const startWidth = panelWidth;
    function onMove(e: MouseEvent) {
      panelWidth = Math.max(320, Math.min(900, startWidth + (startX - e.clientX)));
    }
    function onUp() {
      isResizing = false;
      window.removeEventListener("mousemove", onMove);
      window.removeEventListener("mouseup", onUp);
    }
    window.addEventListener("mousemove", onMove);
    window.addEventListener("mouseup", onUp);
  }

  $effect(() => {
    const _ = store.prAnalyzeMessages;
    tick().then(() => { if (messagesEl) messagesEl.scrollTop = messagesEl.scrollHeight; });
  });

  async function handleSend() {
    const text = inputText.trim();
    if (!text || store.prAnalyzeStreaming) return;
    inputText = "";
    await sendPRAnalyzeMessage(text);
  }

  function handleKeydown(e: KeyboardEvent) {
    if (e.key === "Enter" && !e.shiftKey) { e.preventDefault(); handleSend(); }
  }

  function renderMarkdown(text: string): string {
    const blocks: string[] = [];
    let s = text.replace(/```[\w]*\n?([\s\S]*?)```/g, (_, code) => {
      const idx = blocks.length;
      blocks.push(`<pre class="bg-muted/60 border border-border rounded px-3 py-2 my-2 text-xs overflow-x-auto whitespace-pre font-mono">${escHtml(code.trim())}</pre>`);
      return `\x00BLOCK${idx}\x00`;
    });
    const lines = s.split("\n");
    const out: string[] = [];
    let i = 0;
    while (i < lines.length) {
      const line = lines[i];
      if (/^### /.test(line)) { out.push(`<h3 class="text-sm font-semibold mt-3 mb-0.5">${inline(line.slice(4))}</h3>`); i++; continue; }
      if (/^## /.test(line))  { out.push(`<h2 class="text-sm font-bold mt-4 mb-0.5">${inline(line.slice(3))}</h2>`); i++; continue; }
      if (/^# /.test(line))   { out.push(`<h1 class="text-base font-bold mt-4 mb-0.5">${inline(line.slice(2))}</h1>`); i++; continue; }
      if (/^---+$/.test(line.trim())) { out.push(`<hr class="border-border my-3">`); i++; continue; }
      if (/^[-*] /.test(line)) {
        const items: string[] = [];
        while (i < lines.length && /^[-*] /.test(lines[i])) { items.push(`<li>${inline(lines[i].slice(2))}</li>`); i++; }
        out.push(`<ul class="list-disc ml-5 my-1 space-y-0.5">${items.join("")}</ul>`);
        continue;
      }
      if (/^\d+\. /.test(line)) {
        const items: string[] = [];
        while (i < lines.length && /^\d+\. /.test(lines[i])) { items.push(`<li>${inline(lines[i].replace(/^\d+\. /, ""))}</li>`); i++; }
        out.push(`<ol class="list-decimal ml-5 my-1 space-y-0.5">${items.join("")}</ol>`);
        continue;
      }
      if (line.trim() === "") { out.push(`<div class="h-2"></div>`); i++; continue; }
      out.push(`<p class="leading-relaxed">${inline(line)}</p>`);
      i++;
    }
    let result = out.join("");
    result = result.replace(/\x00BLOCK(\d+)\x00/g, (_, idx) => blocks[parseInt(idx)]);
    return result;
  }

  function inline(s: string): string {
    return s
      .replace(/`([^`]+)`/g, (_, c) => `<code class="bg-muted/60 border border-border rounded px-1 py-0.5 text-xs font-mono">${escHtml(c)}</code>`)
      .replace(/\*\*(.+?)\*\*/g, "<strong>$1</strong>")
      .replace(/\*(.+?)\*/g, "<em>$1</em>");
  }

  function escHtml(s: string): string {
    return s.replace(/&/g, "&amp;").replace(/</g, "&lt;").replace(/>/g, "&gt;");
  }
</script>

<!-- Resize handle -->
<div
  class="w-1 shrink-0 cursor-col-resize hover:bg-primary/40 active:bg-primary/60 transition-colors {isResizing ? 'bg-primary/60' : 'bg-border'}"
  onmousedown={startResize}
  role="separator"
  aria-orientation="vertical"
></div>

<div class="flex flex-col shrink-0 border-l border-border bg-card overflow-hidden" style="width: {panelWidth}px">
  <!-- Header -->
  <div class="flex items-center gap-2 px-4 py-2.5 bg-card shrink-0">
    <Sparkles class="size-3.5 text-primary shrink-0" />
    <span class="text-xs font-semibold text-foreground flex-1">PR Analysis</span>
    <button
      class="flex items-center justify-center w-6 h-6 rounded hover:bg-muted text-muted-foreground hover:text-foreground transition-colors"
      onclick={closePRAnalyzePanel}
    >
      <X class="size-3.5" />
    </button>
  </div>

  <!-- Aurora bar -->
  <div class="relative h-px shrink-0">
    <AuroraLoadingBar active={store.prAnalyzeStreaming} />
    {#if !store.prAnalyzeStreaming}
      <div class="absolute inset-0 bg-border"></div>
    {/if}
  </div>

  <!-- Messages -->
  <div bind:this={messagesEl} class="flex-1 overflow-y-auto px-4 py-3 space-y-4 diff-scroll">
    {#if store.prAnalyzeMessages.length === 0}
      <div class="flex flex-col items-center justify-center h-full gap-3 text-center py-10">
        <Bot class="size-8 text-muted-foreground/30" />
        <p class="text-xs text-muted-foreground font-sans">Claude will analyze the PR review conversation.</p>
      </div>
    {/if}

    {#each store.prAnalyzeMessages as msg}
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
            {#if store.prAnalyzeStreaming && msg.content === ""}
              <Loader2 class="size-2.5 animate-spin text-primary ml-0.5" />
            {/if}
          </div>
          <div class="text-xs text-foreground font-sans leading-relaxed">
            {#if msg.content}
              {@html renderMarkdown(msg.content)}
            {:else if store.prAnalyzeStreaming}
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
        placeholder={store.prAnalyzeStreaming ? "Claude is thinking..." : "Ask a follow-up question..."}
        rows={1}
        disabled={store.prAnalyzeStreaming}
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
               disabled:opacity-30 disabled:cursor-not-allowed transition-colors"
        disabled={store.prAnalyzeStreaming || !inputText.trim()}
        onclick={handleSend}
      >
        <Send class="size-3" />
      </button>
    </div>
    <p class="text-[10px] text-muted-foreground/50 mt-1 font-sans">Enter to send · Shift+Enter for newline</p>
  </div>
</div>
