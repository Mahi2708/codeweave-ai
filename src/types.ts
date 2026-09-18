export type NodeKind = "file" | "directory";

export interface ProjectNode {
  id: string;
  name: string;
  relativePath: string;
  kind: NodeKind;
  ignored: boolean;
  children?: ProjectNode[];
}

export interface ScanOptions {
  respectGitignore: boolean;
  useFrameworkIgnores: boolean;
  showIgnored: boolean;
  maxDepth: number;
}

export interface AIRequest {
  prompt: string;
  context: string;
  language?: string;
}

export interface AIProvider {
  readonly id: string;
  readonly label: string;
  generate(request: AIRequest, model: string): Promise<string>;
}
