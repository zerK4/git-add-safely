import { Database } from "bun:sqlite";
import { mkdirSync, existsSync, writeFileSync } from "node:fs";
import { join } from "node:path";
import { createHash } from "node:crypto";

function gravatarHash(email: string): string {
  return createHash("md5").update(email.trim().toLowerCase()).digest("hex");
}

function getDb(repoRoot: string): Database {
  const dir = join(repoRoot, ".git-notes");
  if (!existsSync(dir)) mkdirSync(dir, { recursive: true });

  const db = new Database(join(dir, "notes.db"));
  db.run("PRAGMA journal_mode = WAL");
  db.run(`
    CREATE TABLE IF NOT EXISTS notes (
      file        TEXT    NOT NULL,
      line_no     INTEGER NOT NULL,
      content     TEXT    NOT NULL,
      author_name  TEXT    NOT NULL DEFAULT '',
      author_email TEXT    NOT NULL DEFAULT '',
      PRIMARY KEY (file, line_no)
    )
  `);
  // migrate existing DBs that lack author columns
  try { db.run("ALTER TABLE notes ADD COLUMN author_name TEXT NOT NULL DEFAULT ''"); } catch {}
  try { db.run("ALTER TABLE notes ADD COLUMN author_email TEXT NOT NULL DEFAULT ''"); } catch {}
  return db;
}

export interface NoteRow {
  content: string;
  author_name: string;
  author_email: string;
}

export function getNote(repoRoot: string, file: string, lineNo: number): string | null {
  const db = getDb(repoRoot);
  const row = db.query<{ content: string }, [string, number]>(
    "SELECT content FROM notes WHERE file = ? AND line_no = ?"
  ).get(file, lineNo);
  return row?.content ?? null;
}

export function setNote(repoRoot: string, file: string, lineNo: number, content: string, authorName = "", authorEmail = ""): void {
  const db = getDb(repoRoot);
  if (content.trim()) {
    db.run(
      "INSERT INTO notes (file, line_no, content, author_name, author_email) VALUES (?, ?, ?, ?, ?) ON CONFLICT(file, line_no) DO UPDATE SET content = excluded.content, author_name = excluded.author_name, author_email = excluded.author_email",
      [file, lineNo, content, authorName, authorEmail]
    );
  } else {
    db.run("DELETE FROM notes WHERE file = ? AND line_no = ?", [file, lineNo]);
  }
  exportMarkdown(repoRoot, db);
}

function exportMarkdown(repoRoot: string, db: Database): void {
  const rows = db.query<{ file: string; line_no: number; content: string }, []>(
    "SELECT file, line_no, content FROM notes ORDER BY file, line_no"
  ).all();

  if (rows.length === 0) {
    writeFileSync(join(repoRoot, ".git-notes", "notes.md"), "");
    return;
  }

  const byFile: Record<string, { line_no: number; content: string }[]> = {};
  for (const row of rows) {
    if (!byFile[row.file]) byFile[row.file] = [];
    byFile[row.file].push({ line_no: row.line_no, content: row.content });
  }

  const sections = Object.entries(byFile).map(([file, notes]) => {
    const noteLines = notes
      .map((n) => `**Line ${n.line_no}:** ${n.content}`)
      .join("\n\n");
    return `## ${file}\n\n${noteLines}`;
  });

  const md = `# Code Review Notes\n\n${sections.join("\n\n---\n\n")}\n`;
  writeFileSync(join(repoRoot, ".git-notes", "notes.md"), md);
}

export interface NoteEntry {
  content: string;
  authorName: string;
  authorEmail: string;
  gravatarHash: string;
}

export function getNotesForFile(repoRoot: string, file: string): Record<string, NoteEntry> {
  const db = getDb(repoRoot);
  const rows = db.query<{ line_no: number; content: string; author_name: string; author_email: string }, [string]>(
    "SELECT line_no, content, author_name, author_email FROM notes WHERE file = ?"
  ).all(file);
  return Object.fromEntries(rows.map((r) => [String(r.line_no), {
    content: r.content,
    authorName: r.author_name,
    authorEmail: r.author_email,
    gravatarHash: r.author_email ? gravatarHash(r.author_email) : "",
  }]));
}

export function getAllNotes(repoRoot: string): Record<string, Record<string, NoteEntry>> {
  const db = getDb(repoRoot);
  const rows = db.query<{ file: string; line_no: number; content: string; author_name: string; author_email: string }, []>(
    "SELECT file, line_no, content, author_name, author_email FROM notes ORDER BY file, line_no"
  ).all();
  const result: Record<string, Record<string, NoteEntry>> = {};
  for (const row of rows) {
    if (!result[row.file]) result[row.file] = {};
    result[row.file][String(row.line_no)] = {
      content: row.content,
      authorName: row.author_name,
      authorEmail: row.author_email,
      gravatarHash: row.author_email ? gravatarHash(row.author_email) : "",
    };
  }
  return result;
}
