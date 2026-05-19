import express from "express";
import path from "path";
import { createServer as createViteServer } from "vite";
import { getSudoku } from "sudoku-gen";

type Difficulty = "easy" | "medium" | "hard" | "expert";

async function startServer() {
  const app = express();
  const PORT = 3000;

  app.use(express.json());

  // API Routes
  app.get("/api/health", (req, res) => {
    res.json({ status: "ok" });
  });

  // Daily Challenge Generation (Simple logic: can be called by client if today's puzzle is missing)
  app.get("/api/sudoku/generate", (req, res) => {
    const difficulty = (req.query.difficulty as Difficulty) || "easy";
    try {
      const puzzle = getSudoku(difficulty);
      res.json(puzzle);
    } catch (error) {
      res.status(500).json({ error: "Failed to generate puzzle" });
    }
  });

  // Vite middleware for development
  if (process.env.NODE_ENV !== "production") {
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
    console.log(`Server running on http://0.0.0.0:${PORT}`);
  });
}

startServer();
