import dotenv from "dotenv";
import readline from "readline";
import User from "./models/User.js";
import connectDB from "./config/connect.js";

dotenv.config();

const rl = readline.createInterface({
  input: process.stdin,
  output: process.stdout,
});

const question = (query) => {
  return new Promise((resolve) => {
    rl.question(query, resolve);
  });
};

const createCustomAdmin = async () => {
  try {
    // Connect to database
    await connectDB(process.env.MONGO_URI);
    console.log("✅ Connected to database\n");

    console.log("========================================");
    console.log("    Create Custom Admin User");
    console.log("========================================\n");

    // Get admin details from user input
    const phone = await question(
      "Enter admin phone (with country code, e.g., +8801700000000): "
    );
    const name = await question("Enter admin name: ");
    const email = await question("Enter admin email: ");

    // Validate phone format
    if (!phone.startsWith("+880") || phone.length !== 14) {
      console.log(
        "\n❌ Invalid phone format. Must be +880 followed by 10 digits."
      );
      rl.close();
      process.exit(1);
    }

    // Check if user already exists
    const existingUser = await User.findOne({ phone });

    if (existingUser) {
      if (existingUser.role === "admin") {
        console.log(
          "\n⚠️  An admin user already exists with this phone number!"
        );
        console.log("Phone:", existingUser.phone);
        console.log("Name:", existingUser.name);
        console.log("Email:", existingUser.email);
      } else {
        console.log(
          "\n⚠️  A user with this phone number already exists but is not an admin."
        );
        console.log("Role:", existingUser.role);
        const upgrade = await question(
          "Do you want to upgrade this user to admin? (yes/no): "
        );

        if (upgrade.toLowerCase() === "yes" || upgrade.toLowerCase() === "y") {
          existingUser.role = "admin";
          if (name) existingUser.name = name;
          if (email) existingUser.email = email;
          await existingUser.save();

          console.log("\n✅ User upgraded to admin successfully!");
          console.log("==========================================");
          console.log("Phone:", existingUser.phone);
          console.log("Name:", existingUser.name);
          console.log("Email:", existingUser.email);
          console.log("Role:", existingUser.role);
          console.log("==========================================");
        }
      }
      rl.close();
      process.exit(0);
    }

    // Create new admin user
    const adminData = {
      phone,
      role: "admin",
      name: name || "Admin User",
      email: email || "",
      balance: 0,
    };

    const admin = new User(adminData);
    await admin.save();

    console.log("\n✅ Admin user created successfully!");
    console.log("==========================================");
    console.log("Phone:", adminData.phone);
    console.log("Name:", adminData.name);
    console.log("Email:", adminData.email);
    console.log("==========================================");
    console.log("\nLogin credentials:");
    console.log("Phone to use in app:", phone.replace("+880", ""));
    console.log("(Enter without country code in the app)");

    rl.close();
    process.exit(0);
  } catch (error) {
    console.error("\n❌ Error creating admin user:", error.message);
    rl.close();
    process.exit(1);
  }
};

// Run the function
createCustomAdmin();
