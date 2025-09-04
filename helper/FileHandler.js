const vscode = require('vscode');
const fs = require('fs');
const path = require('path');

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

function handleFileChange(event, fileChangeLogs) {
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
}

function handleFileCreation(event, fileChangeLogs) {
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
}

function handleFileDeletion(event, fileChangeLogs) {
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
}

module.exports = { writeDailyLog, handleFileChange, handleFileCreation, handleFileDeletion };