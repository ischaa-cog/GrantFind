// Packages the app in Vercel's Build Output API format (.vercel/output):
//   static/        the Vite-built client (run `vite build` first)
//   functions/api  the Express server bundled into one file
// See https://vercel.com/docs/build-output-api/v3
import { build } from "esbuild";
import fs from "fs";
import path from "path";

const root = path.resolve(import.meta.dirname, "..");
const out = path.join(root, ".vercel/output");
const clientDist = path.join(root, "dist/public");
const funcDir = path.join(out, "functions/api.func");

if (!fs.existsSync(path.join(clientDist, "index.html"))) {
  throw new Error("dist/public/index.html not found. Run `vite build` first.");
}

fs.rmSync(out, { recursive: true, force: true });
fs.mkdirSync(funcDir, { recursive: true });
fs.cpSync(clientDist, path.join(out, "static"), { recursive: true });

await build({
  entryPoints: [path.join(root, "server/vercel.ts")],
  outfile: path.join(funcDir, "index.mjs"),
  bundle: true,
  platform: "node",
  target: "node22",
  format: "esm",
  alias: { "@shared": path.join(root, "shared") },
  // Bundled CommonJS packages (express, etc.) still call require().
  banner: {
    js: "import { createRequire as __createRequire } from 'module'; const require = __createRequire(import.meta.url);",
  },
  logLevel: "info",
});

fs.writeFileSync(
  path.join(funcDir, ".vc-config.json"),
  JSON.stringify(
    {
      runtime: "nodejs22.x",
      handler: "index.mjs",
      launcherType: "Nodejs",
      // Hand Express the raw request so the Stripe webhook can verify signatures.
      shouldAddHelpers: false,
      maxDuration: 60,
    },
    null,
    2,
  ),
);

fs.writeFileSync(
  path.join(out, "config.json"),
  JSON.stringify(
    {
      version: 3,
      routes: [
        {
          src: "^/assets/(.*)$",
          headers: { "cache-control": "public, max-age=31536000, immutable" },
          continue: true,
        },
        { handle: "filesystem" },
        { src: "^/(api|objects)(/.*)?$", dest: "/api" },
        { src: "^/(.*)$", dest: "/index.html" },
      ],
    },
    null,
    2,
  ),
);

console.log("Vercel output written to .vercel/output");
