import * as vscode from "vscode"
import ollama from "ollama"

export function activate(context: vscode.ExtensionContext) {
  console.log('Congratulations, your extension "aj-extension" is now active!')

  let abortController: AbortController | null = null

  const disposable = vscode.commands.registerCommand("aj-ext.start", () => {
    const panel = vscode.window.createWebviewPanel(
      "deepChat",
      "Deeper Seek",
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
                command: "chatUpdate",
                text: "Stream stopped by user.",
                isFinal: true,
              })
              return
            }
            responseText += part.message.content
            panel.webview.postMessage({
              command: "chatUpdate",
              text: part.message.content, // Send latest chunk
              isFinal: false,
            })
          }

          // Send the final response after streaming completes
          panel.webview.postMessage({
            command: "chatUpdate",
            text: responseText,
            isFinal: true,
          })
        } catch (error: any) {
          panel.webview.postMessage({
            command: "chatUpdate",
            text: `Error: ${error.message}`,
            isFinal: true,
          })
        } finally {
          abortController = null
        }
      } else if (message.command === "stop") {
        if (abortController) {
          abortController.abort()
          panel.webview.postMessage({
            command: "chatUpdate",
            text: "Stream stopped by user.",
            isFinal: true,
          })
          abortController = null
        }
      }
    })
  })

  context.subscriptions.push(disposable)
}

function getWebViewContent(): string {
  return `
    <!DOCTYPE html>
    <html lang="en">
    <head>
        <meta charset="UTF-8">
        <meta name="viewport" content="width=device-width, initial-scale=1.0">
        <title>Deeper Seek</title>
        <link href="https://cdnjs.cloudflare.com/ajax/libs/prism/1.29.0/themes/prism.min.css" rel="stylesheet" />
        <style>
            body {
                font-family: "Segoe UI", sans-serif;
                background-color: #1e1e1e;
                color: #d4d4d4;
                margin: 1.5rem;
            }
            h1 {
                text-align: center;
                font-size: 2.5rem;
                background: linear-gradient(to right, #61dafb, white);
                -webkit-background-clip: text;
                color: transparent;
            }
            textarea {
                width: 100%;
                padding: 10px;
                margin-top: 10px;
                background-color: #252526;
                color: #d4d4d4;
                border: none;
                border-radius: 5px;
                font-size: 1rem;
            }
            button {
                width: 48%;
                padding: 10px;
                margin-top: 10px;
                border: none;
                border-radius: 5px;
                cursor: pointer;
                font-size: 1rem;
            }
            button#askBtn {
                background-color: #007acc;
                color: white;
            }
            button#askBtn:hover {
                background-color: #005f99;
            }
            button#stopBtn {
                background-color: #d9534f;
                color: white;
            }
            button#stopBtn:hover {
                background-color: #c9302c;
            }
            #response {
                margin-top: 20px;
                padding: 10px;
                background-color: #2e2e2e;
                border-radius: 5px;
                max-height: 300px;
                overflow-y: auto;
                font-size: 1rem;
            }
            .response-item {
                margin-bottom: 10px;
                padding: 10px;
                border-radius: 5px;
                background-color: #3c3c3c;
                white-space: pre-wrap;
                word-wrap: break-word;
            }
            pre {
                background-color: #1e1e1e;
                padding: 10px;
                border-radius: 5px;
                font-family: monospace;
                overflow-x: auto;
            }
        </style>
        <script src="https://cdnjs.cloudflare.com/ajax/libs/prism/1.29.0/prism.min.js"></script>
        <script src="https://cdnjs.cloudflare.com/ajax/libs/prism/1.29.0/components/prism-javascript.min.js"></script>
        <script src="https://cdnjs.cloudflare.com/ajax/libs/prism/1.29.0/components/prism-python.min.js"></script>
        <script src="https://cdnjs.cloudflare.com/ajax/libs/prism/1.29.0/components/prism-html.min.js"></script>
        <script src="https://cdnjs.cloudflare.com/ajax/libs/prism/1.29.0/components/prism-css.min.js"></script>
    </head>
    <body>
        <h1>Chat with Deeper Seek</h1>
        <textarea id="prompt" rows="5" placeholder="Ask something..."></textarea>
        <div style="display: flex; justify-content: space-between;">
            <button id="askBtn">Ask</button>
            <button id="stopBtn">Stop</button>
        </div>
        <div id="response"></div>
        <script>
            const vscode = acquireVsCodeApi();
            let currentResponse = "";

            // Function to escape HTML characters
            function escapeHtml(unsafe) {
                return unsafe
                    .replace(/&/g, "&amp;")
                    .replace(/</g, "&lt;")
                    .replace(/>/g, "&gt;")
                    .replace(/"/g, "&quot;")
                    .replace(/'/g, "&#039;");
            }

            document.getElementById("askBtn").addEventListener("click", function() {
                const promptInput = document.getElementById("prompt");
                const text = promptInput.value.trim();
                if (text) {
                    vscode.postMessage({ command: "chat", text: text });
                    promptInput.value = "";
                    currentResponse = "";
                    document.getElementById("response").innerHTML = "";
                }
            });

            document.getElementById("stopBtn").addEventListener("click", function() {
                vscode.postMessage({ command: "stop" });
            });

            window.addEventListener("message", (event) => {
                const { command, text, isFinal } = event.data;
                if (command === "chatUpdate") {
                    const responseContainer = document.getElementById("response");

                    if (!isFinal) {
                        currentResponse += text;
                        responseContainer.innerHTML = \`<div class="response-item">\${escapeHtml(currentResponse)}</div>\`;
                    } else {
                        const codeBlockRegex = /\\\`\\\`\\\`(\\w*)\\n([\\s\\S]*?)\\\`\\\`\\\`/g;
                        const processedText = currentResponse.replace(codeBlockRegex, (match, lang, code) => {
                            const language = lang || "plaintext";
                            return \`<pre><code class="language-\${language}">\${escapeHtml(code)}</code></pre>\`;
                        });

                        responseContainer.innerHTML = \`<div class="response-item">\${processedText}</div>\`;
                        Prism.highlightAll(); // Apply syntax highlighting
                    }

                    responseContainer.scrollTop = responseContainer.scrollHeight;
                }
            });
        </script>
    </body>
    </html>`
}

export function deactivate() {}
