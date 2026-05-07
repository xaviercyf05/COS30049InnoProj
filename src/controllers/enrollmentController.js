const { Enrollment } = require('../models'); 
const path = require('path');
const fs = require('fs');

exports.requestEnrollment = async (req, res) => {
  try {
    const { moduleId } = req.body;
    const userId = req.user.id;  

    if (!req.files || !req.files.evidence) {
      return res.status(400).json({ 
        success: false, 
        message: 'Payment evidence file is required' 
      });
    }

    const evidence = req.files.evidence;
    
  
    const uploadDir = path.join(__dirname, '../uploads/payments');
    if (!fs.existsSync(uploadDir)) {
      fs.mkdirSync(uploadDir, { recursive: true });
    }

    const fileName = `${Date.now()}-${evidence.name}`;
    const uploadPath = path.join(uploadDir, fileName);

    await evidence.mv(uploadPath);

    const enrollment = await Enrollment.create({
      userId,
      moduleId,
      evidenceUrl: `/uploads/payments/${fileName}`,
      evidenceFileName: evidence.name,
      status: 'pending',
      paymentReference: `REF-${userId}-${moduleId}-${Date.now()}`,
    });

    res.json({ 
      success: true, 
      message: 'Payment request submitted successfully',
      enrollment 
    });

  } catch (error) {
    console.error(error);
    res.status(500).json({ success: false, message: 'Server error' });
  }
};

exports.getPaymentStatus = async (req, res) => {
  try {
    const { moduleId } = req.params;
    const userId = req.user.id;

    const enrollment = await Enrollment.findOne({
      where: { userId, moduleId }
    });

    const hasPaid = enrollment?.status === 'approved';

    res.json({
      hasPaid,
      paymentRequest: enrollment ? {
        id: enrollment.id,
        status: enrollment.status,
        submittedAt: enrollment.createdAt,
        evidenceUrl: enrollment.evidenceUrl,
        note: enrollment.note
      } : null
    });
  } catch (error) {
    console.error(error);
    res.status(500).json({ success: false, message: 'Server error' });
  }
};
