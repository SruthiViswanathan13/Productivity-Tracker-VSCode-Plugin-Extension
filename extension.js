const vscode = require('vscode');

let activeSeconds = 0;
let lastActivityTime = Date.now();
const IDLE_THRESHOLD = 30 * 1000; // 30 seconds
let interval;
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
    context.subscriptions.push(
        vscode.window.onDidChangeTextEditorSelection(markActivity)
    );

    // Track file edits
    context.subscriptions.push(
        vscode.workspace.onDidChangeTextDocument((event) => {
            markActivity();
            handleFileChange(event, fileChangeLogs);
        })
    );

    // Track file creation
    context.subscriptions.push(
        vscode.workspace.onDidCreateFiles((event) => {
            handleFileCreation(event, fileChangeLogs);
        })
    );

    // Track file deletion
    context.subscriptions.push(
        vscode.workspace.onDidDeleteFiles((event) => {
            handleFileDeletion(event, fileChangeLogs)
        })
    );

    // Call writeDailyLog every 1 minute
    setInterval(() => {
        writeDailyLog(getLogFolderPath, fileChangeLogs, activeSeconds);
    }, 60 * 1000);
}

/**
 * Called when the extension is deactivated
 */
function deactivate() {
    stopActivityTimer();
        writeDailyLog(getLogFolderPath, fileChangeLogs, activeSeconds);
}

module.exports = {
    activate,
    deactivate
};
