import { create } from "zustand";
import type { Project } from "../../modules/projects/model";
import type { ProjectRepository } from "../db/repository";
export const errorMessage = (e: unknown) =>
  e instanceof Error ? e.message : "Beklenmeyen bir hata oluştu.";
interface ProjectState {
  projects: Project[];
  loading: boolean;
  error: string | null;
  load: (repo: ProjectRepository) => Promise<void>;
}
export const useProjects = create<ProjectState>((set) => ({
  projects: [],
  loading: false,
  error: null,
  load: async (repo) => {
    set({ loading: true, error: null });
    try {
      set({ projects: await repo.list() });
    } catch (e) {
      set({ error: errorMessage(e) });
    } finally {
      set({ loading: false });
    }
  },
}));
