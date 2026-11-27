import { execFileSync } from "node:child_process";
import { readFileSync } from "node:fs";
import { posix } from "node:path";
import process from "node:process";

/**
 * Fails when the npm tarball is missing a file consumers or coding agents rely
 * on, ships a contributor-only doc, or has an llms.txt link that does not
 * resolve inside it. `check-package-contents.sh` covers extra files, tests and
 * the privacy denylist; this covers what it cannot: missing files.
 */
const REPO_BLOB = "https://github.com/vllnt/convex-flags/blob/";

/** Docs shipped for coding agents, plus the standard package files. */
const DOCS = ["package.json", "README.md", "LICENSE", "CHANGELOG.md", "llms.txt", "docs/API.md"];

/** Contributor or internal docs that a widened `files` entry could ship. */
const FORBIDDEN = [
  /^(AGENTS|CLAUDE|ROADMAP|CONTRIBUTING|SECURITY|CODE_OF_CONDUCT)\.md$/,
  /^(example|scripts|\.github|\.claude)\//,
  /^docs\/(?!API\.md$)/,
];

/** @param {unknown} node @returns {string[]} every path string under an `exports` node */
const exportTargets = (node) =>
  typeof node === "string"
    ? [node]
    : typeof node === "object" && node !== null
      ? Object.values(node).flatMap(exportTargets)
      : [];

/** @type {{ exports?: unknown }} */
const metadata = JSON.parse(readFileSync("package.json", "utf8"));
const required = new Set([
  ...DOCS,
  ...exportTargets(metadata.exports).map((target) => posix.normalize(target)),
]);

/** @type {[{ files: Array<{ path: string }> }]} */
const [pack] = JSON.parse(
  execFileSync("npm", ["pack", "--dry-run", "--json", "--ignore-scripts"], {
    encoding: "utf8",
    stdio: ["ignore", "pipe", "inherit"],
  }),
);
const packed = new Set(pack.files.map((file) => file.path));

/** @type {string[]} */
const problems = [];
for (const path of required)
  if (!packed.has(path)) problems.push(`missing from tarball: ${path}`);
for (const path of packed)
  if (FORBIDDEN.some((pattern) => pattern.test(path)))
    problems.push(`must not ship: ${path}`);

const links = [
  ...readFileSync("llms.txt", "utf8").matchAll(/\]\(([^)\s]+)\)/g),
].map((match) => match[1]);
for (const link of links) {
  if (link.startsWith(REPO_BLOB)) {
    const path = link.slice(REPO_BLOB.length).split("/").slice(1).join("/");
    if (packed.has(path))
      problems.push(`llms.txt links shipped ${path} by URL, use ./${path}`);
  } else if (!/^[a-z][a-z\d+.-]*:/i.test(link) && !link.startsWith("#")) {
    if (!packed.has(posix.normalize(link.split("#")[0])))
      problems.push(`llms.txt link not in tarball: ${link}`);
  }
}

if (problems.length > 0) {
  for (const problem of problems) console.error(`FAIL ${problem}`);
  process.exit(1);
}
console.log(
  `OK    package: ${packed.size} files, ${required.size} required present, ${links.length} llms.txt links checked`,
);
