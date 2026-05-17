const { query } = require("../config/db");
const notificationService = require("../services/notificationService");

function safeJsonParse(value, fallback = {}) {
  if (value == null) {
    return fallback;
  }

  if (typeof value === "object") {
    return value;
  }

  if (typeof value !== "string") {
    return fallback;
  }

  try {
    const parsed = JSON.parse(value);
    return parsed && typeof parsed === "object" ? parsed : fallback;
  } catch (_error) {
    return fallback;
  }
}

function getFirstMatchingValue(source, keys, fallback = null) {
  if (!source || typeof source !== "object") {
    return fallback;
  }

  for (const key of keys) {
    if (Object.prototype.hasOwnProperty.call(source, key)) {
      const value = source[key];
      if (value !== undefined && value !== null && value !== "") {
        return value;
      }
    }
  }

  return fallback;
}

function formatEvidenceTimestamp(value) {
  if (!value) {
    return "";
  }

  const parsedDate = new Date(value);

  if (Number.isNaN(parsedDate.getTime())) {
    return String(value);
  }

  return parsedDate.toISOString().replace("T", " ").slice(0, 16);
}

function normaliseEvidenceRow(row) {
  const labels = safeJsonParse(row.LabelsJson, {});
  const resolvedName =
    getFirstMatchingValue(labels, ["parkName", "park", "siteName", "name", "locationName"]) ||
    row.Location ||
    "Unknown location";
  const parkLatitude = Number(row.ParkLatitude);
  const parkLongitude = Number(row.ParkLongitude);
  const latitude = Number.isFinite(parkLatitude) ? parkLatitude : null;
  const longitude = Number.isFinite(parkLongitude) ? parkLongitude : null;
  const resolved = Boolean(Number(row.Status));
  const unsolvedCount = Number(row.UnsolvedCount || 0);
  const status =
    getFirstMatchingValue(labels, ["status", "summary", "message", "description", "note"]) ||
    String(row.EventType || "abnormal_interaction_detected")
      .replace(/_/g, " ")
      .replace(/\b\w/g, (character) => character.toUpperCase());

  return {
    evidenceId: row.EvidenceID,
    id: row.EvidenceID,
    name: resolvedName,
    location: row.Location,
    status,
    resolved,
    eventType: row.EventType,
    labels,
    parkName: row.ParkName || row.Location || null,
    latitude: Number.isFinite(latitude) ? latitude : null,
    longitude: Number.isFinite(longitude) ? longitude : null,
    unsolvedCountAtLocation: Number.isFinite(unsolvedCount) ? unsolvedCount : 0,
    showOnMap: unsolvedCount > 0 && Number.isFinite(latitude) && Number.isFinite(longitude),
    timestamp: formatEvidenceTimestamp(row.EventTimestamp),
    createdAt: row.CreatedAt,
    videoFileName: row.VideoFileName,
    videoMimeType: row.VideoMimeType,
    videoSizeBytes: row.VideoSizeBytes,
    videoSha256: row.VideoSha256,
    videoPath: `/api/v1/admin/evidence/${row.EvidenceID}/video`,
    hasVideo: Boolean(row.VideoFileName || row.VideoSizeBytes || row.VideoSha256),
  };
}

function normaliseEsp32SensorLogRow(row) {
  const logId = getFirstMatchingValue(row, ["LogID", "logId", "id"], null);
  const deviceId = String(getFirstMatchingValue(row, ["DeviceID", "deviceID", "DeviceId", "deviceId"], "") || "").trim();
  const location = String(getFirstMatchingValue(row, ["Location", "location"], "") || "").trim();
  const severity = String(getFirstMatchingValue(row, ["Severity", "severity"], "ESP32 sensor alert") || "ESP32 sensor alert").trim();
  const timestampValueSource = getFirstMatchingValue(row, ["Timestamp", "timestamp", "CreatedAt", "createdAt"], "");
  const parkLatitude = Number(getFirstMatchingValue(row, ["ParkLatitude", "parkLatitude"], null));
  const parkLongitude = Number(getFirstMatchingValue(row, ["ParkLongitude", "parkLongitude"], null));
  const latitude = Number.isFinite(parkLatitude) ? parkLatitude : null;
  const longitude = Number.isFinite(parkLongitude) ? parkLongitude : null;
  const labels = {
    deviceId: deviceId || null,
    location: location || null,
    severity: severity || null,
    temperature: getFirstMatchingValue(row, ["Temperature", "temperature"], null),
    humidity: getFirstMatchingValue(row, ["Humidity", "humidity"], null),
    distance: getFirstMatchingValue(row, ["Distance", "distance"], null),
    sound: getFirstMatchingValue(row, ["Sound", "sound"], null),
    rain: getFirstMatchingValue(row, ["Rain", "rain"], null),
    soil: getFirstMatchingValue(row, ["Soil", "soil"], null),
    soilRaw: getFirstMatchingValue(row, ["SoilRaw", "soilRaw"], null),
    distanceStatus: getFirstMatchingValue(row, ["DistanceStatus", "distanceStatus"], null),
    soundStatus: getFirstMatchingValue(row, ["SoundStatus", "soundStatus"], null),
    tempStatus: getFirstMatchingValue(row, ["TempStatus", "tempStatus"], null),
    humStatus: getFirstMatchingValue(row, ["HumStatus", "humStatus"], null),
    rainStatus: getFirstMatchingValue(row, ["RainStatus", "rainStatus"], null),
    rainLevel: getFirstMatchingValue(row, ["RainLevel", "rainLevel"], null),
    soilStatus: getFirstMatchingValue(row, ["SoilStatus", "soilStatus"], null),
  };

  return {
    evidenceId: null,
    id: logId !== null ? Number(logId) : null,
    alertKey: `esp32-${logId !== null ? Number(logId) : timestampValueSource || deviceId || location || "alert"}`,
    name: location || deviceId || "ESP32 sensor alert",
    location: location || deviceId || "ESP32 sensor",
    status: severity,
    resolved: Boolean(Number(getFirstMatchingValue(row, ["Status", "status"], 0))),
    eventType: String(getFirstMatchingValue(row, ["EventType", "eventType"], "esp32_sensor_alert") || "esp32_sensor_alert"),
    labels,
    parkName: getFirstMatchingValue(row, ["ParkName", "parkName"], null) || location || null,
    latitude,
    longitude,
    unsolvedCountAtLocation: 0,
    showOnMap: Number.isFinite(latitude) && Number.isFinite(longitude),
    timestamp: formatEvidenceTimestamp(timestampValueSource),
    createdAt: getFirstMatchingValue(row, ["CreatedAt", "createdAt"], null),
    videoFileName: null,
    videoMimeType: null,
    videoSizeBytes: null,
    videoSha256: null,
    videoPath: null,
    hasVideo: false,
    sourceType: "esp32-sensor-log",
    sourceLabel: "ESP32 sensor log",
    canUpdateStatus: false,
  };
}

