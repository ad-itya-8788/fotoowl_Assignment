CREATE TABLE images (
  id SERIAL PRIMARY KEY,
  name VARCHAR(255) NOT NULL,
  google_drive_id VARCHAR(255) UNIQUE NOT NULL,
  size BIGINT,
  mime_type VARCHAR(100),
  storage_path TEXT,
  created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP
);