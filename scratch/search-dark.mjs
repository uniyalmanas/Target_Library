import fs from "fs";
import path from "path";

const targetDirs = ["D:/library-ms/library-ms/app", "D:/library-ms/library-ms/lib"];

function walk(dir) {
  let results = [];
  const list = fs.readdirSync(dir);
  list.forEach((file) => {
    const fullPath = path.join(dir, file);
    const stat = fs.statSync(fullPath);
    if (stat && stat.isDirectory()) {
      results = results.concat(walk(fullPath));
    } else {
      results.push(fullPath);
    }
  });
  return results;
}

const allFiles = targetDirs.flatMap((dir) => (fs.existsSync(dir) ? walk(dir) : []));

console.log(`Searching through ${allFiles.length} files...`);

allFiles.forEach((file) => {
  if (file.endsWith(".tsx") || file.endsWith(".ts") || file.endsWith(".css")) {
    const content = fs.readFileSync(file, "utf-8");
    if (content.includes("dark")) {
      console.log(`File: ${file}`);
      const lines = content.split("\n");
      lines.forEach((line, idx) => {
        if (line.includes("dark") && !line.includes("dark:") && !line.includes("svg") && !line.includes("path")) {
          console.log(`  Line ${idx + 1}: ${line.trim()}`);
        }
      });
    }
  }
});