function toSafeNumber(value, fallback = 0) {
  const parsed = Number(value);
  return Number.isFinite(parsed) ? parsed : fallback;
}

function formatHours(valueInSeconds) {
  const hours = toSafeNumber(valueInSeconds, 0) / 3600;
  return `${hours.toFixed(1)}h`;
}

function formatPercentage(value) {
  return `${Math.round(toSafeNumber(value, 0))}%`;
}

function parseCsvLine(line) {
  const values = [];
  let current = "";
  let insideQuotes = false;

  for (let index = 0; index < line.length; index += 1) {
    const character = line[index];

    if (character === '"') {
      if (insideQuotes && line[index + 1] === '"') {
        current += '"';
        index += 1;
      } else {
        insideQuotes = !insideQuotes;
      }
      continue;
    }

    if (character === "," && !insideQuotes) {
      values.push(current.trim());
      current = "";
      continue;
    }

    current += character;
  }

  values.push(current.trim());
  return values;
}

function normalizeCsvHeaderName(value) {
  return String(value || "")
    .trim()
    .toLowerCase()
    .replace(/[^a-z0-9]/g, "");
}

function findRowValueByHeader(rowValues, headerMap, headerCandidates) {
  for (const candidate of headerCandidates) {
    const normalizedCandidate = normalizeCsvHeaderName(candidate);
    if (Object.prototype.hasOwnProperty.call(headerMap, normalizedCandidate)) {
      const rowIndex = headerMap[normalizedCandidate];
      const rawValue = rowValues[rowIndex];
      if (rawValue !== undefined && rawValue !== null && String(rawValue).trim() !== "") {
        return String(rawValue).trim();
      }
    }
  }

  return null;
}

function toNullableFloat(value) {
  if (value === undefined || value === null || value === "") {
    return null;
  }

  const parsed = Number.parseFloat(String(value));
  return Number.isFinite(parsed) ? parsed : null;
}

function toNullableInteger(value) {
  if (value === undefined || value === null || value === "") {
    return null;
  }

  const parsed = Number.parseInt(String(value), 10);
  return Number.isFinite(parsed) ? parsed : null;
}

function parseSensorTimestamp(value) {
  if (value === undefined || value === null || value === "") {
    return null;
  }

  const normalizedValue = String(value).trim();
  const directDate = new Date(normalizedValue);
  if (!Number.isNaN(directDate.getTime())) {
    return directDate;
  }

  const match = normalizedValue.match(/^(\d{1,2})\s+([A-Za-z]{3,})\s+(\d{4})\s+(\d{1,2}:\d{2}:\d{2})\s*(AM|PM)$/i);
  if (!match) {
    return null;
  }

  const [, day, monthName, year, timeValue, amPm] = match;
  const fallbackDate = new Date(`${monthName} ${day}, ${year} ${timeValue} ${amPm.toUpperCase()}`);
  if (Number.isNaN(fallbackDate.getTime())) {
    return null;
  }

  return fallbackDate;
}

function parseEsp32CsvRows(csvContent) {
  const lines = String(csvContent || "")
    .replace(/^\uFEFF/, "")
    .split(/\r?\n/)
    .map((line) => line.trim())
    .filter((line) => line.length > 0);

  if (lines.length < 2) {
    return { rows: [], errors: [{ row: 0, message: "CSV must include a header row and at least one data row." }] };
  }

  const headers = parseCsvLine(lines[0]);
  const headerMap = headers.reduce((accumulator, header, index) => {
    const normalizedHeader = normalizeCsvHeaderName(header);
    if (normalizedHeader) {
      accumulator[normalizedHeader] = index;
    }
    return accumulator;
  }, {});

  const rows = [];
  const errors = [];

  for (let rowIndex = 1; rowIndex < lines.length; rowIndex += 1) {
    const rawLine = lines[rowIndex];
    const rowValues = parseCsvLine(rawLine);

    const row = {
      timestampRaw: findRowValueByHeader(rowValues, headerMap, ["timestamp", "eventTimestamp", "time", "datetime"]),
      deviceID: findRowValueByHeader(rowValues, headerMap, ["deviceID", "deviceId", "device"]),
      location: findRowValueByHeader(rowValues, headerMap, ["location", "park", "parkName", "site"]),
      temp: findRowValueByHeader(rowValues, headerMap, ["temp", "temperature"]),
      hum: findRowValueByHeader(rowValues, headerMap, ["hum", "humidity"]),
      distance: findRowValueByHeader(rowValues, headerMap, ["distance"]),
      sound: findRowValueByHeader(rowValues, headerMap, ["sound"]),
      rain: findRowValueByHeader(rowValues, headerMap, ["rain"]),
      soil: findRowValueByHeader(rowValues, headerMap, ["soilPercent", "soil", "soilpercentage"]),
      soilRaw: findRowValueByHeader(rowValues, headerMap, ["soilRaw", "soilraw"]),
      distanceStatus: findRowValueByHeader(rowValues, headerMap, ["distanceStatus"]),
      soundStatus: findRowValueByHeader(rowValues, headerMap, ["soundStatus"]),
      tempStatus: findRowValueByHeader(rowValues, headerMap, ["tempStatus", "temperatureStatus"]),
      humStatus: findRowValueByHeader(rowValues, headerMap, ["humStatus", "humidityStatus"]),
      rainStatus: findRowValueByHeader(rowValues, headerMap, ["rainStatus"]),
      rainLevel: findRowValueByHeader(rowValues, headerMap, ["rainLevel"]),
      soilStatus: findRowValueByHeader(rowValues, headerMap, ["soilStatus"]),
      severity: findRowValueByHeader(rowValues, headerMap, ["severity"]),
    };

    const timestamp = parseSensorTimestamp(row.timestampRaw);
    if (!timestamp) {
      errors.push({ row: rowIndex + 1, message: `Invalid timestamp: ${row.timestampRaw || "(empty)"}` });
      continue;
    }

    const normalizedSeverity = String(row.severity || "LOW").trim().toUpperCase();
    const severity = ["LOW", "MEDIUM", "HIGH"].includes(normalizedSeverity) ? normalizedSeverity : "LOW";

    rows.push({
      timestamp,
      deviceID: String(row.deviceID || "").trim() || null,
      location: String(row.location || "").trim() || null,
      temperature: toNullableFloat(row.temp),
      humidity: toNullableFloat(row.hum),
      distance: toNullableFloat(row.distance),
      sound: toNullableInteger(row.sound),
      rain: toNullableInteger(row.rain),
      soil: toNullableFloat(row.soil),
      soilRaw: toNullableInteger(row.soilRaw),
      distanceStatus: row.distanceStatus || null,
      soundStatus: row.soundStatus || null,
      tempStatus: row.tempStatus || null,
      humStatus: row.humStatus || null,
      rainStatus: row.rainStatus || null,
      rainLevel: toNullableInteger(row.rainLevel),
      soilStatus: row.soilStatus || null,
      severity,
    });
  }

  return { rows, errors };
}

