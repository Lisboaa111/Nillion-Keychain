import dotenv from "dotenv";

dotenv.config();

const requiredEnvVars = [
  "BUILDER_PRIVATE_KEY",
  "NILCHAIN_URL",
  "NILAUTH_URL",
  "NILDB_NODES",
];

requiredEnvVars.forEach((key) => {
  if (!process.env[key]) {
    throw new Error(`Missing required environment variable: ${key}`);
  }
});

export const config = {
  server: {
    port: parseInt(process.env.PORT || "3001", 10),
    allowedOrigins: process.env.ALLOWED_ORIGINS?.split(",") || [
      "http://localhost:5173",
    ],
  },
  nillion: {
    builderPrivateKey: process.env.BUILDER_PRIVATE_KEY!,
    nilchainUrl: process.env.NILCHAIN_URL!,
    nilauthUrl: process.env.NILAUTH_URL!,
    nildbNodes: process.env.NILDB_NODES!.split(","),
  },
  delegation: {
    tokenExpirySeconds: 3600,
  },
};
