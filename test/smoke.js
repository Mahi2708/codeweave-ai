const fs = require("fs");
const path = require("path");

const required = [
  "package.json",
  "tsconfig.json",
  "src/extension.ts",
  "src/filesystem/scanner.ts",
  "src/ignore/IgnoreEngine.ts",
  "src/tree/TreeFormatter.ts",
  "src/ai/AIRouter.ts"
];

for (const file of required) {
  if (!fs.existsSync(path.join(__dirname, "..", file))) {
    throw new Error(`Missing ${file}`);
  }
}

const pkg = require("../package.json");
if (pkg.name !== "editree-ai") throw new Error("Unexpected package name");

console.log("Editree AI smoke test passed.");
