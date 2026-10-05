import express, { type Request, Response, NextFunction } from "express";
import { registerRoutes } from "./routes";
import { registerStripeRoutes } from "./stripe";
import { log } from "./log";
import { createDatabaseAvailabilityMiddleware } from "./database-availability";
import { databaseAvailability } from "./storage";

// Builds the Express app with all API routes. Shared by the local server
// (server/index.ts) and the Vercel function (server/vercel.ts).
export async function createApp() {
  const app = express();

  app.use("/api/stripe/webhook", express.raw({ type: "application/json" }), (req: any, _res, next) => {
    req.rawBody = req.body;
    req.body = JSON.parse(req.body.toString());
    next();
  });

  app.use(express.json());
  app.use(express.urlencoded({ extended: false }));

  // Keep the public invite token endpoint available during an outage. Other API
  // requests (including Stripe webhooks) receive a retryable 503 before route
  // handlers can misreport storage failures as authentication or generic errors.
  app.use(
    "/api",
    createDatabaseAvailabilityMiddleware(databaseAvailability, [
      "/api/stripe/labor-day-trial/invite",
    ]),
  );

  app.use((req, res, next) => {
    const start = Date.now();
    const path = req.path;
    let capturedJsonResponse: Record<string, any> | undefined = undefined;

    const originalResJson = res.json;
    res.json = function (bodyJson, ...args) {
      capturedJsonResponse = bodyJson;
      return originalResJson.apply(res, [bodyJson, ...args]);
    };

    res.on("finish", () => {
      const duration = Date.now() - start;
      if (path.startsWith("/api")) {
        let logLine = `${req.method} ${path} ${res.statusCode} in ${duration}ms`;
        if (capturedJsonResponse) {
          logLine += ` :: ${JSON.stringify(capturedJsonResponse)}`;
        }

        if (logLine.length > 80) {
          logLine = logLine.slice(0, 79) + "…";
        }

        log(logLine);
      }
    });

    next();
  });

  registerStripeRoutes(app);
  const server = await registerRoutes(app);

  app.use((err: any, _req: Request, res: Response, _next: NextFunction) => {
    const status = err.status || err.statusCode || 500;
    const message = err.message || "Internal Server Error";

    console.error("Unhandled request error:", err);
    if (!res.headersSent) {
      res.status(status).json({ message });
    }
  });

  return { app, server };
}
