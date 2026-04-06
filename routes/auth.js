import express from "express";
import {
  refreshToken,
  auth,
  autoAuth,
  registerWithEmail,
  loginWithEmail,
  updateUserProfile,
  getUserProfile,
  getRiderTodayEarnings,
} from "../controllers/auth.js";
import authenticateUser from "../middleware/authentication.js";

const router = express.Router();

router.post("/refresh-token", refreshToken);
router.post("/signin", auth);
router.post("/auto-signin", autoAuth);
router.post("/register", registerWithEmail);
router.post("/login", loginWithEmail);
router.get("/profile", authenticateUser, getUserProfile);
router.patch("/profile", authenticateUser, updateUserProfile);
router.get("/today-earnings", authenticateUser, getRiderTodayEarnings);

export default router;
