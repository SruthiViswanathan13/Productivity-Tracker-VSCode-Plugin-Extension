const vscode = require('vscode');

let logFolderPath = undefined;
const DEFAULT_LOG_FOLDER = 'C:/Productivity-Tracker';

async function selectLogFolder() {
    const folderUri = await vscode.window.showOpenDialog({
        canSelectFiles: false,
        canSelectFolders: true,
        canSelectMany: false,
        openLabel: 'Select log folder'
    });
    if (folderUri && folderUri[0]) {
        logFolderPath = folderUri[0].fsPath;
        vscode.window.showInformationMessage('Log folder set to: ' + logFolderPath);
    } else {
        vscode.window.showInformationMessage('No folder selected. Using default location: ' + DEFAULT_LOG_FOLDER);
    }
}

function getLogFolderPath() {
    return logFolderPath || DEFAULT_LOG_FOLDER;
}

module.exports = { selectLogFolder, getLogFolderPath };