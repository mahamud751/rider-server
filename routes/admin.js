import express from "express";
import {
  getAllUsers,
  getAllRides,
  getPlatformStatistics,
  getRiderEarnings,
  getUserById,
  updateUserByAdmin,
  deleteUser,
  verifyAdmin,
} from "../controllers/admin.js";
import authenticateUser from "../middleware/authentication.js";

const router = express.Router();

// All admin routes require authentication and admin role
router.use(authenticateUser);
router.use(verifyAdmin);

// User management
router.get("/users", getAllUsers);
router.get("/users/:userId", getUserById);
router.patch("/users/:userId", updateUserByAdmin);
router.delete("/users/:userId", deleteUser);

// Ride management
router.get("/rides", getAllRides);

// Statistics and analytics
router.get("/statistics", getPlatformStatistics);
router.get("/rider-earnings", getRiderEarnings);

export default router;
