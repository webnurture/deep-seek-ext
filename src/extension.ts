import * as vscode from "vscode"
import ollama from "ollama"

export function activate(context: vscode.ExtensionContext) {
  console.log('Congratulations, your extension "aj-extension" is now active!')

  let abortController: AbortController | null = null

  const disposable = vscode.commands.registerCommand("aj-ext.start", () => {
    const panel = vscode.window.createWebviewPanel(
      "deepChat",
      "Deep Seek Chat",
      vscode.ViewColumn.One,
      { enableScripts: true }
    )

    panel.webview.html = getWebViewContent()

    panel.webview.onDidReceiveMessage(async (message: any) => {
      if (message.command === "chat") {
        if (abortController) {
          abortController.abort() // Stop previous stream if running
        }
        abortController = new AbortController()
        const { signal } = abortController

        const userPrompt = message.text
        let responseText = ""

        try {
          const streamResponse = await ollama.chat({
            model: "deepseek-r1:1.5b",
            messages: [{ role: "user", content: userPrompt }],
            stream: true,
          })

          for await (const part of streamResponse) {
            if (signal.aborted) {
              panel.webview.postMessage({
                command: "chatResponse",
                text: "Stream stopped by user.",
              })
              return
            }
            responseText += part.message.content
            panel.webview.postMessage({ command: "chatResponse", text: responseText })
          }
        } catch (error: any) {
          panel.webview.postMessage({ command: "chatResponse", text: `Error: ${String(error)}` })
        }
      } else if (message.command === "stop") {
        if (abortController) {
          abortController.abort() // Stop current response
          panel.webview.postMessage({ command: "chatResponse", text: "Stream stopped by user." })
        }
      }
    })
  })

  context.subscriptions.push(disposable)
}

function getWebViewContent(): string {
  return /*html*/ `
      <!DOCTYPE html>
      <html lang="en">
      <head>
          <meta charset="UTF-8"/>
          <style>
                body {
                    font-family: 'Segoe UI', sans-serif;
                    background-color: #1e1e1e;
                    color: #d4d4d4;
                    margin: 1.5rem;
                }
                
                h1 {
                    text-align: center;
                    color: #61dafb;
                }
                
                #prompt {
                    width: 100%;
                    box-sizing: border-box;
                    margin-top: 10px;
                    padding: 10px;
                    border: none;
                    border-radius: 5px;
                    background-color: #252526;
                    color: #d4d4d4;
                    font-size: 1rem;
                    resize: none;
                }
                
                #askBtn, #stopBtn {
                    display: block;
                    width: 100%;
                    padding: 10px;
                    margin-top: 10px;
                    border: none;
                    border-radius: 5px;
                    font-size: 1rem;
                    cursor: pointer;
                    transition: 0.3s ease;
                }

                #askBtn {
                    background-color: #007acc;
                    color: white;
                }

                #askBtn:hover {
                    background-color: #005f99;
                }

                #stopBtn {
                    background-color: #d9534f;
                    color: white;
                }

                #stopBtn:hover {
                    background-color: #c9302c;
                }
                
                #response {
                    border: 1px solid #3c3c3c;
                    margin-top: 1rem;
                    padding: 10px;
                    border-radius: 5px;
                    background-color: #252526;
                    font-size: 1rem;
                    min-height: 50px;
                    word-wrap: break-word;
                }
            </style>
      </head>
      <body>
          <h1>Chat with Deep Seek</h1>
          <textarea id="prompt" rows=3 placeholder="Ask Anything......"></textarea><br/>
          <button id="askBtn">Ask</button>
          <button id="stopBtn">Stop (Ctrl + C)</button>
          <div id="response"></div>

          <script>
            const vscode = acquireVsCodeApi();

            document.getElementById("askBtn").addEventListener("click", () => {
              const promptInput = document.getElementById("prompt");
              const text = promptInput.value;
              vscode.postMessage({ command: "chat", text });
              promptInput.value = "";
            });

            document.getElementById("stopBtn").addEventListener("click", () => {
              vscode.postMessage({ command: "stop" });
            });

            window.addEventListener("message", event => {
              const { command , text } = event.data;
              if (command === "chatResponse"){
                document.getElementById("response").innerText = text;
              }
            });

            document.addEventListener("keydown", (event) => {
              if (event.ctrlKey && event.key === "c") {
                vscode.postMessage({ command: "stop" });
              }
            });
          </script>
      </body>
      </html>
    `
}

export function deactivate() {}
