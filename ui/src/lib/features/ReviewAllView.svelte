<script lang="ts">
  import { Bot, Play, X, AlertTriangle, Send, Save, Loader2, ArrowLeft, PanelRight, PanelLeft } from "@lucide/svelte";
  import { Button } from "$lib/components/ui/button";
  import { Separator } from "$lib/components/ui/separator";
  import AuroraLoadingBar from "$lib/components/ui/aurora-loading-bar.svelte";
  import { store, closeReviewAll, pinReviewAll, unpinReviewAll } from "$lib/stores/app.svelte";
  import { createConversation, persistMessage, fetchMessages } from "$lib/api/client";
  import type { ChatMessage } from "$lib/types";
  import { tick } from "svelte";

  // --- Phase state ---
  type Phase = "select" | "chat";
  // If loaded from history (store already has messages), go straight to chat
  let phase = $state<Phase>(store.chatMessages.length > 0 ? "chat" : "select");

  // --- Selection state ---
  let selectedFiles = $state<Set<string>>(new Set());
  let userNote = $state("");
  let initialized = $state(false);

  $effect(() => {
    const files = store.context?.stagedFiles ?? [];
    if (files.length > 0 && !initialized) {
      selectedFiles = new Set(files.map((f) => f.path));
      initialized = true;
    }
  });

  function toggleFile(path: string) {
    const next = new Set(selectedFiles);
    next.has(path) ? next.delete(path) : next.add(path);
    selectedFiles = next;
  }

  function toggleAll() {
    const all = store.context?.stagedFiles ?? [];
    selectedFiles = selectedFiles.size === all.length
      ? new Set()
      : new Set(all.map((f) => f.path));
  }

  // --- Chat state ---
  // Seed from store if loaded from history, otherwise start empty
  let messages = $state<ChatMessage[]>(store.chatMessages.length > 0 ? [...store.chatMessages] : []);
  let streaming = $state(false);
  let inputText = $state("");
  let messagesEl = $state<HTMLElement | null>(null);
  let saveStatus = $state<"idle" | "saving" | "saved">("idle");
  let convId = $state<number | null>(store.activeConversationId);

  $effect(() => {
    const _ = messages.length + (messages[messages.length - 1]?.content ?? "");
    tick().then(() => {
      if (messagesEl) messagesEl.scrollTop = messagesEl.scrollHeight;
    });
  });

  // --- SSE stream helper ---
  async function streamSse(url: string, body: object, onText: (t: string) => void) {
    const res = await fetch(url, {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify(body),
    });
    if (!res.ok || !res.body) throw new Error("Request failed");
    const reader = res.body.getReader();
    const dec = new TextDecoder();
    let buf = "";
    while (true) {
      const { done, value } = await reader.read();
      if (done) break;
      buf += dec.decode(value, { stream: true });
      const lines = buf.split("\n");
      buf = lines.pop() ?? "";
      for (const line of lines) {
        if (!line.startsWith("data: ")) continue;
        const data = line.slice(6).trim();
        if (data === "[DONE]") return;
        try {
          const p = JSON.parse(data);
          if (p.type === "text" && p.text) onText(p.text);
        } catch { /* skip */ }
      }
    }
  }

  // --- Start review ---
  async function handleStart() {
    if (selectedFiles.size === 0 || streaming) return;

    phase = "chat";
    streaming = true;
    messages = [{ role: "assistant", content: "", streaming: true }];

    const title = `Review all: ${selectedFiles.size} files`;
    const id = await createConversation([...selectedFiles].join(", "), title);
    convId = id;

    try {
      await streamSse("/api/review-all", { files: [...selectedFiles], userNote }, (text) => {
        messages[0] = { ...messages[0], content: messages[0].content + text };
      });
      messages[0] = { ...messages[0], streaming: false };
      if (convId && messages[0].content) {
        await persistMessage(convId, "assistant", messages[0].content);
      }
    } catch (e) {
      messages[0] = { role: "assistant", content: `Error: ${(e as Error).message}`, streaming: false };
    } finally {
      streaming = false;
    }
  }

  // --- Follow-up chat ---
  async function handleSend() {
    const text = inputText.trim();
    if (!text || streaming) return;
    inputText = "";

    if (convId) await persistMessage(convId, "user", text);

    const assistantIdx = messages.length + 1;
    messages = [...messages, { role: "user", content: text }, { role: "assistant", content: "", streaming: true }];
    streaming = true;

    try {
      await streamSse("/api/review-message", {
        file: "all",
        messages: messages.slice(0, assistantIdx).map((m) => ({ role: m.role, content: m.content })),
      }, (t) => {
        const msgs = [...messages];
        msgs[assistantIdx] = { ...msgs[assistantIdx], content: msgs[assistantIdx].content + t };
        messages = msgs;
      });
      const msgs = [...messages];
      msgs[assistantIdx] = { ...msgs[assistantIdx], streaming: false };
      messages = msgs;
      if (convId && msgs[assistantIdx].content) {
        await persistMessage(convId, "assistant", msgs[assistantIdx].content);
      }
    } catch (e) {
      const msgs = [...messages];
      msgs[assistantIdx] = { role: "assistant", content: `Error: ${(e as Error).message}`, streaming: false };
      messages = msgs;
    } finally {
      streaming = false;
    }
  }

  function handleKeydown(e: KeyboardEvent) {
    if (e.key === "Enter" && !e.shiftKey) { e.preventDefault(); handleSend(); }
  }

  async function handleSave() {
    const content = messages.find((m) => m.role === "assistant")?.content;
    if (!content) return;
    saveStatus = "saving";
    await fetch("/api/review-save", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ file: `all-${[...selectedFiles].length}-files`, content }),
    });
    saveStatus = "saved";
    setTimeout(() => (saveStatus = "idle"), 2500);
  }

  // --- Markdown rendering (same as ClaudePanel) ---
  function renderMarkdown(text: string): string {
    const blocks: string[] = [];
    let s = text.replace(/```[\w]*\n?([\s\S]*?)```/g, (_, code) => {
      const idx = blocks.length;
      blocks.push(`<pre class="bg-muted/60 border border-border rounded px-3 py-2 my-2 text-xs overflow-x-auto whitespace-pre font-mono">${esc(code.trim())}</pre>`);
      return `\x00B${idx}\x00`;
    });
    const lines = s.split("\n");
    const out: string[] = [];
    let i = 0;
    while (i < lines.length) {
      const l = lines[i];
      if (/^### /.test(l)) { out.push(`<h3 class="text-sm font-semibold mt-3 mb-0.5">${inline(l.slice(4))}</h3>`); i++; continue; }
      if (/^## /.test(l))  { out.push(`<h2 class="text-sm font-bold mt-4 mb-0.5">${inline(l.slice(3))}</h2>`); i++; continue; }
      if (/^# /.test(l))   { out.push(`<h1 class="text-base font-bold mt-4 mb-0.5">${inline(l.slice(2))}</h1>`); i++; continue; }
      if (/^---+$/.test(l.trim())) { out.push(`<hr class="border-border my-3">`); i++; continue; }
      if (/^[-*] /.test(l)) {
        const items: string[] = [];
        while (i < lines.length && /^[-*] /.test(lines[i])) { items.push(`<li>${inline(lines[i].slice(2))}</li>`); i++; }
        out.push(`<ul class="list-disc ml-5 my-1 space-y-0.5">${items.join("")}</ul>`);
        continue;
      }
      if (/^\d+\. /.test(l)) {
        const items: string[] = [];
        while (i < lines.length && /^\d+\. /.test(lines[i])) { items.push(`<li>${inline(lines[i].replace(/^\d+\. /, ""))}</li>`); i++; }
        out.push(`<ol class="list-decimal ml-5 my-1 space-y-0.5">${items.join("")}</ol>`);
        continue;
      }
      if (l.trim() === "") { out.push(`<div class="h-2"></div>`); i++; continue; }
      out.push(`<p class="leading-relaxed">${inline(l)}</p>`);
      i++;
    }
    let result = out.join("");
    result = result.replace(/\x00B(\d+)\x00/g, (_, idx) => blocks[parseInt(idx)]);
    return result;
  }

  function inline(s: string): string {
    return s
      .replace(/`([^`]+)`/g, (_, c) => `<code class="bg-muted/60 border border-border rounded px-1 py-0.5 text-xs font-mono">${esc(c)}</code>`)
      .replace(/\*\*(.+?)\*\*/g, "<strong>$1</strong>")
      .replace(/\*(.+?)\*/g, "<em>$1</em>");
  }

  function esc(s: string): string {
    return s.replace(/&/g, "&amp;").replace(/</g, "&lt;").replace(/>/g, "&gt;");
  }

  // --- Resize (when pinned as right panel) ---
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

  // Derived
  const files = $derived(store.context?.stagedFiles ?? []);
  const allSelected = $derived(selectedFiles.size === files.length && files.length > 0);
  const someSelected = $derived(selectedFiles.size > 0 && selectedFiles.size < files.length);
  const warnings = $derived(store.context?.scanResults ?? []);
  const hasReview = $derived(messages.some((m) => m.role === "assistant" && m.content.trim().length > 0));

  function statusLabel(s: string) { return s === "added" ? "A" : s === "deleted" ? "D" : s === "renamed" ? "R" : "M"; }
  function statusTextColor(s: string) {
    return s === "added" ? "text-status-good" : s === "deleted" ? "text-destructive" : s === "renamed" ? "text-primary" : "text-muted-foreground";
  }
  function splitPath(path: string) {
    const idx = path.lastIndexOf("/");
    return idx === -1 ? { dir: "", name: path } : { dir: path.slice(0, idx + 1), name: path.slice(idx + 1) };
  }
</script>

{#if store.reviewAllPinned}
  <!-- Resize handle when pinned as right panel -->
  <div
    class="w-1 shrink-0 cursor-col-resize hover:bg-primary/40 active:bg-primary/60 transition-colors {isResizing ? 'bg-primary/60' : 'bg-border'}"
    onmousedown={startResize}
    role="separator"
    aria-orientation="vertical"
  ></div>
{/if}

<div
  class="flex flex-col overflow-hidden {store.reviewAllPinned ? 'shrink-0 border-l border-border bg-card' : 'flex-1'}"
  style={store.reviewAllPinned ? `width: ${panelWidth}px` : ""}
>
  <!-- Toolbar -->
  <div class="flex items-center gap-2.5 px-4 py-2 bg-card shrink-0">
    <Bot class="size-3.5 text-primary shrink-0" />
    <span class="text-xs font-semibold text-foreground">Review all</span>
    {#if phase === "select"}
      <span class="text-[10px] text-muted-foreground/60">{selectedFiles.size}/{files.length} selected</span>
    {:else}
      <span class="text-[10px] text-muted-foreground/60">{[...selectedFiles].length} files</span>
    {/if}

    <div class="ml-auto flex items-center gap-1">
      {#if phase === "chat" && hasReview}
        <Button
          variant="ghost" size="sm"
          class="h-6 px-2 text-[10px] gap-1 text-muted-foreground hover:text-foreground"
          onclick={handleSave}
          disabled={saveStatus === "saving"}
        >
          <Save class="size-3" />
          {saveStatus === "saved" ? "Saved!" : saveStatus === "saving" ? "Saving..." : "Save to .reviews/"}
        </Button>
      {/if}
      {#if phase === "chat" && !streaming}
        <button
          class="flex items-center gap-1 text-[10px] text-muted-foreground hover:text-foreground px-1.5 py-0.5 rounded hover:bg-muted transition-colors"
          onclick={() => { phase = "select"; messages = []; convId = null; }}
        >
          <ArrowLeft class="size-3" />
          Back
        </button>
      {/if}
      <!-- Pin / unpin toggle -->
      <button
        class="flex items-center justify-center w-6 h-6 rounded hover:bg-muted text-muted-foreground hover:text-foreground transition-colors"
        title={store.reviewAllPinned ? "Move to center" : "Pin to side"}
        onclick={() => store.reviewAllPinned ? unpinReviewAll() : pinReviewAll()}
      >
        {#if store.reviewAllPinned}
          <PanelLeft class="size-3.5" />
        {:else}
          <PanelRight class="size-3.5" />
        {/if}
      </button>
      <button
        class="flex items-center justify-center w-6 h-6 rounded hover:bg-muted text-muted-foreground hover:text-foreground transition-colors"
        onclick={closeReviewAll}
      >
        <X class="size-3.5" />
      </button>
    </div>
  </div>

  <!-- Aurora bar under header when streaming -->
  <div class="relative h-px shrink-0">
    <AuroraLoadingBar active={streaming} />
    {#if !streaming}
      <div class="absolute inset-0 bg-border"></div>
    {/if}
  </div>

  {#if phase === "select"}
    <!-- ── FILE LIST ── -->
    <div class="flex-1 overflow-y-auto diff-scroll py-1">
      <!-- Select all -->
      <div
        class="flex items-center gap-2.5 px-3 py-1 mx-2 rounded cursor-pointer hover:bg-muted/30 transition-colors group"
        role="checkbox"
        aria-checked={allSelected ? "true" : someSelected ? "mixed" : "false"}
        tabindex="0"
        onclick={toggleAll}
        onkeydown={(e) => e.key === " " && toggleAll()}
      >
        <div class="size-3.5 rounded-sm border flex items-center justify-center shrink-0 transition-colors
          {allSelected ? 'bg-primary border-primary' : someSelected ? 'bg-primary/40 border-primary/60' : 'border-muted-foreground/30 group-hover:border-muted-foreground/60'}">
          {#if allSelected}
            <svg class="size-2.5 text-primary-foreground" viewBox="0 0 10 10" fill="none">
              <path d="M2 5l2.5 2.5L8 3" stroke="currentColor" stroke-width="1.5" stroke-linecap="round" stroke-linejoin="round"/>
            </svg>
          {:else if someSelected}
            <div class="w-2 h-0.5 bg-primary-foreground rounded"></div>
          {/if}
        </div>
        <span class="text-[11px] text-muted-foreground font-sans select-none">All files</span>
      </div>

      <div class="h-1"></div>

      {#each files as file}
        {@const hasWarning = warnings.some((w) => w.file === file.path)}
        {@const checked = selectedFiles.has(file.path)}
        {@const { dir, name } = splitPath(file.path)}
        <div
          class="flex items-center gap-2.5 px-3 py-[3px] mx-2 rounded cursor-pointer hover:bg-muted/30 transition-colors group"
          role="checkbox"
          aria-checked={checked}
          tabindex="0"
          onclick={() => toggleFile(file.path)}
          onkeydown={(e) => e.key === " " && toggleFile(file.path)}
        >
          <div class="size-3.5 rounded-sm border flex items-center justify-center shrink-0 transition-colors
            {checked ? 'bg-primary border-primary' : 'border-muted-foreground/30 group-hover:border-muted-foreground/60'}">
            {#if checked}
              <svg class="size-2.5 text-primary-foreground" viewBox="0 0 10 10" fill="none">
                <path d="M2 5l2.5 2.5L8 3" stroke="currentColor" stroke-width="1.5" stroke-linecap="round" stroke-linejoin="round"/>
              </svg>
            {/if}
          </div>
          <span class="text-[10px] font-bold font-mono w-3 shrink-0 {statusTextColor(file.status)}">{statusLabel(file.status)}</span>
          <span class="text-xs font-mono flex-1 truncate min-w-0">
            {#if dir}<span class="text-muted-foreground/50">{dir}</span>{/if}<span class="text-foreground">{name}</span>
          </span>
          {#if hasWarning}
            <AlertTriangle class="size-3 text-status-warn shrink-0 opacity-70" />
          {/if}
        </div>
      {/each}
    </div>

    <Separator />

    <!-- Bottom: note + start -->
    <div class="px-3 py-2.5 bg-card shrink-0 flex flex-col gap-2">
      <textarea
        class="w-full bg-muted/30 border border-border rounded-md px-2.5 py-1.5 text-xs text-foreground
               placeholder:text-muted-foreground/50 resize-none outline-none font-sans leading-relaxed
               focus:border-primary/40 transition-colors"
        placeholder="Optional context for Claude — e.g. 'focus on auth logic'..."
        rows={2}
        bind:value={userNote}
      ></textarea>
      <Button
        class="w-full gap-1.5"
        size="sm"
        disabled={selectedFiles.size === 0}
        onclick={handleStart}
      >
        <Play class="size-3" />
        Start review · {selectedFiles.size} file{selectedFiles.size !== 1 ? "s" : ""}
      </Button>
    </div>

  {:else}
    <!-- ── CHAT ── -->
    <div bind:this={messagesEl} class="flex-1 overflow-y-auto px-4 py-3 space-y-4 diff-scroll">
      {#each messages as msg}
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

    <!-- Chat input -->
    <div class="px-3 py-2 shrink-0">
      <div class="flex items-end gap-2 bg-muted/40 border border-border rounded-lg px-3 py-2 focus-within:border-primary/50 transition-colors">
        <textarea
          class="flex-1 bg-transparent text-xs text-foreground placeholder:text-muted-foreground resize-none outline-none font-sans leading-relaxed min-h-[20px] max-h-[120px]"
          placeholder={streaming ? "Claude is thinking..." : "Ask a follow-up question..."}
          rows={1}
          disabled={streaming}
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
          disabled={streaming || !inputText.trim()}
          onclick={handleSend}
        >
          <Send class="size-3" />
        </button>
      </div>
      <p class="text-[10px] text-muted-foreground/50 mt-1 font-sans">Enter to send · Shift+Enter for newline</p>
    </div>
  {/if}
</div>
