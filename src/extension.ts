/*---------------------------------------------------------
 * Copyright (C) Microsoft Corporation. All rights reserved.
 *--------------------------------------------------------*/
'use strict';

import * as vscode from 'vscode';
import * as templateCODE from './templateCODE';

export function activate(context: vscode.ExtensionContext) {

    let fs = require('fs')
    let successDoc
    let prevdirectoryChange
    let docChangeTimer
    let preUri

    function previewUri(bool) {
        let update = Math.floor(Date.now() / 1000);
        if (bool)
            preUri = vscode.Uri.parse('timeline-code://Authority/timeline-code?' + update);
        return preUri
    }

    class TextDocumentContentProvider implements vscode.TextDocumentContentProvider {
        private _onDidChange = new vscode.EventEmitter<vscode.Uri>();

        public provideTextDocumentContent(uri: vscode.Uri): string {
            
            return this.createMarkDownDoc(function (string) {
                return string
            });
        }

        get onDidChange(): vscode.Event<vscode.Uri> {
            return this._onDidChange.event;
        }

        public update(uri: vscode.Uri) {
            this._onDidChange.fire(uri);
        }

        private createMarkDownDoc(callback) {
            let editor = vscode.window.activeTextEditor;
            if (!(editor.document.languageId === 'markdown')) {
                successDoc = false
                return this.errorSnippet("Active editor doesn't show a MarkDown document - no timeline to link.")
                
            }
            return this.extractSnippet(callback);
        }

        private extractSnippet(callback): string {
            let invalidDependancies = true

            let editor = vscode.window.activeTextEditor;
            let text = editor.document.getText();
            let regx = /<markdown-html>/g;
            let match = text.match(regx);
            if (match) {
                invalidDependancies = false
            }
            
            if (invalidDependancies) {
                successDoc = false
                return this.errorSnippet("This document has no timeline.");
            } else {
                return this.snippet(editor.document, callback);
            }
        }

        private errorSnippet(error: string): string {
            return `
                <body>
                    ${error}
                </body>`;
        }

        private snippet(document: vscode.TextDocument, callback): string {
            let path = document.uri.toString();
            let pathg = path.split('/');
            pathg.pop();
            const pathJoin = pathg.join('/');         



            let fspath = document.uri.path.toString()
            let fspathg = fspath.split('/');
            fspathg.shift();
            fspathg.pop();
            const fspathLoc = fspathg.join('/');

            let markDownDocument = document.getText();
            let _appSetting = /(\/\/.*|\/.*|\/\*.*)?app.codesetting = '([^]*)'\n?\s/g.exec(markDownDocument);//if app.codesetting has been commented out
            const appSettingReg = /^[A-Za-z]*[A-Za-z][A-Za-z0-9-. _]*$/g.exec(_appSetting[2])// valid characters only
            let appSetting = ''

            if (appSettingReg)
                if (appSettingReg.length > 0 && (typeof _appSetting[1] == 'undefined' || _appSetting[1].length == 0))
                    appSetting = appSettingReg[0] + '/';
                else 
                    appSettingReg[0] = ''
            
            let userFileExists = function (url, callback) {
                fs.stat(url, function (err, stats) {
                    //Check if error defined and the error code is "not exists"
                    if (err) {
                        if (err.code == 'ENOENT') {
                            if (callback)
                                callback(false)
                        }
                    } else {
                        if (callback)
                            callback(true)
                    }
                });
            }

            let writeUserFile = function (url, content, callback) {
                fs.writeFile(url, content, function(err) {
                    if(err) {
                        return console.log(err);
                    } else {
                        if (callback)
                            callback(url)
                    }
                });
            }

            let openUserFile = function (url) {
                console.log(url)
                let appUri = vscode.Uri.parse(url);
                vscode.commands.executeCommand('vscode.open', appUri, vscode.ViewColumn.One);
            }

            let app = pathJoin + '/user/' + appSetting + 'app.js';
            const localApp = `${fspathLoc}/user/${appSetting}app.js`
            const localComment = `${fspathLoc}/user/${appSetting}comment`
            const localSegment = `${fspathLoc}/user/${appSetting}segment`
            const localAction = `${fspathLoc}/user/${appSetting}action`
            const localSound = `${fspathLoc}/user/${appSetting}sound`
            let appTemplate = pathJoin + '/lib/pipeline/app.template.js';
            if (!successDoc) {
                successDoc = document.uri.fsPath;
            }

            const directory = `${fspathLoc}/user/${appSettingReg[0]}`
            prevdirectoryChange = prevdirectoryChange || directory
            fs.stat(directory, function(err, stats) {
                //Check if error defined and the error code is "not exists"
                if (err) {
                    if (err.code == 'ENOENT') {
                        //Create the directory, call the callback.
                        fs.readdir(prevdirectoryChange, function(err, stats) {
                            if (err || stats) {
                                if (stats) {
                                    if (stats.length > 0) {
                                        fs.renameSync(prevdirectoryChange, directory)
                                    } else {
                                        fs.mkdirSync(directory);
                                        userFileExists(localApp, function (found) {
                                            if (!found) {
                                                // Make defaults when there's no app.js
                                                writeUserFile(localApp, templateCODE.basic.app, function (url) {
                                                    openUserFile(app)
                                                    fs.mkdirSync(directory + '/assets')
                                                    writeUserFile(localComment, templateCODE.basic.comment, undefined);
                                                    writeUserFile(localSegment, templateCODE.basic.segment, undefined);
                                                    writeUserFile(localAction, templateCODE.basic.action, undefined);
                                                    writeUserFile(localSound, templateCODE.basic.sound, undefined);
                                                });
                                            } else {
                                                openUserFile(app)
                                            }

                                        })
                                    }
                                } else if (err) {
                                    if (err.code == 'ENOTEMPTY' || err.code == 'ENOENT') {
                                        fs.mkdirSync(directory);
                                        writeUserFile(localApp, templateCODE.basic.app, function (url) {
                                            openUserFile(app)
                                            fs.mkdirSync(directory + '/assets')
                                            writeUserFile(localComment, templateCODE.basic.comment, undefined);
                                            writeUserFile(localSegment, templateCODE.basic.segment, undefined);
                                            writeUserFile(localAction, templateCODE.basic.action, undefined);
                                            writeUserFile(localSound, templateCODE.basic.sound, undefined);
                                        });
                                        
                                    }
                                }
                            }
                            prevdirectoryChange = directory
                        })
                    }
                }
            });

            markDownDocument = markDownDocument.replace(new RegExp(`<markdown-html>`, `g`), ``)
            .replace(new RegExp(`</markdown-html>`, `g`), ``)
            .replace(new RegExp(
                `<script type=\"text/javascript\" src=\"lib/window.app.js\"></script>`, ``), 
                `<script type=\"text/javascript\" src=\"lib/window.app.js\"></script>
                <script>
                app._fileLocal = '${fspathLoc}/';//expose to file references in code
                app._fileLocalUser = '${fspathLoc}/user/${appSetting}';
                app._fileRef = '${pathJoin}/';//expose to file references in code
                app._fileRefUser = '${pathJoin}/user/${appSetting}';//expose to file references in code
                app._vscodeCommandLink = 'expose'//expose to have code aware of vscode
                </script>`
            )
            .replace(new RegExp(`\"app.js\"`, `g`), `\"user/${appSetting}app.js\"`)
            .replace(new RegExp(`href=\"`, `g`), `href=\"${pathJoin}/`)
            .replace(new RegExp(`src=\"`, `g`), `src=\"${fspathLoc}/`)
            return callback(`<!DOCTYPE html>
                    <html>
                    ${markDownDocument}
                    <script>
                    app._vscodeCommandOpen = 'command:extension.openCodeRule?';
                    app._vscodeCommandSave = 'command:extension.saveCodeRule?';
                    app._vscodeDocOBJ = ${JSON.stringify(document.uri)};
                    app._vscodeDocOBJ.query = app._fileRef + 'app.js';
                    app._vscodeDocURI = encodeURIComponent(JSON.stringify(app._vscodeDocOBJ));
                    app._vscodeRef = app._vscodeCommandOpen + '%5B' + app._vscodeDocURI + '%5D';
                    app._vscodeCommandLink = document.createElement('a');
                    app._vscodeCommandLink.id = 'vscode.command.link';
                    app._vscodeCommandLink.style.display = 'none';
                    app._vscodeCommandLink.href = app._vscodeRef;
                    document.getElementsByTagName('body').item(0).appendChild(app._vscodeCommandLink);
                    </script>
                    //Render
                    </html>`);
        }
    }

    let provider = new TextDocumentContentProvider();
    let registration = vscode.workspace.registerTextDocumentContentProvider('timeline-code', provider);

    vscode.workspace.onDidChangeTextDocument((e: vscode.TextDocumentChangeEvent) => {
        let editDoc = e.document.uri.fsPath
        if (e.document.languageId === 'markdown' && editDoc === successDoc) {
            clearTimeout(docChangeTimer)
            docChangeTimer = setTimeout(function () {
                vscode.commands.executeCommand('_webview.closeDevTools')
                provider.update(previewUri(false));
                setTimeout(
                function () {
                    vscode.commands.executeCommand('_webview.openDevTools')
                }, 2000);
            }, 2000)
        }
    });

    vscode.window.onDidChangeTextEditorSelection((e: vscode.TextEditorSelectionChangeEvent) => {
        if (e.textEditor.document.languageId === 'markdown' && !successDoc) {
            clearTimeout(docChangeTimer)
            docChangeTimer = setTimeout(function () {
                vscode.commands.executeCommand('_webview.closeDevTools')
                provider.update(previewUri(false));
                setTimeout(
                function () {
                    console.log(vscode.commands.executeCommand('_webview.openDevTools'))
                }, 2000);
            }, 2000)
        }
    })

    let disposable = vscode.commands.registerCommand('extension.linkTimeLineJSCode', () => {
        return vscode.commands.executeCommand('vscode.previewHtml', previewUri(true), vscode.ViewColumn.Two, 'TimeLine JSCode Preview').then((success) => {
        }, (reason) => {
            vscode.window.showErrorMessage(reason);
        });
    });

    //let highlight = vscode.window.createTextEditorDecorationType({ backgroundColor: 'rgba(200,200,200,.35)' });

    vscode.commands.registerCommand('extension.openCodeRule', (uri: vscode.Uri) => {
            let code = uri.query;
            let uriCode = vscode.Uri.parse(code);
            let success = vscode.commands.executeCommand('vscode.open', uriCode, vscode.ViewColumn.One);
    });

    vscode.commands.registerCommand('extension.saveCodeRule', (uri: vscode.Uri) => {
        let fspath = uri.query.toString();

        let fspathq = fspath.split('?');
        const fspathFile = fspathq[0];
        fspathq.shift();
        const fsquery = JSON.parse(fspathq.join('?'));
        const logJSON = JSON.parse(fsquery.logJSON);

        let fspathg = fspath.split('/');
        fspathg.pop();
        const fspathLoc = fspathg.join('/');

        // file = (string) filepath of the file to read
        fs.readFile(fspathLoc + `/${fsquery.file}`, 'utf8', function (err, data) {
            
            /// write to file
            fs.writeFile(fspathFile, decodeURIComponent(uri.fragment), function(err) {
                if(err) {
                    return console.log(err);
                }
            }); 
            if (err) {

                /// write to file
                if(err.code == 'ENOENT') {
                    fs.writeFile(fspathLoc + `/${fsquery.file}`, `var Authority = ${JSON.stringify(logJSON)}`, function(err) {
                        if(err) {
                            return console.log(err);
                        }
                    });
                }

                return console.log(err);
            } else {
                let logDATA = JSON.parse(data.replace(new RegExp(`var Authority = `, `g`), ``))
                for (let obj in logJSON) {
                    logDATA[obj] = {}
                }
                
                fs.writeFile(fspathLoc + `/${fsquery.file}`, `var Authority = ${JSON.stringify(logDATA)}`, function(err) {
                    if(err) {
                        return console.log(err);
                    }
                });
            }
        });    
    });

    context.subscriptions.push(disposable, registration);
}

export function deactivate() {
}