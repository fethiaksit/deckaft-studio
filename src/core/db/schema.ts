export const SCHEMA = `
PRAGMA foreign_keys = ON;
PRAGMA journal_mode = WAL;
CREATE TABLE IF NOT EXISTS projects (
  id TEXT PRIMARY KEY NOT NULL,
  name TEXT NOT NULL, customer TEXT NOT NULL DEFAULT '',
  city TEXT NOT NULL, district TEXT NOT NULL, description TEXT NOT NULL DEFAULT '',
  type TEXT NOT NULL CHECK(type IN ('Deck','Teras','Pergola','Diğer')),
  createdAt TEXT NOT NULL, updatedAt TEXT NOT NULL
);
CREATE TABLE IF NOT EXISTS drawings (
  projectId TEXT PRIMARY KEY NOT NULL REFERENCES projects(id) ON DELETE CASCADE,
  document TEXT NOT NULL, updatedAt TEXT NOT NULL
);
CREATE TABLE IF NOT EXISTS settings (key TEXT PRIMARY KEY NOT NULL, value TEXT NOT NULL);

`;

export const FRAMING_MIGRATION = `
BEGIN IMMEDIATE;
CREATE TABLE IF NOT EXISTS framing_plans (
 id TEXT PRIMARY KEY NOT NULL,
 projectId TEXT UNIQUE NOT NULL REFERENCES projects(id) ON DELETE CASCADE,
 document TEXT NOT NULL,
 createdAt TEXT NOT NULL,
 updatedAt TEXT NOT NULL
);
PRAGMA user_version = 2;
COMMIT;
`;
