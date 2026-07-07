import fs from "fs";

const historyPath = "C:/Users/uniya/.gemini/antigravity-cli/history.jsonl";

if (fs.existsSync(historyPath)) {
  const content = fs.readFileSync(historyPath, "utf-8");
  const lines = content.split("\n").filter(Boolean);
  console.log(`First 10 lines:`);
  lines.slice(0, 10).forEach((line) => {
    console.log(line);
  });
} else {
  console.log("History file does not exist.");
}
