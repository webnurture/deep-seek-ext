import * as vscode from "vscode"
import ollama from "ollama"

export function activate(context: vscode.ExtensionContext) {
  console.log('Congratulations, your extension "aj-extension" is now active!')

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
        const userPrompt = message.text
        let responseText = ""

        try {
          const streamResponse = await ollama.chat({
            model: "deepseek-r1:1.5b",
            messages: [{ role: "user", content: userPrompt }],
            stream: true,
          })

          for await (const part of streamResponse) {
            responseText += part.message.content
            panel.webview.postMessage({ command: "chatResponse", text: responseText })
          }
        } catch (error: any) {
          panel.webview.postMessage({ command: "chatResponse", text: `Error: ${String(error)}` })
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
                
                h2 {
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
                
                #askBtn {
                    display: block;
                    width: 100%;
                    padding: 10px;
                    margin-top: 10px;
                    border: none;
                    border-radius: 5px;
                    background-color: #007acc;
                    color: white;
                    font-size: 1rem;
                    cursor: pointer;
                    transition: 0.3s ease;
                }
                
                #askBtn:hover {
                    background-color: #005f99;
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
          <h2>Chat with Deep Seek</h2>
          <textarea id="prompt" rows=3 placeholder="Ask Anything......"></textarea><br/>
          <button id="askBtn">Ask</button>
          <div id="response"></div>

          <script>
            const vscode = acquireVsCodeApi();

            document.getElementById("askBtn").addEventListener("click", () => {
              const promptInput = document.getElementById("prompt");
              const text = document.getElementById("prompt").value;
              vscode.postMessage({ command: "chat", text });
              promptInput.value = "";
            });

            window.addEventListener("message", event => {
              const { command , text } = event.data;
              if (command === "chatResponse"){
                document.getElementById("response").innerText = text;
              }
            });
          </script>
      </body>
      </html>
    `
}

export function deactivate() {}
