import { mkdir, readFile, writeFile } from "node:fs/promises";
import path from "node:path";

const root = process.cwd();
const buildDir = path.join(root, ".client-build");
const outPath = path.join(root, "src/client/generated.ts");

const script = await readFile(path.join(buildDir, "client.js"), "utf8");
let styles = "";
try {
  styles = await readFile(path.join(buildDir, "client.css"), "utf8");
} catch {
  styles = "";
}

await mkdir(path.dirname(outPath), { recursive: true });
await writeFile(
  outPath,
  `export const generatedClientScript: string = ${JSON.stringify(script)};\nexport const generatedClientStyles: string = ${JSON.stringify(styles)};\n`
);
