const express = require('express');
const { body, param, query } = require('express-validator');
const sensorController = require('../controllers/sensorController');
const { validateDeviceKey } = require('../middleware/sensorAuth');

const router = express.Router();

router.post('/log',
  validateDeviceKey,
  [
    body('temp').exists().isFloat({ min: -50, max: 100 }),
    body('hum').exists().isFloat({ min: 0, max: 100 }),
    body('distance').exists().isFloat({ min: 0 })
  ],
  sensorController.logSensorData
);

router.get('/device/:deviceID',
  [param('deviceID').notEmpty(), query('limit').optional().isInt({ min: 1, max: 1000 })],
  sensorController.getLatestSensorData
);

router.get('/stats/:deviceID',
  [param('deviceID').notEmpty(), query('hours').optional().isInt({ min: 1, max: 8760 })],
  sensorController.getSensorStats
);

router.get('/alerts/:deviceID',
  [param('deviceID').notEmpty(), query('limit').optional().isInt({ min: 1, max: 1000 })],
  sensorController.getAlerts
);

module.exports = router;
