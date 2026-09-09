import * as vscode from "vscode";
import { getNonce } from "../Util";

export class VideoPlayerPanel {
  public static currentPanel: VideoPlayerPanel | undefined;

  private readonly _panel: vscode.WebviewPanel;
  private readonly _extensionUri: vscode.Uri;

  private _disposables: vscode.Disposable[] = [];

  constructor(
    panel: vscode.WebviewPanel,
    extensionUri: vscode.Uri,
    private readonly streamUrl?: string,
    private readonly subtitleUrl?: string,
  ) {
    this._panel = panel;
    this._extensionUri = extensionUri;

    this._update();

    this._panel.onDidDispose(() => this.dispose(), null, this._disposables);
  }

  public static createOrShow(
    extensionUri: vscode.Uri,
    streamUrl?: string,
    subtitleUrl?: string,
  ) {
    const column = vscode.window.activeTextEditor
      ? vscode.window.activeTextEditor.viewColumn
      : undefined;

    if (VideoPlayerPanel.currentPanel) {
      VideoPlayerPanel.currentPanel._panel.reveal(column);

      if (streamUrl) {
        VideoPlayerPanel.currentPanel._panel.webview.postMessage({
          type: "load_video",
          data: {
            url: streamUrl,
            subtitle: subtitleUrl,
          },
        });
      }

      return;
    }

    const panel = vscode.window.createWebviewPanel(
      "video-player-panel",
      "Anime Player",
      column || vscode.ViewColumn.One,
      {
        enableScripts: true,
        retainContextWhenHidden: true,

        localResourceRoots: [
          vscode.Uri.joinPath(extensionUri, "media"),
          vscode.Uri.joinPath(extensionUri, "out"),
        ],
      },
    );

    VideoPlayerPanel.currentPanel = new VideoPlayerPanel(
      panel,
      extensionUri,
      streamUrl,
      subtitleUrl,
    );
  }

  private async _update() {
    const webview = this._panel.webview;

    webview.html = this._getHtmlForWebview(webview);

    webview.onDidReceiveMessage(
      async (msg) => {
        switch (msg.type) {
          case "video_ready":
            if (this.streamUrl) {
              webview.postMessage({
                type: "load_video",
                data: {
                  url: this.streamUrl,
                  subtitle: this.subtitleUrl,
                },
              });
            }
            break;

          case "video_error":
            console.error("Video player error:", msg.data);

            vscode.window.showErrorMessage(
              `Video player error: ${msg.data?.message ?? "Unknown error"}`,
            );
            break;

          case "video_playing":
            console.log("Video started playing");
            break;
        }
      },
      null,
      this._disposables,
    );
  }

  private _getHtmlForWebview(webview: vscode.Webview) {
    const scriptUri = webview.asWebviewUri(
      vscode.Uri.joinPath(this._extensionUri, "out", "video-player-panel.js"),
    );

    const styleResetUri = webview.asWebviewUri(
      vscode.Uri.joinPath(this._extensionUri, "media", "reset.css"),
    );

    const styleVSCodeUri = webview.asWebviewUri(
      vscode.Uri.joinPath(this._extensionUri, "media", "vscode.css"),
    );

    const styleMainUri = webview.asWebviewUri(
      vscode.Uri.joinPath(this._extensionUri, "out", "video-player-panel.css"),
    );

    const nonce = getNonce();

    return `
      <!DOCTYPE html>
      <html lang="en">
        <head>
          <meta charset="UTF-8">

          <meta
            http-equiv="Content-Security-Policy"
            content="
              default-src 'none';

              connect-src
                ${webview.cspSource}
                http://127.0.0.1:*
                https://api.animeonsen.xyz
                https://cdn.animeonsen.xyz;

              media-src
                blob:
                http://127.0.0.1:*
                https://cdn.animeonsen.xyz;

              img-src
                ${webview.cspSource}
                https:
                data:;

              style-src
                ${webview.cspSource};

              script-src
                'nonce-${nonce}';
            "
          />

          <meta
            name="viewport"
            content="width=device-width, initial-scale=1.0"
          >

          <link href="${styleResetUri}" rel="stylesheet">
          <link href="${styleVSCodeUri}" rel="stylesheet">
          <link href="${styleMainUri}" rel="stylesheet">

          <script nonce="${nonce}">
            const tsvscode = acquireVsCodeApi();
          </script>
        </head>

        <body></body>

        <script nonce="${nonce}" src="${scriptUri}"></script>
      </html>
    `;
  }

  public dispose() {
    VideoPlayerPanel.currentPanel = undefined;

    this._panel.dispose();

    while (this._disposables.length) {
      const disposable = this._disposables.pop();

      if (disposable) {
        disposable.dispose();
      }
    }
  }
}
