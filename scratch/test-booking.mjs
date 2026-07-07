import { createClient } from "@supabase/supabase-js";
import fs from "fs";
import path from "path";
import { fileURLToPath } from "url";

// Manually parse .env.local
const __dirname = path.dirname(fileURLToPath(import.meta.url));
const envPath = path.resolve(__dirname, "../.env.local");
const envContent = fs.readFileSync(envPath, "utf-8");

const env = {};
envContent.split("\n").forEach((line) => {
  const parts = line.split("=");
  if (parts.length >= 2) {
    env[parts[0].trim()] = parts.slice(1).join("=").trim();
  }
});

const supabaseUrl = env.NEXT_PUBLIC_SUPABASE_URL;
const supabaseKey = env.NEXT_PUBLIC_SUPABASE_PUBLISHABLE_KEY;

const supabase = createClient(supabaseUrl, supabaseKey);

async function run() {
  console.log("Simulating new member creation...");
  const { data: newMember, error: memberError } = await supabase
    .from("members")
    .insert({ name: "Test Student", phone: "1234567890" })
    .select()
    .single();

  if (memberError) {
    console.error("Member creation failed:", memberError);
    return;
  }
  console.log("Member created successfully:", newMember);

  console.log("Simulating receipt creation for seat 1...");
  const today = new Date().toISOString().split("T")[0];
  const { data: receipt, error: receiptError } = await supabase
    .from("receipts")
    .insert({
      student_id: newMember.student_id,
      seat_id: 1, // Seat 1 should exist
      subscription_type: "full_day",
      has_sheet: false,
      amount_paid: 900,
      start_date: today,
      end_date: today,
    })
    .select()
    .single();

  if (receiptError) {
    console.error("Receipt creation failed:", receiptError);
  } else {
    console.log("Receipt created successfully:", receipt);
  }

  // Clean up test data
  console.log("Cleaning up test data...");
  if (receipt) {
    await supabase.from("receipts").delete().eq("receipt_no", receipt.receipt_no);
  }
  await supabase.from("members").delete().eq("student_id", newMember.student_id);
  console.log("Cleanup done.");
}

run();
