import "dotenv/config";
import express from "express";
import cors from "cors";
import multer from "multer";
import OpenAI, { toFile } from "openai";

const app = express();
const port = Number(process.env.PORT || 8080);

if (!process.env.OPENAI_API_KEY) {
  throw new Error("OPENAI_API_KEY is not configured");
}

const client = new OpenAI({
  apiKey: process.env.OPENAI_API_KEY
});

app.use(cors({
  origin: process.env.ALLOWED_ORIGIN || "*",
  methods: ["GET", "POST"]
}));

const upload = multer({
  storage: multer.memoryStorage(),
  limits: {
    fileSize: 10 * 1024 * 1024
  }
});

app.get("/health", (_req, res) => {
  res.json({
    ok: true,
    service: "photo-restore-ai"
  });
});

app.post("/api/restore", upload.single("image"), async (req, res) => {
  try {
    if (!req.file) {
      return res.status(400).json({
        error: "image is required"
      });
    }

    const userPrompt = String(
      req.body.prompt || ""
    ).trim();

    const restorePrompt = userPrompt || `
Restore this old photograph professionally.

Remove scratches, dust, stains, fading, blur,
compression damage and film noise.

Recover natural facial details and realistic skin texture.

Preserve the person's identity, facial structure,
expression, pose, clothing, headwear and composition.

Do not invent a different person.

Improve sharpness, contrast and tonal range naturally.

Produce a photorealistic restoration that looks like
a clean high-quality photograph, not an illustration
or AI painting.
    `.trim();

    const file = await toFile(
      req.file.buffer,
      req.file.originalname || "photo.jpg",
      {
        type: req.file.mimetype || "image/jpeg"
      }
    );

    const result = await client.images.edit({
      model: process.env.IMAGE_MODEL || "gpt-image-2",
      image: file,
      prompt: restorePrompt,
      size: "1024x1024",
      quality: "medium",
      n: 1
    });

    const b64 = result?.data?.[0]?.b64_json;

    if (!b64) {
      return res.status(502).json({
        error: "No image returned by AI service."
      });
    }

    res.setHeader("Content-Type", "image/png");
    res.setHeader("Cache-Control", "no-store");

    return res.send(
      Buffer.from(b64, "base64")
    );

  } catch (error) {
    console.error("RESTORE ERROR:", error);

    return res.status(500).json({
      error: "Image restoration failed",
      detail:
        process.env.NODE_ENV === "development"
          ? String(error?.message || error)
          : undefined
    });
  }
});

app.listen(port, () => {
  console.log(
    `Photo Restore AI backend listening on port ${port}`
  );
});
