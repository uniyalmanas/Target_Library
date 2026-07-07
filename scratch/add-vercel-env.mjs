import { execSync } from "child_process";

const supabaseUrl = "https://yokxobybxdhmqijnipyx.supabase.co";
const supabaseKey = "sb_publishable_eFb_J4TDzQqY6UTjUsX5og_UKrcJqa3";

const commands = [
  // URL Preview & Dev
  `echo "${supabaseUrl}" | npx vercel env add NEXT_PUBLIC_SUPABASE_URL preview`,
  `echo "${supabaseUrl}" | npx vercel env add NEXT_PUBLIC_SUPABASE_URL development`,
  
  // Publishable Key for all environments
  `echo "${supabaseKey}" | npx vercel env add NEXT_PUBLIC_SUPABASE_PUBLISHABLE_KEY production`,
  `echo "${supabaseKey}" | npx vercel env add NEXT_PUBLIC_SUPABASE_PUBLISHABLE_KEY preview`,
  `echo "${supabaseKey}" | npx vercel env add NEXT_PUBLIC_SUPABASE_PUBLISHABLE_KEY development`,
];

console.log("Configuring Vercel Environment Variables...");

commands.forEach((cmd) => {
  try {
    console.log(`Running: ${cmd}`);
    const output = execSync(cmd, { encoding: "utf-8" });
    console.log(output);
  } catch (err) {
    console.error(`Command failed: ${cmd}`);
    console.error(err.stdout || err.stderr || err.message);
  }
});

console.log("Environment variables configuration complete.");