async function uploadEsp32SensorLogsCsv(req, res) {
  try {
    const file = req.file;

    if (!file || !file.buffer) {
      return res.status(400).json({ success: false, message: "CSV file is required. Use form-data file field 'file'." });
    }

    const csvContent = file.buffer.toString("utf8");
    const parsed = parseEsp32CsvRows(csvContent);

    if (parsed.rows.length === 0) {
      return res.status(400).json({
        success: false,
        message: "No valid rows found in CSV.",
        errors: parsed.errors.slice(0, 20),
      });
    }

    const fallbackDeviceId = String(req.body.deviceID || req.query.deviceID || "manual-upload").trim() || "manual-upload";
    const maxRows = 5000;
    const rowsToInsert = parsed.rows.slice(0, maxRows);

    const insertSql = `
      INSERT INTO ESP32SensorLogs (
        DeviceID, Location, Temperature, Humidity, Distance, Sound, Rain, Soil, SoilRaw,
        DistanceStatus, SoundStatus, TempStatus, HumStatus, RainStatus, RainLevel, SoilStatus,
        Severity, Timestamp
      ) VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)
    `;

    let insertedCount = 0;

    for (const row of rowsToInsert) {
      await query(insertSql, [
        row.deviceID || fallbackDeviceId,
        row.location,
        row.temperature,
        row.humidity,
        row.distance,
        row.sound,
        row.rain,
        row.soil,
        row.soilRaw,
        row.distanceStatus,
        row.soundStatus,
        row.tempStatus,
        row.humStatus,
        row.rainStatus,
        row.rainLevel,
        row.soilStatus,
        row.severity,
        row.timestamp,
      ]);
      insertedCount += 1;
    }

    const skippedCount = parsed.errors.length + Math.max(parsed.rows.length - maxRows, 0);

    return res.status(201).json({
      success: true,
      message: "ESP32 sensor logs uploaded successfully.",
      data: {
        insertedCount,
        skippedCount,
        totalDataRows: parsed.rows.length + parsed.errors.length,
        fallbackDeviceID: fallbackDeviceId,
        rowLimitApplied: parsed.rows.length > maxRows,
        sampleErrors: parsed.errors.slice(0, 20),
      },
    });
  } catch (error) {
    console.error("Upload ESP32 sensor logs CSV error:", error);
    return res.status(500).json({
      success: false,
      message: "Failed to upload ESP32 sensor logs CSV.",
      error: error.message,
    });
  }
}

let announcementSchemaPromise;

async function ensureAnnouncementSchema() {
  if (!announcementSchemaPromise) {
    announcementSchemaPromise = query(
      "ALTER TABLE Announcements ADD COLUMN CreatedAt TIMESTAMP NOT NULL DEFAULT CURRENT_TIMESTAMP"
    ).catch((error) => {
      if (error.code !== "ER_DUP_FIELDNAME") {
        announcementSchemaPromise = null;
        throw error;
      }
    });
  }

  return announcementSchemaPromise;
}

function buildAnnouncementTeaser(content) {
  const normalizedContent = String(content || "").replace(/\s+/g, " ").trim();

  if (!normalizedContent) {
    return "No teaser provided.";
  }

  if (normalizedContent.length <= 95) {
    return normalizedContent;
  }

  return `${normalizedContent.slice(0, 92).trim()}...`;
}

function buildAnnouncementAvatarLabel(title) {
  const normalizedTitle = String(title || "").trim();
  const levelMatch = normalizedTitle.match(/\bL\s*(\d+)\b/i);

  if (levelMatch) {
    return `L${levelMatch[1]}`;
  }

  const tokens = normalizedTitle
    .split(/\s+/)
    .map((token) => token.replace(/[^a-zA-Z0-9]/g, ""))
    .filter(Boolean);

  if (tokens.length >= 2) {
    return `${tokens[0][0]}${tokens[1][0]}`.toUpperCase();
  }

  if (tokens.length === 1) {
    return tokens[0].slice(0, 2).toUpperCase();
  }

  return "AN";
}

function formatAnnouncementPosted(createdAtValue) {
  if (!createdAtValue) {
    return "Recently";
  }

  const parsedDate = new Date(createdAtValue);

  if (Number.isNaN(parsedDate.getTime())) {
    return "Recently";
  }

  return parsedDate.toLocaleString("en-MY", {
    day: "2-digit",
    month: "short",
    year: "numeric",
    hour: "2-digit",
    minute: "2-digit",
  });
}

function mapAnnouncementRow(announcementRow) {
  return {
    announcementId: announcementRow.AnnouncementID,
    id: announcementRow.AnnouncementID,
    title: announcementRow.Title,
    teaser: buildAnnouncementTeaser(announcementRow.Content),
    content: announcementRow.Content,
    fullDesc: announcementRow.Content,
    targetRole: announcementRow.TargetRole,
    expiryDate: announcementRow.ExpiryDate,
    postedAt: announcementRow.CreatedAt || null,
    posted: formatAnnouncementPosted(announcementRow.CreatedAt),
    avatarLabel: buildAnnouncementAvatarLabel(announcementRow.Title),
  };
}

/**
 * Controller for admin management - qualifications, announcements, schedules, users.
 */

/**
 * Create qualification (admin only)
 */
async function createQualification(req, res) {
  try {
    const { name, status = "Active" } = req.body;

    if (!name) {
      return res.status(400).json({
        success: false,
        message: "Qualification name is required.",
      });
    }

    const [result] = await query(
      "INSERT INTO Qualifications (QualificationName, Status) VALUES (?, ?)",
      [name, status]
    );

    return res.status(201).json({
      success: true,
      message: "Qualification created successfully.",
      data: {
        qualificationId: result.insertId,
        name,
        status,
      },
    });
  } catch (error) {
    if (error.code === "ER_DUP_ENTRY") {
      return res.status(409).json({
        success: false,
        message: "Qualification with this name already exists.",
      });
    }

    console.error("Create qualification error:", error);
    return res.status(500).json({
      success: false,
      message: "Failed to create qualification.",
    });
  }
}

