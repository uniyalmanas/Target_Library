import fs from "fs";

console.log("Process Environment:");
for (const [key, value] of Object.entries(process.env)) {
  if (key.includes("SUPABASE") || key.includes("KEY") || key.includes("URL") || key.includes("SECRET") || key.includes("PASS")) {
    console.log(`${key}: ${value}`);
  }
}
