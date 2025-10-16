import express from "express";
import cors from "cors";
import { config } from "./config";
import { NillionService } from "./services/nillion-service";
import { setupRoutes } from "./routes";
import { errorHandler } from "./utils/nillion";

const app = express();

app.use(express.json());

app.use(
  cors({
    origin: (origin, callback) => {
      if (!origin || config.server.allowedOrigins.includes(origin)) {
        callback(null, true);
      } else {
        callback(new Error("Not allowed by CORS"));
      }
    },
    credentials: true,
  })
);

const nillionService = new NillionService(config.nillion);

setupRoutes(app, nillionService);

app.use(errorHandler);

async function startServer() {
  try {
    await nillionService.initialize();

    app.listen(config.server.port, () => {
      console.log(`Server running on http://localhost:${config.server.port}`);
      console.log(
        `CORS enabled for: ${config.server.allowedOrigins.join(", ")}`
      );
    });
  } catch (error) {
    console.error("Failed to start server:", error);
    process.exit(1);
  }
}

startServer();