/**
 * Create announcement (admin only)
 */
async function createAnnouncement(req, res) {
  try {
    await ensureAnnouncementSchema();

    const { userId } = req.user;
    const { title, content, targetRole, expiryDate } = req.body;

    if (!title || !content || !targetRole) {
      return res.status(400).json({
        success: false,
        message: "Title, content, and target role are required.",
      });
    }

    if (!["Admin", "User", "All"].includes(targetRole)) {
      return res.status(400).json({
        success: false,
        message: "Invalid target role. Must be Admin, User, or All.",
      });
    }

    const [result] = await query(
      "INSERT INTO Announcements (Title, Content, TargetRole, ExpiryDate, CreatedBy) VALUES (?, ?, ?, ?, ?)",
      [title, content, targetRole, expiryDate || null, userId]
    );

    // Notify all users of target role
    if (targetRole === "User" || targetRole === "All") {
      const [users] = await query(
        "SELECT UserID FROM Users WHERE RoleID = (SELECT RoleID FROM Roles WHERE RoleTitle = 'User')"
      );

      for (const user of users) {
        await notificationService.notificationHelpers.notifyAnnouncement(
          user.UserID,
          title
        );
      }
    }

    if (targetRole === "Admin" || targetRole === "All") {
      const [admins] = await query(
        "SELECT UserID FROM Users WHERE RoleID = (SELECT RoleID FROM Roles WHERE RoleTitle = 'Admin')"
      );

      for (const admin of admins) {
        await notificationService.notificationHelpers.notifyAnnouncement(
          admin.UserID,
          title
        );
      }
    }

    const [insertedRows] = await query(
      `SELECT AnnouncementID, Title, Content, TargetRole, ExpiryDate, CreatedAt
         FROM Announcements
        WHERE AnnouncementID = ?
        LIMIT 1`,
      [result.insertId]
    );

    return res.status(201).json({
      success: true,
      message: "Announcement created and notified to users.",
      data: mapAnnouncementRow(insertedRows[0]),
    });
  } catch (error) {
    console.error("Create announcement error:", error);
    return res.status(500).json({
      success: false,
      message: "Failed to create announcement.",
    });
  }
}

/**
 * Get all announcements for admin management.
 */
async function getAllAnnouncements(req, res) {
  try {
    await ensureAnnouncementSchema();

    const [announcements] = await query(
      `SELECT AnnouncementID, Title, Content, TargetRole, ExpiryDate, CreatedAt
         FROM Announcements
        ORDER BY AnnouncementID DESC`
    );

    return res.json({
      success: true,
      data: announcements.map((announcement) => mapAnnouncementRow(announcement)),
    });
  } catch (error) {
    console.error("Get all announcements error:", error);
    return res.status(500).json({
      success: false,
      message: "Failed to fetch announcements.",
    });
  }
}

/**
 * Update an announcement.
 */
async function updateAnnouncement(req, res) {
  try {
    await ensureAnnouncementSchema();

    const { announcementId } = req.params;
    const title = String(req.body.title || "").trim();
    const content = String(
      req.body.fullDesc || req.body.content || req.body.teaser || ""
    ).trim();
    const targetRole = String(req.body.targetRole || "All").trim();
    const expiryDate = req.body.expiryDate || null;

    if (!title || !content) {
      return res.status(400).json({
        success: false,
        message: "Title and content are required.",
      });
    }

    if (!["Admin", "User", "All"].includes(targetRole)) {
      return res.status(400).json({
        success: false,
        message: "Target role must be Admin, User, or All.",
      });
    }

    const [updateResult] = await query(
      `UPDATE Announcements
          SET Title = ?,
              Content = ?,
              TargetRole = ?,
              ExpiryDate = ?
        WHERE AnnouncementID = ?`,
      [title, content, targetRole, expiryDate, announcementId]
    );

    if (updateResult.affectedRows === 0) {
      return res.status(404).json({
        success: false,
        message: "Announcement not found.",
      });
    }

    const [updatedRows] = await query(
      `SELECT AnnouncementID, Title, Content, TargetRole, ExpiryDate, CreatedAt
         FROM Announcements
        WHERE AnnouncementID = ?
        LIMIT 1`,
      [announcementId]
    );

    return res.json({
      success: true,
      message: "Announcement updated successfully.",
      data: mapAnnouncementRow(updatedRows[0]),
    });
  } catch (error) {
    console.error("Update announcement error:", error);
    return res.status(500).json({
      success: false,
      message: "Failed to update announcement.",
    });
  }
}

/**
 * Delete an announcement.
 */
async function deleteAnnouncement(req, res) {
  try {
    const { announcementId } = req.params;
    const [deleteResult] = await query(
      "DELETE FROM Announcements WHERE AnnouncementID = ?",
      [announcementId]
    );

    if (deleteResult.affectedRows === 0) {
      return res.status(404).json({
        success: false,
        message: "Announcement not found.",
      });
    }

    return res.json({
      success: true,
      message: "Announcement deleted successfully.",
    });
  } catch (error) {
    console.error("Delete announcement error:", error);
    return res.status(500).json({
      success: false,
      message: "Failed to delete announcement.",
    });
  }
}

/**
 * Create schedule event for a user (admin only)
 */
async function createSchedule(req, res) {
  try {
    const { userId } = req.user;
    const {
      targetUserId,
      qualificationId,
      title,
      description,
      eventDate,
      startTime,
      endTime,
    } = req.body;

    if (
      !targetUserId ||
      !qualificationId ||
      !title ||
      !eventDate ||
      !startTime ||
      !endTime
    ) {
      return res.status(400).json({
        success: false,
        message:
          "User ID, qualification ID, title, date, and times are required.",
      });
    }

    const [result] = await query(
      `INSERT INTO Schedules (UserID, QualificationID, Title, Description, EventDate, StartTime, EndTime)
       VALUES (?, ?, ?, ?, ?, ?, ?)`,
      [
        targetUserId,
        qualificationId,
        title,
        description || null,
        eventDate,
        startTime,
        endTime,
      ]
    );

    // Notify the user
    await notificationService.notificationHelpers.notifyScheduleEvent(
      targetUserId,
      title,
      eventDate
    );

    return res.status(201).json({
      success: true,
      message: "Schedule created and user notified.",
      data: {
        scheduleId: result.insertId,
        title,
        eventDate,
        startTime,
        endTime,
      },
    });
  } catch (error) {
    console.error("Create schedule error:", error);
    return res.status(500).json({
      success: false,
      message: "Failed to create schedule.",
    });
  }
}

