import app from "./app";
import path from "path";
import express from "express";

const PORT = 3000;

// Setup Vite Dev Server / Static Asset delivery
async function start() {
  if (process.env.NODE_ENV !== "production") {
    // Dynamic import to prevent bundling Vite in production/Vercel environments
    const { createServer: createViteServer } = await import("vite");
    const vite = await createViteServer({
      server: { middlewareMode: true },
      appType: "spa",
    });
    app.use(vite.middlewares);
  } else {
    const distPath = path.join(process.cwd(), "dist");
    app.use(express.static(distPath));
    app.get("*", (req, res) => {
      res.sendFile(path.join(distPath, "index.html"));
    });
  }

  app.listen(PORT, "0.0.0.0", () => {
    console.log(`Smart Bill Splitter Server is running on port ${PORT}`);
  });
}

// Only start the server locally, not when imported as a module by Vercel
if (process.env.VERCEL !== "1") {
  start();
}

export default app;
