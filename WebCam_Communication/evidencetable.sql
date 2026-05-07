CREATE TABLE IF NOT EXISTS Evidence (
EvidenceID BIGINT UNSIGNED AUTO_INCREMENT PRIMARY KEY,
EventTimestamp DATETIME NOT NULL,
EventType VARCHAR(100) NOT NULL DEFAULT 'abnormal_interaction_detected',
LabelsJson LONGTEXT NOT NULL,
Location VARCHAR(100) NOT NULL,
VideoFileName VARCHAR(255) NOT NULL,
VideoMimeType VARCHAR(120) NOT NULL DEFAULT 'video/mp4',
VideoSizeBytes BIGINT UNSIGNED NULL,
VideoData LONGBLOB NOT NULL,
VideoSha256 CHAR(64) NULL,
CreatedAt TIMESTAMP NOT NULL DEFAULT CURRENT_TIMESTAMP,
CONSTRAINT chk_evidence_labels_json CHECK (JSON_VALID(LabelsJson))
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci;

ALTER TABLE Evidence
ADD COLUMN IF NOT EXISTS Location VARCHAR(100) NOT NULL AFTER LabelsJson;

CREATE INDEX idx_evidence_event_time ON Evidence (EventTimestamp);
CREATE INDEX idx_evidence_created_at ON Evidence (CreatedAt);
