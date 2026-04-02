import User from "../models/User.js";
import Ride from "../models/Ride.js";
import {
  BadRequestError,
  UnauthenticatedError,
  NotFoundError,
} from "../errors/index.js";
import { StatusCodes } from "http-status-codes";

// Middleware to check if user is admin
export const verifyAdmin = async (req, res, next) => {
  if (req.user.role !== "admin") {
    throw new UnauthenticatedError("Access denied. Admin only.");
  }
  next();
};

// Get all users with optional role filter
export const getAllUsers = async (req, res) => {
  const { role, search, page = 1, limit = 20 } = req.query;

  try {
    const query = {};

    // Filter by role if provided
    if (role && ["customer", "rider", "admin"].includes(role)) {
      query.role = role;
    }

    // Search by name or phone
    if (search) {
      query.$or = [
        { name: { $regex: search, $options: "i" } },
        { phone: { $regex: search, $options: "i" } },
      ];
    }

    const skip = (page - 1) * limit;

    const users = await User.find(query)
      .select("-__v")
      .sort({ createdAt: -1 })
      .skip(skip)
      .limit(parseInt(limit));

    const totalUsers = await User.countDocuments(query);

    res.status(StatusCodes.OK).json({
      message: "Users retrieved successfully",
      users,
      pagination: {
        total: totalUsers,
        page: parseInt(page),
        limit: parseInt(limit),
        totalPages: Math.ceil(totalUsers / limit),
      },
    });
  } catch (error) {
    console.error("Error retrieving users:", error);
    throw new BadRequestError("Failed to retrieve users");
  }
};

// Get all rides with filters
export const getAllRides = async (req, res) => {
  const {
    status,
    vehicle,
    page = 1,
    limit = 20,
    startDate,
    endDate,
  } = req.query;

  try {
    const query = {};

    // Filter by status
    if (status) {
      query.status = status;
    }

    // Filter by vehicle type
    if (vehicle) {
      query.vehicle = vehicle;
    }

    // Filter by date range
    if (startDate || endDate) {
      query.createdAt = {};
      if (startDate) {
        query.createdAt.$gte = new Date(startDate);
      }
      if (endDate) {
        query.createdAt.$lte = new Date(endDate);
      }
    }

    const skip = (page - 1) * limit;

    const rides = await Ride.find(query)
      .populate("customer", "name phone email")
      .populate("rider", "name phone email")
      .sort({ createdAt: -1 })
      .skip(skip)
      .limit(parseInt(limit));

    const totalRides = await Ride.countDocuments(query);

    res.status(StatusCodes.OK).json({
      message: "Rides retrieved successfully",
      rides,
      pagination: {
        total: totalRides,
        page: parseInt(page),
        limit: parseInt(limit),
        totalPages: Math.ceil(totalRides / limit),
      },
    });
  } catch (error) {
    console.error("Error retrieving rides:", error);
    throw new BadRequestError("Failed to retrieve rides");
  }
};

// Get platform statistics
export const getPlatformStatistics = async (req, res) => {
  try {
    // Total users by role
    const totalCustomers = await User.countDocuments({ role: "customer" });
    const totalRiders = await User.countDocuments({ role: "rider" });
    const totalAdmins = await User.countDocuments({ role: "admin" });

    // Total rides by status
    const totalRides = await Ride.countDocuments();
    const completedRides = await Ride.countDocuments({ status: "COMPLETED" });
    const activeRides = await Ride.countDocuments({
      status: { $in: ["SEARCHING_FOR_RIDER", "START", "ARRIVED"] },
    });
    const cancelledRides = await Ride.countDocuments({ status: "CANCELLED" });

    // Revenue calculations
    const revenueData = await Ride.aggregate([
      {
        $match: { status: "COMPLETED" },
      },
      {
        $group: {
          _id: null,
          totalRevenue: { $sum: "$fare" },
        },
      },
    ]);

    const totalRevenue =
      revenueData.length > 0 ? revenueData[0].totalRevenue : 0;

    // Today's statistics
    const today = new Date();
    const startOfDay = new Date(today.setHours(0, 0, 0, 0));
    const endOfDay = new Date(today.setHours(23, 59, 59, 999));

    const todayRides = await Ride.countDocuments({
      createdAt: { $gte: startOfDay, $lte: endOfDay },
    });

    const todayRevenue = await Ride.aggregate([
      {
        $match: {
          status: "COMPLETED",
          createdAt: { $gte: startOfDay, $lte: endOfDay },
        },
      },
      {
        $group: {
          _id: null,
          revenue: { $sum: "$fare" },
        },
      },
    ]);

    const todayEarnings = todayRevenue.length > 0 ? todayRevenue[0].revenue : 0;

    // Rides by vehicle type
    const ridesByVehicle = await Ride.aggregate([
      {
        $group: {
          _id: "$vehicle",
          count: { $sum: 1 },
        },
      },
    ]);

    res.status(StatusCodes.OK).json({
      message: "Platform statistics retrieved successfully",
      statistics: {
        users: {
          totalCustomers,
          totalRiders,
          totalAdmins,
          total: totalCustomers + totalRiders + totalAdmins,
        },
        rides: {
          totalRides,
          completedRides,
          activeRides,
          cancelledRides,
        },
        revenue: {
          totalRevenue,
          todayRevenue: todayEarnings,
        },
        today: {
          rides: todayRides,
          revenue: todayEarnings,
        },
        ridesByVehicle,
      },
    });
  } catch (error) {
    console.error("Error retrieving platform statistics:", error);
    throw new BadRequestError("Failed to retrieve platform statistics");
  }
};

