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

const generateRoasts = (filename, style = "default") => {
  const defaultRoasts = [
    `This face could scare Wi-Fi into disconnecting.`,
    `Are you sure this isn't an AI-generated prank?`,
    `You look like the reason autocorrect gave up.`,
    `Face so fried, even KFC said no thanks.`,
    `You didn't choose the struggle life—the struggle chose you.`,
    `You look like a before photo with no after.`,
    `This face has "404 Error: Glow Up Not Found" written all over it.`,
    `Even AI refused to enhance this image.`,
    `If confidence was based on looks, you’d be bankrupt.`,
    `You look like you type with one finger... and misspell everything.`,
    `If awkward had a face, it just uploaded itself.`,
    `NASA called—they found a new crater.`,
    `This image is proof that pixels can scream.`,
    `You look like your reflection tries to run away.`,
    `If vibes were visible, yours would be buffering.`,
    `You’ve got the kind of face that makes mirrors flinch.`,
    `Even your camera lens sighed before capturing this.`,
    `You look like the villain in a toothpaste commercial.`,
    `You didn’t break the internet—you scared it offline.`,
    `This face has been through three filters and still filed a complaint.`,
  ];

  const pidginRoasts = [
    `See as you be like who DStv dey use test signal.`,
    `Your face fit break SIM card.`,
    `Na you go make NEPA fear to bring light.`,
    `Your face dey drag network like say na MTN 3G.`,
    `You be like person wey jollof rice reject.`,
    `Mirror see you and e crack by itself.`,
    `Even your shadow dey avoid you for road.`,
    `Your picture fit make soldier fear.`,
    `If suffering na person, e go resemble you.`,
    `You resemble who life beat without warning.`,
  ];

  const patoisRoasts = [
    `Yuh face look like it bun up inna curry fire.`,
    `Dem shoulda warn di camera 'fore yuh tek dat shot.`,
    `Yuh look like stress tek yuh to church and back.`,
    `Yuh face alone a mash up di vibes.`,
    `Mi phone battery dead when it see yuh picture.`,
    `Yuh hairstyle look like it lose di argument.`,
    `Even ghost nah haunt yuh back.`,
    `Yuh look like yuh sleep inna blender.`,
    `Mirror say “nah, mi good” when it see yuh.`,
    `Yuh face a reason fi curfew.`,
  ];

  let lines = defaultRoasts;
  if (style === "pidgin") lines = pidginRoasts;
  else if (style === "patois") lines = patoisRoasts;

  return lines.sort(() => 0.5 - Math.random()).slice(0, 1);
};

app.post("/api/roast", upload.single("image"), (req, res) => {
  try {
    const imageFile = req.file;
    const style = req.body.style || "default";

    if (!imageFile) return res.status(400).json({ error: "No image uploaded" });

    const roasts = generateRoasts(imageFile.originalname, style);

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
