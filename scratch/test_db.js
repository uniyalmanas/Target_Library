const { createClient } = require("@supabase/supabase-js");
const fs = require("fs");
const path = require("path");

// Manually parse .env.local
const envPath = path.join(__dirname, "../.env.local");
let supabaseUrl = "";
let supabaseKey = "";

if (fs.existsSync(envPath)) {
  const envContent = fs.readFileSync(envPath, "utf-8");
  envContent.split("\n").forEach((line) => {
    const parts = line.split("=");
    if (parts.length >= 2) {
      const key = parts[0].trim();
      const val = parts[1].trim().replace(/['"]/g, "");
      if (key === "NEXT_PUBLIC_SUPABASE_URL") supabaseUrl = val;
      if (key === "NEXT_PUBLIC_SUPABASE_PUBLISHABLE_KEY") supabaseKey = val;
    }
  });
}

if (!supabaseUrl || !supabaseKey) {
  console.error("Missing Supabase credentials in .env.local");
  process.exit(1);
}

const supabase = createClient(supabaseUrl, supabaseKey);

async function checkReceipts() {
  const { data: receipts, error } = await supabase
    .from("receipts")
    .select("receipt_no, amount_paid, start_date, end_date");

  if (error) {
    console.error("Error fetching receipts:", error);
    return;
  }

  console.log(`Total receipts found: ${receipts.length}`);
  let sum = 0;
  receipts.forEach((r) => {
    sum += Number(r.amount_paid);
    console.log(`Receipt #${r.receipt_no}: Rs ${r.amount_paid} (Start: ${r.start_date}, End: ${r.end_date})`);
  });
  console.log(`Calculated Sum: Rs ${sum}`);
}

checkReceipts();
