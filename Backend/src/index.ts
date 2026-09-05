import express from "express";
import cors from "cors";
import apiRouter from "./routes/api";

const app = express();

// Configure CORS for local development and Vercel deployments
const allowedOrigins = [
  "http://localhost:5173",
  "http://localhost:3000",
  /\.vercel\.app$/,
];

app.use(
  cors({
    origin: allowedOrigins,
    credentials: true,
  }),
);

app.use(express.json());

app.get("/health", (_req, res) => res.json({ ok: true }));
app.use("/api", apiRouter);

const PORT = process.env.PORT || 4000;
app.listen(PORT, () => console.log(`Server listening on port ${PORT}`));
