// Middleware to authenticate ESP32 devices using a shared secret per-device.
// Supports loading device keys from the environment variable SENSOR_DEVICE_KEYS
// as a JSON string like: {"device-Bako":"cos30049fr","device-Kubah":"cos30049fr"}

const DEFAULT_KEYS = {
  "device-Bako": "cos30049fr",
  "device-Kubah": "cos30049fr",
  "device-Similajau": "cos30049fr",
  "device-Gunung Mulu": "cos30049fr",
  "device-Maludam": "cos30049fr",
};
const DEFAULT_DEVICE_ID = "device-Bako";

function loadDeviceKeys() {
  try {
    if (process.env.SENSOR_DEVICE_KEYS) {
      const parsed = JSON.parse(process.env.SENSOR_DEVICE_KEYS);
      if (typeof parsed === 'object' && parsed !== null) return parsed;
    }
  } catch (e) {
    console.warn('Invalid SENSOR_DEVICE_KEYS JSON, falling back to defaults');
  }
  return DEFAULT_KEYS;
}

const DEVICE_KEYS = loadDeviceKeys();

function validateDeviceKey(req, res, next) {
  const apiKey = (req.headers['x-device-key'] || req.body && req.body.key || '').toString();
  const deviceID = (req.headers['x-device-id'] || req.body && req.body.deviceID || DEFAULT_DEVICE_ID).toString();

  if (!apiKey) {
    return res.status(401).json({ success: false, message: 'Missing device API key' });
  }

  if (DEVICE_KEYS[deviceID] && DEVICE_KEYS[deviceID] === apiKey) {
    req.deviceID = deviceID;
    return next();
  }

  return res.status(401).json({ success: false, message: 'Unauthorized - invalid device key' });
}

module.exports = { validateDeviceKey, DEVICE_KEYS };
