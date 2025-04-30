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

let roastPack;
try {
  roastPack = JSON.parse(
    fs.readFileSync(path.join(__dirname, "roast_pack.json"), "utf-8")
  );
} catch (err) {
  console.error("Error loading roast_pack.json:", err.message);
  roastPack = [];
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
            top_p: 0.9,
            return_full_text: false,
          },
        },
        {
          headers: {
            Authorization: `Bearer ${HF_API_KEY}`,
            "Content-Type": "application/json",
          },
          timeout: 15000,
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

const generateRoast = async (style = "default", category = "looks", tone = "funny", customPrompt = "") => {
  // Map style to language for roast_pack.json
  const styleToLanguage = {
    default: "English",
    pidgin: "Pidgin",
    patois: "English", // Patois uses English in roast_pack.json for simplicity
  };
  const language = styleToLanguage[style] || "English";

  // Fetch example roasts from roast_pack.json to guide AI
  let exampleRoasts = [];
  const pack = roastPack.find(p => p.pack_name === "African Meme Legends");
  if (pack && pack.languages[language] && pack.languages[language].tones[tone] && pack.languages[language].tones[tone].categories[category]) {
    exampleRoasts = pack.languages[language].tones[tone].categories[category].slice(0, 3); // Use up to 3 examples for better guidance
  }

  // Try AI generation first
  if (HF_API_KEY) {
    try {
      const uniqueSeed = Math.floor(Math.random() * 1000000);
      const timestamp = Date.now();

      let prompt;
      if (customPrompt) {
        prompt = `<s>[INST] You are a roast generator for African Meme Legends (seed: ${uniqueSeed}, time: ${timestamp}).
        ${customPrompt}
        Generate one roast in ${style} style (${style === "pidgin" ? "Nigerian Pidgin" : style === "patois" ? "Jamaican Patois" : "standard English"}),
        targeting the ${category} category with a ${tone} tone.
        Keep it witty, light-hearted for friends, under 15 words, and end with punctuation.
        Match the style, tone, and category of these examples: ${exampleRoasts.join(" | ")}
        Return only the roast text, no explanations or metadata. [/INST]`;
      } else {
        prompt = `<s>[INST] You are a roast generator for African Meme Legends (seed: ${uniqueSeed}, time: ${timestamp}).
        Generate one roast in ${style} style (${style === "pidgin" ? "Nigerian Pidgin" : style === "patois" ? "Jamaican Patois" : "standard English"}),
        targeting the ${category} category with a ${tone} tone.
        Keep it witty, light-hearted for friends, under 15 words, and end with punctuation.
        Match the style, tone, and category of these examples: ${exampleRoasts.join(" | ")}
        Return only the roast text, no explanations or metadata. [/INST]`;
      }

      const response = await makeApiRequest(prompt);
      console.log("Raw API response:", JSON.stringify(response.data));

      let roast = response.data[0]?.generated_text?.trim();
      if (roast) {
        // Clean the response
        roast = roast.replace(/\[INST\]|\[\/INST\]|<s>|<\/s>/g, "").trim();

        // Handle quoted content or multi-line responses
        const quotedContent = roast.match(/"([^"]+)"/);
        if (quotedContent && quotedContent[1]) {
          roast = quotedContent[1].trim();
        } else {
          const lines = roast
            .split("\n")
            .map(line => line.trim())
            .filter(
              line =>
                line.length > 0 &&
                !line.toLowerCase().includes("example") &&
                !line.toLowerCase().includes("format") &&
                !line.toLowerCase().includes("seed") &&
                !line.toLowerCase().includes("time") &&
                !line.toLowerCase().includes("inst")
            );

          roast = lines.length > 0 ? lines[0] : "";
        }

        // Validate and finalize roast
        if (roast && roast.length > 3) {
          if (!roast.match(/[.!?]$/)) {
            roast += ".";
          }
          return roast;
        }
      }

      console.warn("Invalid or empty roast received from AI, falling back to roast_pack.json");
    } catch (err) {
      console.warn(`AI roast failed, falling back to roast_pack.json: ${err.message}`);
    }
  } else {
    console.warn("No Hugging Face API key provided, falling back to roast_pack.json");
  }

  // Fallback to roast_pack.json
  if (pack && pack.languages[language] && pack.languages[language].tones[tone] && pack.languages[language].tones[tone].categories[category]) {
    const roasts = pack.languages[language].tones[tone].categories[category];
    if (roasts && roasts.length > 0) {
      return roasts[Math.floor(Math.random() * roasts.length)];
    }
  }

  // Last resort: roasts.json
  const lines = roastData[style] || roastData["default"] || ["Your face broke the AI, congrats."];
  return lines.sort(() => 0.5 - Math.random())[0];
};

app.post("/api/roast", upload.single("image"), async (req, res) => {
  try {
    const imageFile = req.file;
    const { style = "default", category = "looks", tone = "funny" } = req.body;

    if (!imageFile) {
      return res.status(400).json({ error: "No image uploaded" });
    }

    const roast = await generateRoast(style, category, tone);

    if (!roast || typeof roast !== "string" || roast.length < 3) {
      console.error("No valid roast generated, using emergency fallback");
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
    res.json({
      roasts: ["Your face was so powerful it broke our roasting engine!"],
    });
  }
});

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

    const roastsPromises = imageFiles.map(async (_, index) => {
      const positionText = getImagePositionText(index, imageFiles.length);
      let imageSpecificPrompt;

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

      if (imageFiles.length > 1) {
        imageSpecificPrompt += ` In this one sentence, compare them to the others in this set, dragging their flaws so viciously they’re clearly the worst, with no redemption.`;
      }

      imageSpecificPrompt += ` Keep the roast to a single sentence, razor-sharp, unapologetic, and dripping with savage humor, avoiding anything polite or tame—go for the jugular with clever, brutal wit.`;

      const roast = await generateRoast(style, "looks", "savage", imageSpecificPrompt);

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

app.get("/", (req, res) => {
  res.send("RoastMyFace API is running");
});

app.listen(PORT, () => console.log(`Server running on port ${PORT}`));

module.exports = app;