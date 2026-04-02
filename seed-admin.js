import dotenv from "dotenv";
import mongoose from "mongoose";
import User from "./models/User.js";
import connectDB from "./config/connect.js";

dotenv.config();

const createAdminUser = async () => {
  try {
    // Connect to database
    await connectDB(process.env.MONGO_URI);
    console.log("Connected to database");

    // Admin user details
    const adminData = {
      phone: "+8801700000000", // Default admin phone number
      role: "admin",
      name: "Admin User",
      email: "admin@rideapp.com",
      balance: 0,
    };

    // Check if admin already exists
    const existingAdmin = await User.findOne({ phone: adminData.phone });

    if (existingAdmin) {
      console.log("Admin user already exists with this phone number!");
      console.log("Phone:", existingAdmin.phone);
      console.log("Name:", existingAdmin.name);
      console.log("Email:", existingAdmin.email);
      console.log("\nYou can use this phone number to login as admin.");
      process.exit(0);
    }

    // Create admin user
    const admin = new User(adminData);
    await admin.save();

    console.log("\n✅ Admin user created successfully!");
    console.log("==========================================");
    console.log("Phone:", adminData.phone);
    console.log("Name:", adminData.name);
    console.log("Email:", adminData.email);
    console.log("==========================================");
    console.log(
      "\nYou can now login to the admin panel using this phone number."
    );
    console.log("Phone to use in app: 1700000000 (without country code)");

    process.exit(0);
  } catch (error) {
    console.error("Error creating admin user:", error);
    process.exit(1);
  }
};

// Run the seed function
createAdminUser();
