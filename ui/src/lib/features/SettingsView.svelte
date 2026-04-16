<script lang="ts">
  import { Settings, Plus, Trash2, Check, X } from "@lucide/svelte";
  import { Button } from "$lib/components/ui/button";
  import { Separator } from "$lib/components/ui/separator";
  import { store, closeSettings, loadSettingsFromServer, saveSettingsToServer } from "$lib/stores/app.svelte";
  import type { AIProviderConfig, AppSettings, AIProviderType, FeatureAssignments } from "$lib/api/client";

  // Fetch settings each time view opens
  $effect(() => {
    loadSettingsFromServer();
  });

  // Local editable copies
  let providers = $state<AIProviderConfig[]>([]);
  let assignments = $state<FeatureAssignments>({});
  let saveStatus = $state<"idle" | "saving" | "saved" | "error">("idle");
  let initialized = $state(false);

  // Sync from store when first loaded
  $effect(() => {
    if (store.settings && !initialized) {
      providers = [...store.settings.providers];
      assignments = { ...store.settings.featureAssignments };
      initialized = true;
    }
  });

  // Form state
  let formOpen = $state(false);
  let editingId = $state<string | null>(null);
  let formName = $state("");
  let formType = $state<AIProviderType>("anthropic");
  let formApiKey = $state("");
  let formBaseURL = $state("");
  let formModel = $state("");
  let showApiKey = $state(false);

  const PROVIDER_LABELS: Record<AIProviderType, string> = {
    anthropic: "Anthropic (Claude)",
    google: "Google (Gemini)",
    openai: "OpenAI",
    "openai-compatible": "OpenAI-compatible",
  };

  const PROVIDER_PLACEHOLDERS: Record<AIProviderType, string> = {
    anthropic: "claude-sonnet-4-5",
    google: "gemini-2.5-pro",
    openai: "gpt-4o",
    "openai-compatible": "gpt-4o",
  };

  const PROVIDER_TYPES: AIProviderType[] = ["anthropic", "google", "openai", "openai-compatible"];
  const FEATURE_KEYS: (keyof FeatureAssignments)[] = ["generateCommit", "codeReview"];

  const FEATURE_LABELS: Record<keyof FeatureAssignments, string> = {
    generateCommit: "Generate commit message",
    codeReview: "Code review",
  };

  async function persist(nextProviders: AIProviderConfig[], nextAssignments: FeatureAssignments) {
    saveStatus = "saving";
    try {
      await saveSettingsToServer({ providers: nextProviders, featureAssignments: nextAssignments });
      saveStatus = "saved";
      setTimeout(() => { saveStatus = "idle"; }, 1500);
    } catch {
      saveStatus = "error";
      setTimeout(() => { saveStatus = "idle"; }, 3000);
    }
  }

  function openAddForm() {
    editingId = null;
    formName = "";
    formType = "anthropic";
    formApiKey = "";
    formBaseURL = "";
    formModel = "";
    showApiKey = false;
    formOpen = true;
  }

  function openEditForm(p: AIProviderConfig) {
    editingId = p.id;
    formName = p.name;
    formType = p.type;
    formApiKey = p.apiKey;
    formBaseURL = p.baseURL ?? "";
    formModel = p.model ?? "";
    showApiKey = false;
    formOpen = true;
  }

  function cancelForm() {
    formOpen = false;
    editingId = null;
  }

  async function saveProvider() {
    const entry: AIProviderConfig = {
      id: editingId ?? crypto.randomUUID(),
      name: formName.trim() || PROVIDER_LABELS[formType],
      type: formType,
      apiKey: formApiKey.trim(),
      baseURL: formType === "openai-compatible" ? formBaseURL.trim() || undefined : undefined,
      model: formModel.trim() || undefined,
    };

    const next = editingId
      ? providers.map((p) => (p.id === editingId ? entry : p))
      : [...providers, entry];

    providers = next;
    formOpen = false;
    editingId = null;
    await persist(next, assignments);
  }

  async function deleteProvider(id: string) {
    const next = providers.filter((p) => p.id !== id);
    const nextAssignments = { ...assignments };
    for (const key of Object.keys(nextAssignments) as (keyof FeatureAssignments)[]) {
      if (nextAssignments[key] === id) delete nextAssignments[key];
    }
    providers = next;
    assignments = nextAssignments;
    await persist(next, nextAssignments);
  }

  async function handleAssignmentChange(feature: keyof FeatureAssignments, value: string | undefined) {
    const next = { ...assignments, [feature]: value || undefined };
    assignments = next;
    await persist(providers, next);
  }

  const formValid = $derived(
    formName.trim().length > 0 &&
    formApiKey.trim().length > 0 &&
    (formType !== "openai-compatible" || formBaseURL.trim().length > 0)
  );