/**
 * Get all users (admin only)
 */
async function getAllUsers(req, res) {
  try {
    const [users] = await query(
      `SELECT u.UserID, u.Username, u.FullName, u.Email, u.Status, u.IsActive, r.RoleTitle, u.CreatedAt
       FROM Users u
       INNER JOIN Roles r ON r.RoleID = u.RoleID
       ORDER BY u.CreatedAt DESC`
    );

    return res.json({
      success: true,
      data: users.map((u) => ({
        userId: u.UserID,
        username: u.Username,
        fullName: u.FullName,
        email: u.Email,
        role: u.RoleTitle,
        status: u.Status,
        isActive: u.IsActive === 1,
        createdAt: u.CreatedAt,
      })),
    });
  } catch (error) {
    console.error("Get all users error:", error);
    return res.status(500).json({
      success: false,
      message: "Failed to fetch users.",
    });
  }
}

/**
 * Update user status (admin only)
 */
async function updateUserStatus(req, res) {
  try {
    const { targetUserId, status } = req.body;

    if (!targetUserId || !status) {
      return res.status(400).json({
        success: false,
        message: "User ID and status are required.",
      });
    }

    if (!["Active", "Inactive", "Suspended"].includes(status)) {
      return res.status(400).json({
        success: false,
        message: "Invalid status. Must be Active, Inactive, or Suspended.",
      });
    }

    await query("UPDATE Users SET Status = ? WHERE UserID = ?", [
      status,
      targetUserId,
    ]);

    return res.json({
      success: true,
      message: `User status updated to ${status}.`,
    });
  } catch (error) {
    console.error("Update user status error:", error);
    return res.status(500).json({
      success: false,
      message: "Failed to update user status.",
    });
  }
}

/**
 * Get user enrollment details (admin only)
 */
async function getUserEnrollmentDetails(req, res) {
  try {
    const { userId } = req.params;

    // Get user info
    const [users] = await query(
      "SELECT UserID, Username, FullName, Email FROM Users WHERE UserID = ? LIMIT 1",
      [userId]
    );

    if (users.length === 0) {
      return res.status(404).json({
        success: false,
        message: "User not found.",
      });
    }

    const user = users[0];

    // Get enrollments
    const [enrollments] = await query(
      `SELECT c.CertificateID, c.QualificationID, c.QualificationName, c.Status
       FROM Certificates c
       WHERE c.UserID = ?`,
      [userId]
    );

    return res.json({
      success: true,
      data: {
        userId: user.UserID,
        username: user.Username,
        fullName: user.FullName,
        email: user.Email,
        enrollments: enrollments.map((e) => ({
          certificateId: e.CertificateID,
          qualificationId: e.QualificationID,
          qualificationName: e.QualificationName,
          status: e.Status,
        })),
      },
    });
  } catch (error) {
    console.error("Get user enrollment details error:", error);
    return res.status(500).json({
      success: false,
      message: "Failed to fetch enrollment details.",
    });
  }
}

async function listEvidenceAlerts(req, res) {
  try {
    const limitValue = Number.parseInt(req.query.limit, 10);
    const limit = Number.isInteger(limitValue) && limitValue > 0 ? Math.min(limitValue, 100) : 20;

    const [rows] = await query(
      `SELECT e.EvidenceID,
              e.EventTimestamp,
              e.EventType,
              e.LabelsJson,
              e.Location,
              e.Status,
              e.VideoFileName,
              e.VideoMimeType,
              e.VideoSizeBytes,
              e.VideoSha256,
              e.CreatedAt,
              p.ParkName,
              p.Latitude AS ParkLatitude,
              p.Longitude AS ParkLongitude,
              IFNULL(elu.UnsolvedCount, 0) AS UnsolvedCount
         FROM Evidence e
         LEFT JOIN Park p
           ON p.ParkID = (
             SELECT p2.ParkID
               FROM Park p2
              WHERE LOWER(TRIM(p2.ParkName)) = LOWER(TRIM(e.Location))
                 OR LOWER(TRIM(p2.ParkName)) LIKE CONCAT('%', LOWER(TRIM(e.Location)), '%')
                 OR LOWER(TRIM(e.Location)) LIKE CONCAT('%', LOWER(TRIM(p2.ParkName)), '%')
              ORDER BY CASE
                         WHEN LOWER(TRIM(p2.ParkName)) = LOWER(TRIM(e.Location)) THEN 0
                         WHEN LOWER(TRIM(p2.ParkName)) LIKE CONCAT(LOWER(TRIM(e.Location)), '%') THEN 1
                         ELSE 2
                       END,
                       LENGTH(p2.ParkName)
              LIMIT 1
           )
         LEFT JOIN (
           SELECT LOWER(TRIM(Location)) AS LocationKey,
                  SUM(CASE WHEN Status = 0 THEN 1 ELSE 0 END) AS UnsolvedCount
             FROM Evidence
            GROUP BY LOWER(TRIM(Location))
         ) elu
           ON LOWER(TRIM(e.Location)) = elu.LocationKey
        ORDER BY e.EventTimestamp DESC, e.EvidenceID DESC
        LIMIT ?`,
      [limit]
    );

    return res.json({
      success: true,
      data: rows.map((row) => normaliseEvidenceRow(row)),
    });
  } catch (error) {
    console.error("List evidence alerts error:", error);
    return res.status(500).json({
      success: false,
      message: "Failed to fetch evidence alerts.",
    });
  }
}

