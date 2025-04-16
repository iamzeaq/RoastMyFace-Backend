const express = require("express");
const cors = require("cors");
const multer = require("multer");
const axios = require("axios");
const path = require("path");
const fs = require("fs");
require("dotenv").config();

const app = express();
const PORT = process.env.PORT || 5500;

app.use(cors());
app.use(express.json());
app.use(express.urlencoded({ extended: true }));

const upload = multer({ storage: multer.memoryStorage() });

let roastData;
try {
  roastData = JSON.parse(fs.readFileSync(path.join(__dirname, "roasts.json"), "utf-8"));
} catch (err) {
  console.error("Error loading roasts.json:", err.message);
  roastData = {
    default: [
      "Your selfie just made my phone switch to power-saving mode.",
      "Your face is what error messages were designed for.",
      "You look like the human version of a loading screen.",
      "Your appearance is buffering at 2% indefinitely."
    ],
    pidgin: [
      "Your face dey scatter market vibe like bad juju.",
      "You be like hustle wey no pay.",
      "Your smile dey comot Wi-Fi signal for area."
    ],
    patois: [
      "Yuh style flop like curry goat gone wrong.",
      "Yuh face vex di sun bad.",
      "Yuh vibe weak like no-rasta roadman."
    ]
  };
}

const HF_API_URL = "https://api-inference.huggingface.co/models/mistralai/Mixtral-8x7B-Instruct-v0.1";
const HF_API_KEY = process.env.HF_API_KEY;

const makeApiRequest = async (prompt, retries = 3, delay = 1000) => {
  for (let i = 0; i < retries; i++) {
    try {
      const response = await axios.post(
        HF_API_URL,
        {
          inputs: prompt,
          parameters: {
            max_new_tokens: 50,
            temperature: 0.9,
            return_full_text: false,
          },
        },
        {
          headers: {
            Authorization: `Bearer ${HF_API_KEY}`,
            "Content-Type": "application/json",
          },
          timeout: 10000,
        }
      );
      return response;
    } catch (err) {
      console.warn(`API attempt ${i + 1} failed: ${err.message}`);
      if (i < retries - 1) {
        await new Promise(r => setTimeout(r, delay * Math.pow(2, i)));
      } else {
        throw err;
      }
    }
  }
};

const generateRoast = async (style = "default", customPrompt = "") => {
  if (!HF_API_KEY) {
    console.warn("No Hugging Face API key provided, falling back to roasts.json");
    const lines = roastData[style] || roastData["default"] || ["Your face broke the AI, congrats."];
    return lines.sort(() => 0.5 - Math.random())[0];
  }

  try {
    const uniqueSeed = Math.floor(Math.random() * 1000000);
    const timestamp = Date.now();

    let prompt;
    if (customPrompt) {
      // Use the custom prompt from the pack
      prompt = `<s>[INST] You are a funny roast generator (seed: ${uniqueSeed}, time: ${timestamp}). 
      ${customPrompt} Make it witty, under 15 words, and end with punctuation. 
      Only return the roast, nothing else. [/INST]`;
    } else if (style.toLowerCase() === "pidgin") {
      prompt = `<s>[INST] You are a funny roast generator (seed: ${uniqueSeed}, time: ${timestamp}). Write exactly one funny, brief roast in Nigerian Pidgin about someone's appearance. Make it witty, under 15 words, and end with punctuation. Only return the roast, nothing else. [/INST]`;
    } else if (style.toLowerCase() === "patois") {
      prompt = `<s>[INST] You are a funny roast generator (seed: ${uniqueSeed}, time: ${timestamp}). Write exactly one funny, brief roast in Jamaican Patois about someone's appearance. Make it witty, under 15 words, and end with punctuation. Only return the roast, nothing else. [/INST]`;
    } else {
      prompt = `<s>[INST] You are a funny roast generator (seed: ${uniqueSeed}, time: ${timestamp}). Write exactly one funny, brief roast in standard English about someone's appearance. Make it witty, under 15 words, and end with punctuation. Only return the roast, nothing else. [/INST]`;
    }

    const response = await makeApiRequest(prompt);
    console.log("Raw API response:", JSON.stringify(response.data));

    let roast = response.data[0]?.generated_text?.trim();
    if (roast) {
      roast = roast.replace(/\[INST\]|\[\/INST\]/g, "").trim();

      const quotedContent = roast.match(/"([^"]+)"/);
      if (quotedContent && quotedContent[1]) {
        roast = quotedContent[1].trim();
      } else {
        const lines = roast.split("\n").filter(line =>
          line.trim().length > 0 &&
          !line.trim().toLowerCase().includes("example") &&
          !line.trim().toLowerCase().includes("format") &&
          !line.trim().toLowerCase().includes("seed") &&
          !line.trim().toLowerCase().includes("time")
        );

        if (lines.length > 0) {
          roast = lines[0].trim();
        }
      }

      if (!roast.match(/[.!?]$/)) {
        roast += ".";
      }

      if (roast.length > 3) {
        return roast;
      }
    }

    console.warn("Invalid or empty roast received from AI, using fallback roasts");
    throw new Error("Invalid roast format from AI");

  } catch (err) {
    console.warn(
      `AI roast failed, falling back to roasts.json: ${err.message}`,
      err.response?.status ? `Status: ${err.response.status}` : ""
    );

    const lines = roastData[style] || roastData["default"] || ["Your selfie has achieved what no filter could - made me speechless."];
    return lines.sort(() => 0.5 - Math.random())[0];
  }
};

