import * as vscode from 'vscode';

/**
 * Định nghĩa một nút trong cây thư mục được chọn.
 * Mỗi nút đại diện cho một file hoặc một thư mục.
 */
export interface TreeNode {
  /**
   * URI đầy đủ của file/thư mục.
   */
  uri: vscode.Uri;
  /**
   * Các nút con của nút hiện tại.
   * Dùng Map với key là tên của file/thư mục con (ví dụ: 'components')
   * và value là chính TreeNode con đó.
   */
  children: Map<string, TreeNode>;
}