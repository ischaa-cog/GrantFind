import type { IncomingMessage, ServerResponse } from "http";
import { createApp } from "./app";

// Vercel function entry. Vercel serves the built client as static files and
// sends /api/* and /objects/* requests here (see scripts/build-vercel.mjs).
const appReady = createApp().then(({ app }) => app);

export default async function handler(req: IncomingMessage, res: ServerResponse) {
  const app = await appReady;
  // Resolve only once the response is done so the function isn't frozen mid-request.
  await new Promise<void>((resolve) => {
    res.once("finish", resolve);
    res.once("close", resolve);
    app(req as any, res as any);
  });
}
