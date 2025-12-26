// Import required libraries
const amqp = require("amqplib");
const axios = require("axios");
const { Pool } = require("pg");
require("dotenv").config();

// ============================================
// DATABASE SETUP
// ============================================
const pool = new Pool({
  host: "localhost",
  port: 5432,
  user: "postgres",
  password: "1234",
  database: "images_data",
});

// ============================================
// BUNNYCDN CONFIGURATION
// ============================================
const BUNNY_ACCESS_KEY = process.env.BUNNY_ACCESS_KEY;
const BUNNY_STORAGE_ZONE = process.env.BUNNY_STORAGE_ZONE;
const BUNNY_CDN_HOSTNAME = process.env.BUNNY_CDN_HOSTNAME;

// ============================================
// HELPER: Retry function with exponential backoff
// ============================================
async function retryWithBackoff(fn, maxRetries = 3, baseDelay = 1000) {
  for (let attempt = 1; attempt <= maxRetries; attempt++) {
    try {
      return await fn();
    } catch (error) {
      const isLastAttempt = attempt === maxRetries;
      const isRetryableError =
        error.code === 'ECONNRESET' ||
        error.code === 'ETIMEDOUT' ||
        error.code === 'ENOTFOUND' ||
        error.response?.status >= 500;

      if (isLastAttempt || !isRetryableError) {
        throw error;
      }

      const delay = baseDelay * Math.pow(2, attempt - 1);
      console.log(`⚠️  Attempt ${attempt} failed: ${error.message}. Retrying in ${delay}ms...`);
      await new Promise(resolve => setTimeout(resolve, delay));
    }
  }
}

// ============================================
// FUNCTION: Stream image directly from Google Drive to BunnyCDN
// NO LOCAL STORAGE - Direct streaming
// ============================================
async function streamImageToBunny(fileId, fileName) {
  return retryWithBackoff(async () => {
    // Build Google Drive download URL
    const driveUrl = `https://drive.google.com/uc?export=download&id=${fileId}&confirm=t`;

    // Build BunnyCDN storage path
    const bunnyPath = `ASSIGNMENT_TASK/${fileName}`;
    const storageUrl = `https://storage.bunnycdn.com/${BUNNY_STORAGE_ZONE}/${bunnyPath}`;

    // STEP 1: Download from Google Drive as stream
    console.log("⬇️  Streaming from Google Drive...");
    const driveResponse = await axios({
      url: driveUrl,
      method: "GET",
      responseType: "arraybuffer", // Get as buffer for direct upload
      timeout: 60000, // 60 second timeout for large files
      maxContentLength: Infinity,
      maxBodyLength: Infinity,
    });

    // STEP 2: Upload directly to BunnyCDN (no local storage)
    console.log("⬆️  Uploading to BunnyCDN...");
    await axios.put(storageUrl, driveResponse.data, {
      headers: {
        AccessKey: BUNNY_ACCESS_KEY,
        "Content-Type": "application/octet-stream",
      },
      timeout: 60000, // 60 second timeout
      maxContentLength: Infinity,
      maxBodyLength: Infinity,
    });

    // Return public CDN URL
    const cdnUrl = `https://${BUNNY_CDN_HOSTNAME}/${bunnyPath}`;
    return cdnUrl;
  });
}

// ============================================
// FUNCTION: Update database with CDN URL
// ============================================
async function updateDatabase(googleDriveId, cdnUrl) {
  await pool.query(
    "UPDATE images SET storage_path = $1 WHERE google_drive_id = $2",
    [cdnUrl, googleDriveId]
  );
}

// ============================================
// MAIN WORKER FUNCTION
// ============================================
async function startWorker() {
  // Connect to RabbitMQ
  const connection = await amqp.connect("amqp://localhost");
  const channel = await connection.createChannel();
  await channel.assertQueue("image_jobs");

  console.log("✅ Worker started. Waiting for jobs...");
  console.log("🚀 Direct streaming mode: Google Drive → BunnyCDN (no local storage)");

  // Listen for messages
  channel.consume("image_jobs", async (message) => {
    // Parse the job data
    const job = JSON.parse(message.content.toString());
    console.log(`\n📥 New job: ${job.name}`);

    try {
      // STEP 1: Stream directly from Google Drive to BunnyCDN
      const cdnUrl = await streamImageToBunny(job.google_drive_id, job.name);

      // STEP 2: Update database
      console.log("💾 Updating database...");
      await updateDatabase(job.google_drive_id, cdnUrl);

      // STEP 3: Acknowledge job completion
      channel.ack(message);
      console.log(`✅ Job completed: ${job.name}`);

    } catch (error) {
      // If anything fails, log error and acknowledge anyway
      console.error(`❌ Error: ${error.message}`);
      channel.ack(message);
    }
  });
}

// ============================================
// START THE WORKER
// ============================================
startWorker();
