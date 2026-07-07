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

console.log(`Scanning through ${allFiles.length} files for invalid tailwind color classes...`);

const regex = /-(emerald|rose|amber|blue|indigo|neutral|zinc|slate)-(\d{3})/g;

allFiles.forEach((file) => {
  if (file.endsWith(".tsx") || file.endsWith(".ts")) {
    const content = fs.readFileSync(file, "utf-8");
    let match;
    const lines = content.split("\n");
    lines.forEach((line, idx) => {
      while ((match = regex.exec(line)) !== null) {
        const colorVal = parseInt(match[2]);
        if (colorVal % 100 !== 0) {
          console.log(`File: ${file} (Line ${idx + 1}): Found invalid color class ${match[0]} in: "${line.trim()}"`);
        }
      }
    });
  }
});
