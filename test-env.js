import dotenv from "dotenv";
dotenv.config();

console.log("MONGO_URI from process.env:", process.env.MONGO_URI);
console.log(
  "All env variables:",
  Object.keys(process.env).filter((key) => key.includes("MONGO"))
);
