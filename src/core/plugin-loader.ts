import type { Plugin, PluginContext, GitSafelyConfig } from "../types/plugin";
import { readFileSync, existsSync } from "node:fs";
import { join } from "node:path";

export class PluginLoader {
  private plugins: Plugin[] = [];
  private config: GitSafelyConfig = {};

  constructor() {
    this.loadConfig();
  }

  /**
   * Load configuration from .git-safely.json if it exists
   */
  private loadConfig() {
    const configPath = join(process.cwd(), ".git-safely.json");
    if (existsSync(configPath)) {
      try {
        const configContent = readFileSync(configPath, "utf-8");
        this.config = JSON.parse(configContent);
      } catch (err) {
        console.warn(
          "⚠️  Failed to parse .git-safely.json, using defaults:",
          (err as Error).message,
        );
      }
    }
  }

  /**
   * Register a plugin
   */
  async registerPlugin(plugin: Plugin) {
    const pluginConfig = this.config.plugins?.[plugin.name];

    // Skip if plugin is explicitly disabled
    if (pluginConfig && pluginConfig.enabled === false) {
      return;
    }

    // Initialize plugin
    if (plugin.init) {
      await plugin.init(pluginConfig?.config);
    }

    this.plugins.push(plugin);
  }

  /**
   * Execute beforeScan hooks
   */
  async executeBeforeScan(files: string[]): Promise<string[]> {
    let processedFiles = files;

    for (const plugin of this.plugins) {
      if (plugin.hooks.beforeScan) {
        processedFiles = await plugin.hooks.beforeScan(processedFiles);
      }
    }

    return processedFiles;
  }

  /**
   * Execute afterScan hooks
   */
  async executeAfterScan(context: PluginContext): Promise<PluginContext> {
    let processedContext = context;

    for (const plugin of this.plugins) {
      if (plugin.hooks.afterScan) {
        processedContext = await plugin.hooks.afterScan(processedContext);
      }
    }

    return processedContext;
  }

  /**
   * Execute beforeAdd hooks
   * Returns false if any plugin prevents the add
   */
  async executeBeforeAdd(context: PluginContext): Promise<boolean> {
    for (const plugin of this.plugins) {
      if (plugin.hooks.beforeAdd) {
        const result = await plugin.hooks.beforeAdd(context);
        if (result === false) {
          console.log(`\x1b[31m  error  Add prevented by plugin: ${plugin.name}\x1b[0m`);
          return false;
        }
      }
    }

    return true;
  }

  /**
   * Execute afterAdd hooks
   */
  async executeAfterAdd(context: PluginContext): Promise<void> {
    for (const plugin of this.plugins) {
      if (plugin.hooks.afterAdd) {
        await plugin.hooks.afterAdd(context);
      }
    }
  }

  /**
   * Cleanup all plugins
   */
  async cleanup() {
    for (const plugin of this.plugins) {
      if (plugin.cleanup) {
        await plugin.cleanup();
      }
    }
  }

  /**
   * Get config for a specific section
   */
  getConfig<T = any>(key: keyof GitSafelyConfig): T | undefined {
    return this.config[key] as T;
  }

  /**
   * Get all loaded plugins
   */
  getPlugins(): Plugin[] {
    return this.plugins;
  }
}
