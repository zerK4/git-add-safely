export const contentPatterns = [
  // AWS Credentials
  { name: "AWS Access Key", regex: /AKIA[0-9A-Z]{16}/ },
  { name: "AWS Secret Key", regex: /[A-Za-z0-9/+=]{40}/ },
  { name: "AWS Session Token", regex: /FwoGZXIvYXdzE[A-Za-z0-9/+=]+/ },
  { name: "AWS Account ID", regex: /[0-9]{12}/ },

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

  // Azure
  { name: "Azure Client Secret", regex: /[A-Za-z0-9~._-]{34,40}/ },
  {
    name: "Azure Client ID",
    regex: /[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}/,
  },
  { name: "Azure Storage Key", regex: /[A-Za-z0-9+/]{88}==/ },

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

  // Global KEY patterns - catch any variable ending with _KEY
  {
    name: "Global Key Pattern",
    regex: /\b[A-Z_]*KEY\b\s*[:=]\s*['"]*[A-Za-z0-9\-._~+/]{3,}['"]*(?:\s|$)/i,
  },
  {
    name: "Global Secret Pattern",
    regex:
      /\b[A-Z_]*SECRET\b\s*[:=]\s*['"]*[A-Za-z0-9\-._~+/]{3,}['"]*(?:\s|$)/i,
  },
  {
    name: "Global Token Pattern",
    regex:
      /\b[A-Z_]*TOKEN\b\s*[:=]\s*['"]*[A-Za-z0-9\-._~+/]{3,}['"]*(?:\s|$)/i,
  },
  {
    name: "Global Password Pattern",
    regex:
      /\b[A-Z_]*PASSWORD\b\s*[:=]\s*['"]*[A-Za-z0-9\-._~+/]{3,}['"]*(?:\s|$)/i,
  },

  // Common environment variable patterns
  {
    name: "Env Key Pattern",
    regex:
      /\b[A-Z][A-Z0-9_]*(?:KEY|SECRET|TOKEN|PASSWORD|AUTH|CREDENTIAL)\b\s*[:=]\s*['"]*[^\s'"]{3,}['"]*(?:\s|$)/i,
  },

  // JavaScript/TypeScript const/let/var declarations
  {
    name: "JS Key Declaration",
    regex:
      /\b(?:const|let|var)\s+[A-Z_]*KEY\b\s*=\s*['"]*[A-Za-z0-9\-._~+/]{3,}['"]*(?:\s|$)/i,
  },
  {
    name: "JS Secret Declaration",
    regex:
      /\b(?:const|let|var)\s+[A-Z_]*SECRET\b\s*=\s*['"]*[A-Za-z0-9\-._~+/]{3,}['"]*(?:\s|$)/i,
  },
  {
    name: "JS Token Declaration",
    regex:
      /\b(?:const|let|var)\s+[A-Z_]*TOKEN\b\s*=\s*['"]*[A-Za-z0-9\-._~+/]{3,}['"]*(?:\s|$)/i,
  },
  {
    name: "JS Password Declaration",
    regex:
      /\b(?:const|let|var)\s+[A-Z_]*PASSWORD\b\s*=\s*['"]*[A-Za-z0-9\-._~+/]{3,}['"]*(?:\s|$)/i,
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

  // PayPal
  { name: "PayPal Client ID", regex: /[A-Za-z0-9_-]{80}/ },
  { name: "PayPal Client Secret", regex: /[A-Za-z0-9_-]{80}/ },

  // Twilio
  { name: "Twilio Account SID", regex: /AC[a-f0-9]{32}/ },
  { name: "Twilio Auth Token", regex: /[a-f0-9]{32}/ },
  { name: "Twilio API Key", regex: /SK[a-f0-9]{32}/ },

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

  // Heroku
  {
    name: "Heroku API Key",
    regex: /[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}/,
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

  // Cryptocurrency
  { name: "Bitcoin Address", regex: /[13][a-km-zA-HJ-NP-Z1-9]{25,34}/ },
  { name: "Ethereum Address", regex: /0x[a-fA-F0-9]{40}/ },
  { name: "Private Key (Hex)", regex: /[0-9a-fA-F]{64}/ },

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

  // Base64 Encoded Secrets (common pattern)
  {
    name: "Base64 Secret",
    regex:
      /(?:secret|key|token|password)\s*[:=]\s*['"]*[A-Za-z0-9+/]{20,}={0,2}['"]*(?:\s|$)/i,
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

  // Phone Numbers (potentially sensitive)
  {
    name: "Phone Number",
    regex: /(?:\+?1[-.\s]?)?\(?[0-9]{3}\)?[-.\s]?[0-9]{3}[-.\s]?[0-9]{4}/,
  },

  // Credit Card Numbers (basic pattern)
  {
    name: "Credit Card",
    regex:
      /(?:4[0-9]{12}(?:[0-9]{3})?|5[1-5][0-9]{14}|3[47][0-9]{13}|3[0-9]{13}|6(?:011|5[0-9]{2})[0-9]{12})/,
  },

  // IP Addresses (private ranges)
  {
    name: "Private IP",
    regex:
      /(?:10\.(?:25[0-5]|2[0-4][0-9]|[01]?[0-9][0-9]?)\.(?:25[0-5]|2[0-4][0-9]|[01]?[0-9][0-9]?)\.(?:25[0-5]|2[0-4][0-9]|[01]?[0-9][0-9]?)|172\.(?:1[6-9]|2[0-9]|3[0-1])\.(?:25[0-5]|2[0-4][0-9]|[01]?[0-9][0-9]?)\.(?:25[0-5]|2[0-4][0-9]|[01]?[0-9][0-9]?)|192\.168\.(?:25[0-5]|2[0-4][0-9]|[01]?[0-9][0-9]?)\.(?:25[0-5]|2[0-4][0-9]|[01]?[0-9][0-9]?))/,
  },
];
