import * as vscode from 'vscode';
import * as path from 'path';
import { Dependency, ProjectFilesProvider } from './ProjectFilesProvider';
import { SelectedFilesProvider } from './SelectedFilesProvider';
import { TreeNode } from './tree';

// --- CÁC HẰNG SỐ CẤU HÌNH BỎ QUA ---
const IGNORE_FOLDERS = ['.git', 'node_modules', '.vscode', 'dist', 'out', 'build', '.idea', 'target', '.next'];
const IGNORE_FILES = ['.DS_Store', 'pnpm-lock.yaml', 'package-lock.json', 'yarn.lock', '.gitignore'];
const IGNORE_EXTENSIONS = ['.png', '.jpg', '.jpeg', '.gif', '.svg', '.ico', '.webp', '.pdf', '.zip', '.rar', '.exe', '.dll', '.o', '.a', '.so', '.lock'];


export function activate(context: vscode.ExtensionContext) {

    console.log('AI Prompt Combiner is now active!');

    const rootUri = (vscode.workspace.workspaceFolders && (vscode.workspace.workspaceFolders.length > 0))
        ? vscode.workspace.workspaceFolders[0].uri : undefined;

    if (!rootUri) {
        vscode.window.showInformationMessage("Please open a project folder to use AI Prompt Combiner.");
        return;
    }

    // ===== STATE MANAGEMENT: Dùng cấu trúc Tree để lưu trữ lựa chọn =====
    const selectionTree: TreeNode = { uri: rootUri, children: new Map() };

    // --- KHỞI TẠO CÁC VIEW PROVIDER ---
    const projectFilesProvider = new ProjectFilesProvider(rootUri.fsPath);
    vscode.window.registerTreeDataProvider('ai-prompt-source-view', projectFilesProvider);
    
    const selectedFilesProvider = new SelectedFilesProvider(selectionTree);
    vscode.window.registerTreeDataProvider('ai-prompt-selected-view', selectedFilesProvider);

    // --- ĐĂNG KÝ CÁC LỆNH ---

    vscode.commands.registerCommand('ai-prompt-combiner.refresh', () => projectFilesProvider.refresh());
    
    // Lệnh THÊM: thêm file/thư mục vào cây lựa chọn
    vscode.commands.registerCommand('ai-prompt-combiner.addFile', async (item: Dependency) => {
        const filesToAdd: vscode.Uri[] = [];
        const stat = await vscode.workspace.fs.stat(item.resourceUri);
        if (stat.type === vscode.FileType.Directory) {
            await getFilesRecursively(item.resourceUri, filesToAdd);
        } else {
            filesToAdd.push(item.resourceUri);
        }

        for (const file of filesToAdd) {
            addToTree(selectionTree, file, rootUri);
        }
        selectedFilesProvider.refresh();
    });

    // Lệnh XÓA: xóa file/thư mục khỏi cây lựa chọn
    vscode.commands.registerCommand('ai-prompt-combiner.removeFile', async (item: Dependency) => {
        const urisToRemove = await getAllUrisFromNode(item.resourceUri, selectionTree, rootUri);
        for(const uri of urisToRemove) {
            removeFromTree(selectionTree, uri, rootUri);
        }
        selectedFilesProvider.refresh();
    });

    // Lệnh COMPILE: tạo file output cuối cùng
    const compileCommand = vscode.commands.registerCommand('ai-prompt-combiner.compile', async () => {
        const allFiles = await getAllUrisFromNode(rootUri, selectionTree, rootUri);
        if (allFiles.length === 0) {
            vscode.window.showWarningMessage('No files selected to combine.');
            return;
        }
        
        vscode.window.showInformationMessage('Generating project structure...');
        const projectStructure = await generateDirectoryTree(rootUri, 0, 10);
        
        let combinedContent = `//--- PROJECT STRUCTURE ---\n\n${projectStructure}\n\n//--- FILE CONTENTS ---\n\n`;

        for (const fileUri of allFiles) {
            try {
                const relativePath = path.relative(rootUri.fsPath, fileUri.fsPath).replace(/\\/g, '/');
                const contentBuffer = await vscode.workspace.fs.readFile(fileUri);
                const content = contentBuffer.toString();
                combinedContent += `//--- FILE: ${relativePath} ---\n\n`;
                combinedContent += content;
                combinedContent += '\n\n//--- END OF FILE: ' + relativePath + ' ---\n\n';
            } catch (error) {
                console.error(`Error reading file ${fileUri.fsPath}:`, error);
            }
        }
        
        const outputUri = vscode.Uri.joinPath(rootUri, 'combined_prompt.txt');
        try {
            const outputBuffer = Buffer.from(combinedContent, 'utf8');
            await vscode.workspace.fs.writeFile(outputUri, outputBuffer);
            const openAction = 'Open File';
            vscode.window.showInformationMessage(`Successfully created combined_prompt.txt!`, openAction)
                .then(selection => {
                    if (selection === openAction) {
                        vscode.window.showTextDocument(outputUri);
                    }
                });
        } catch (error) {
            vscode.window.showErrorMessage(`Failed to write to combined_prompt.txt. See console for details.`);
            console.error('Error writing combined file:', error);
        }
    });

    context.subscriptions.push(compileCommand);
}

