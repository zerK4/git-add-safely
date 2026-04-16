import { Database } from "bun:sqlite";
import { mkdirSync, existsSync } from "node:fs";
import { join } from "node:path";
import { homedir } from "node:os";

export interface Conversation {
  id: number;
  repo: string;
  file: string;
  title: string;
  created_at: string;
  updated_at: string;
}

export interface Message {
  id: number;
  conversation_id: number;
  role: "user" | "assistant";
  content: string;
  created_at: string;
}

function getDb(): Database {
  const dir = join(homedir(), ".git-add-safely");
  if (!existsSync(dir)) mkdirSync(dir, { recursive: true });

  const db = new Database(join(dir, "history.db"));
  db.run("PRAGMA journal_mode = WAL");

  db.run(`
    CREATE TABLE IF NOT EXISTS conversations (
      id         INTEGER PRIMARY KEY AUTOINCREMENT,
      repo       TEXT NOT NULL,
      file       TEXT NOT NULL,
      title      TEXT NOT NULL,
      created_at TEXT NOT NULL DEFAULT (datetime('now')),
      updated_at TEXT NOT NULL DEFAULT (datetime('now'))
    )
  `);

  db.run(`
    CREATE TABLE IF NOT EXISTS messages (
      id              INTEGER PRIMARY KEY AUTOINCREMENT,
      conversation_id INTEGER NOT NULL REFERENCES conversations(id) ON DELETE CASCADE,
      role            TEXT NOT NULL CHECK(role IN ('user','assistant')),
      content         TEXT NOT NULL,
      created_at      TEXT NOT NULL DEFAULT (datetime('now'))
    )
  `);

  db.run(`CREATE INDEX IF NOT EXISTS idx_messages_conv ON messages(conversation_id)`);
  db.run(`CREATE INDEX IF NOT EXISTS idx_conversations_repo ON conversations(repo)`);

  return db;
}

// --- Conversation CRUD ---

export function createConversation(repo: string, file: string, title: string): number {
  const db = getDb();
  const stmt = db.prepare(
    "INSERT INTO conversations (repo, file, title) VALUES (?, ?, ?)"
  );
  const result = stmt.run(repo, file, title);
  return result.lastInsertRowid as number;
}

export function updateConversationTimestamp(id: number): void {
  const db = getDb();
  db.run("UPDATE conversations SET updated_at = datetime('now') WHERE id = ?", [id]);
}

export function listConversations(repo?: string): Conversation[] {
  const db = getDb();
  if (repo) {
    return db.query<Conversation, [string]>(
      "SELECT * FROM conversations WHERE repo = ? ORDER BY updated_at DESC"
    ).all(repo);
  }
  return db.query<Conversation, []>(
    "SELECT * FROM conversations ORDER BY updated_at DESC"
  ).all();
}

export function getConversation(id: number): Conversation | null {
  const db = getDb();
  return db.query<Conversation, [number]>(
    "SELECT * FROM conversations WHERE id = ?"
  ).get(id) ?? null;
}

export function deleteConversation(id: number): void {
  const db = getDb();
  db.run("DELETE FROM conversations WHERE id = ?", [id]);
}

// --- Message CRUD ---

export function addMessage(conversationId: number, role: "user" | "assistant", content: string): void {
  const db = getDb();
  db.run(
    "INSERT INTO messages (conversation_id, role, content) VALUES (?, ?, ?)",
    [conversationId, role, content]
  );
  updateConversationTimestamp(conversationId);
}

export function getMessages(conversationId: number): Message[] {
  const db = getDb();
  return db.query<Message, [number]>(
    "SELECT * FROM messages WHERE conversation_id = ? ORDER BY created_at ASC"
  ).all(conversationId);
}
