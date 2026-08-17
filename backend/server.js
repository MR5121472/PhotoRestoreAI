import "dotenv/config";
import express from "express";
import cors from "cors";
import multer from "multer";
import Replicate from "replicate";

const app = express();
const port = Number(process.env.PORT || 8080);

if (!process.env.REPLICATE_API_TOKEN) {
  throw new Error("REPLICATE_API_TOKEN is not configured");
}

const replicate = new Replicate({
  auth: process.env.REPLICATE_API_TOKEN,
});

app.use(cors());

const upload = multer({
  storage: multer.memoryStorage(),
  limits: { fileSize: 10 * 1024 * 1024 }
});

// Root & Health Check Endpoints
app.get(["/", "/health", "/backend", "/backend/health"], (_req, res) => {
  res.json({ ok: true, service: "photo-restore-ai" });
});

// Target Multiple Paths to Prevent 404
app.post(
  ["/api/restore", "/backend/api/restore", "/"],
  upload.single("image"),
  async (req, res) => {
    try {
      if (!req.file) {
        return res.status(400).json({ error: "image is required" });
      }

      const base64Image = `data:${req.file.mimetype || "image/jpeg"};base64,${req.file.buffer.toString("base64")}`;

      const output = await replicate.run(
  "sc3000/codeformer:7de2ea26c616d5bf2245ad0d5e24f0ff9a6204578a5c876db731439075736570",
  {
    input: {
      image: base64Image,
      codeformer_fidelity: 0.7,
      background_enhance: true,
      face_upsample: true,
      upscale: 2
    }
  }
);
    

      const imageUrl = Array.isArray(output) ? output[0] : output;

      if (!imageUrl) {
        return res.status(502).json({ error: "No image URL returned by AI model" });
      }

      const imageResponse = await fetch(imageUrl);
      const arrayBuffer = await imageResponse.arrayBuffer();
      const buffer = Buffer.from(arrayBuffer);

      res.setHeader("Content-Type", "image/png");
      res.setHeader("Cache-Control", "no-store");
      return res.send(buffer);

    } catch (error) {
      console.error("RESTORE ERROR:", error);
      return res.status(500).json({
        error: "Image restoration failed",
        detail: String(error?.message || error)
      });
    }
  }
);

app.listen(port, () => {
  console.log(`Photo Restore AI backend listening on port ${port}`);
});
