export const filenamePatterns = [
  // Environment & Configuration Files
  { name: ".env file", regex: /^\.env(\..*)?$/ },
  { name: "Config files", regex: /^config\.(json|yaml|yml|toml|ini)$/i },
  { name: "Local config", regex: /\.local\.(json|yaml|yml|js|ts)$/i },
  { name: "Settings files", regex: /^settings\.(json|yaml|yml)$/i },

  // Security & Authentication
  { name: "Private Key File", regex: /\.(pem|key|p12|pfx|jks|keystore)$/i },
  { name: "Certificate files", regex: /\.(crt|cer|ca-bundle|p7b|p7c|p7s)$/i },
  { name: "SSH keys", regex: /^(id_rsa|id_dsa|id_ecdsa|id_ed25519)$/i },
  { name: "Credentials Backup", regex: /credentials.*\.bak$/i },
  {
    name: "Auth tokens",
    regex: /(token|secret|password|auth).*\.(txt|json|yaml|yml)$/i,
  },
  { name: "AWS credentials", regex: /^\.aws\/(credentials|config)$/i },
  { name: "Google credentials", regex: /.*service-account.*\.json$/i },
  { name: "Firebase config", regex: /^firebase-adminsdk.*\.json$/i },

  // Database Files
  { name: "SQLite database", regex: /\.(db|sqlite|sqlite3)$/i },
  { name: "Database dumps", regex: /\.(sql|dump)$/i },
  { name: "MongoDB dumps", regex: /\.bson$/i },

  // Backup & Temporary Files
  { name: "Backup files", regex: /\.(bak|backup|old|orig|tmp)$/i },
  { name: "Swap files", regex: /\.(swp|swo)$/i },
  { name: "Temp files", regex: /~$/i },
  { name: "Auto-save files", regex: /^\.#.*$/i },

  // IDE & Editor Files
  {
    name: "VS Code workspace",
    regex: /\.vscode\/(settings|launch|tasks)\.json$/i,
  },
  { name: "IntelliJ files", regex: /\.(iml|iws|ipr)$/i },
  { name: "Sublime Text", regex: /\.(sublime-project|sublime-workspace)$/i },
  { name: "Vim files", regex: /\.(vimrc|gvimrc)$/i },

  // OS Generated Files
  { name: "macOS files", regex: /^\.DS_Store$/i },
  { name: "Windows files", regex: /^(Thumbs\.db|ehthumbs\.db|Desktop\.ini)$/i },
  { name: "Linux files", regex: /^\.directory$/i },

  // Build & Compilation
  { name: "Build artifacts", regex: /\.(o|obj|exe|dll|so|dylib|class)$/i },
  { name: "Compiled Python", regex: /\.(pyc|pyo|pyd)$/i },
  { name: "Java compiled", regex: /\.class$/i },
  { name: "C# compiled", regex: /\.(exe|dll|pdb)$/i },

  // Package Manager Files
  { name: "npm debug", regex: /^npm-debug\.log$/i },
  { name: "yarn error", regex: /^yarn-error\.log$/i },
  { name: "pnpm debug", regex: /^pnpm-debug\.log$/i },

  // Log Files
  { name: "Log files", regex: /\.(log|out|err)$/i },
  { name: "Application logs", regex: /^(access|error|debug|app)\.log$/i },
  { name: "Crash dumps", regex: /\.(dmp|dump|core)$/i },

  // Docker & Container Files
  { name: "Docker override", regex: /^docker-compose\.override\.yml$/i },
  { name: "Docker local", regex: /^\.dockerignore\.local$/i },

  // Testing & Coverage
  { name: "Test results", regex: /^(test-results|coverage)\/.*$/i },
  { name: "Jest cache", regex: /^\.jest\/.*$/i },
  { name: "Cypress artifacts", regex: /^cypress\/(screenshots|videos)\/.*$/i },

  // Cache & Dependencies
  { name: "Cache directories", regex: /^\.cache\/.*$/i },
  { name: "Temp directories", regex: /^(tmp|temp)\/.*$/i },
  { name: "User data", regex: /^user-data\/.*$/i },

  // Specific Framework Files
  { name: "Next.js", regex: /^\.next\/.*$/i },
  { name: "Nuxt.js", regex: /^\.nuxt\/.*$/i },
  { name: "Gatsby", regex: /^\.gatsby\/.*$/i },
  { name: "Serverless", regex: /^\.serverless\/.*$/i },
  { name: "Terraform", regex: /\.(tfstate|tfstate\.backup)$/i },

  // Media & Assets (if large/sensitive)
  { name: "Large media", regex: /\.(mp4|avi|mov|wmv|flv|webm|mkv)$/i },
  { name: "Audio files", regex: /\.(mp3|wav|flac|aac|ogg|wma)$/i },
  { name: "Archive files", regex: /\.(zip|rar|7z|tar|gz|bz2|xz)$/i },

  // Version Control
  { name: "Git files", regex: /^\.git\/.*$/i },
  { name: "SVN files", regex: /^\.svn\/.*$/i },
  { name: "Mercurial files", regex: /^\.hg\/.*$/i },

  // Documentation drafts
  { name: "Draft documents", regex: /.*\.draft\.(md|txt|doc|docx)$/i },
  { name: "Personal notes", regex: /^(notes|todo|personal).*\.(md|txt)$/i },

  // Miscellaneous
  { name: "PID files", regex: /\.pid$/i },
  { name: "Lock files", regex: /\.lock$/i },
  { name: "Sock files", regex: /\.sock$/i },
  { name: "Profile data", regex: /^\.profile$/i },
];
