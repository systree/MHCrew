require("dotenv").config();
require("express-async-errors");

const express = require("express");
const cors = require("cors");
const routes = require("./src/routes/index");
const errorHandler = require("./src/middleware/errorHandler");
const logger = require("./src/utils/logger");

const app = express();
const PORT = process.env.PORT || 3001;

const allowedOrigins =
  process.env.NODE_ENV === "production"
    ? ["https://mhcrew.413157239.xyz"]
    : ["http://localhost:5173", "http://localhost:3000"];

app.use(
  cors({
    origin: allowedOrigins,
    methods: ["GET", "POST", "PATCH", "DELETE", "OPTIONS"],
    allowedHeaders: ["Content-Type", "Authorization"],
  }),
);

app.get("/health", (req, res) => {
  res.json({ status: "ok", timestamp: new Date().toISOString() });
});

// Webhook route must be registered BEFORE express.json() so the raw body
// middleware in webhooks.js can capture the request stream for HMAC verification.
const webhooksRouter = require("./src/routes/webhooks");
app.use("/api/webhooks", webhooksRouter);

app.use(express.json());
app.use("/api", routes);

app.use(errorHandler);

app.listen(PORT, () => {
  logger.info(`MH Crew Backend listening on port ${PORT}`);
});

module.exports = app;
