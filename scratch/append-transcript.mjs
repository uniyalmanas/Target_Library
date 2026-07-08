import fs from "fs";
import path from "path";

const logPath = "C:\\Users\\uniya\\.gemini\\antigravity-cli\\brain\\023c08e2-6775-4f74-94a0-c973992e974a\\.system_generated\\logs\\transcript.jsonl";
const reportPath = "D:\\library-ms\\library-ms\\progress_report.md";

async function run() {
  console.log("Reading conversation log...");
  if (!fs.existsSync(logPath)) {
    console.error(`Log file not found at: ${logPath}`);
    return;
  }

  const logLines = fs.readFileSync(logPath, "utf-8").split("\n");
  let formattedTranscript = "\n\n## 💬 Full Conversation & Context Log\n\nBelow is the complete sequence of user requests and model solutions from this session:\n\n";

  let stepNumber = 1;
  logLines.forEach((line) => {
    if (!line.trim()) return;
    try {
      const step = JSON.parse(line);
      const source = step.source;
      const type = step.type;
      
      // Parse User Input
      if (type === "USER_INPUT") {
        formattedTranscript += `### 👤 Step ${stepNumber} — User Request\n`;
        formattedTranscript += `> ${step.content.trim()}\n\n`;
        stepNumber++;
      }
      
      // Parse Planner Response
      if (type === "PLANNER_RESPONSE" || (source === "MODEL" && step.content)) {
        // Strip out system tool call markdown if present or clean it up
        let content = step.content || "";
        // If content is just tools, skip or simplify
        if (content.trim()) {
          formattedTranscript += `### 🤖 Step ${stepNumber - 1} — Assistant Response\n`;
          formattedTranscript += `${content.trim()}\n\n---\n\n`;
        }
      }
    } catch (err) {
      // Skip invalid JSON lines
    }
  });

  console.log("Appending transcript to progress_report.md...");
  let reportContent = fs.readFileSync(reportPath, "utf-8");
  
  // Strip any old transcript header if running again
  const splitIndex = reportContent.indexOf("## 💬 Full Conversation");
  if (splitIndex !== -1) {
    reportContent = reportContent.substring(0, splitIndex);
  }

  fs.writeFileSync(reportPath, reportContent + formattedTranscript, "utf-8");
  console.log("Transcript successfully appended to progress report!");
}

run();
