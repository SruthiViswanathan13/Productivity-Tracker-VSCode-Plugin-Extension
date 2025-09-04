# Welcome to Productivity Tracker Plugin

## What's in the folder

* This folder contains all of the files necessary for your extension.
* `package.json` - this is the manifest file in which you declare your extension and command.
  * The sample plugin registers a command and defines its title and command name. With this information VS Code can show the command in the command palette. It doesn’t yet need to load the plugin.
* `extension.js` - this is the main file where you will provide the implementation of your command.
  * The file exports one function, `activate`, which is called the very first time your extension is activated (in this case by executing the command). Inside the `activate` function we call `registerCommand`.
  * We pass the function containing the implementation of the command as the second parameter to `registerCommand`.

## Get up and running straight away

* Press `F5` to open a new window with your extension loaded.
* Run your command from the command palette by pressing (`Ctrl+Shift+P` or `Cmd+Shift+P` on Mac) and typing `Hello World`.
* Set breakpoints in your code inside `extension.js` to debug your extension.
* Find output from your extension in the debug console.

## Make changes

* You can relaunch the extension from the debug toolbar after changing code in `extension.js`.
* You can also reload (`Ctrl+R` or `Cmd+R` on Mac) the VS Code window with your extension to load your changes.

# Local Development Instructions

## Steps to update the plugin login
1. Add or update logic in extension.js
2. Run `npm install`
3. Execute `code .`
4. Press `F5` to test the plugin in debug mode.

# Testing out the plugin independently outside of development.

## Compile the plugin

1. Run `npm install`
2. Run `npx vsce package`
3. This will generate a plugin with name -> `productivity-tracker-version.vsix`

## Import the plugin.

1. Click on the extensions in VSCode.
2. Click on view and more options.
3. Import the vsix plugin from the saved location.

## Verify the plugin

1. Open any code repository or folders.
2. Update the code, every 1 minute, the code changes are added to the log file saved in `C:Productivity-Tracker` as a day-wise .json file.