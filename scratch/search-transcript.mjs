import fs from "fs";
import path from "path";

const logPath = "C:/Users/uniya/.gemini/antigravity-cli/brain/023c08e2-6775-4f74-94a0-c973992e974a/.system_generated/logs/transcript.jsonl";

if (fs.existsSync(logPath)) {
  const content = fs.readFileSync(logPath, "utf-8");
  const lines = content.split("\n").filter(Boolean);
  console.log(`Searching ${lines.length} lines in transcript...`);
  
  const keywords = ["password", "key", "url", "sb_publishable", "supabase", "migration", "yokxobybxdhmqijnipyx", "env"];
  
  lines.forEach((line, idx) => {
    try {
      const step = JSON.parse(line);
      const str = JSON.stringify(step).toLowerCase();
      const matches = keywords.filter(kw => str.includes(kw));
      if (matches.length > 0) {
        // Log basic step info
        console.log(`\n--- Match on Step ${step.step_index || idx} (Type: ${step.type}) ---`);
        console.log(`Matches keywords: ${matches.join(", ")}`);
        
        // Print snippet of content or tool calls
        if (step.tool_calls) {
          console.log("Tool calls:", JSON.stringify(step.tool_calls).substring(0, 300));
        }
        if (step.content) {
          console.log("Content:", step.content.substring(0, 300));
        }
      }
    } catch (e) {
      // not JSON
    }
  });
} else {
  console.log("Transcript file does not exist.");
}