// Get rider earnings details
export const getRiderEarnings = async (req, res) => {
  const { page = 1, limit = 20, sortBy = "earnings" } = req.query;

  try {
    const skip = (page - 1) * limit;

    // Get all riders with their earnings
    const ridersEarnings = await Ride.aggregate([
      {
        $match: { status: "COMPLETED", rider: { $ne: null } },
      },
      {
        $group: {
          _id: "$rider",
          totalEarnings: { $sum: "$fare" },
          totalRides: { $sum: 1 },
        },
      },
      {
        $lookup: {
          from: "users",
          localField: "_id",
          foreignField: "_id",
          as: "riderInfo",
        },
      },
      {
        $unwind: "$riderInfo",
      },
      {
        $project: {
          _id: 1,
          name: "$riderInfo.name",
          phone: "$riderInfo.phone",
          email: "$riderInfo.email",
          balance: "$riderInfo.balance",
          totalEarnings: 1,
          totalRides: 1,
        },
      },
      {
        $sort: sortBy === "rides" ? { totalRides: -1 } : { totalEarnings: -1 },
      },
      {
        $skip: skip,
      },
      {
        $limit: parseInt(limit),
      },
    ]);

    const totalRiders = await User.countDocuments({ role: "rider" });

    res.status(StatusCodes.OK).json({
      message: "Rider earnings retrieved successfully",
      riders: ridersEarnings,
      pagination: {
        total: totalRiders,
        page: parseInt(page),
        limit: parseInt(limit),
        totalPages: Math.ceil(totalRiders / limit),
      },
    });
  } catch (error) {
    console.error("Error retrieving rider earnings:", error);
    throw new BadRequestError("Failed to retrieve rider earnings");
  }
};

// Get user details by ID
export const getUserById = async (req, res) => {
  const { userId } = req.params;

  try {
    const user = await User.findById(userId).select("-__v");

    if (!user) {
      throw new NotFoundError("User not found");
    }

    // Get user's ride statistics
    let statistics = {};

    if (user.role === "customer") {
      const totalRides = await Ride.countDocuments({ customer: userId });
      const completedRides = await Ride.countDocuments({
        customer: userId,
        status: "COMPLETED",
      });

      const spending = await Ride.aggregate([
        {
          $match: { customer: user._id, status: "COMPLETED" },
        },
        {
          $group: {
            _id: null,
            totalSpent: { $sum: "$fare" },
          },
        },
      ]);

      statistics = {
        totalRides,
        completedRides,
        totalSpent: spending.length > 0 ? spending[0].totalSpent : 0,
      };
    } else if (user.role === "rider") {
      const totalRides = await Ride.countDocuments({ rider: userId });
      const completedRides = await Ride.countDocuments({
        rider: userId,
        status: "COMPLETED",
      });

      const earnings = await Ride.aggregate([
        {
          $match: { rider: user._id, status: "COMPLETED" },
        },
        {
          $group: {
            _id: null,
            totalEarnings: { $sum: "$fare" },
          },
        },
      ]);

      statistics = {
        totalRides,
        completedRides,
        totalEarnings: earnings.length > 0 ? earnings[0].totalEarnings : 0,
      };
    }

    res.status(StatusCodes.OK).json({
      message: "User details retrieved successfully",
      user,
      statistics,
    });
  } catch (error) {
    console.error("Error retrieving user details:", error);
    throw new BadRequestError("Failed to retrieve user details");
  }
};

// Update user status or details (admin can edit user info)
export const updateUserByAdmin = async (req, res) => {
  const { userId } = req.params;
  const updates = req.body;

  try {
    // Don't allow changing role through this endpoint
    delete updates.role;

    const user = await User.findByIdAndUpdate(userId, updates, {
      new: true,
      runValidators: true,
    }).select("-__v");

    if (!user) {
      throw new NotFoundError("User not found");
    }

    res.status(StatusCodes.OK).json({
      message: "User updated successfully",
      user,
    });
  } catch (error) {
    console.error("Error updating user:", error);
    throw new BadRequestError("Failed to update user");
  }
};

// Delete user (soft delete - could be implemented as deactivation)
export const deleteUser = async (req, res) => {
  const { userId } = req.params;

  try {
    const user = await User.findByIdAndDelete(userId);

    if (!user) {
      throw new NotFoundError("User not found");
    }

    res.status(StatusCodes.OK).json({
      message: "User deleted successfully",
    });
  } catch (error) {
    console.error("Error deleting user:", error);
    throw new BadRequestError("Failed to delete user");
  }
};
