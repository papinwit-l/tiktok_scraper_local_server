require("dotenv").config();
const express = require("express");
const path = require("path");

const errorMiddleware = require("./middlewares/error");

const app = express();
app.use(express.json());

const tiktokRoute = require("./routes/tiktok-route");
app.use("/tiktok", tiktokRoute);

// Serve static files
app.use(express.static(path.join(__dirname, "../client-dist")));

// Fallback for client-side routing (React/Vite)
app.get(["/", "/get-tags", "/view-tags", "/view-all-users"], (req, res) => {
  res.sendFile(path.join(__dirname, "../client-dist/index.html"));
});

app.use(errorMiddleware);

if (!process.env.PORT) {
  console.log("PORT is not defined");
}

const PORT = process.env.PORT || 8800;

app.listen(PORT, () => {
  console.log(`Server is listening on port ${PORT}`);
});
