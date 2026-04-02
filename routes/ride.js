import express from "express";
import {
  createRide,
  updateRideStatus,
  acceptRide,
  getMyRides,
  getRiderStatistics,
  getCustomerStatistics,
} from "../controllers/ride.js";

const router = express.Router();

router.use((req, res, next) => {
  req.socket = req.app.get("io");
  req.io = req.app.get("io");
  next();
});

router.post("/create", createRide);
router.patch("/accept/:rideId", acceptRide);
router.patch("/update/:rideId", updateRideStatus);
router.get("/rides", getMyRides);
router.get("/rider/statistics", getRiderStatistics);
router.get("/customer/statistics", getCustomerStatistics);

export default router;
