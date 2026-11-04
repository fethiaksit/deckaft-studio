export interface ExportRequest {
  projectId: string;
  format: "pdf";
  sections: ("drawing" | "framing" | "cutting")[];
  paper: "A4" | "A3";
  orientation: "portrait" | "landscape";
}
export interface ExportArtifact {
  id: string;
  projectId: string;
  uri: string;
  createdAt: string;
}
