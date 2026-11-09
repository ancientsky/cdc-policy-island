import { spawnSync } from "node:child_process";
import { dirname, join } from "node:path";
import { fileURLToPath } from "node:url";

const script = join(dirname(fileURLToPath(import.meta.url)), "subset-fonts.py");
const probe = [
  "import sys, fontTools, cffsubr",
  "flags = getattr(sys, 'abiflags', '')",
  "bad = 'free-threading' in sys.version.lower() or str(flags).endswith('t')",
  "raise SystemExit(1 if bad else 0)",
].join("; ");

function works(command, args) {
  const run = spawnSync(command, [...args, "-c", probe], { windowsHide: true, encoding: "utf-8" });
  return run.status === 0;
}

function pyTags() {
  if (process.platform !== "win32") return [];
  const listed = spawnSync("py", ["-0p"], { windowsHide: true, encoding: "utf-8" });
  const text = `${listed.stdout || ""}\n${listed.stderr || ""}`;
  const tags = [];
  for (const line of text.split(/\r?\n/)) {
    const match = line.match(/-V:(\S+)/);
    if (!match) continue;
    const tag = match[1];
    if (/t$/i.test(tag)) continue;
    tags.push(tag);
  }
  return tags;
}

const candidates = [];
if (process.env.PYTHON) candidates.push([process.env.PYTHON, []]);
candidates.push(["python3", []], ["python", []]);
for (const tag of pyTags()) candidates.push(["py", [`-${tag}`]]);

for (const [command, args] of candidates) {
  if (!works(command, args)) continue;
  const run = spawnSync(command, [...args, script], { stdio: "inherit", windowsHide: true });
  process.exit(run.status === null ? 1 : run.status);
}

console.error("No CPython with fontTools and cffsubr. Install them, or set PYTHON to that interpreter.");
process.exit(1);