async function listEsp32SensorAlerts(req, res) {
  try {
    const limitValue = Number.parseInt(req.query.limit, 10);
    const limit = Number.isInteger(limitValue) && limitValue > 0 ? Math.min(limitValue, 100) : 20;

    const [rows] = await query(
      `SELECT LogID,
              DeviceID,
              Location,
              Temperature,
              Humidity,
              Distance,
              Sound,
              Rain,
              Soil,
              SoilRaw,
              DistanceStatus,
              SoundStatus,
              TempStatus,
              HumStatus,
              RainStatus,
              RainLevel,
              SoilStatus,
              Severity,
              Timestamp,
              CreatedAt,
              Status,
              p.ParkName AS ParkName,
              p.Latitude AS ParkLatitude,
              p.Longitude AS ParkLongitude
         FROM (
           SELECT s.LogID,
                  s.DeviceID,
                  s.Location,
                  s.Temperature,
                  s.Humidity,
                  s.Distance,
                  s.Sound,
                  s.Rain,
                  s.Soil,
                  s.SoilRaw,
                  s.DistanceStatus,
                  s.SoundStatus,
                  s.TempStatus,
                  s.HumStatus,
                  s.RainStatus,
                  s.RainLevel,
                  s.SoilStatus,
                  s.Severity,
                  s.Timestamp,
                  s.CreatedAt,
                  s.Status,
                  (
                    SELECT p2.ParkName
                      FROM Park p2
                     WHERE LOWER(TRIM(p2.ParkName)) = LOWER(TRIM(s.Location))
                        OR LOWER(TRIM(p2.ParkName)) LIKE CONCAT('%', LOWER(TRIM(s.Location)), '%')
                        OR LOWER(TRIM(s.Location)) LIKE CONCAT('%', LOWER(TRIM(p2.ParkName)), '%')
                     ORDER BY CASE
                                WHEN LOWER(TRIM(p2.ParkName)) = LOWER(TRIM(s.Location)) THEN 0
                                WHEN LOWER(TRIM(p2.ParkName)) LIKE CONCAT(LOWER(TRIM(s.Location)), '%') THEN 1
                                ELSE 2
                              END,
                              LENGTH(p2.ParkName)
                     LIMIT 1
                  ) AS MatchedParkName
             FROM ESP32SensorLogs s
         ) sensor_logs
         LEFT JOIN Park p
           ON p.ParkName = sensor_logs.MatchedParkName
        ORDER BY Timestamp DESC, LogID DESC
        LIMIT ?`,
      [limit]
    );

    return res.json({
      success: true,
      data: rows.map((row) => normaliseEsp32SensorLogRow(row)),
    });
  } catch (error) {
    console.error("List ESP32 sensor alerts error:", error);
    return res.status(500).json({
      success: false,
      message: "Failed to fetch ESP32 sensor alerts.",
    });
  }
}

async function listPayments(req, res) {
  try {
    const limitValue = Number.parseInt(req.query.limit, 10);
    const limit = Number.isInteger(limitValue) && limitValue > 0 ? Math.min(limitValue, 200) : 50;
    const statusFilter = req.query.status ? String(req.query.status).toLowerCase() : null;

    let sql = `SELECT p.PaymentID,
                      p.UserID,
                      p.ModuleID,
                      p.Reference,
                      p.EvidenceFilePath,
                      p.EvidenceFileName,
                      p.EvidenceMimeType,
                      p.Status,
                      p.ReviewRemark,
                      p.ReviewedBy,
                      p.ReviewedAt,
                      p.CreatedAt,
                      u.FullName,
                      u.Username,
                      m.ModuleTitle
                 FROM Payments p
                 LEFT JOIN Users u ON u.UserID = p.UserID
                 LEFT JOIN Modules m ON m.ModuleID = p.ModuleID
                `;

    const params = [];
    if (statusFilter) {
      sql += ' WHERE LOWER(p.Status) = ? ';
      params.push(statusFilter);
    }

    sql += ' ORDER BY p.CreatedAt DESC LIMIT ?';
    params.push(limit);

    const [rows] = await query(sql, params);

    const data = rows.map((r) => ({
      paymentId: r.PaymentID,
      userId: r.UserID,
      moduleId: r.ModuleID,
      moduleTitle: r.ModuleTitle,
      userName: r.FullName || r.Username,
      reference: r.Reference,
      evidenceFile: r.EvidenceFilePath,
      evidenceName: r.EvidenceFileName,
      evidenceMime: r.EvidenceMimeType,
      status: String(r.Status || 'pending').toLowerCase(),
      reviewRemark: r.ReviewRemark || null,
      reviewedBy: r.ReviewedBy || null,
      reviewedAt: r.ReviewedAt || null,
      createdAt: r.CreatedAt,
    }));

    return res.json({ success: true, data });
  } catch (error) {
    console.error('List payments error:', error);
    return res.status(500).json({ success: false, message: 'Failed to fetch payments.' });
  }
}

async function updatePaymentStatus(req, res) {
  try {
    const { paymentId } = req.params;
    const status = String(req.body.status || '').toLowerCase();
    const remark = req.body.remark || null;
    const reviewerId = req.user && req.user.userId;

    if (!['approved', 'rejected'].includes(status)) {
      return res.status(400).json({ success: false, message: 'Invalid status.' });
    }

    const [result] = await query(
      `UPDATE Payments SET Status = ?, ReviewedBy = ?, ReviewedAt = NOW(), ReviewRemark = ? WHERE PaymentID = ?`,
      [status, reviewerId || null, remark, paymentId]
    );

    if (result.affectedRows === 0) {
      return res.status(404).json({ success: false, message: 'Payment not found.' });
    }

    // Notify user about decision
    try {
      const [rows] = await query('SELECT UserID, ModuleID FROM Payments WHERE PaymentID = ? LIMIT 1', [paymentId]);
      if (rows && rows[0]) {
        const userId = rows[0].UserID;
        const moduleId = rows[0].ModuleID;
        if (status === 'approved') {
          await notificationService.createNotification(userId, 'Payment Approved', `Your payment for module ${moduleId} has been approved.`);
        } else {
          await notificationService.createNotification(userId, 'Payment Rejected', `Your payment for module ${moduleId} was rejected. ${remark || ''}`);
        }
      }
    } catch (_err) {
      console.warn('Failed to notify user about payment review', _err);
    }

    return res.json({ success: true, data: { paymentId: Number(paymentId), status } });
  } catch (error) {
    console.error('Update payment status error:', error);
    return res.status(500).json({ success: false, message: 'Failed to update payment status.' });
  }
}

async function streamEvidenceVideo(req, res) {
  try {
    const { evidenceId } = req.params;

    const [rows] = await query(
      `SELECT EvidenceID,
              VideoData,
              VideoMimeType,
              VideoFileName
         FROM Evidence
        WHERE EvidenceID = ?
        LIMIT 1`,
      [evidenceId]
    );

    if (rows.length === 0 || !rows[0].VideoData) {
      return res.status(404).json({
        success: false,
        message: "Evidence video not found.",
      });
    }

    const videoRow = rows[0];

    res.setHeader("Content-Type", videoRow.VideoMimeType || "video/mp4");
    res.setHeader("Content-Length", videoRow.VideoData.length);
    res.setHeader(
      "Content-Disposition",
      `inline; filename="${String(videoRow.VideoFileName || `evidence-${videoRow.EvidenceID}.mp4`).replace(/\"/g, "")}"`
    );

    return res.send(videoRow.VideoData);
  } catch (error) {
    console.error("Stream evidence video error:", error);
    return res.status(500).json({
      success: false,
      message: "Failed to stream evidence video.",
    });
  }
}

