import * as vscode from "vscode";
import { IgnoreEngine } from "../ignore/IgnoreEngine";
import { ProjectNode, ScanOptions } from "../types";

export class FileScanner {
  async scan(root: vscode.Uri, options: ScanOptions): Promise<ProjectNode> {
    const engine = new IgnoreEngine(
      root,
      options.respectGitignore,
      options.useFrameworkIgnores
    );
    await engine.initialize();
    await engine.loadGitignore();

    const rootName = root.path.split("/").filter(Boolean).pop() ?? "project";
    const children = await this.scanDirectory(root, "", engine, options, 0);

    return {
      id: "",
      name: rootName,
      relativePath: "",
      kind: "directory",
      ignored: false,
      children
    };
  }

  private async scanDirectory(
    uri: vscode.Uri,
    relativeDir: string,
    engine: IgnoreEngine,
    options: ScanOptions,
    depth: number
  ): Promise<ProjectNode[]> {
    if (depth > options.maxDepth) return [];

    const entries = await vscode.workspace.fs.readDirectory(uri);
    const nodes: ProjectNode[] = [];

    entries.sort(([a, aType], [b, bType]) => {
      const ad = aType === vscode.FileType.Directory ? 0 : 1;
      const bd = bType === vscode.FileType.Directory ? 0 : 1;
      return ad - bd || a.localeCompare(b);
    });

    for (const [name, type] of entries) {
      const kind = type === vscode.FileType.Directory ? "directory" : "file";
      const relativePath = relativeDir ? `${relativeDir}/${name}` : name;
      const ignored = engine.isIgnored(relativePath, kind);

      if (ignored && !options.showIgnored) continue;

      const node: ProjectNode = {
        id: relativePath,
        name,
        relativePath,
        kind,
        ignored
      };

      if (kind === "directory" && !ignored) {
        node.children = await this.scanDirectory(
          vscode.Uri.joinPath(uri, name),
          relativePath,
          engine,
          options,
          depth + 1
        );
      }

      nodes.push(node);
    }

    return nodes;
  }
}
