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
  roastData = JSON.parse(
    fs.readFileSync(path.join(__dirname, "roasts.json"), "utf-8")
  );
} catch (err) {
  console.error("Error loading roasts.json:", err.message);
  roastData = {
    default: [
      "Your selfie just made my phone switch to power-saving mode.",
      "Your face is what error messages were designed for.",
      "You look like the human version of a loading screen.",
      "Your appearance is buffering at 2% indefinitely.",
    ],
    pidgin: [
      "Your face dey scatter market vibe like bad juju.",
      "You be like hustle wey no pay.",
      "Your smile dey comot Wi-Fi signal for area.",
    ],
    patois: [
      "Yuh style flop like curry goat gone wrong.",
      "Yuh face vex di sun bad.",
      "Yuh vibe weak like no-rasta roadman.",
    ],
  };
}

const HF_API_URL =
  "https://api-inference.huggingface.co/models/mistralai/Mixtral-8x7B-Instruct-v0.1";
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
        await new Promise((r) => setTimeout(r, delay * Math.pow(2, i)));
      } else {
        throw err;
      }
    }
  }
};

const generateRoast = async (style = "default", customPrompt = "") => {
  if (!HF_API_KEY) {
    console.warn(
      "No Hugging Face API key provided, falling back to roasts.json"
    );
    const lines = roastData[style] ||
      roastData["default"] || ["Your face broke the AI, congrats."];
    return lines.sort(() => 0.5 - Math.random())[0];
  }

  try {
    const uniqueSeed = Math.floor(Math.random() * 1000000);
    const timestamp = Date.now();

    let prompt;
    if (customPrompt) {
      // Use the custom prompt but ensure it's formatted correctly
      prompt = `<s>[INST] You are a savage roast generator (seed: ${uniqueSeed}, time: ${timestamp}). 
      ${customPrompt} 
      
      Make it hilarious, specific, and under 25 words. End with punctuation.
      Tailor the roast to match the theme requested.
      Make it light-hearted enough for friends joking with each other.
      Only return the roast text itself, nothing else. [/INST]`;
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
        const lines = roast
          .split("\n")
          .filter(
            (line) =>
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

    console.warn(
      "Invalid or empty roast received from AI, using fallback roasts"
    );
    throw new Error("Invalid roast format from AI");
  } catch (err) {
    console.warn(
      `AI roast failed, falling back to roasts.json: ${err.message}`,
      err.response?.status ? `Status: ${err.response.status}` : ""
    );

    // Add some backup roasts specific to each category
    const categoryRoasts = {
      "Nigerian Entertainment Space": [
        "Your one hit wonder is still pending after 10 years in the industry.",
        "You're the celebrity that even paparazzi ignore at events.",
        "Your music career is like Nigerian electricity – always off.",
      ],
      "Nigerian Politicians": [
        "You look like you'd promise roads and deliver potholes.",
        "Your campaign promises expire faster than milk in Nigeria's heat.",
        "You'd win gold if avoiding accountability was an Olympic sport.",
      ],
      "Female Actresses": [
        "Your acting range goes from shocked to... slightly more shocked.",
        "You're the type to win 'Best Dressed' but never 'Best Actress'.",
        "Your dramatic skills only work on social media, never on screen.",
      ],
      Football: [
        "You look like you'd get injured during the team photo.",
        "Your football skills are so bad even Sunday league teams would bench you.",
        "You'd miss an open goal from two yards out.",
      ],
      "Controversial American Celebrities": [
        "Your scandals are more successful than your career.",
        "You're famous for being famous, and infamous for everything else.",
        "Your publicist deserves a raise for keeping you relevant.",
      ],
      "Global Influencers and More": [
        "Your content is 90% filter, 10% substance.",
        "You'd promote water in a desert if they paid you enough.",
        "Your engagement rate is lower than my battery life.",
      ],
    };

    // Try to find category-specific roasts first
    if (categoryRoasts[style]) {
      return categoryRoasts[style].sort(() => 0.5 - Math.random())[0];
    }

    // Fall back to default roasts
    const lines = roastData[style] ||
      roastData["default"] || [
        "Your selfie has achieved what no filter could - made me speechless.",
      ];
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
    if (!roast || typeof roast !== "string") {
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
      roasts: ["Your face was so powerful it broke our roasting engine!"],
    });
  }
});

// Helper function to create position text
function getImagePositionText(index, totalImages) {
  if (totalImages <= 1) return "";

  const positions = [
    "first",
    "second",
    "third",
    "fourth",
    "fifth",
    "sixth",
    "seventh",
    "eighth",
    "ninth",
    "tenth",
  ];
  if (index < positions.length) {
    return positions[index];
  } else {
    return `${index + 1}th`;
  }
}

