const express = require('express');
const router = express.Router();
const Complaint = require('./complaint');
const User = require('./user');
const auth = require('./authmiddle');

// Create complaint (User)
router.post('/', auth, async (req, res) => {
  try {
    const { message } = req.body;

    if (!message || !message.trim()) {
      return res.status(400).json({ error: 'Message is required' });
    }

    const user = await User.findById(req.userId);
    if (!user) {
      return res.status(404).json({ error: 'User not found' });
    }

    const complaint = new Complaint({
      user: req.userId,
      message: message.trim(),
      userSnapshot: {
        name: user.name,
        email: user.email,
        phone: user.phone
      }
    });

    await complaint.save();

    console.log('✅ Complaint created:', complaint._id);

    res.status(201).json({
      success: true,
      message: 'Complaint submitted successfully',
      complaint
    });
  } catch (error) {
    console.error('❌ Error creating complaint:', error);
    res.status(500).json({ error: 'Server error creating complaint' });
  }
});

// Get all complaints (Admin)
router.get('/', auth, async (req, res) => {
  try {
    const complaints = await Complaint.find()
      .populate('user', 'name email phone')
      .sort({ createdAt: -1 });

    res.json({
      success: true,
      complaints
    });
  } catch (error) {
    console.error('❌ Error fetching complaints:', error);
    res.status(500).json({ error: 'Server error fetching complaints' });
  }
});

// Update complaint status (Admin)
router.patch('/:id/status', auth, async (req, res) => {
  try {
    const { status } = req.body;

    if (!['pending', 'in-progress', 'resolved'].includes(status)) {
      return res.status(400).json({ error: 'Invalid status' });
    }

    const updateData = { status };
    if (status === 'resolved') {
      updateData.resolvedAt = new Date();
    }

    const complaint = await Complaint.findByIdAndUpdate(
      req.params.id,
      updateData,
      { new: true }
    ).populate('user', 'name email phone');

    if (!complaint) {
      return res.status(404).json({ error: 'Complaint not found' });
    }

    console.log('✅ Complaint status updated:', complaint._id, status);

    res.json({
      success: true,
      message: 'Complaint status updated',
      complaint
    });
  } catch (error) {
    console.error('❌ Error updating complaint:', error);
    res.status(500).json({ error: 'Server error updating complaint' });
  }
});

// Delete complaint (Admin)
router.delete('/:id', auth, async (req, res) => {
  try {
    const complaint = await Complaint.findByIdAndDelete(req.params.id);

    if (!complaint) {
      return res.status(404).json({ error: 'Complaint not found' });
    }

    console.log('✅ Complaint deleted:', complaint._id);

    res.json({
      success: true,
      message: 'Complaint deleted successfully'
    });
  } catch (error) {
    console.error('❌ Error deleting complaint:', error);
    res.status(500).json({ error: 'Server error deleting complaint' });
  }
});

module.exports = router;
