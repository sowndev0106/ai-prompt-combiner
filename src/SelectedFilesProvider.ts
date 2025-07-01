import * as vscode from 'vscode';
import * as path from 'path';
// Import các lớp dùng chung
import { Dependency } from './ProjectFilesProvider';
import { TreeNode } from './tree';

export class SelectedFilesProvider implements vscode.TreeDataProvider<Dependency> {
  private _onDidChangeTreeData: vscode.EventEmitter<Dependency | undefined | null | void> = new vscode.EventEmitter<Dependency | undefined | null | void>();
  readonly onDidChangeTreeData: vscode.Event<Dependency | undefined | null | void> = this._onDidChangeTreeData.event;

  // Constructor bây giờ nhận vào một TreeNode thay vì Set
  constructor(private selectionTree: TreeNode) {}

  refresh(): void {
    this._onDidChangeTreeData.fire();
  }

  getTreeItem(element: Dependency): vscode.TreeItem {
    return element;
  }

  // getChildren được viết lại hoàn toàn để đọc từ cây
  getChildren(element?: Dependency): Thenable<Dependency[]> {
    // Nếu không có element, chúng ta đang ở cấp gốc. Lấy các con của nút gốc của cây.
    // Nếu có element, tìm nút tương ứng trong cây và lấy các con của nó.
    const parentNode = element ? this.findNode(element.resourceUri) : this.selectionTree;

    if (!parentNode) {
      return Promise.resolve([]);
    }

    // Chuyển các nút con từ Map thành một mảng các Dependency để hiển thị
    const childrenItems = Array.from(parentNode.children.values()).map(node => {
      const label = path.basename(node.uri.fsPath);
      // Một nút có thể thu gọn (là thư mục) nếu nó có con
      const collapsibleState = node.children.size > 0
        ? vscode.TreeItemCollapsibleState.Collapsed
        : vscode.TreeItemCollapsibleState.None;

      return new Dependency(label, collapsibleState, node.uri, 'selectedFile');
    });

    // Sắp xếp thư mục trước, file sau
    childrenItems.sort((a, b) => {
        if (a.collapsibleState === b.collapsibleState) {
            return a.label.localeCompare(b.label);
        }
        return a.collapsibleState === vscode.TreeItemCollapsibleState.Collapsed ? -1 : 1;
    });

    return Promise.resolve(childrenItems);
  }

  /**
   * Hàm helper để tìm một TreeNode trong cây dựa vào URI.
   */
  private findNode(uri: vscode.Uri): TreeNode | undefined {
    const workspaceRoot = this.selectionTree.uri;
    // Nếu URI là của thư mục gốc, trả về ngay nút gốc của cây
    if (uri.fsPath === workspaceRoot.fsPath) {
        return this.selectionTree;
    }

    const relativePath = path.relative(workspaceRoot.fsPath, uri.fsPath);
    const parts = relativePath.split(path.sep);

    let currentNode = this.selectionTree;
    for (const part of parts) {
        const child = currentNode.children.get(part);
        if (child) {
            currentNode = child;
        } else {
            // Không tìm thấy đường dẫn trong cây
            return undefined; 
        }
    }
    return currentNode;
  }
}