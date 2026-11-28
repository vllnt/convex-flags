import { execFileSync } from "node:child_process";
import {
  existsSync,
  mkdtempSync,
  readFileSync,
  rmSync,
  writeFileSync,
} from "node:fs";
import { tmpdir } from "node:os";
import { join, posix } from "node:path";
import process from "node:process";

import {
  checkDocumentation,
  convexHost,
  writeHost,
} from "./check-documentation.mjs";

/**
 * Fails when the npm tarball is missing a file consumers or coding agents rely
 * on, ships a contributor-only doc, or has an llms.txt link that does not
 * resolve inside it. `check-package-contents.sh` covers extra files, tests and
 * the privacy denylist; this covers what it cannot: missing files.
 *
 * Then installs the packed tarball in one temporary app (removed afterwards),
 * checks the docs contract (`scripts/check-documentation.mjs`), type-checks the
 * README examples and runs the README test example, and type-checks the entry
 * points under Bundler and NodeNext. Run after `pnpm build`: `pnpm test:package`.
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

function checkContents() {
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
}

/** Lowest supported versions: the convex peer floor and React 18. */
const CONSUMER_DEPENDENCIES = [
  "convex@1.45.0",
  "react@18.3.1",
  "@types/react@18.3.31",
  "typescript@5.9.3",
  "convex-test@0.0.56",
  "vite@8.2.2",
  "@types/node@22.20.2",
  "vitest@5.1.1",
  "@edge-runtime/vm@5.0.0",
];

/** @param {string[]} files @param {string[]} [extra] */
const tscArguments = (files, extra = []) => [
  "exec",
  "tsc",
  "--noEmit",
  "--strict",
  "--target",
  "ES2022",
  ...extra,
  ...files,
];
const BUNDLER = ["--module", "ESNext", "--moduleResolution", "Bundler"];
const NODENEXT = ["--module", "NodeNext", "--moduleResolution", "NodeNext"];

/** Imports every entry point; type-checked under Bundler and NodeNext. */
const ENTRY_POINTS = `
import { Flags } from "@vllnt/convex-flags";
import type { ComponentApi } from "@vllnt/convex-flags/_generated/component.js";
import config from "@vllnt/convex-flags/convex.config.js";
import { useFlag, useFlags } from "@vllnt/convex-flags/react";
import { defineApp } from "convex/server";
declare const component: ComponentApi;
const client = new Flags(component);
const app = defineApp(); app.use(config);
void client; void app; void useFlag; void useFlags;
`;

/** The `./test` helper is TypeScript source: it must compile for consumers too. */
const REGISTRATION = `
import { register } from "@vllnt/convex-flags/test";
import { convexTest } from "convex-test";
import { defineSchema, defineTable } from "convex/server";
import { v } from "convex/values";
const host = defineSchema({ unrelated: defineTable({ label: v.string() }) });
register(convexTest(host, {}), "custom");
`;

function checkConsumer() {
  const root = process.cwd();
  /** @type {{ name: string, version: string }} */
  const metadata = JSON.parse(readFileSync("package.json", "utf8"));
  const tarball = `${metadata.name.replace("@", "").replace("/", "-")}-${metadata.version}.tgz`;
  const temporary = mkdtempSync(join(tmpdir(), "flags-consumer-"));
  /** @param {string} command @param {string[]} arguments_ @param {string} [cwd] */
  const run = (command, arguments_, cwd = temporary) =>
    execFileSync(command, arguments_, { cwd, stdio: "inherit" });
  try {
    run("pnpm", ["pack", "--pack-destination", temporary], root);
    writeFileSync(
      join(temporary, "package.json"),
      JSON.stringify({
        pnpm: { ignoredBuiltDependencies: ["esbuild"] },
        private: true,
        type: "module",
      }),
    );
    // pnpm 11 reads the build-script policy from the workspace file, pnpm 10 from package.json.
    // The same 7-day release-age gate as the repo: this also runs in the publish jobs.
    writeFileSync(
      join(temporary, "pnpm-workspace.yaml"),
      "allowBuilds:\n  esbuild: false\nminimumReleaseAge: 10080\n",
    );
    run("pnpm", ["add", join(temporary, tarball), ...CONSUMER_DEPENDENCIES]);
    // Agents read the bundled docs from node_modules, so they must ship and resolve.
    const installed = join(temporary, "node_modules", metadata.name);
    const missing = DOCS.filter((file) => !existsSync(join(installed, file)));
    if (missing.length > 0)
      throw new Error(`tarball is missing ${missing.join(", ")}`);
    // Docs contract, then README examples compile and run against the packed package.
    const examples = checkDocumentation(installed, temporary);
    console.log("OK    documentation contract");
    const hostFiles = writeHost(
      temporary,
      convexHost(installed, examples),
      examples,
    );
    run(
      "pnpm",
      tscArguments(hostFiles, [
        ...BUNDLER,
        "--jsx",
        "react-jsx",
        "--types",
        "vite/client,node",
      ]),
    );
    console.log("OK    README examples and docs/API.md signatures type-check");
    // The README's own vitest.config.mts runs its test example.
    run("pnpm", ["exec", "vitest", "run"]);
    writeFileSync(join(temporary, "consumer.ts"), ENTRY_POINTS);
    run("pnpm", tscArguments(["consumer.ts"], BUNDLER));
    run("pnpm", tscArguments(["consumer.ts"], NODENEXT));
    writeFileSync(join(temporary, "registration.ts"), REGISTRATION);
    run(
      "pnpm",
      tscArguments(
        ["registration.ts"],
        [...BUNDLER, "--types", "vite/client,node"],
      ),
    );
    run(
      "pnpm",
      tscArguments(["registration.ts"], [...NODENEXT, "--types", "node"]),
    );
    run("node", [
      "--input-type=module",
      "-e",
      'import { Flags } from "@vllnt/convex-flags"; import config from "@vllnt/convex-flags/convex.config.js"; import { useFlag, useFlags } from "@vllnt/convex-flags/react"; if (!Flags || !config || !useFlag || !useFlags) throw Error("missing export");',
    ]);
    console.log("OK    packed package consumer checks");
  } finally {
    rmSync(temporary, { force: true, recursive: true });
  }
}

checkContents();
checkConsumer();
