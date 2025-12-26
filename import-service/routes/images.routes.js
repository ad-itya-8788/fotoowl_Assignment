const express = require("express");
const pool = require("../db");

const router = express.Router();

router.get("/", async (req, res) => {
  try {
    const result = await pool.query(
      "SELECT name, google_drive_id, size, mime_type, storage_path FROM images ORDER BY id DESC"
    );
    res.json(result.rows);
  } catch (err) {
    console.error("Get images error:", err.message);
    res.status(500).json({ error: err.message });
  }
});

module.exports = router;
