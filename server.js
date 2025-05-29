// ✅ Buffer.concat Patch (MUST be first)
const buffer = require("buffer");
const originalConcat = buffer.Buffer.concat;

buffer.Buffer.concat = function (list, ...args) {
  if (!Array.isArray(list)) return originalConcat(list, ...args);
  const safeList = list.map((el) =>
    typeof el === "string" ? Buffer.from(el) : el
  );
  return originalConcat(safeList, ...args);
};

// ✅ Required Modules
require("dotenv").config();
const express = require("express");
const path = require("path");
const fs = require("fs");
const readline = require("readline");
const { exec } = require("child_process"); // ✅ For browser auto-open

// ✅ Global Error Handlers
process.on("uncaughtException", (error) => {
  console.error("\x1b[31m%s\x1b[0m", "====== UNCAUGHT EXCEPTION ======");
  console.error(error);
  try {
    fs.appendFileSync(
      "server-error.log",
      `[${new Date().toISOString()}] Uncaught Exception: ${
        error.stack || error
      }\n`
    );
  } catch (logError) {
    console.error("Failed to write to log file:", logError);
  }
  console.log("\n\x1b[33mPress Enter to exit...\x1b[0m");
  readline
    .createInterface({ input: process.stdin, output: process.stdout })
    .on("line", () => {
      process.exit(1);
    });
});

process.on("unhandledRejection", (reason, promise) => {
  console.error(
    "\x1b[31m%s\x1b[0m",
    "====== UNHANDLED PROMISE REJECTION ======"
  );
  console.error("Promise:", promise);
  console.error("Reason:", reason);
  try {
    fs.appendFileSync(
      "server-error.log",
      `[${new Date().toISOString()}] Unhandled Rejection: ${
        reason.stack || reason
      }\n`
    );
  } catch (logError) {
    console.error("Failed to write to log file:", logError);
  }
});

// ✅ Express App Setup
const errorMiddleware = require("./src/middlewares/error");
const tiktokRoute = require("./src/routes/tiktok-route");

const app = express();
app.use(express.json());

// ✅ Path Handling for `nexe`
const isPkg = typeof process.pkg !== "undefined";
const baseDir = isPkg ? path.dirname(process.execPath) : __dirname;

// ✅ Routes
app.use("/tiktok", tiktokRoute);

// ✅ Static Assets (React/Vite)
app.use(express.static(path.join(baseDir, "client-dist")));

// ✅ SPA Fallback
app.get(
  ["/", "/get-tags", "/view-tags", "/view-all-users", "/sync-and-export"],
  (req, res) => {
    res.sendFile(path.join(baseDir, "client-dist/index.html"));
  }
);

// ✅ Error Middleware
app.use(errorMiddleware);

// ✅ Port Handling
if (!process.env.PORT) {
  console.warn(
    "\x1b[33m%s\x1b[0m",
    "WARNING: PORT is not defined in .env file. Using default port 8800."
  );
}
const PORT = process.env.PORT || 8800;
const AUTO_OPEN_BROWSER = process.env.AUTO_OPEN_BROWSER === "true";

// ✅ Start Server
try {
  const server = app.listen(PORT, () => {
    const url = `http://localhost:${PORT}`;
    console.log(`Server is running at ${url}`);

    // ✅ Auto-open browser if enabled
    if (AUTO_OPEN_BROWSER) {
      const startCommand =
        process.platform === "win32"
          ? `start ${url}`
          : process.platform === "darwin"
          ? `open ${url}`
          : `xdg-open ${url}`;

      exec(startCommand, (err) => {
        if (err) {
          console.error("Failed to open browser:", err);
        }
      });
    }
  });

  server.on("error", (error) => {
    if (error.code === "EADDRINUSE") {
      console.error(
        `\x1b[31mError: Port ${PORT} is already in use. Please use a different port.\x1b[0m`
      );
    } else {
      console.error("\x1b[31mServer error:\x1b[0m", error);
    }
    console.log("\n\x1b[33mPress Enter to exit...\x1b[0m");
    readline
      .createInterface({ input: process.stdin, output: process.stdout })
      .on("line", () => {
        process.exit(1);
      });
  });
} catch (error) {
  console.error("\x1b[31mFailed to start server:\x1b[0m", error);
  console.log("\n\x1b[33mPress Enter to exit...\x1b[0m");
  readline
    .createInterface({ input: process.stdin, output: process.stdout })
    .on("line", () => {
      process.exit(1);
    });
}