</script>

<div class="flex flex-col h-full bg-background min-w-0 flex-1 overflow-hidden">
  <!-- Header -->
  <div class="flex items-center gap-3 px-5 py-3 border-b border-border shrink-0">
    <Settings class="size-4 text-muted-foreground" />
    <span class="text-sm font-semibold font-sans">AI Settings</span>
    <div class="ml-auto flex items-center gap-2">
      {#if saveStatus === "saving"}
        <span class="text-xs text-muted-foreground">Saving…</span>
      {:else if saveStatus === "saved"}
        <span class="text-xs text-status-good flex items-center gap-1">
          <Check class="size-3" /> Saved
        </span>
      {:else if saveStatus === "error"}
        <span class="text-xs text-destructive">Failed to save</span>
      {/if}
      <Button
        variant="ghost"
        size="sm"
        class="h-7 w-7 p-0 text-muted-foreground hover:text-foreground"
        onclick={closeSettings}
      >
        <X class="size-3.5" />
      </Button>
    </div>
  </div>

  <!-- Content -->
  <div class="flex-1 overflow-y-auto px-5 py-5 space-y-8">

    <!-- Providers section -->
    <section class="space-y-3">
      <div class="flex items-center justify-between">
        <div>
          <h2 class="text-sm font-semibold text-foreground">AI Providers</h2>
          <p class="text-xs text-muted-foreground mt-0.5">Add API keys for the models you want to use.</p>
        </div>
        <Button
          variant="outline"
          size="sm"
          class="h-7 px-2.5 text-xs gap-1.5"
          onclick={openAddForm}
          disabled={formOpen}
        >
          <Plus class="size-3.5" />
          Add provider
        </Button>
      </div>

      <!-- Provider list -->
      {#if providers.length === 0 && !formOpen}
        <div class="border border-border rounded-md px-4 py-6 text-center text-xs text-muted-foreground bg-card">
          No providers configured. Add one to get started.
        </div>
      {:else}
        <div class="space-y-2">
          {#each providers as p (p.id)}
            <div class="border border-border rounded-md bg-card px-4 py-3 flex items-center gap-3">
              <div class="flex-1 min-w-0">
                <div class="flex items-center gap-2">
                  <span class="text-sm font-medium text-foreground truncate">{p.name}</span>
                  <span class="text-xs text-muted-foreground bg-muted px-1.5 py-0.5 rounded shrink-0">{PROVIDER_LABELS[p.type]}</span>
                </div>
                {#if p.model}
                  <p class="text-xs text-muted-foreground mt-0.5">{p.model}</p>
                {/if}
                {#if p.baseURL}
                  <p class="text-xs text-muted-foreground mt-0.5 font-mono truncate">{p.baseURL}</p>
                {/if}
              </div>
              <div class="flex items-center gap-1 shrink-0">
                <Button
                  variant="ghost"
                  size="sm"
                  class="h-7 px-2 text-xs text-muted-foreground hover:text-foreground"
                  onclick={() => openEditForm(p)}
                >
                  Edit
                </Button>
                <Button
                  variant="ghost"
                  size="sm"
                  class="h-7 w-7 p-0 text-muted-foreground hover:text-destructive"
                  onclick={() => deleteProvider(p.id)}
                >
                  <Trash2 class="size-3.5" />
                </Button>
              </div>
            </div>
          {/each}
        </div>
      {/if}

      <!-- Add/Edit form -->
      {#if formOpen}
        <div class="border border-primary/30 rounded-md bg-card px-4 py-4 space-y-3">
          <p class="text-xs font-semibold text-foreground">{editingId ? "Edit provider" : "New provider"}</p>

          <!-- Name -->
          <div class="space-y-1">
            <label class="text-xs text-muted-foreground" for="provider-name">Name</label>
            <input
              id="provider-name"
              type="text"
              placeholder="e.g. My Gemini, Minimax"
              bind:value={formName}
              class="w-full h-8 px-3 text-sm bg-input border border-border rounded text-foreground placeholder:text-muted-foreground focus:outline-none focus:ring-1 focus:ring-ring"
            />
          </div>

          <!-- Type -->
          <div class="space-y-1">
            <label class="text-xs text-muted-foreground">Provider type</label>
            <div class="flex flex-wrap gap-2">
              {#each PROVIDER_TYPES as type}
                <button
                  type="button"
                  onclick={() => { formType = type; }}
                  class="px-2.5 py-1 text-xs rounded border transition-colors {formType === type ? 'border-primary bg-primary/10 text-primary' : 'border-border text-muted-foreground hover:text-foreground hover:border-foreground/30'}"
                >
                  {PROVIDER_LABELS[type]}
                </button>
              {/each}
            </div>
          </div>

          <!-- API key -->
          <div class="space-y-1">
            <label class="text-xs text-muted-foreground" for="provider-apikey">API Key</label>
            <div class="relative">
              <input
                id="provider-apikey"
                type={showApiKey ? "text" : "password"}
                placeholder="sk-..."
                bind:value={formApiKey}
                class="w-full h-8 px-3 pr-16 text-sm bg-input border border-border rounded text-foreground placeholder:text-muted-foreground focus:outline-none focus:ring-1 focus:ring-ring font-mono"
              />
              <button
                type="button"
                onclick={() => { showApiKey = !showApiKey; }}
                class="absolute right-2 top-1/2 -translate-y-1/2 text-xs text-muted-foreground hover:text-foreground px-1"
              >
                {showApiKey ? "Hide" : "Show"}
              </button>
            </div>
          </div>

          <!-- Base URL (openai-compatible only) -->
          {#if formType === "openai-compatible"}
            <div class="space-y-1">
              <label class="text-xs text-muted-foreground" for="provider-baseurl">Base URL</label>
              <input
                id="provider-baseurl"
                type="text"
                placeholder="https://api.minimax.io/v1"
                bind:value={formBaseURL}
                class="w-full h-8 px-3 text-sm bg-input border border-border rounded text-foreground placeholder:text-muted-foreground focus:outline-none focus:ring-1 focus:ring-ring font-mono"
              />
            </div>
          {/if}

          <!-- Model (optional) -->
          <div class="space-y-1">
            <label class="text-xs text-muted-foreground" for="provider-model">
              Model <span class="text-muted-foreground/60">(optional)</span>
            </label>
            <input
              id="provider-model"
              type="text"
              placeholder={PROVIDER_PLACEHOLDERS[formType]}
              bind:value={formModel}
              class="w-full h-8 px-3 text-sm bg-input border border-border rounded text-foreground placeholder:text-muted-foreground focus:outline-none focus:ring-1 focus:ring-ring font-mono"
            />
          </div>

          <!-- Form actions -->
          <div class="flex items-center gap-2 pt-1">
            <Button
              variant="default"
              size="sm"
              class="h-7 px-3 text-xs"
              onclick={saveProvider}
              disabled={!formValid || saveStatus === "saving"}
            >
              {editingId ? "Update" : "Add"}
            </Button>
            <Button
              variant="ghost"
              size="sm"
              class="h-7 px-3 text-xs text-muted-foreground"
              onclick={cancelForm}
            >
              Cancel
            </Button>
          </div>
        </div>
      {/if}
    </section>

    <Separator />

    <!-- Feature assignments section -->
    <section class="space-y-3">
      <div>
        <h2 class="text-sm font-semibold text-foreground">Feature assignments</h2>
        <p class="text-xs text-muted-foreground mt-0.5">Choose which AI to use for each feature.</p>
      </div>

      <div class="space-y-2">
        {#each FEATURE_KEYS as feature}
          <div class="border border-border rounded-md bg-card px-4 py-3 flex items-center gap-4">
            <span class="text-sm text-foreground flex-1">{FEATURE_LABELS[feature]}</span>
            <select
              value={assignments[feature] ?? ""}
              onchange={(e) => handleAssignmentChange(feature, (e.target as HTMLSelectElement).value || undefined)}
              class="h-8 px-2 text-sm bg-input border border-border rounded text-foreground focus:outline-none focus:ring-1 focus:ring-ring min-w-[180px]"
            >
              <option value="">Claude CLI (default)</option>
              {#each providers as p (p.id)}
                <option value={p.id}>{p.name}</option>
              {/each}
            </select>
          </div>
        {/each}
      </div>
    </section>

  </div>
</div>
