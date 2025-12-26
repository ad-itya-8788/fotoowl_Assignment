const express = require("express");
const path = require("path");
const { connectQueue } = require("./queue");

const importRoutes = require("./routes/import.routes");
const imagesRoutes = require("./routes/images.routes");

const app = express();
app.use(express.json());

app.use("/import", importRoutes);
app.use("/images", imagesRoutes);
app.use(express.static(path.join(__dirname, "../frontend")));

// Serve index.html at root URL
app.get("/", (req, res) => {
  res.sendFile(path.join(__dirname, "../frontend/index.html"));
});

connectQueue()
  .then(() => {
    app.listen(3000, () => {
      console.log("Import service running on http://localhost:3000");
    });
  })
  .catch((err) => {
    console.error("Failed to connect to RabbitMQ:", err.message);
    process.exit(1);
  });
