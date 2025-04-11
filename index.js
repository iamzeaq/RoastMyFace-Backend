const express = require("express");
const cors = require("cors");
const multer = require("multer");
const path = require("path");
const fs = require("fs");

const app = express();
const PORT = process.env.PORT || 5500;

app.use(cors());
app.use(express.json());
app.use(express.urlencoded({ extended: true }));

const upload = multer({ storage: multer.memoryStorage() });

const roastData = JSON.parse(
  fs.readFileSync(path.join(__dirname, "roasts.json"), "utf-8")
);

const generateRoasts = (style = "default") => {
  const lines = roastData[style] || roastData["default"];
  return lines.sort(() => 0.5 - Math.random()).slice(0, 1);
};

app.post("/api/roast", upload.single("image"), (req, res) => {
  try {
    const imageFile = req.file;
    const style = req.body.style || "default";

    if (!imageFile) return res.status(400).json({ error: "No image uploaded" });

    const roasts = generateRoasts(style);

    res.json({ roasts });
  } catch (err) {
    console.error("Roast error:", err);
    res.status(500).json({ error: "Failed to roast image" });
  }
});

app.get("/", (req, res) => {
  res.send("RoastMyFace API is running");
});

module.exports = app;
