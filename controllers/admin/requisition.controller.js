import Requisition from "../../models/requisition.model.js";
import { Warden } from "../../models/warden.model.js";


// Get all requisitions (for Admin)
export const getAllRequisitions = async (req, res) => {
  try {
    const requisitions = await Requisition.find()
      .populate('wardenId', 'firstName lastName wardenId')
      .sort({ createdAt: -1 });

    res.status(200).json({
      success: true,
      requisitions
    });
  } catch (error) {
    res.status(500).json({
      success: false,
      message: "Error fetching requisitions",
      error: error.message
    });
  }
};

// Update requisition status (Approve/Reject)
export const updateRequisitionStatus = async (req, res) => {
  try {
    const { id } = req.params;
    const { status, adminRemarks } = req.body;

    if (!['approved', 'rejected', 'completed'].includes(status)) {
      return res.status(400).json({
        success: false,
        message: "Invalid status"
      });
    }

    const requisition = await Requisition.findByIdAndUpdate(
      id,
      { status, adminRemarks },
      { new: true }
    ).populate('wardenId', 'firstName lastName wardenId');

    if (!requisition) {
      return res.status(404).json({
        success: false,
        message: "Requisition not found"
      });
    }

    res.status(200).json({
      success: true,
      message: `Requisition ${status} successfully`,
      requisition
    });
  } catch (error) {
    res.status(500).json({
      success: false,
      message: "Error updating requisition status",
      error: error.message
    });
  }
};

// Get single requisition details
export const getRequisitionById = async (req, res) => {
  try {
    const { id } = req.params;
    const requisition = await Requisition.findById(id).populate('wardenId', 'firstName lastName wardenId email phone');

    if (!requisition) {
      return res.status(404).json({
        success: false,
        message: "Requisition not found"
      });
    }

    res.status(200).json({
      success: true,
      requisition
    });
  } catch (error) {
    res.status(500).json({
      success: false,
      message: "Error fetching requisition details",
      error: error.message
    });
  }
};
