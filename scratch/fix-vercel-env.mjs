import { spawn, execSync } from "child_process";

const supabaseUrl = "https://yokxobybxdhmqijnipyx.supabase.co";
const supabaseKey = "sb_publishable_eFb_J4TDzQqY6UTjUsX5og_UKrcJqa3";

const envs = ["production", "preview", "development"];
const vars = ["NEXT_PUBLIC_SUPABASE_URL", "NEXT_PUBLIC_SUPABASE_PUBLISHABLE_KEY"];

// First, delete all existing variables
console.log("Removing bad environment variables from Vercel...");
for (const v of vars) {
  for (const env of envs) {
    try {
      console.log(`Removing ${v} from ${env}...`);
      execSync(`npx vercel env rm ${v} ${env} -y`, { stdio: "inherit" });
    } catch (err) {
      console.log(`Could not remove ${v} from ${env} (might not exist):`, err.message);
    }
  }
}

// Next, add them cleanly
function addEnv(name, value, environment) {
  return new Promise((resolve, reject) => {
    // We trim the value to ensure no trailing newline/whitespace
    const trimmedValue = value.trim();
    const child = spawn("npx", ["vercel", "env", "add", name, environment], {
      shell: true,
    });

    child.stdin.write(trimmedValue);
    child.stdin.end();

    let output = "";
    child.stdout.on("data", (data) => {
      output += data.toString();
    });
    child.stderr.on("data", (data) => {
      output += data.toString();
    });

    child.on("close", (code) => {
      if (code === 0) {
        resolve(output);
      } else {
        reject(new Error(`Exit code ${code}: ${output}`));
      }
    });
  });
}

async function run() {
  console.log("\nRe-adding clean environment variables to Vercel...");
  for (const env of envs) {
    try {
      console.log(`Adding NEXT_PUBLIC_SUPABASE_URL to ${env}...`);
      const res = await addEnv("NEXT_PUBLIC_SUPABASE_URL", supabaseUrl, env);
      console.log(res);

      console.log(`Adding NEXT_PUBLIC_SUPABASE_PUBLISHABLE_KEY to ${env}...`);
      const res2 = await addEnv("NEXT_PUBLIC_SUPABASE_PUBLISHABLE_KEY", supabaseKey, env);
      console.log(res2);
    } catch (err) {
      console.error("Failed to add variable:", err.message);
    }
  }
  console.log("Environment variable configuration fix complete!");
}

run();
