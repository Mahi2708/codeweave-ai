import * as vscode from "vscode";

export async function renameUri(uri: vscode.Uri, newName: string): Promise<vscode.Uri> {
  if (!newName.trim() || /[\\/]/.test(newName)) {
    throw new Error("Enter a valid file or folder name.");
  }

  const parent = vscode.Uri.joinPath(uri, "..");
  const target = vscode.Uri.joinPath(parent, newName.trim());
  await vscode.workspace.fs.rename(uri, target, { overwrite: false });
  return target;
}

export async function createFile(parent: vscode.Uri, name: string, content = ""): Promise<vscode.Uri> {
  if (!name.trim() || /[\\/]/.test(name)) throw new Error("Enter a valid file name.");
  const target = vscode.Uri.joinPath(parent, name.trim());
  await vscode.workspace.fs.writeFile(target, Buffer.from(content, "utf8"));
  return target;
}

export async function createFolder(parent: vscode.Uri, name: string): Promise<vscode.Uri> {
  if (!name.trim() || /[\\/]/.test(name)) throw new Error("Enter a valid folder name.");
  const target = vscode.Uri.joinPath(parent, name.trim());
  await vscode.workspace.fs.createDirectory(target);
  return target;
}
