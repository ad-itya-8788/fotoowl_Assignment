const express = require("express");
const axios = require("axios");
const pool = require("../db");
const { sendToQueue } = require("../queue");
require("dotenv").config();

const router = express.Router();
const GOOGLE_API_KEY = process.env.GOOGLE_DRIVE_API_KEY;

function getFolderId(url)
{
  // Try different Google Drive URL patterns
  const patterns = [
    /folders\/([a-zA-Z0-9_-]+)/,
    /\/d\/([a-zA-Z0-9_-]+)/,  // For file URLs, but sometimes used
    /\?id=([a-zA-Z0-9_-]+)/
  ];

  for (const pattern of patterns) {
    const match = url.match(pattern);
    if (match) return match[1];
  }
  return null;
}

router.post("/google-drive", async (req, res) => {
  try {
    const { folderUrl } = req.body;
    console.log("Import request received, folderUrl:", folderUrl);

    if (!folderUrl)
    {
      return res.status(400).json({ error: "folderUrl required" });
    }

    const folderId = getFolderId(folderUrl);
    console.log("Extracted folderId:", folderId);
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

      // Check if API returned error
      if (response.status !== 200) {
        return res.status(400).json({ error: `Google Drive API error: ${response.status} ${response.statusText}` });
      }

      const files = response.data.files || [];

      // If first page and no files, might be permission issue
      if (pageCount === 1 && files.length === 0 && !response.data.nextPageToken) {
        return res.status(400).json({ error: "No files found in folder. Make sure the folder is public and contains images." });
      }

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
        try {
          await sendToQueue({
            google_drive_id: img.id,
            name: img.name
          });
          queuedCount++;
        } catch (queueError) {
          console.error("Failed to queue image:", queueError.message);
          // Still count as processed, worker can be restarted later
          queuedCount++;
        }
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
