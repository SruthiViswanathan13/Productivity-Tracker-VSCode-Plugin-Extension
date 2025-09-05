const vscode = require('vscode');

let activeSeconds = 0;
let lastActivityTime = Date.now();
const IDLE_THRESHOLD = 30 * 1000; // 30 seconds
let interval;
let activityDisposables = [];
let fileChangeLogs = [];

const { selectLogFolder, getLogFolderPath } = require('./helper/SelectLogFolder');
const { startActivityTimer, stopActivityTimer } = require('./helper/ActivityMonitor');
const { writeDailyLog, handleFileChange, handleFileCreation, handleFileDeletion } = require('./helper/FileHandler');

/**
 * Marks recent activity time.
 */
function markActivity() {
    lastActivityTime = Date.now();
}

/**
 * Called when the extension is activated
 */
function activate(context) {

    let disposable = vscode.commands.registerCommand('productivity-tracker.selectLogFolder', selectLogFolder);
    context.subscriptions.push(disposable);

    // Start timer to count active seconds
    interval = startActivityTimer(() => lastActivityTime,
        IDLE_THRESHOLD, () => { activeSeconds++; }
    );

    // Track cursor activity as activity
    activityDisposables.push(
        vscode.window.onDidChangeTextEditorSelection(markActivity)
    );

    // Track file edits
    activityDisposables.push(
        vscode.workspace.onDidChangeTextDocument((event) => {
            const logFolder = getLogFolderPath();
            if (event.document.uri.fsPath.startsWith(logFolder)) return;
            markActivity();
            handleFileChange(event, fileChangeLogs);
        })
    );

    // Track file creation
    activityDisposables.push(
        vscode.workspace.onDidCreateFiles((event) => {
            const logFolder = getLogFolderPath();
            const isLogFile = event.files.some(file => file.fsPath.startsWith(logFolder));
            if (isLogFile) return;
            markActivity();
            handleFileCreation(event, fileChangeLogs);
        })
    );

    // Track file deletion
    activityDisposables.push(
        vscode.workspace.onDidDeleteFiles((event) => {
            const logFolder = getLogFolderPath();
            const isLogFile = event.files.some(file => file.fsPath.startsWith(logFolder));
            if (isLogFile) return;
            markActivity();
            handleFileDeletion(event, fileChangeLogs);
        })
    );

    // Call writeDailyLog every 1 minute
    // Store interval so it can be cleared on deactivate
    activityDisposables.push({ dispose: () => clearInterval(interval) });
    activityDisposables.push({ dispose: () => clearInterval(this.logInterval) });
    this.logInterval = setInterval(() => {
        writeDailyLog(getLogFolderPath, fileChangeLogs, activeSeconds);
    }, 60 * 1000);
}

/**
 * Called when the extension is deactivated
 */
function deactivate() {
    stopActivityTimer();
    if (activityDisposables && activityDisposables.length) {
        activityDisposables.forEach(d => {
            if (d && typeof d.dispose === 'function') {
                d.dispose();
            }
        });
    }
    if (this.logInterval) {
        clearInterval(this.logInterval);
        this.logInterval = null;
    }
    writeDailyLog(getLogFolderPath, fileChangeLogs, activeSeconds);
}

module.exports = {
    activate,
    deactivate
};
