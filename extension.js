const vscode = require('vscode');
const fs = require('fs');
const path = require('path');

let activeSeconds = 0;
let lastActivityTime = Date.now();
const IDLE_THRESHOLD = 30 * 1000; // 30 seconds
let interval;
let fileChangeLogs = [];

/**
 * Marks recent activity
 */
function markActivity() {
    lastActivityTime = Date.now();
}

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
        vscode.window.showInformationMessage('No folder selected. Using default log folder.');
    }
}

function getLogFolderPath() {
    return logFolderPath || DEFAULT_LOG_FOLDER;
}

/**
 * Called when the extension is activated
 */
function activate(context) {

    let disposable = vscode.commands.registerCommand('productivity-tracker.selectLogFolder', selectLogFolder);
    context.subscriptions.push(disposable);
    // Print log folder path on activation
    console.log('Log folder on activation:', getLogFolderPath());

    // Start timer to count active seconds
    interval = setInterval(() => {
        if (Date.now() - lastActivityTime < IDLE_THRESHOLD) {
            activeSeconds++;
        }
    }, 1000);

    // Track cursor activity as activity
    context.subscriptions.push(
        vscode.window.onDidChangeTextEditorSelection(markActivity)
    );

    // Track file edits
    context.subscriptions.push(
        vscode.workspace.onDidChangeTextDocument((event) => {
            markActivity();
            const contentChanges = event.contentChanges;

            let added = 0, removed = 0;
            let codeChanges = '';

            contentChanges.forEach(change => {
                const newLines = change.text.split('\n').length - 1;
                const oldLines = change.range.end.line - change.range.start.line;
                added += newLines;
                removed += oldLines;
                // Only log meaningful code changes (not just whitespace or repeated accidental typing)
                if (change.text && /\S/.test(change.text)) {
                    // Avoid logging repeated accidental retyping by checking for duplicate consecutive text
                    if (!codeChanges.endsWith(change.text)) {
                        codeChanges += change.text;
                    }
                }
            });

            const filePath = event.document.uri.fsPath;
            // Check if Copilot is enabled
            const copilotExt = vscode.extensions.getExtension('GitHub.copilot');
            const isCopilotEnabled = copilotExt && copilotExt.isActive;
            const existing = fileChangeLogs.find(f => f.filePath === filePath);
            if (existing) {
                existing.linesAdded += added;
                existing.linesRemoved += removed;
                existing.isCopilotEnabled = isCopilotEnabled;
                if (existing.codeChanges) {
                    existing.codeChanges += codeChanges;
                } else {
                    existing.codeChanges = codeChanges;
                }
            } else {
                fileChangeLogs.push({
                    filePath,
                    action: 'modified',
                    linesAdded: added,
                    linesRemoved: removed,
                    isCopilotEnabled,
                    codeChanges
                });
            }
        })
    );

        // Track file creation
    context.subscriptions.push(
        vscode.workspace.onDidCreateFiles((event) => {
            event.files.forEach(file => {
                const filePath = file.fsPath;
                const copilotExt = vscode.extensions.getExtension('GitHub.copilot');
                const isCopilotEnabled = copilotExt && copilotExt.isActive;
                fileChangeLogs.push({
                    filePath,
                    action: 'created',
                    isCopilotEnabled,
                    timestamp: new Date().toISOString()
                });
            });
        })
    );

    // Track file deletion
    context.subscriptions.push(
        vscode.workspace.onDidDeleteFiles((event) => {
            event.files.forEach(file => {
                const filePath = file.fsPath;
                const copilotExt = vscode.extensions.getExtension('GitHub.copilot');
                const isCopilotEnabled = copilotExt && copilotExt.isActive;
                fileChangeLogs.push({
                    filePath,
                    action: 'deleted',
                    isCopilotEnabled,
                    timestamp: new Date().toISOString()
                });
            });
        })
    );

    // Call writeDailyLog every 1 minute
    setInterval(writeDailyLog, 60 * 1000);
}

function writeDailyLog() {
    const today = new Date().toISOString().slice(0, 10);
    const logDir = path.join(getLogFolderPath());
    const logFile = path.join(logDir, `${today}.json`);

    if (!fs.existsSync(logDir)) {
        fs.mkdirSync(logDir);
    }

    let logs = {};
    if (fs.existsSync(logFile)) {
        try {
            const existing = fs.readFileSync(logFile, 'utf8');
            logs = JSON.parse(existing);
        } catch (e) {
            logs = {};
        }
    }

    if (!logs[today]) {
        logs[today] = [];
    }

    // Merge file changes for today
    fileChangeLogs.forEach(newLog => {
        const existingIdx = logs[today].findIndex(l => l.filePath === newLog.filePath);
        if (existingIdx !== -1) {
            logs[today][existingIdx].action = newLog.action;
            logs[today][existingIdx].linesAdded += newLog.linesAdded;
            logs[today][existingIdx].linesRemoved += newLog.linesRemoved;
            logs[today][existingIdx].isCopilotEnabled = newLog.isCopilotEnabled;
            logs[today][existingIdx].codeChanges = (logs[today][existingIdx].codeChanges || '') + (newLog.codeChanges || '');
            if (activeSeconds < 60) {
                logs[today][existingIdx].activeSeconds = activeSeconds;
                logs[today][existingIdx].activeMinutes = 0;
            } else {
                logs[today][existingIdx].activeMinutes = Math.floor(activeSeconds / 60);
                logs[today][existingIdx].activeSeconds = 0;
            }
        } else {
            logs[today].push({
                filePath: newLog.filePath,
                action: newLog.action,
                linesAdded: newLog.linesAdded,
                linesRemoved: newLog.linesRemoved,
                isCopilotEnabled: newLog.isCopilotEnabled,
                codeChanges: newLog.codeChanges,
                activeSeconds: (activeSeconds < 60) ? activeSeconds : 0,
                activeMinutes: (activeSeconds > 60) ? Math.floor(activeSeconds / 60) : 0
            });
        }
    });

    fs.writeFileSync(logFile, JSON.stringify(logs, null, 2));
}

/**
 * Called when the extension is deactivated
 */
function deactivate() {
    clearInterval(interval);
    writeDailyLog();
}

module.exports = {
    activate,
    deactivate
};
