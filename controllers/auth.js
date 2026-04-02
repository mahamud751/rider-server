import User from "../models/User.js";
import Ride from "../models/Ride.js";
import { StatusCodes } from "http-status-codes";
import { BadRequestError, UnauthenticatedError } from "../errors/index.js";
import jwt from "jsonwebtoken";

export const auth = async (req, res) => {
  const { phone, role, name, email, dateOfBirth } = req.body;

  // Log the incoming phone number for debugging
  console.log("Incoming phone number:", phone);
  console.log("Phone number length:", phone?.length);
  console.log("Phone number type:", typeof phone);

  if (!phone) {
    throw new BadRequestError("Phone number is required");
  }

  if (!role || !["customer", "rider", "admin"].includes(role)) {
    throw new BadRequestError(
      "Valid role is required (customer, rider, or admin)"
    );
  }

  try {
    let user = await User.findOne({ phone });

    if (user) {
      if (user.role !== role) {
        throw new BadRequestError("Phone number and role do not match");
      }

      // Update user profile information if provided
      if (name) user.name = name;
      if (email) user.email = email;
      if (dateOfBirth) user.dateOfBirth = dateOfBirth;

      await user.save();

      const accessToken = user.createAccessToken();
      const refreshToken = user.createRefreshToken();

      return res.status(StatusCodes.OK).json({
        message: "User logged in successfully",
        user,
        access_token: accessToken,
        refresh_token: refreshToken,
      });
    }

    // Create new user with profile information
    user = new User({
      phone,
      role,
      name: name || "",
      email: email || "",
      dateOfBirth: dateOfBirth || null,
    });

    await user.save();

    const accessToken = user.createAccessToken();
    const refreshToken = user.createRefreshToken();

    res.status(StatusCodes.CREATED).json({
      message: "User created successfully",
      user,
      access_token: accessToken,
      refresh_token: refreshToken,
    });
  } catch (error) {
    console.error(error);
    throw error;
  }
};

// Auto signin - detects user role from phone number
export const autoAuth = async (req, res) => {
  const { phone, name, email, dateOfBirth } = req.body;

  console.log("Auto auth - Incoming phone number:", phone);

  if (!phone) {
    throw new BadRequestError("Phone number is required");
  }

  try {
    // Find existing user by phone number
    let user = await User.findOne({ phone });

    if (user) {
      // Existing user - update profile if provided
      if (name) user.name = name;
      if (email) user.email = email;
      if (dateOfBirth) user.dateOfBirth = dateOfBirth;

      await user.save();

      const accessToken = user.createAccessToken();
      const refreshToken = user.createRefreshToken();

      return res.status(StatusCodes.OK).json({
        message: "User logged in successfully",
        user,
        access_token: accessToken,
        refresh_token: refreshToken,
      });
    }

    // New user - default to customer role
    user = new User({
      phone,
      role: "customer",
      name: name || "",
      email: email || "",
      dateOfBirth: dateOfBirth || null,
    });

    await user.save();

    const accessToken = user.createAccessToken();
    const refreshToken = user.createRefreshToken();

    res.status(StatusCodes.CREATED).json({
      message: "User created successfully",
      user,
      access_token: accessToken,
      refresh_token: refreshToken,
    });
  } catch (error) {
    console.error(error);
    throw error;
  }
};

export const refreshToken = async (req, res) => {
  const { refresh_token } = req.body;
  if (!refresh_token) {
    throw new BadRequestError("Refresh token is required");
  }

  try {
    const payload = jwt.verify(refresh_token, process.env.REFRESH_TOKEN_SECRET);
    const user = await User.findById(payload.id);

    if (!user) {
      throw new UnauthenticatedError("Invalid refresh token");
    }

    const newAccessToken = user.createAccessToken();
    const newRefreshToken = user.createRefreshToken();

    res.status(StatusCodes.OK).json({
      access_token: newAccessToken,
      refresh_token: newRefreshToken,
    });
  } catch (error) {
    console.error(error);
    throw new UnauthenticatedError("Invalid refresh token");
  }
};

// New controller to update user profile
export const updateUserProfile = async (req, res) => {
  const userId = req.user.id;
  const { name, email, dateOfBirth, profilePicture } = req.body;

  try {
    const user = await User.findById(userId);

    if (!user) {
      throw new NotFoundError("User not found");
    }

    // Update user profile information
    if (name !== undefined) user.name = name;
    if (email !== undefined) user.email = email;
    if (dateOfBirth !== undefined) user.dateOfBirth = dateOfBirth;
    if (profilePicture !== undefined) user.profilePicture = profilePicture;

    await user.save();

    res.status(StatusCodes.OK).json({
      message: "Profile updated successfully",
      user,
    });
  } catch (error) {
    console.error(error);
    throw new BadRequestError("Failed to update profile");
  }
};

// New controller to get user profile
export const getUserProfile = async (req, res) => {
  const userId = req.user.id;

  try {
    const user = await User.findById(userId).select("-__v");

    if (!user) {
      throw new NotFoundError("User not found");
    }

    res.status(StatusCodes.OK).json({
      message: "Profile retrieved successfully",
      user,
    });
  } catch (error) {
    console.error(error);
    throw new BadRequestError("Failed to retrieve profile");
  }
};

// New controller to get rider's today earnings
export const getRiderTodayEarnings = async (req, res) => {
  const userId = req.user.id;

  try {
    // Get today's date range (from 00:00:00 to 23:59:59)
    const today = new Date();
    const startOfDay = new Date(today.setHours(0, 0, 0, 0));
    const endOfDay = new Date(today.setHours(23, 59, 59, 999));

    // Find all completed rides for this rider today
    const todayRides = await Ride.find({
      rider: userId,
      status: "COMPLETED",
      createdAt: {
        $gte: startOfDay,
        $lte: endOfDay,
      },
    });

    // Calculate total earnings
    const totalEarnings = todayRides.reduce((sum, ride) => sum + ride.fare, 0);

    res.status(StatusCodes.OK).json({
      message: "Today's earnings retrieved successfully",
      earnings: totalEarnings,
      rideCount: todayRides.length,
    });
  } catch (error) {
    console.error(error);
    throw new BadRequestError("Failed to retrieve today's earnings");
  }
};
