import mongoose from "mongoose";
import jwt from "jsonwebtoken";
import bcrypt from "bcryptjs";

const { Schema } = mongoose;

const userSchema = new Schema(
  {
    role: {
      type: String,
      enum: ["customer", "rider", "admin"],
      required: true,
    },
    phone: {
      type: String,
      required: false,
      sparse: true,
      unique: true,
      validate: {
        validator: function (v) {
          if (!v) return true;
          return /^\+880\d{10}$/.test(v);
        },
        message: (props) =>
          `${props.value} is not a valid Bangladesh phone number!`,
      },
    },
    /** Bcrypt hash; only set for email/password accounts */
    passwordHash: {
      type: String,
      select: false,
      required: false,
    },
    name: {
      type: String,
      required: false,
      trim: true,
      maxlength: 50,
    },
    email: {
      type: String,
      required: false,
      trim: true,
      lowercase: true,
      sparse: true,
      unique: true,
      validate: {
        validator: function (v) {
          if (!v) return true;
          return /^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(v);
        },
        message: (props) => `${props.value} is not a valid email!`,
      },
    },
    dateOfBirth: {
      type: Date,
      required: false,
    },
    balance: {
      type: Number,
      default: 0,
      min: 0,
    },
    profilePicture: {
      type: String,
      required: false,
    },
  },
  {
    timestamps: true,
  }
);

userSchema.pre("validate", function (next) {
  if (this.email === "") this.set("email", undefined);
  next();
});

userSchema.methods.createAccessToken = function () {
  return jwt.sign(
    {
      id: this._id,
      phone: this.phone,
      email: this.email,
      role: this.role,
    },
    process.env.ACCESS_TOKEN_SECRET,
    { expiresIn: process.env.ACCESS_TOKEN_EXPIRY }
  );
};

userSchema.methods.createRefreshToken = function () {
  return jwt.sign(
    { id: this._id, phone: this.phone, email: this.email, role: this.role },
    process.env.REFRESH_TOKEN_SECRET,
    {
      expiresIn: process.env.REFRESH_TOKEN_EXPIRY,
    }
  );
};

const User = mongoose.model("User", userSchema);
export default User;
