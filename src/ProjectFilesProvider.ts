import * as vscode from 'vscode';
import * as path from 'path';

// Lớp này được export để các file khác có thể sử dụng
export class Dependency extends vscode.TreeItem {
  constructor(
    public readonly label: string,
    public readonly collapsibleState: vscode.TreeItemCollapsibleState,
    public readonly resourceUri: vscode.Uri,
    // Tham số contextValue đã được thêm vào đây
    public readonly contextValue: string 
  ) {
    super(label, collapsibleState);
    this.tooltip = `${this.label}`;
  }
}

export class ProjectFilesProvider implements vscode.TreeDataProvider<Dependency> {
  private _onDidChangeTreeData: vscode.EventEmitter<Dependency | undefined | null | void> = new vscode.EventEmitter<Dependency | undefined | null | void>();
  readonly onDidChangeTreeData: vscode.Event<Dependency | undefined | null | void> = this._onDidChangeTreeData.event;

  // Danh sách các file và thư mục cần bỏ qua
  private ignoreFolders = ['.git', 'node_modules', '.vscode', 'dist', 'out', 'build', '.idea'];
  private ignoreFiles = ['.DS_Store', 'pnpm-lock.yaml', 'package-lock.json', 'yarn.lock', '.gitignore'];

  constructor(private workspaceRoot: string | undefined) {}

  refresh(): void {
    this._onDidChangeTreeData.fire();
  }

  getTreeItem(element: Dependency): vscode.TreeItem {
    return element;
  }

  getChildren(element?: Dependency): Thenable<Dependency[]> {
    if (!this.workspaceRoot) {
      vscode.window.showInformationMessage('No project folder found in workspace');
      return Promise.resolve([]);
    }

    const targetPath = element ? element.resourceUri.fsPath : this.workspaceRoot;
    return this.getFilesInDirectory(targetPath);
  }

  private async getFilesInDirectory(dirPath: string): Promise<Dependency[]> {
    const dirEntries = await vscode.workspace.fs.readDirectory(vscode.Uri.file(dirPath));
    const dependencies: Dependency[] = [];

    for (const [name, type] of dirEntries) {
      if ((type === vscode.FileType.Directory && this.ignoreFolders.includes(name)) ||
          (type === vscode.FileType.File && this.ignoreFiles.includes(name))) {
        continue;
      }

      const uri = vscode.Uri.joinPath(vscode.Uri.file(dirPath), name);
      if (type === vscode.FileType.Directory) {
        // 'projectFile' được truyền vào làm contextValue
        dependencies.push(new Dependency(name, vscode.TreeItemCollapsibleState.Collapsed, uri, 'projectFile'));
      } else {
         // 'projectFile' được truyền vào làm contextValue
        dependencies.push(new Dependency(name, vscode.TreeItemCollapsibleState.None, uri, 'projectFile'));
      }
    }

    // Sắp xếp: thư mục lên trước, sau đó đến file, tất cả theo alphabet
    dependencies.sort((a, b) => {
        if (a.collapsibleState === b.collapsibleState) {
            return a.label.localeCompare(b.label);
        }
        return a.collapsibleState === vscode.TreeItemCollapsibleState.Collapsed ? -1 : 1;
    });

    return dependencies;
  }
}