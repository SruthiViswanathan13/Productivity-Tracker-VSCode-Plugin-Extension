const vscode = require('vscode');
const fs = require('fs');
const path = require('path');
const os = require('os');
const { execSync } = require('child_process');

let username = os.userInfo().username;

let email = '';
try {
  email = execSync('git config user.email').toString().trim();
  username = execSync('git config user.name').toString().trim();
} catch (err) {
  email = 'Not found';
}

function writeDailyLog(getLogFolderPath, fileChangeLogs, activeSeconds) {
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
            logs = { 
                email: email,
                userName: username,
                timeSpentInIDE: '00:00:00', 
                totalFilesModified: 0, 
                totalFilesAdded: 0,
                totalFilesDeleted: 0
            };
        }
    }

    // Calculate total IDE time in HH:MM:SS format
    function formatTime(seconds) {
        const h = Math.floor(seconds / 3600);
        const m = Math.floor((seconds % 3600) / 60);
        const s = seconds % 60;
        return [h, m, s].map(v => String(v).padStart(2, '0')).join(':');
    }

    // Accumulate timeSpentInIDE for today
    let previousSeconds = 0;
    if (logs.timeSpentInIDE && typeof logs.timeSpentInIDE === 'string') {
        const parts = logs.timeSpentInIDE.split(':').map(Number);
        if (parts.length === 3) {
            previousSeconds = parts[0] * 3600 + parts[1] * 60 + parts[2];
        }
    }
    const timeSpentInIDE = formatTime(previousSeconds + activeSeconds);

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

    // Count unique files for each action for today
    const modifiedFiles = new Set();
    const addedFiles = new Set();
    const deletedFiles = new Set();
    logs[today].forEach(log => {
        if (log.action === 'modified') modifiedFiles.add(log.filePath);
        if (log.action === 'created') addedFiles.add(log.filePath);
        if (log.action === 'deleted') deletedFiles.add(log.filePath);
    });

    logs.totalFilesModified = modifiedFiles.size;
    logs.totalFilesAdded = addedFiles.size;
    logs.totalFilesDeleted = deletedFiles.size;

    // Add timeSpentInIDE to the top level of the log file
    logs.timeSpentInIDE = timeSpentInIDE;
    logs.email = email;
    logs.userName = username;
    fs.writeFileSync(logFile, JSON.stringify(logs, null, 2));
    // Reset activeSeconds after writing log to prevent double-counting
    if (typeof global !== 'undefined' && global.activeSeconds !== undefined) {
        global.activeSeconds = 0;
    }
    if (typeof activeSeconds === 'object' && activeSeconds !== null) {
        activeSeconds.value = 0;
    }
}

function getGitDiff(filePath) {
    try {
        // Get the diff for the file (unstaged changes)
        const diff = execSync(`git --no-pager diff "${filePath}"`, { cwd: path.dirname(filePath) }).toString();
        return diff;
    } catch (e) {
        return '';
    }
}

function handleFileChange(event, fileChangeLogs) {
    const filePath = event.document.uri.fsPath;
    let added = 0, removed = 0;
    event.contentChanges.forEach(change => {
        const newLines = change.text.split('\n').length - 1;
        const oldLines = change.range.end.line - change.range.start.line;
        added += newLines;
        removed += oldLines;
    });
    // Check if Copilot is enabled
    const copilotExt = vscode.extensions.getExtension('GitHub.copilot');
    const isCopilotEnabled = copilotExt && copilotExt.isActive;
    // Get only the actual diff
    const codeChanges = getGitDiff(filePath);
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
}

function handleFileCreation(event, fileChangeLogs) {
    event.files.forEach(file => {
        const filePath = file.fsPath;
        const copilotExt = vscode.extensions.getExtension('GitHub.copilot');
        const isCopilotEnabled = copilotExt && copilotExt.isActive;
        let codeChanges = '';
        try {
            codeChanges = fs.readFileSync(filePath, 'utf8');
        } catch (e) {
            codeChanges = '';
        }
        fileChangeLogs.push({
            filePath,
            action: 'created',
            isCopilotEnabled,
            codeChanges,
            timestamp: new Date().toISOString()
        });
    });
}

function handleFileDeletion(event, fileChangeLogs) {
    event.files.forEach(file => {
        const filePath = file.fsPath;
        const copilotExt = vscode.extensions.getExtension('GitHub.copilot');
        const isCopilotEnabled = copilotExt && copilotExt.isActive;
        let codeChanges = '';
        try {
            // Get last committed content before deletion
            codeChanges = execSync(`git show HEAD:"${filePath}"`, { cwd: path.dirname(filePath) }).toString();
        } catch (e) {
            codeChanges = '';
        }
        fileChangeLogs.push({
            filePath,
            action: 'deleted',
            isCopilotEnabled,
            codeChanges,
            timestamp: new Date().toISOString()
        });
    });
}

module.exports = { writeDailyLog, handleFileChange, handleFileCreation, handleFileDeletion };