import * as vscode from 'vscode';

export interface WorkspaceSelection {
  folder?: vscode.WorkspaceFolder;
  key: string;
}

export function resolveWorkspaceFolder(): WorkspaceSelection {
  const folders = vscode.workspace.workspaceFolders;
  if (!folders || folders.length === 0) {
    return { key: 'global:no-folder' };
  }

  const cfg = vscode.workspace.getConfiguration('naas');
  const preferredName = cfg.get<string>('workspaceFolder', '').trim();

  if (preferredName) {
    const matched = folders.find((folder) => folder.name === preferredName);
    if (matched) {
      return { folder: matched, key: matched.uri.toString() };
    }
  }

  const selected = folders[0];
  if (!selected) {
    return { key: 'global:no-folder' };
  }
  return { folder: selected, key: selected.uri.toString() };
}