export function deactivate() {}


// =====================================================================
// ======================= CÁC HÀM HELPER ==============================
// =====================================================================

function addToTree(root: TreeNode, uri: vscode.Uri, workspaceRoot: vscode.Uri) {
    const relativePath = path.relative(workspaceRoot.fsPath, uri.fsPath);
    const parts = relativePath.split(path.sep);
    let currentNode = root;
    for (let i = 0; i < parts.length; i++) {
        const part = parts[i];
        if (!currentNode.children.has(part)) {
            const newUri = vscode.Uri.joinPath(currentNode.uri, part);
            currentNode.children.set(part, { uri: newUri, children: new Map() });
        }
        currentNode = currentNode.children.get(part)!;
    }
}

function removeFromTree(root: TreeNode, uri: vscode.Uri, workspaceRoot: vscode.Uri): boolean {
    const relativePath = path.relative(workspaceRoot.fsPath, uri.fsPath);
    const parts = relativePath.split(path.sep);
    return removeRecursive(root, parts);
}

function removeRecursive(node: TreeNode, parts: string[]): boolean {
    if (parts.length === 0) return false;
    const part = parts.shift()!;
    const childNode = node.children.get(part);
    if (!childNode) return false;
    if (parts.length === 0) {
        node.children.delete(part);
    } else {
        if (removeRecursive(childNode, parts)) {
            if (childNode.children.size === 0) {
                node.children.delete(part);
            }
        }
    }
    return node.children.size === 0;
}

async function getAllUrisFromNode(startUri: vscode.Uri, root: TreeNode, workspaceRoot: vscode.Uri): Promise<vscode.Uri[]> {
    const relativePath = path.relative(workspaceRoot.fsPath, startUri.fsPath);
    const parts = relativePath.split(path.sep).filter(p => p.length > 0);
    let startNode = root;
    if (startUri.fsPath !== workspaceRoot.fsPath) {
        for (const part of parts) {
            if (startNode.children.has(part)) {
                startNode = startNode.children.get(part)!;
            } else {
                return [];
            }
        }
    }
    const files: vscode.Uri[] = [];
    const queue: TreeNode[] = [startNode];
    while (queue.length > 0) {
        const node = queue.shift()!;
        if (node.children.size > 0) {
            queue.push(...Array.from(node.children.values()));
        } else {
            if(node.uri.fsPath !== workspaceRoot.fsPath) {
                 files.push(node.uri);
            }
        }
    }
    return files;
}

async function getFilesRecursively(uri: vscode.Uri, fileList: vscode.Uri[]): Promise<void> {
    try {
        const stat = await vscode.workspace.fs.stat(uri);
        const name = uri.path.split('/').pop() || '';
        if (stat.type === vscode.FileType.Directory) {
            if (IGNORE_FOLDERS.includes(name)) return;
            const entries = await vscode.workspace.fs.readDirectory(uri);
            for (const [entryName] of entries) {
                await getFilesRecursively(vscode.Uri.joinPath(uri, entryName), fileList);
            }
        } else if (stat.type === vscode.FileType.File) {
            const fileExtension = path.extname(name).toLowerCase();
            if (IGNORE_FILES.includes(name) || IGNORE_EXTENSIONS.includes(fileExtension)) return;
            fileList.push(uri);
        }
    } catch (error) {
        console.error(`Error processing URI ${uri.fsPath}:`, error);
    }
}

async function generateDirectoryTree(uri: vscode.Uri, depth: number, maxDepth: number, prefix: string = '', isLast: boolean = true): Promise<string> {
    if (depth > maxDepth) return '';
    const name = path.basename(uri.fsPath);
    if (depth > 0 && (IGNORE_FOLDERS.includes(name) || IGNORE_FILES.includes(name))) return '';
    let treeString = (depth > 0 ? prefix + (isLast ? '└── ' : '├── ') : '') + name + '\n';
    try {
        const stat = await vscode.workspace.fs.stat(uri);
        if (stat.type === vscode.FileType.Directory) {
            const entries = await vscode.workspace.fs.readDirectory(uri);
            const filteredEntries = entries
                .map(([name, type]) => ({ name, type }))
                .filter(e => !IGNORE_FOLDERS.includes(e.name) && !IGNORE_FILES.includes(e.name))
                .sort((a, b) => {
                    if (a.type === b.type) return a.name.localeCompare(b.name);
                    return a.type === vscode.FileType.Directory ? -1 : 1;
                });
            for (let i = 0; i < filteredEntries.length; i++) {
                const entry = filteredEntries[i];
                const childUri = vscode.Uri.joinPath(uri, entry.name);
                const isChildLast = i === filteredEntries.length - 1;
                const newPrefix = prefix + (isLast ? '    ' : '|   ');
                treeString += await generateDirectoryTree(childUri, depth + 1, maxDepth, newPrefix, isChildLast);
            }
        }
    } catch (e) { /* ignore */ }
    return treeString;
}