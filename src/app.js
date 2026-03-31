const path = require("path");
const express = require("express");
const cors = require("cors");
const helmet = require("helmet");
const morgan = require("morgan");
const env = require("./config/env");
const { ping } = require("./config/db");
const publicRoutes = require("./routes/publicRoutes");
const adminRoutes = require("./routes/adminRoutes");
const asyncHandler = require("./utils/asyncHandler");
const { notFound, errorHandler } = require("./middleware/errorHandler");

const app = express();

const corsOptions =
  env.corsOrigin === "*"
    ? { origin: true }
    : {
        origin: env.corsOrigin,
      };

app.disable("x-powered-by");

if (env.trustProxy) {
  app.set("trust proxy", 1);
}

app.use(helmet());
app.use(cors(corsOptions));
app.use(morgan("dev"));
app.use(express.json({ limit: "1mb" }));
app.use(express.urlencoded({ extended: false }));

if (env.serveStaticClient) {
  app.use(express.static(path.join(__dirname, "..", "public")));
}

app.get(
  "/api/health",
  asyncHandler(async (req, res) => {
    await ping();
    return res.json({
      status: "ok",
      time: new Date().toISOString(),
      database: "reachable",
    });
  })
);

app.use("/api", publicRoutes);
app.use("/api/admin", adminRoutes);

app.use(notFound);
app.use(errorHandler);

module.exports = app;
