import * as vscode from "vscode";
import ignore, { Ignore } from "ignore";

const UNIVERSAL_IGNORES = [
  ".git/",
  ".svn/",
  ".hg/",
  ".DS_Store",
  "Thumbs.db",
  "node_modules/",
  ".pnpm-store/",
  ".yarn/cache/",
  ".yarn/install-state.gz",
  ".next/",
  ".nuxt/",
  ".output/",
  ".turbo/",
  ".parcel-cache/",
  ".vite/",
  ".cache/",
  "coverage/",
  ".nyc_output/",
  "dist/",
  "build/",
  "out/",
  "target/",
  ".gradle/",
  ".idea/",
  ".vscode-test/",
  "__pycache__/",
  ".pytest_cache/",
  ".mypy_cache/",
  ".ruff_cache/",
  ".venv/",
  "venv/",
  "env/",
  "site-packages/",
  ".tox/",
  "bin/",
  "obj/",
  "Debug/",
  "Release/",
  "cmake-build-*/",
  ".cxx/",
  "vendor/",
  ".terraform/",
  ".serverless/",
  ".aws-sam/",
  "Pods/",
  "DerivedData/",
  "*.pyc",
  "*.pyo",
  "*.class",
  "*.o",
  "*.obj",
  "*.dll",
  "*.exe",
  "*.so",
  "*.dylib",
  "*.a"
];

const PROJECT_MARKERS: Record<string, string[]> = {
  "node": ["package.json", "package-lock.json", "pnpm-lock.yaml", "yarn.lock", "bun.lockb", "bun.lock"],
  "next": ["next.config.js", "next.config.mjs", "next.config.ts"],
  "nuxt": ["nuxt.config.ts", "nuxt.config.js"],
  "java": ["pom.xml", "build.gradle", "build.gradle.kts"],
  "python": ["pyproject.toml", "requirements.txt", "setup.py", "Pipfile", "poetry.lock"],
  "rust": ["Cargo.toml"],
  "go": ["go.mod"],
  "dotnet": [".sln", ".csproj", ".fsproj"],
  "php": ["composer.json"],
  "ruby": ["Gemfile"],
  "android": ["gradlew", "settings.gradle", "settings.gradle.kts"],
  "flutter": ["pubspec.yaml"],
  "swift": ["Package.swift", "Podfile"],
  "cpp": ["CMakeLists.txt", "Makefile"]
};

export class IgnoreEngine {
  private gitIgnore: Ignore = ignore();
  private frameworkIgnore: Ignore = ignore();

  constructor(
    private readonly workspaceRoot: vscode.Uri,
    private readonly respectGitignore: boolean,
    private readonly useFrameworkIgnores: boolean
  ) {}

  async initialize(): Promise<void> {
    this.frameworkIgnore.add(UNIVERSAL_IGNORES);
    if (!this.useFrameworkIgnores) return;

    const rootEntries = await vscode.workspace.fs.readDirectory(this.workspaceRoot);
    const names = new Set(rootEntries.map(([name]) => name));

    for (const markerNames of Object.values(PROJECT_MARKERS)) {
      if (markerNames.some(marker => [...names].some(name => marker === name || (marker.startsWith(".") && name.endsWith(marker))))) {
        // The universal list is intentionally broad; project-specific additions can be
        // added here as the extension grows.
      }
    }

    // Framework-specific paths that are not safe to classify universally.
    if (names.has("next.config.js") || names.has("next.config.mjs") || names.has("next.config.ts")) {
      this.frameworkIgnore.add([".next/", "out/"]);
    }
    if (names.has("Cargo.toml")) this.frameworkIgnore.add(["target/"]);
    if (names.has("pom.xml") || names.has("build.gradle") || names.has("build.gradle.kts")) {
      this.frameworkIgnore.add(["target/", ".gradle/", "build/"]);
    }
    if (names.has("pubspec.yaml")) this.frameworkIgnore.add([".dart_tool/", "build/"]);
  }

  async loadGitignore(): Promise<void> {
    if (!this.respectGitignore) return;
    try {
      const bytes = await vscode.workspace.fs.readFile(vscode.Uri.joinPath(this.workspaceRoot, ".gitignore"));
      const text = Buffer.from(bytes).toString("utf8");
      this.gitIgnore.add(text.split(/\r?\n/));
    } catch {
      // No root .gitignore is normal.
    }
  }

  isIgnored(relativePath: string, kind: "file" | "directory"): boolean {
    const normalized = relativePath.replace(/\\/g, "/").replace(/^\/+/, "");
    const pathForIgnore = kind === "directory" && !normalized.endsWith("/")
      ? `${normalized}/`
      : normalized;

    if (this.respectGitignore && this.gitIgnore.ignores(pathForIgnore)) return true;
    if (this.useFrameworkIgnores && this.frameworkIgnore.ignores(pathForIgnore)) return true;
    return false;
  }
}
