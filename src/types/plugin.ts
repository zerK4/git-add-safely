/**
 * Plugin system types for git-add-safely
 */

export interface ScanResult {
  file: string;
  line: number;
  pattern: string;
  content: string;
}

export interface FileStatus {
  path: string;
  status: "added" | "modified" | "deleted" | "renamed";
  staged: boolean;
}

export interface PluginContext {
  stagedFiles: FileStatus[];
  scanResults: ScanResult[];
  config: Record<string, any>;
}

export interface PluginHooks {
  /**
   * Called before scanning files
   * Can modify the list of files to scan
   */
  beforeScan?: (files: string[]) => string[] | Promise<string[]>;

  /**
   * Called after scanning completes
   * Can add additional checks or modify results
   */
  afterScan?: (
    context: PluginContext,
  ) => PluginContext | Promise<PluginContext>;

  /**
   * Called before proceeding with git add
   * Return false to prevent the add
   */
  beforeAdd?: (context: PluginContext) => boolean | Promise<boolean>;

  /**
   * Called after git add completes successfully
   */
  afterAdd?: (context: PluginContext) => void | Promise<void>;
}

export interface Plugin {
  /**
   * Unique plugin name
   */
  name: string;

  /**
   * Plugin version
   */
  version: string;

  /**
   * Plugin description
   */
  description?: string;

  /**
   * Plugin initialization
   * Called once when plugin is loaded
   */
  init?: (config?: Record<string, any>) => void | Promise<void>;

  /**
   * Plugin hooks
   */
  hooks: PluginHooks;

  /**
   * Plugin cleanup
   * Called when the tool exits
   */
  cleanup?: () => void | Promise<void>;
}

export interface PluginConfig {
  enabled: boolean;
  config?: Record<string, any>;
}

export interface GitSafelyConfig {
  plugins?: Record<string, PluginConfig>;
  patterns?: {
    sensitive?: boolean;
    content?: boolean;
  };
  ui?: {
    enabled?: boolean;
    autoOpen?: boolean;
    port?: number;
  };
}
