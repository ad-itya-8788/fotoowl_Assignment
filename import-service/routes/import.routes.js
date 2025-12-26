const express = require("express");
const axios = require("axios");
const pool = require("../db");
const { sendToQueue } = require("../queue");
require("dotenv").config();

const router = express.Router();
const GOOGLE_API_KEY = process.env.GOOGLE_DRIVE_API_KEY;

function getFolderId(url)
{
  const match = url.match(/folders\/([a-zA-Z0-9_-]+)/);
  return match ? match[1] : null;
}

router.post("/google-drive", async (req, res) => {
  try {
    const { folderUrl } = req.body;

    if (!folderUrl)
    {
      return res.status(400).json({ error: "folderUrl required" });
    }

    const folderId = getFolderId(folderUrl);
    if (!folderId)
    {
      return res.status(400).json({ error: "Invalid Google Drive folder URL" });
    }

    // Collect ALL images from ALL pages
    let allImages = [];
    let pageToken = null;
    let pageCount = 0;

    // Pagination loop - continues until no more pages
    do {
      pageCount++;

      // Build API URL with pageToken if available
      let apiUrl = `https://www.googleapis.com/drive/v3/files?q=${encodeURIComponent(
        `'${folderId}' in parents`
      )}&fields=files(id,name,mimeType,size),nextPageToken&key=${GOOGLE_API_KEY}`;

      if (pageToken) {
        apiUrl += `&pageToken=${pageToken}`;
      }

      const response = await axios.get(apiUrl, {
        timeout: 30000, // 30 second timeout
      });

      const files = response.data.files || [];

      // Filter only images
      const images = files.filter(
        f => f.mimeType && f.mimeType.startsWith("image/")
      );

      allImages.push(...images);

      // Get next page token (null if no more pages)
      pageToken = response.data.nextPageToken;

      console.log(`Page ${pageCount}: Fetched ${images.length} images (total so far: ${allImages.length})`);

      // Small delay to avoid rate limiting (only if there are more pages)
      if (pageToken) {
        await new Promise(resolve => setTimeout(resolve, 100));
      }

    } while (pageToken); // Continue while there are more pages

    console.log(`✅ Total images fetched from ${pageCount} pages: ${allImages.length}`);

    // Process all collected images
    let queuedCount = 0;
    for (const img of allImages) {
      const result = await pool.query(
        `INSERT INTO images (name, google_drive_id, size, mime_type, storage_path)
         VALUES ($1, $2, $3, $4, $5)
         ON CONFLICT (google_drive_id) DO NOTHING
         RETURNING id`,
        [img.name, img.id, img.size || 0, img.mimeType, null]
      );

      if (result.rowCount > 0) {
        await sendToQueue({
          google_drive_id: img.id,
          name: img.name
        });
        queuedCount++;
      }
    }

    res.json({
      message: "Images imported successfully",
      totalImages: allImages.length,
      queuedForDownload: queuedCount
    });

  } catch (err) {
    console.error("Import error:", err.message);
    res.status(500).json({ error: err.message });
  }
});

module.exports = router;
