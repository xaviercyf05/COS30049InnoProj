const { query } = require("../config/db");
const qualificationService = require("../services/qualificationService");
const notificationService = require("../services/notificationService");
const asyncHandler = require("../utils/asyncHandler");

/**
 * Controller for qualifications - handles enrollment, viewing, and progress tracking.
 */

/**
 * Get all available qualifications
 */
async function getQualifications(req, res) {
  try {
    const [qualifications] = await query(
      "SELECT QualificationID, QualificationName, Status FROM Qualifications ORDER BY QualificationID ASC"
    );

    return res.json({
      success: true,
      data: qualifications.map((q) => ({
        qualificationId: q.QualificationID,
        name: q.QualificationName,
        status: q.Status,
      })),
    });
  } catch (error) {
    console.error("Get qualifications error:", error);
    return res.status(500).json({
      success: false,
      message: "Failed to fetch qualifications.",
    });
  }
}

/**
 * Get qualification details including modules
 */
async function getQualificationDetails(req, res) {
  try {
    const { qualificationId } = req.params;

    // Get qualification
    const [quals] = await query(
      "SELECT QualificationID, QualificationName, Status FROM Qualifications WHERE QualificationID = ? LIMIT 1",
      [qualificationId]
    );

    if (quals.length === 0) {
      return res.status(404).json({
        success: false,
        message: "Qualification not found.",
      });
    }

    const qual = quals[0];

    // Get modules
    const [modules] = await query(
      "SELECT ModuleID, ModuleTitle FROM Modules WHERE QualificationID = ? ORDER BY ModuleID ASC",
      [qualificationId]
    );

    return res.json({
      success: true,
      data: {
        qualificationId: qual.QualificationID,
        name: qual.QualificationName,
        status: qual.Status,
        modules: modules.map((m) => ({
          moduleId: m.ModuleID,
          title: m.ModuleTitle,
        })),
      },
    });
  } catch (error) {
    console.error("Get qualification details error:", error);
    return res.status(500).json({
      success: false,
      message: "Failed to fetch qualification details.",
    });
  }
}

/**
 * Get user's enrolled qualifications
 */
async function getUserQualifications(req, res) {
  try {
    const { userId } = req.user;

    const qualifications = await qualificationService.getUserQualifications(
      userId
    );

    return res.json({
      success: true,
      data: qualifications,
    });
  } catch (error) {
    console.error("Get user qualifications error:", error);
    return res.status(500).json({
      success: false,
      message: "Failed to fetch user qualifications.",
    });
  }
}

/**
 * Enroll user in a qualification
 */
async function enrollInQualification(req, res) {
  try {
    const { userId } = req.user;
    const { qualificationId } = req.body;

    if (!qualificationId) {
      return res.status(400).json({
        success: false,
        message: "Qualification ID is required.",
      });
    }

    // Get qualification name for notification
    const [quals] = await query(
      "SELECT QualificationName FROM Qualifications WHERE QualificationID = ? LIMIT 1",
      [qualificationId]
    );

    if (quals.length === 0) {
      return res.status(404).json({
        success: false,
        message: "Qualification not found.",
      });
    }

    const qualName = quals[0].QualificationName;

    // Enroll user
    const enrollment = await qualificationService.enrollUserInQualification(
      userId,
      qualificationId
    );

    // Send notification
    await notificationService.notificationHelpers.notifyEnrollment(
      userId,
      qualName
    );

    return res.status(201).json({
      success: true,
      message: "Successfully enrolled in qualification.",
      data: enrollment,
    });
  } catch (error) {
    if (error.message.includes("already enrolled")) {
      return res.status(409).json({
        success: false,
        message: error.message,
      });
    }

    console.error("Enroll in qualification error:", error);
    return res.status(500).json({
      success: false,
      message: "Failed to enroll in qualification.",
    });
  }
}

/**
 * Get user's progress in a qualification
 */
async function getQualificationProgress(req, res) {
  try {
    const { userId } = req.user;
    const { qualificationId } = req.params;

    if (!qualificationId) {
      return res.status(400).json({
        success: false,
        message: "Qualification ID is required.",
      });
    }

    const progress =
      await qualificationService.getQualificationProgress(
        userId,
        qualificationId
      );

    return res.json({
      success: true,
      data: progress,
    });
  } catch (error) {
    console.error("Get qualification progress error:", error);
    return res.status(500).json({
      success: false,
      message: "Failed to fetch qualification progress.",
    });
  }
}

module.exports = {
  getQualifications,
  getQualificationDetails,
  getUserQualifications,
  enrollInQualification,
  getQualificationProgress,
};
