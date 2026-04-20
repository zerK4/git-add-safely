export const contentPatterns = [
  // AWS Credentials - Made more specific with context
  { name: "AWS Access Key", regex: /AKIA[0-9A-Z]{16}/ }, // This one is good - specific prefix
  {
    name: "AWS Secret Key",
    regex: /(?:aws[_-]?secret[_-]?(?:access[_-]?)?key|secret[_-]?(?:access[_-]?)?key)\s*[:=]\s*['"]?[A-Za-z0-9/+=]{40}['"]?/i
  },
  { name: "AWS Session Token", regex: /FwoGZXIvYXdzE[A-Za-z0-9/+=]+/ }, // Good - specific prefix
  // Removed AWS Account ID - too generic (any 12 digits)

  // Google Cloud Platform
  { name: "Google API Key", regex: /AIza[0-9A-Za-z\-_]{35}/ },
  {
    name: "Google OAuth Client ID",
    regex: /[0-9]+-[0-9A-Za-z_]{32}\.apps\.googleusercontent\.com/,
  },
  { name: "Google OAuth Client Secret", regex: /GOCSPX-[A-Za-z0-9_-]{28}/ },
  {
    name: "Google Service Account",
    regex:
      /"private_key":\s*"-----BEGIN PRIVATE KEY-----[^"]*-----END PRIVATE KEY-----"/,
  },

  // Azure - Made more specific
  {
    name: "Azure Client Secret",
    regex: /(?:azure[_-]?client[_-]?secret|client[_-]?secret)\s*[:=]\s*['"]?[A-Za-z0-9~._-]{34,40}['"]?/i
  },
  {
    name: "Azure Client ID (GUID)",
    regex: /(?:azure[_-]?client[_-]?id|client[_-]?id|tenant[_-]?id|subscription[_-]?id)\s*[:=]\s*['"]?[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}['"]?/i,
  },
  {
    name: "Azure Storage Key",
    regex: /(?:azure[_-]?storage[_-]?key|storage[_-]?(?:account[_-]?)?key)\s*[:=]\s*['"]?[A-Za-z0-9+/]{88}==["']?/i
  },

  // Private Keys
  {
    name: "RSA Private Key",
    regex:
      /-----BEGIN RSA PRIVATE KEY-----[\s\S]*?-----END RSA PRIVATE KEY-----/,
  },
  {
    name: "DSA Private Key",
    regex:
      /-----BEGIN DSA PRIVATE KEY-----[\s\S]*?-----END DSA PRIVATE KEY-----/,
  },
  {
    name: "EC Private Key",
    regex: /-----BEGIN EC PRIVATE KEY-----[\s\S]*?-----END EC PRIVATE KEY-----/,
  },
  {
    name: "PGP Private Key",
    regex:
      /-----BEGIN PGP PRIVATE KEY BLOCK-----[\s\S]*?-----END PGP PRIVATE KEY BLOCK-----/,
  },
  {
    name: "OpenSSH Private Key",
    regex:
      /-----BEGIN OPENSSH PRIVATE KEY-----[\s\S]*?-----END OPENSSH PRIVATE KEY-----/,
  },
  {
    name: "PKCS#8 Private Key",
    regex: /-----BEGIN PRIVATE KEY-----[\s\S]*?-----END PRIVATE KEY-----/,
  },
  {
    name: "Encrypted Private Key",
    regex:
      /-----BEGIN ENCRYPTED PRIVATE KEY-----[\s\S]*?-----END ENCRYPTED PRIVATE KEY-----/,
  },

  // Generic API Keys and Tokens
  {
    name: "API Key",
    regex:
      /(?:api[_-]?key|apikey)\s*[:=]\s*['"]*[A-Za-z0-9\-._~+/]{16,}['"]*(?:\s|$)/i,
  },
  {
    name: "Secret Key",
    regex:
      /(?:secret[_-]?key|secretkey)\s*[:=]\s*['"]*[A-Za-z0-9\-._~+/]{16,}['"]*(?:\s|$)/i,
  },
  {
    name: "Access Token",
    regex:
      /(?:access[_-]?token|accesstoken)\s*[:=]\s*['"]*[A-Za-z0-9\-._~+/]{16,}['"]*(?:\s|$)/i,
  },
  {
    name: "Bearer Token",
    regex: /(?:bearer|authorization:\s*bearer)\s+[A-Za-z0-9\-._~+/]+=*/i,
  },
  {
    name: "Auth Token",
    regex:
      /(?:auth[_-]?token|authtoken)\s*[:=]\s*['"]*[A-Za-z0-9\-._~+/]{16,}['"]*(?:\s|$)/i,
  },

  // Global KEY patterns - only flag when RHS is a quoted literal (16+ chars) or process.env ref
  {
    name: "Global Key Pattern",
    regex: /\b[A-Z_]*KEY\b\s*[:=]\s*(?:'[A-Za-z0-9\-._~+/]{16,}'|"[A-Za-z0-9\-._~+/]{16,}")/i,
  },
  {
    name: "Global Secret Pattern",
    regex: /\b[A-Z_]*SECRET\b\s*[:=]\s*(?:'[A-Za-z0-9\-._~+/]{16,}'|"[A-Za-z0-9\-._~+/]{16,}")/i,
  },
  {
    name: "Global Token Pattern",
    regex: /\b[A-Z_]*TOKEN\b\s*[:=]\s*(?:'[A-Za-z0-9\-._~+/]{16,}'|"[A-Za-z0-9\-._~+/]{16,}")/i,
  },
  {
    name: "Global Password Pattern",
    regex: /\b[A-Z_]*PASSWORD\b\s*[:=]\s*(?:'[A-Za-z0-9\-._~+/]{8,}'|"[A-Za-z0-9\-._~+/]{8,}")/i,
  },

  // Common environment variable patterns - ALL_CAPS env var names only, quoted or process.env RHS
  {
    name: "Env Key Pattern",
    regex: /\b[A-Z][A-Z0-9_]{2,}(?:KEY|SECRET|TOKEN|PASSWORD|AUTH|CREDENTIAL)\b\s*[:=]\s*(?:'[^\s'"]{8,}'|"[^\s'"]{8,}"|`[^\s`]{8,}`)/,
  },

  // JavaScript/TypeScript const/let/var declarations - only quoted literal RHS
  {
    name: "JS Key Declaration",
    regex: /\b(?:const|let|var)\s+[A-Z_]*KEY\b\s*=\s*(?:'[A-Za-z0-9\-._~+/]{16,}'|"[A-Za-z0-9\-._~+/]{16,}"|`[A-Za-z0-9\-._~+/]{16,}`)/i,
  },
  {
    name: "JS Secret Declaration",
    regex: /\b(?:const|let|var)\s+[A-Z_]*SECRET\b\s*=\s*(?:'[A-Za-z0-9\-._~+/]{16,}'|"[A-Za-z0-9\-._~+/]{16,}"|`[A-Za-z0-9\-._~+/]{16,}`)/i,
  },
  {
    name: "JS Token Declaration",
    regex: /\b(?:const|let|var)\s+[A-Z_]*TOKEN\b\s*=\s*(?:'[A-Za-z0-9\-._~+/]{16,}'|"[A-Za-z0-9\-._~+/]{16,}"|`[A-Za-z0-9\-._~+/]{16,}`)/i,
  },
  {
    name: "JS Password Declaration",
    regex: /\b(?:const|let|var)\s+[A-Z_]*PASSWORD\b\s*=\s*(?:'[A-Za-z0-9\-._~+/]{8,}'|"[A-Za-z0-9\-._~+/]{8,}"|`[A-Za-z0-9\-._~+/]{8,}`)/i,
  },

  // Catch-all for suspicious patterns
  {
    name: "Suspicious Assignment",
    regex:
      /(?:private|confidential|internal|secure)[_-]?(?:key|secret|token|password|auth)\s*[:=]\s*['"]*[A-Za-z0-9\-._~+/]{8,}['"]*(?:\s|$)/i,
  },

  // Database Credentials
  {
    name: "Database URL",
    regex:
      /(?:database[_-]?url|db[_-]?url)\s*[:=]\s*['"]*(?:postgres|mysql|mongodb|redis):\/\/[^'"]*['"]*(?:\s|$)/i,
  },
  {
    name: "Connection String",
    regex:
      /(?:connection[_-]?string|connectionstring)\s*[:=]\s*['"]*[^'"]*['"]*(?:\s|$)/i,
  },
  { name: "MongoDB URI", regex: /mongodb(?:\+srv)?:\/\/[^\s'"]+/i },
  { name: "Redis URL", regex: /redis:\/\/[^\s'"]+/i },
  { name: "PostgreSQL URL", regex: /postgres(?:ql)?:\/\/[^\s'"]+/i },
  { name: "MySQL URL", regex: /mysql:\/\/[^\s'"]+/i },

  // Password Patterns
  {
    name: "Password Assignment",
    regex: /(?:password|passwd|pwd)\s*[:=]\s*['"]*[^'"\s]{4,}['"]*(?:\s|$)/i,
  },
  {
    name: "Admin Password",
    regex:
      /(?:admin[_-]?password|adminpassword)\s*[:=]\s*['"]*[^'"\s]{4,}['"]*(?:\s|$)/i,
  },
  {
    name: "DB Password",
    regex:
      /(?:db[_-]?password|database[_-]?password)\s*[:=]\s*['"]*[^'"\s]{4,}['"]*(?:\s|$)/i,
  },
  {
    name: "User Password",
    regex:
      /(?:user[_-]?password|userpassword)\s*[:=]\s*['"]*[^'"\s]{4,}['"]*(?:\s|$)/i,
  },

  // Third-party Services
  {
    name: "GitHub Token",
    regex:
      /(?:github[_-]?token|gh[_-]?token)\s*[:=]\s*['"]*ghp_[A-Za-z0-9]{36}['"]*(?:\s|$)/i,
  },
  { name: "GitHub Personal Access Token", regex: /ghp_[A-Za-z0-9]{36}/ },
  { name: "GitHub OAuth Token", regex: /gho_[A-Za-z0-9]{36}/ },
  { name: "GitHub User Token", regex: /ghu_[A-Za-z0-9]{36}/ },
  { name: "GitHub Server Token", regex: /ghs_[A-Za-z0-9]{36}/ },
  { name: "GitHub Refresh Token", regex: /ghr_[A-Za-z0-9]{36}/ },

  // Stripe
  { name: "Stripe Secret Key", regex: /sk_live_[A-Za-z0-9]{24}/ },
  { name: "Stripe Test Key", regex: /sk_test_[A-Za-z0-9]{24}/ },
  { name: "Stripe Publishable Key", regex: /pk_live_[A-Za-z0-9]{24}/ },
  { name: "Stripe Webhook Secret", regex: /whsec_[A-Za-z0-9]{32}/ },

  // PayPal - Made specific with context
  {
    name: "PayPal Client ID",
    regex: /(?:paypal[_-]?client[_-]?id)\s*[:=]\s*['"]?[A-Za-z0-9_-]{80}['"]?/i
  },
  {
    name: "PayPal Client Secret",
    regex: /(?:paypal[_-]?(?:client[_-]?)?secret)\s*[:=]\s*['"]?[A-Za-z0-9_-]{80}['"]?/i
  },

  // Twilio - Good specific prefixes
  { name: "Twilio Account SID", regex: /AC[a-f0-9]{32}/ }, // Good - specific prefix
  {
    name: "Twilio Auth Token",
    regex: /(?:twilio[_-]?auth[_-]?token|auth[_-]?token)\s*[:=]\s*['"]?[a-f0-9]{32}['"]?/i
  },
  { name: "Twilio API Key", regex: /SK[a-f0-9]{32}/ }, // Good - specific prefix

  // SendGrid
  {
    name: "SendGrid API Key",
    regex: /SG\.[A-Za-z0-9_-]{22}\.[A-Za-z0-9_-]{43}/,
  },

  // Mailgun
  { name: "Mailgun API Key", regex: /key-[A-Za-z0-9]{32}/ },
  { name: "Mailgun Public Key", regex: /pubkey-[A-Za-z0-9]{32}/ },

  // Slack
  { name: "Slack Token", regex: /xox[bprs]-[A-Za-z0-9\-]{10,48}/ },
  {
    name: "Slack Webhook",
    regex: /https:\/\/hooks\.slack\.com\/services\/[A-Za-z0-9\/]+/,
  },

  // Discord
  {
    name: "Discord Bot Token",
    regex: /[MN][A-Za-z\d]{23}\.[\w-]{6}\.[\w-]{27}/,
  },
  {
    name: "Discord Webhook",
    regex:
      /https:\/\/discord(?:app)?\.com\/api\/webhooks\/[0-9]{18}\/[A-Za-z0-9\-_]{68}/,
  },

  // Firebase
  { name: "Firebase API Key", regex: /AIza[0-9A-Za-z\-_]{35}/ },
  { name: "Firebase Auth Domain", regex: /[A-Za-z0-9\-_]+\.firebaseapp\.com/ },
  {
    name: "Firebase Database URL",
    regex: /https:\/\/[A-Za-z0-9\-_]+\.firebaseio\.com/,
  },

  // Heroku - Made specific with context
  {
    name: "Heroku API Key",
    regex: /(?:heroku[_-]?api[_-]?key)\s*[:=]\s*['"]?[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}['"]?/i,
  },

  // JWT Tokens
  {
    name: "JWT Token",
    regex: /eyJ[A-Za-z0-9\-_]+\.eyJ[A-Za-z0-9\-_]+\.[A-Za-z0-9\-_]+/,
  },

  // SSH Keys
  {
    name: "SSH Public Key",
    regex: /ssh-(?:rsa|dss|ed25519|ecdsa) [A-Za-z0-9+/=]+/,
  },

  // Cryptocurrency - Made more specific
  {
    name: "Bitcoin Address",
    regex: /(?:bitcoin[_-]?address|btc[_-]?address)\s*[:=]\s*['"]?[13][a-km-zA-HJ-NP-Z1-9]{25,34}['"]?/i
  },
  {
    name: "Ethereum Address",
    regex: /(?:ethereum[_-]?address|eth[_-]?address)\s*[:=]\s*['"]?0x[a-fA-F0-9]{40}['"]?/i
  },
  {
    name: "Private Key (Hex)",
    regex: /(?:private[_-]?key|priv[_-]?key)\s*[:=]\s*['"]?[0-9a-fA-F]{64}['"]?/i
  },

  // Docker Hub
  { name: "Docker Hub Token", regex: /dckr_pat_[A-Za-z0-9_-]{32}/ },

  // NPM
  { name: "NPM Token", regex: /npm_[A-Za-z0-9]{36}/ },

  // Generic Secrets
  {
    name: "Client Secret",
    regex:
      /(?:client[_-]?secret|clientsecret)\s*[:=]\s*['"]*[A-Za-z0-9\-._~+/]{16,}['"]*(?:\s|$)/i,
  },
  {
    name: "App Secret",
    regex:
      /(?:app[_-]?secret|appsecret)\s*[:=]\s*['"]*[A-Za-z0-9\-._~+/]{16,}['"]*(?:\s|$)/i,
  },
  {
    name: "Webhook Secret",
    regex:
      /(?:webhook[_-]?secret|webhooksecret)\s*[:=]\s*['"]*[A-Za-z0-9\-._~+/]{16,}['"]*(?:\s|$)/i,
  },
  {
    name: "Encryption Key",
    regex:
      /(?:encryption[_-]?key|encryptionkey)\s*[:=]\s*['"]*[A-Za-z0-9\-._~+/]{16,}['"]*(?:\s|$)/i,
  },

  // Common Environment Variables
  {
    name: "Session Secret",
    regex:
      /(?:session[_-]?secret|sessionsecret)\s*[:=]\s*['"]*[A-Za-z0-9\-._~+/]{16,}['"]*(?:\s|$)/i,
  },
  {
    name: "JWT Secret",
    regex:
      /(?:jwt[_-]?secret|jwtsecret)\s*[:=]\s*['"]*[A-Za-z0-9\-._~+/]{16,}['"]*(?:\s|$)/i,
  },
  {
    name: "Cookie Secret",
    regex:
      /(?:cookie[_-]?secret|cookiesecret)\s*[:=]\s*['"]*[A-Za-z0-9\-._~+/]{16,}['"]*(?:\s|$)/i,
  },

  // Email Credentials
  {
    name: "SMTP Password",
    regex:
      /(?:smtp[_-]?password|smtppassword)\s*[:=]\s*['"]*[^'"\s]{4,}['"]*(?:\s|$)/i,
  },
  {
    name: "Email Password",
    regex:
      /(?:email[_-]?password|emailpassword)\s*[:=]\s*['"]*[^'"\s]{4,}['"]*(?:\s|$)/i,
  },

  // FTP Credentials
  {
    name: "FTP Password",
    regex:
      /(?:ftp[_-]?password|ftppassword)\s*[:=]\s*['"]*[^'"\s]{4,}['"]*(?:\s|$)/i,
  },
  {
    name: "SFTP Password",
    regex:
      /(?:sftp[_-]?password|sftppassword)\s*[:=]\s*['"]*[^'"\s]{4,}['"]*(?:\s|$)/i,
  },

  // Base64 Encoded Secrets - require quoted literal to avoid variable references
  {
    name: "Base64 Secret",
    regex: /(?:secret|key|token|password)\s*[:=]\s*(?:'[A-Za-z0-9+/]{20,}={0,2}'|"[A-Za-z0-9+/]{20,}={0,2}")/i,
  },

  // URL with embedded credentials
  {
    name: "URL with Credentials",
    regex: /https?:\/\/[A-Za-z0-9\-._~]+:[A-Za-z0-9\-._~]+@[^\s'"]+/i,
  },

  // Common credential patterns in JSON
  {
    name: "JSON Secret",
    regex: /"(?:secret|key|token|password|auth)":\s*"[^"]{8,}"/,
  },

  // License Keys
  {
    name: "License Key",
    regex:
      /(?:license[_-]?key|licensekey)\s*[:=]\s*['"]*[A-Za-z0-9\-]{16,}['"]*(?:\s|$)/i,
  },

  // Removed: Phone Number - too generic, matches many numeric patterns
  // Removed: Credit Card - too risky for false positives with numeric IDs
  // Removed: Private IP - too generic, matches internal network configs legitimately
];
