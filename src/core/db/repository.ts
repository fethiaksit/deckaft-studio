import { SCHEMA } from "./schema";
import {
  validateProject,
  type Project,
  type ProjectInput,
} from "../../modules/projects/model";
import {
  emptyDrawing,
  parseDrawing,
  type DrawingDocument,
} from "../../modules/drawing/model";
export interface SqlDatabase {
  execAsync(sql: string): Promise<void>;
  runAsync(
    sql: string,
    ...params: (string | number | null)[]
  ): Promise<{ changes: number }>;
  getAllAsync<T>(
    sql: string,
    ...params: (string | number | null)[]
  ): Promise<T[]>;
}
export const newId = () =>
  `${Date.now().toString(36)}-${Math.random().toString(36).slice(2, 12)}`;
export class ProjectRepository {
  constructor(private db: SqlDatabase) {}
  async init(): Promise<void> {
    const rows = await this.db.getAllAsync<{ user_version: number }>(
      "PRAGMA user_version",
    );
    if ((rows[0]?.user_version ?? 0) > 1)
      throw new Error("Veritabanı daha yeni bir uygulama sürümü gerektiriyor.");
    await this.db.execAsync(SCHEMA);
  }
  list(): Promise<Project[]> {
    return this.db.getAllAsync<Project>(
      "SELECT * FROM projects ORDER BY updatedAt DESC, id DESC",
    );
  }
  async get(id: string): Promise<Project | null> {
    return (
      (
        await this.db.getAllAsync<Project>(
          "SELECT * FROM projects WHERE id = ?",
          id,
        )
      )[0] ?? null
    );
  }
  async save(input: ProjectInput, id?: string): Promise<Project> {
    const p = validateProject(input);
    const now = new Date().toISOString();
    if (id) {
      const r = await this.db.runAsync(
        "UPDATE projects SET name=?, customer=?, city=?, district=?, description=?, type=?, updatedAt=? WHERE id=?",
        p.name,
        p.customer,
        p.city,
        p.district,
        p.description,
        p.type,
        now,
        id,
      );
      if (!r.changes) throw new Error("Proje bulunamadı. Silinmiş olabilir.");
    } else {
      id = newId();
      await this.db.runAsync(
        "INSERT INTO projects (id,name,customer,city,district,description,type,createdAt,updatedAt) VALUES (?,?,?,?,?,?,?,?,?)",
        id,
        p.name,
        p.customer,
        p.city,
        p.district,
        p.description,
        p.type,
        now,
        now,
      );
    }
    const saved = await this.get(id);
    if (!saved) throw new Error("Kaydedilen proje okunamadı.");
    return saved;
  }
  async delete(id: string): Promise<void> {
    await this.db.runAsync("DELETE FROM projects WHERE id=?", id);
  }
  async getDrawing(id: string): Promise<DrawingDocument> {
    if (!(await this.get(id))) throw new Error("Proje bulunamadı.");
    const rows = await this.db.getAllAsync<{ document: string }>(
      "SELECT document FROM drawings WHERE projectId=?",
      id,
    );
    return rows[0] ? parseDrawing(rows[0].document) : emptyDrawing();
  }
  async saveDrawing(id: string, document: DrawingDocument): Promise<void> {
    const serialized = JSON.stringify(document);
    parseDrawing(serialized);
    await this.db.runAsync(
      "INSERT INTO drawings (projectId,document,updatedAt) VALUES (?,?,?) ON CONFLICT(projectId) DO UPDATE SET document=excluded.document, updatedAt=excluded.updatedAt",
      id,
      serialized,
      new Date().toISOString(),
    );
  }
  async getSetting(key: string): Promise<string | null> {
    return (
      (
        await this.db.getAllAsync<{ value: string }>(
          "SELECT value FROM settings WHERE key=?",
          key,
        )
      )[0]?.value ?? null
    );
  }
  async setSetting(key: string, value: string): Promise<void> {
    await this.db.runAsync(
      "INSERT INTO settings (key,value) VALUES (?,?) ON CONFLICT(key) DO UPDATE SET value=excluded.value",
      key,
      value,
    );
  }
}