app.post("/api/mememyface", upload.array("images"), async (req, res) => {
  try {
    const imageFiles = req.files;
    const style = req.body.style || "default";
    const prompt = req.body.prompt || "";
    const packTitle = req.body.packTitle || "";

    if (!imageFiles || imageFiles.length === 0) {
      return res.status(400).json({ error: "No images uploaded" });
    }

    console.log(
      `Processing ${imageFiles.length} images with prompt: "${prompt}" from pack: "${packTitle}"`
    );

    // Generate individual roasts for each image
    const roastsPromises = imageFiles.map(async (_, index) => {
      const positionText = getImagePositionText(index, imageFiles.length);
      let imageSpecificPrompt;

      // Savage one-sentence prompt customization based on pack title
      switch (packTitle) {
        case "Nigerian Entertainment Space":
          imageSpecificPrompt = `${prompt} For the ${positionText} person in a set of ${imageFiles.length} images, write a single-sentence, ruthless Nigerian entertainment industry-themed roast that obliterates them as a washed-up Nigerian celebrity, dragging their outdated music, overhyped collabs, or cringeworthy social media antics with savage Naija slang like 'yeye' or 'mumu,' ensuring it stings with brutal local vibes.`;
          break;

        case "Nigerian Politicians":
          imageSpecificPrompt = `${prompt} For the ${positionText} person in a set of ${imageFiles.length} images, write a single-sentence, brutal Nigerian politics-themed roast that buries them as a shameless, corrupt politician, mocking their empty promises, bloated agbada, or scandalous looting with savage jabs like 'ole' or 'chop-and-clean-mouth,' dripping with Naija-style shade.`;
          break;

        case "Female Actresses":
          imageSpecificPrompt = `${prompt} For the ${positionText} person in a set of ${imageFiles.length} images, write a single-sentence, vicious Nollywood-style roast that annihilates them as a female actress with zero range, tearing into their typecast roles, fake accents, or desperate thirst for endorsements with ruthless shade, calling out their 'wack' acting like it’s a national disgrace.`;
          break;

        case "Football":
          imageSpecificPrompt = `${prompt} For the ${positionText} person in a set of ${imageFiles.length} images, write a single-sentence, savage football/soccer-themed roast that destroys them as an overhyped footballer, roasting their flopped transfers, lazy footwork, or ridiculous hairstyles like they’re an insult to the pitch, making their teammates look like Messi by comparison.`;
          break;

        case "Controversial American Celebrities":
          imageSpecificPrompt = `${prompt} For the ${positionText} person in a set of ${imageFiles.length} images, write a single-sentence, cutthroat roast that eviscerates them as a trainwreck American celebrity, ripping into their messy beefs, delusional PR stunts, or canceled antics with savage pop culture burns, making their scandals sound like a reality TV dumpster fire.`;
          break;

        case "Global Influencers and More":
          imageSpecificPrompt = `${prompt} For the ${positionText} person in a set of ${imageFiles.length} images, write a single-sentence, brutal social media influencer-themed roast that obliterates them as a fake, try-hard wannabe, mocking their filtered selfies, flops at brand deals, or cringey TikTok dances like they’re an embarrassment to the algorithm.`;
          break;

        default:
          imageSpecificPrompt = `${prompt} For the ${positionText} person in a set of ${imageFiles.length} images, write a single-sentence, savage, no-holds-barred roast that obliterates them based on the prompt, ensuring brutal wit and zero mercy in a razor-sharp insult.`;
      }

      // Add savage competitive comparison for multiple images
      if (imageFiles.length > 1) {
        imageSpecificPrompt += ` In this one sentence, compare them to the others in this set, dragging their flaws so viciously they’re clearly the worst, with no redemption.`;
      }

      // Ensure the roast is savage and one sentence
      imageSpecificPrompt += ` Keep the roast to a single sentence, razor-sharp, unapologetic, and dripping with savage humor, avoiding anything polite or tame—go for the jugular with clever, brutal wit.`;

      const roast = await generateRoast(style, imageSpecificPrompt);

      return {
        imageIndex: index,
        roast: roast,
      };
    });

    const roasts = await Promise.all(roastsPromises);
    res.json({ roasts });
  } catch (err) {
    console.error("MemeMyFace endpoint error:", err.message);
    res.status(500).json({
      error: "An error occurred while processing your request",
      roasts: [],
    });
  }
});

app.get("/", (req, res) => {
  res.send("RoastMyFace API is running");
});

app.listen(PORT, () => console.log(`Server running on port ${PORT}`));

module.exports = app;
