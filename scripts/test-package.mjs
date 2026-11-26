import { execFileSync } from "node:child_process";
import { readFileSync } from "node:fs";
import { posix } from "node:path";
import process from "node:process";

/** Files a consumer or coding agent expects inside the installed package. */
const REQUIRED = [
  "package.json",
  "README.md",
  "LICENSE",
  "CHANGELOG.md",
  "llms.txt",
  "docs/API.md",
  "dist/client/index.js",
  "dist/client/index.d.ts",
];

/** Contributor-only paths that must never ship. */
const FORBIDDEN = [
  /^(AGENTS|CLAUDE|ROADMAP|CONTRIBUTING|SECURITY|CODE_OF_CONDUCT)\.md$/,
  /^(example|scripts|\.github|\.claude)\//,
  /^docs\/(?!API\.md$)/,
  /\.(test|spec)\./,
];

/** @type {unknown} */
const metadata = JSON.parse(readFileSync("package.json", "utf8"));
if (
  typeof metadata !== "object" ||
  metadata === null ||
  !("repository" in metadata) ||
  typeof metadata.repository !== "object" ||
  metadata.repository === null ||
  !("url" in metadata.repository) ||
  typeof metadata.repository.url !== "string"
)
  throw new Error("package.json needs repository.url");
const blobPrefix = `${metadata.repository.url}/blob/`;

/** @type {unknown} */
const [pack] = JSON.parse(
  execFileSync("npm", ["pack", "--dry-run", "--json", "--ignore-scripts"], {
    encoding: "utf8",
    stdio: ["ignore", "pipe", "inherit"],
  }),
);
if (
  typeof pack !== "object" ||
  pack === null ||
  !("files" in pack) ||
  !Array.isArray(pack.files)
)
  throw new Error("unexpected npm pack output");
const packed = new Set(
  pack.files.map((/** @type {{ path: string }} */ file) => file.path),
);

/** @type {string[]} */
const problems = [];
for (const path of REQUIRED)
  if (!packed.has(path)) problems.push(`missing from tarball: ${path}`);
for (const path of packed)
  if (FORBIDDEN.some((pattern) => pattern.test(path)))
    problems.push(`must not ship: ${path}`);

const links = [
  ...readFileSync("llms.txt", "utf8").matchAll(/\]\(([^)\s]+)\)/g),
].map((match) => match[1]);
for (const link of links) {
  if (link.startsWith(blobPrefix)) {
    const path = link.slice(blobPrefix.length).split("/").slice(1).join("/");
    if (packed.has(path))
      problems.push(`llms.txt links shipped ${path} by URL, use ./${path}`);
  } else if (!/^[a-z][a-z\d+.-]*:/i.test(link) && !link.startsWith("#")) {
    const path = posix.normalize(link.split("#")[0]);
    if (!packed.has(path))
      problems.push(`llms.txt link not in tarball: ${link}`);
  }
}

if (problems.length > 0) {
  for (const problem of problems) console.error(`FAIL ${problem}`);
  process.exit(1);
}
console.log(
  `OK    package: ${packed.size} files, ${REQUIRED.length} required present, ${links.length} llms.txt links checked`,
);
