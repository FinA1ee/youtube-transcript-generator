import { generatedClientScript, generatedClientStyles } from "./generated";

const fallbackStyles = `
:root {
  color-scheme: light;
  background: #f7f5ef;
  color: #18202f;
  font-family: ui-sans-serif, system-ui, -apple-system, BlinkMacSystemFont, "Segoe UI", sans-serif;
}
body {
  margin: 0;
}
main {
  max-width: 960px;
  margin: 0 auto;
  padding: 32px 20px;
}
`;

const fallbackScript = `
document.getElementById("root").innerHTML =
  '<p>Client assets are not built yet. Run npm run build:client.</p>';
`;

function selectAsset(value: string, fallback: string): string {
  return value.length > 0 ? value : fallback;
}

export const styles = selectAsset(generatedClientStyles, fallbackStyles);
export const clientScript = selectAsset(generatedClientScript, fallbackScript);

export function renderAppHtml(enableDiagnosticControls = false): string {
  return `<!doctype html>
<html lang="en">
  <head>
    <meta charset="utf-8" />
    <meta name="viewport" content="width=device-width, initial-scale=1" />
    <title>YouTube Report Generator</title>
    <link rel="stylesheet" href="/styles.css" />
  </head>
  <body>
    <main>
      <div id="root"></div>
    </main>
    <script>window.__APP_CONFIG__ = ${JSON.stringify({ enableDiagnosticControls })};</script>
    <script src="/client.js"></script>
  </body>
</html>`;
}

export const appHtml = renderAppHtml();