// Original roast endpoint
app.post("/api/roast", upload.single("image"), async (req, res) => {
  try {
    const imageFile = req.file;
    const style = req.body.style || "default";

    if (!imageFile) {
      return res.status(400).json({ error: "No image uploaded" });
    }

    const roast = await generateRoast(style);

    // Validate that we actually have a roast to return
    if (!roast || typeof roast !== 'string') {
      console.error("No valid roast generated, using emergency fallback");

      // Emergency fallback based on style
      let emergencyRoast;
      if (style.toLowerCase() === "pidgin") {
        emergencyRoast = "Your face dey make data finish for network.";
      } else if (style.toLowerCase() === "patois") {
        emergencyRoast = "Yuh look like Monday morning struggle.";
      } else {
        emergencyRoast = "Your selfie just crashed the compliment algorithm.";
      }

      return res.json({ roasts: [emergencyRoast] });
    }

    res.json({ roasts: [roast] });
  } catch (err) {
    console.error("Roast endpoint error:", err.message);
    // Send a witty error message instead of exposing the internal error
    res.json({
      roasts: ["Your face was so powerful it broke our roasting engine!"]
    });
  }
});

// New MemeMyFace endpoint for multiple images
app.post("/api/mememyface", upload.array("images"), async (req, res) => {
  try {
    const imageFiles = req.files;
    const style = req.body.style || "default";
    const prompt = req.body.prompt || "";

    if (!imageFiles || imageFiles.length === 0) {
      return res.status(400).json({ error: "No images uploaded" });
    }

    console.log(`Processing ${imageFiles.length} images with prompt: "${prompt}"`);

    // Generate individual roasts for each image
    const roastsPromises = imageFiles.map(async (_, index) => {
      // Generate a customized prompt for this specific image based on the pack prompt
      const imagePrompt = `Based on this prompt: "${prompt}" - write a funny roast for a person in an image.`;
      const roast = await generateRoast(style, imagePrompt);
      
      return {
        imageIndex: index,
        roast: roast
      };
    });

    const roasts = await Promise.all(roastsPromises);

    res.json({ roasts });
  } catch (err) {
    console.error("MemeMyFace endpoint error:", err.message);
    res.status(500).json({
      error: "An error occurred while processing your request",
      roasts: []
    });
  }
});

app.get("/", (req, res) => {
  res.send("RoastMyFace API is running");
});

app.listen(PORT, () => console.log(`Server running on port ${PORT}`));

module.exports = app;