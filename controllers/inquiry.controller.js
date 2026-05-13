import { Inquiry } from '../models/inquiry.model.js';

// Create a new inquiry (Public)
export const createInquiry = async (req, res) => {
  try {
    const { name, email, phone, roomType, message } = req.body;

    if (!name || !email || !phone || !roomType) {
      return res.status(400).json({ message: 'Please provide all required fields.' });
    }

    const newInquiry = new Inquiry({
      name,
      email,
      phone,
      roomType,
      message
    });

    await newInquiry.save();

    res.status(201).json({
      success: true,
      message: 'Inquiry submitted successfully.',
      data: newInquiry
    });
  } catch (error) {
    console.error('Error creating inquiry:', error);
    res.status(500).json({ message: 'Internal server error.' });
  }
};

// Get all inquiries (Admin/Warden)
export const getAllInquiries = async (req, res) => {
  try {
    const inquiries = await Inquiry.find().sort({ createdAt: -1 });
    res.status(200).json({
      success: true,
      data: inquiries
    });
  } catch (error) {
    console.error('Error fetching inquiries:', error);
    res.status(500).json({ message: 'Internal server error.' });
  }
};

// Update inquiry status (Admin/Warden)
export const updateInquiryStatus = async (req, res) => {
  try {
    const { id } = req.params;
    const { status, notes } = req.body;

    const inquiry = await Inquiry.findById(id);

    if (!inquiry) {
      return res.status(404).json({ message: 'Inquiry not found.' });
    }

    if (status) inquiry.status = status;
    if (notes) inquiry.notes = notes;

    await inquiry.save();

    res.status(200).json({
      success: true,
      message: 'Inquiry updated successfully.',
      data: inquiry
    });
  } catch (error) {
    console.error('Error updating inquiry:', error);
    res.status(500).json({ message: 'Internal server error.' });
  }
};

// Delete inquiry (Admin)
export const deleteInquiry = async (req, res) => {
  try {
    const { id } = req.params;
    const inquiry = await Inquiry.findByIdAndDelete(id);

    if (!inquiry) {
      return res.status(404).json({ message: 'Inquiry not found.' });
    }

    res.status(200).json({
      success: true,
      message: 'Inquiry deleted successfully.'
    });
  } catch (error) {
    console.error('Error deleting inquiry:', error);
    res.status(500).json({ message: 'Internal server error.' });
  }
};
