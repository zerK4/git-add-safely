import { readFileSync, writeFileSync, mkdirSync, existsSync } from "node:fs";
import { join } from "node:path";
import { homedir } from "node:os";

export type AIProviderType = "anthropic" | "google" | "openai" | "openai-compatible";

export interface AIProviderConfig {
  id: string;
  name: string;
  type: AIProviderType;
  apiKey: string;
  baseURL?: string;
  model?: string;
}

export interface FeatureAssignments {
  generateCommit?: string; // providerId
  codeReview?: string;     // providerId
}

export interface AppSettings {
  providers: AIProviderConfig[];
  featureAssignments: FeatureAssignments;
}

const DEFAULT_SETTINGS: AppSettings = {
  providers: [],
  featureAssignments: {},
};

export function getSettingsPath(): string {
  return join(homedir(), ".git-add-safely", "settings.json");
}

export function readSettings(): AppSettings {
  const path = getSettingsPath();
  if (!existsSync(path)) return { ...DEFAULT_SETTINGS };
  try {
    const raw = readFileSync(path, "utf-8");
    const parsed = JSON.parse(raw);
    return {
      providers: parsed.providers ?? [],
      featureAssignments: parsed.featureAssignments ?? {},
    };
  } catch {
    return { ...DEFAULT_SETTINGS };
  }
}

export function writeSettings(settings: AppSettings): void {
  const path = getSettingsPath();
  const dir = join(homedir(), ".git-add-safely");
  if (!existsSync(dir)) {
    mkdirSync(dir, { recursive: true });
  }
  writeFileSync(path, JSON.stringify(settings, null, 2), { mode: 0o600 });
}

export function getProviderForFeature(
  feature: keyof FeatureAssignments
): AIProviderConfig | null {
  const settings = readSettings();
  const id = settings.featureAssignments[feature];
  if (!id) return null;
  return settings.providers.find((p) => p.id === id) ?? null;
}