async function updateEvidenceStatus(req, res) {
  try {
    const { evidenceId } = req.params;
    const resolved = req.body && (req.body.resolved === true || req.body.resolved === 'true' || req.body.resolved === 1 || req.body.resolved === '1');

    const statusValue = resolved ? 1 : 0;

    const [result] = await query(
      `UPDATE Evidence SET Status = ? WHERE EvidenceID = ?`,
      [statusValue, evidenceId]
    );

    if (result.affectedRows === 0) {
      return res.status(404).json({ success: false, message: 'Evidence not found.' });
    }

    return res.json({ success: true, data: { evidenceId: Number(evidenceId), resolved: !!resolved } });
  } catch (error) {
    console.error('Update evidence status error:', error);
    return res.status(500).json({ success: false, message: 'Failed to update evidence status.' });
  }
}

async function getAnalyticsDashboard(req, res) {
  try {
    const [guideRows] = await query(
      `SELECT u.UserID,
              u.FullName,
              u.Email,
              u.Username,
              u.Progress,
              u.IsActive,
              q.QualificationName AS AssignedPark
         FROM Users u
         INNER JOIN Roles r ON r.RoleID = u.RoleID AND r.RoleTitle = 'User'
         LEFT JOIN Qualifications q ON q.QualificationID = u.QualificationID
        ORDER BY u.UserID ASC`
    );

    const [enrollmentRows] = await query(
      `SELECT COUNT(DISTINCT c.UserID) AS EnrolledUsers
         FROM Certificates c
         INNER JOIN Users u ON u.UserID = c.UserID
         INNER JOIN Roles r ON r.RoleID = u.RoleID AND r.RoleTitle = 'User'`
    );

    const [issuedRows] = await query(
      `SELECT COUNT(DISTINCT c.UserID) AS IssuedUsers
         FROM Certificates c
         INNER JOIN Users u ON u.UserID = c.UserID
         INNER JOIN Roles r ON r.RoleID = u.RoleID AND r.RoleTitle = 'User'
        WHERE c.Status = 'Issued'`
    );

    const [userBadgeRows] = await query(
      `SELECT aa.UserID,
              GROUP_CONCAT(DISTINCT b.BadgeName ORDER BY b.BadgeName SEPARATOR ', ') AS EarnedBadges
         FROM AssessmentAttempts aa
         INNER JOIN Assessments a ON a.AssessmentID = aa.AssessmentID
         INNER JOIN Badges b ON b.BadgeID = a.BadgeID
        WHERE aa.Status = 'Passed'
        GROUP BY aa.UserID`
    );

    const [moduleRows] = await query(
      `SELECT m.ModuleID,
              m.ModuleTitle,
              COUNT(DISTINCT aa.UserID) AS EnrolledGuides,
              COUNT(DISTINCT CASE WHEN aa.Status = 'Passed' THEN aa.UserID END) AS CompletedGuides
         FROM Modules m
         LEFT JOIN Assessments a ON a.ModuleID = m.ModuleID
         LEFT JOIN AssessmentAttempts aa ON aa.AssessmentID = a.AssessmentID
         LEFT JOIN Users u ON u.UserID = aa.UserID
         LEFT JOIN Roles r ON r.RoleID = u.RoleID
        WHERE r.RoleTitle = 'User' OR r.RoleTitle IS NULL
        GROUP BY m.ModuleID, m.ModuleTitle
        ORDER BY EnrolledGuides DESC, m.ModuleID ASC`
    );

    const [badgeRows] = await query(
      `SELECT b.BadgeID,
              b.BadgeName,
              b.UnlockThreshold,
              COUNT(DISTINCT CASE WHEN aa.Status = 'Passed' THEN aa.UserID END) AS AwardedCount
         FROM Badges b
         LEFT JOIN Assessments a ON a.BadgeID = b.BadgeID
         LEFT JOIN AssessmentAttempts aa ON aa.AssessmentID = a.AssessmentID
         LEFT JOIN Users u ON u.UserID = aa.UserID
         LEFT JOIN Roles r ON r.RoleID = u.RoleID
        WHERE b.IsActive = 1 AND (r.RoleTitle = 'User' OR r.RoleTitle IS NULL)
        GROUP BY b.BadgeID, b.BadgeName, b.UnlockThreshold
        ORDER BY AwardedCount DESC, b.BadgeID ASC`
    );

    const earnedBadgesByUser = userBadgeRows.reduce((accumulator, row) => {
      accumulator[row.UserID] = row.EarnedBadges || '-';
      return accumulator;
    }, {});

    const guides = guideRows.map((row) => {
      const progress = toSafeNumber(row.Progress, 0);
      const isActive = Number(row.IsActive) === 1;

      return {
        guideId: row.UserID,
        fullName: row.FullName || row.Username || `Guide ${row.UserID}`,
        assignedPark: row.AssignedPark || 'Unassigned',
        contact: row.Email || '-',
        isActive,
        activeStatus: isActive ? 'Active' : 'Inactive',
        progress,
        earnedBadges: earnedBadgesByUser[row.UserID] || '-',
      };
    });

    const guidesSortedByStatus = [...guides].sort((leftGuide, rightGuide) => {
      if (leftGuide.isActive === rightGuide.isActive) {
        return leftGuide.guideId - rightGuide.guideId;
      }

      return leftGuide.isActive ? -1 : 1;
    });

    const activeGuides = guides.filter((guide) => guide.isActive);

    const totalGuides = guides.length;
    const inactiveGuides = guides.filter((guide) => !guide.isActive).length;
    const averageProgress =
      activeGuides.length > 0
        ? activeGuides.reduce((sum, guide) => sum + guide.progress, 0) / activeGuides.length
        : 0;

    const enrolledGuides = toSafeNumber(enrollmentRows[0] && enrollmentRows[0].EnrolledUsers, 0);
    const issuedGuides = toSafeNumber(issuedRows[0] && issuedRows[0].IssuedUsers, 0);

    const moduleRowsNormalized = moduleRows.map((row) => {
      const enrolled = toSafeNumber(row.EnrolledGuides, 0);
      const completed = toSafeNumber(row.CompletedGuides, 0);
      const training = Math.max(enrolled - completed, 0);
      const completion = enrolled > 0 ? (completed / enrolled) * 100 : 0;

      return {
        moduleTitle: row.ModuleTitle || `Module ${row.ModuleID}`,
        enrolled,
        completed,
        training,
        completion,
      };
    });

    const progressBars = moduleRowsNormalized.map((module) => ({
      label: module.moduleTitle.length > 10
        ? module.moduleTitle.substring(0, 10) + '...'
        : module.moduleTitle,
      value: Math.round(module.completion),
    }));

    const totalModuleEnrollments = moduleRowsNormalized.reduce((sum, row) => sum + row.enrolled, 0);
    const totalModuleCompletions = moduleRowsNormalized.reduce((sum, row) => sum + row.completed, 0);
    const averageModuleCompletion =
      totalModuleEnrollments > 0 ? (totalModuleCompletions / totalModuleEnrollments) * 100 : 0;

    const badgeRowsNormalized = badgeRows.map((row) => {
      const awarded = toSafeNumber(row.AwardedCount, 0);
      const unlockThreshold = toSafeNumber(row.UnlockThreshold, 0);
      const eligible = activeGuides.filter((guide) => guide.progress >= unlockThreshold).length;

      return {
        badgeName: row.BadgeName || `Badge ${row.BadgeID}`,
        awarded,
        eligible,
        pending: Math.max(eligible - awarded, 0),
      };
    });

    const totalAwardedBadges = badgeRowsNormalized.reduce((sum, row) => sum + row.awarded, 0);
    const totalEligibleGuides = badgeRowsNormalized.reduce((sum, row) => sum + row.eligible, 0);
    const totalPendingBadges = badgeRowsNormalized.reduce((sum, row) => sum + row.pending, 0);

    return res.json({
      success: true,
      data: {
        parkGuides: {
          title: 'Park guides overview',
          subtitle: 'Complete overview of active and inactive park guides.',
          kpis: [
            { label: 'Total park guides', value: String(totalGuides), note: 'All user accounts with User role' },
            { label: 'Inactive guides', value: String(inactiveGuides), note: 'Not currently active' },
          ],
          columns: ['Guide ID', 'Full Name', 'Active Status', 'Contact (Email)'],
          rows: guidesSortedByStatus.map((guide) => [
            `G${String(guide.guideId).padStart(3, '0')}`,
            guide.fullName,
            guide.activeStatus,
            guide.contact,
          ]),
        },
        progress: {
          title: 'Park guide training progress tracker',
          subtitle: 'Track individual training completion on current modules.',
          chartType: 'bar',
          kpis: [
            { label: 'Guides enrolled', value: String(enrolledGuides), note: 'Users with certificate records' },
            { label: 'Avg. progress', value: formatPercentage(averageProgress), note: 'Across active park guides' }
          ],
          chartTitle: 'Average progress by module',
          chartSubtitle: 'Shows how far guides have progressed in each module.',
          bars: progressBars,
          columns: ['Guide Name', 'Current Module', 'Progress %', 'Earned Park Badges'],
          rows: guides.map((guide) => [
            guide.fullName,
            guide.assignedPark,
            formatPercentage(guide.progress),
            guide.earnedBadges,
          ]),
        },
        modules: {
          title: 'Module enrollment analysis',
          subtitle: 'Track enrollment, completion rates, and identify overloaded modules.',
          chartType: 'pie',
          kpis: [
            { label: 'Active modules', value: String(moduleRowsNormalized.length), note: 'Configured in database' },
            { label: 'Total enrolled', value: String(totalModuleEnrollments), note: 'Distinct user attempts by module' },
            { label: 'Avg. completion', value: formatPercentage(averageModuleCompletion), note: 'Weighted by enrollment size' },
            { label: 'Most popular', value: moduleRowsNormalized[0] ? moduleRowsNormalized[0].moduleTitle : '-', note: moduleRowsNormalized[0] ? `${moduleRowsNormalized[0].enrolled} enrolled` : 'No enrollment data yet' },
          ],
          chartTitle: 'Module enrollment share',
          chartSubtitle: 'Each slice shows how many guides attempted each module.',
          pieSlices: moduleRowsNormalized.map((row) => ({
            label: row.moduleTitle,
            value: row.enrolled,
            completed: row.completed,
          })),
          columns: ['Module (Park)', 'Enrolled Guides', 'Completed', 'Training', 'Completion %'],
          rows: moduleRowsNormalized.map((row) => [
            row.moduleTitle,
            String(row.enrolled),
            String(row.completed),
            String(row.training),
            formatPercentage(row.completion),
          ]),
        },
        badges: {
          title: 'Park badge eligibility and award status',
          subtitle: 'Track eligible guides and badge award rates.',
          chartType: 'pie',
          kpis: [
            { label: 'Total badge types', value: String(badgeRowsNormalized.length), note: 'Active badge definitions' },
            { label: 'Awarded badges', value: String(totalAwardedBadges), note: 'From passed linked assessments' },
            { label: 'Eligible guides', value: String(totalEligibleGuides), note: 'Based on unlock threshold' },
            { label: 'Pending', value: String(totalPendingBadges), note: 'Eligible not yet awarded' },
          ],
          chartTitle: 'Badge unlock share',
          chartSubtitle: 'Issued badges for each badge type.',
          pieSlices: badgeRowsNormalized.map((row) => ({
            label: row.badgeName,
            value: row.awarded,
            awarded: row.awarded,
            eligible: row.eligible,
          })),
          columns: ['Badge (Park)', 'Eligible Guides', 'Awarded', 'Pending'],
          rows: badgeRowsNormalized.map((row) => [
            row.badgeName,
            String(row.eligible),
            String(row.awarded),
            String(row.pending),
          ]),
        },
        generatedAt: new Date().toISOString(),
        certificationSummary: {
          issuedGuides,
        },
      },
    });
  } catch (error) {
    console.error('Get analytics dashboard error:', error);
    return res.status(500).json({
      success: false,
      message: 'Failed to fetch analytics dashboard data.',
    });
  }
}

module.exports = {
  createQualification,
  createAnnouncement,
  getAllAnnouncements,
  updateAnnouncement,
  deleteAnnouncement,
  createSchedule,
  getAllUsers,
  updateUserStatus,
  getUserEnrollmentDetails,
  listEvidenceAlerts,
  listEsp32SensorAlerts,
  uploadEsp32SensorLogsCsv,
  streamEvidenceVideo,
  updateEvidenceStatus,
  listPayments,
  updatePaymentStatus,
  getAnalyticsDashboard,
};
