// Agent-first documentation contract, ported from @vllnt/convex-buckets via
// @vllnt/convex-events.
// test-package.mjs runs it on the installed tarball: what consumers receive.
import assert from "node:assert/strict";
import {
  existsSync,
  mkdirSync,
  readdirSync,
  readFileSync,
  writeFileSync,
} from "node:fs";
import { dirname, join } from "node:path";

import ts from "typescript";

/** README `##` sections, in this order, in every @vllnt package. */
export const SECTIONS = [
  "For coding agents",
  "When to use",
  "Install",
  "Quick start",
  "API",
  "Common tasks",
  "Errors and fixes",
  "Limits and gotchas",
  "Compatibility",
  "Testing",
  "Security",
  "Related packages",
  "Contributing",
  "Links",
  "License",
];
const FIRST_LINES = 40;
const OSS = "https://oss.vllnt.com";

/**
 * @typedef {{ code: string, lang: string, line: number }} Block
 * @typedef {{ lang: string, line: number, lines: string[] }} OpenBlock
 * @typedef {{ body: string, line: number, name: string }} Section
 * @typedef {{ name: string, target: ts.Symbol }} Export
 * @typedef {{ checker: ts.TypeChecker, entry: string, symbols: Export[] }} Entry
 * @typedef {{ headings: Set<string>, table: string }} Documented
 * @typedef {string | { url?: unknown }} Repository
 */

/** @param {string} name package name without the scope */
export const footer = (name) =>
  `---\n\nPart of [vllnt open source](${OSS}) · [Package page](${OSS}/packages/${name}) · [vllnt.com](https://vllnt.com) · Built by [bntvllnt](https://bntvllnt.com)\n`;

/** @param {string} name package name without the scope */
export const ecosystem = (name) =>
  [
    "## Ecosystem\n",
    `- [Package page](${OSS}/packages/${name})`,
    `- [Release feed](${OSS}/packages/${name}/rss.xml)`,
    `- [All @vllnt packages](${OSS}/llms.txt)`,
    "- [Search vllnt packages and docs](https://index.vllnt.com)",
    "- [vllnt](https://vllnt.com/llms.txt)",
    "- [Author](https://bntvllnt.com)\n",
  ].join("\n");

/**
 * Body of the README `## Links` section.
 * @param {string} name package name without the scope
 * @param {string} repository GitHub repository URL without `.git`
 */
export const links = (name, repository) =>
  [
    `- Docs and changelog: [oss.vllnt.com/packages/${name}](${OSS}/packages/${name}) · [release feed](${OSS}/packages/${name}/rss.xml)`,
    `- All @vllnt packages: [oss.vllnt.com](${OSS}) · [search packages and docs on index.vllnt.com](https://index.vllnt.com)`,
    `- Source and issues: [GitHub](${repository}) · [issues](${repository}/issues) · [npm](https://www.npmjs.com/package/@vllnt/${name})`,
    "- Questions and updates: [Discord](https://bntvllnt.com/discord) · [X @bntvllnt](https://x.com/bntvllnt)",
    "- Company and author: [vllnt.com](https://vllnt.com) · [bntvllnt.com](https://bntvllnt.com) · [GitHub @bntvllnt](https://github.com/bntvllnt) · [LinkedIn](https://linkedin.com/in/bntvllnt)",
    "- Sponsor: [GitHub Sponsors](https://github.com/sponsors/bntvllnt)",
  ].join("\n");

/** GitHub heading anchor. @param {string} heading */
export const slug = (heading) =>
  heading
    .trim()
    .toLowerCase()
    .replaceAll(/[^\p{L}\p{N}\s_-]/gu, "")
    .replaceAll(/\s/gu, "-");

/** Heading anchors, skipping `#` lines in code blocks. @param {string} text @returns {Set<string>} */
function anchors(text) {
  /** @type {Map<string, number>} */
  const seen = new Map();
  const headings = linesOutsideCode(text).flatMap(
    ({ content }) => /^#{1,6}\s+(.+)$/u.exec(content)?.slice(1) ?? [],
  );
  return new Set(
    headings.map((heading) => {
      const base = slug(heading);
      const count = seen.get(base) ?? 0;
      seen.set(base, count + 1);
      return count === 0 ? base : `${base}-${String(count)}`;
    }),
  );
}

/** Fenced code blocks with 1-based start lines. @param {string} text */
export function codeBlocks(text) {
  /** @type {{ blocks: Block[], open: OpenBlock | undefined }} */
  const start = { blocks: [], open: undefined };
  const state = text.split("\n").reduce((current, line, index) => {
    if (!line.startsWith("```")) {
      current.open?.lines.push(line);
      return current;
    }
    if (current.open === undefined) {
      const open = { lang: line.slice(3).trim(), line: index + 1, lines: [] };
      return { ...current, open };
    }
    const { lang, line: at, lines } = current.open;
    const block = { code: lines.join("\n"), lang, line: at };
    return { blocks: [...current.blocks, block], open: undefined };
  }, start);
  assert.equal(state.open, undefined, "unclosed code block");
  return state.blocks;
}

/** Lines outside code blocks with 1-based line numbers. @param {string} text */
function linesOutsideCode(text) {
  const inCode = new Set(
    codeBlocks(text).flatMap(({ code, line }) =>
      Array.from(
        { length: code.split("\n").length + 2 },
        (_, offset) => line + offset,
      ),
    ),
  );
  return text
    .split("\n")
    .map((content, index) => ({ content, line: index + 1 }))
    .filter(({ line }) => !inCode.has(line));
}

/** `##` sections outside code blocks. @param {string} text @returns {Section[]} */
function sections(text) {
  const lines = text.split("\n");
  const heads = linesOutsideCode(text).filter(({ content }) =>
    content.startsWith("## "),
  );
  return heads.map((head, index) => ({
    body: lines
      .slice(head.line, (heads[index + 1]?.line ?? lines.length + 1) - 1)
      .join("\n"),
    line: head.line,
    name: head.content.slice(3).trim(),
  }));
}

/** @param {string} directory */
const filesUnder = (directory) =>
  readdirSync(directory, { recursive: true, withFileTypes: true })
    .filter((entry) => entry.isFile())
    .map((entry) => join(entry.parentPath, entry.name));

/** @param {Section[]} parts @param {string} name */
function section(parts, name) {
  const found = parts.find((part) => part.name === name);
  assert.ok(found, `README has no section ${name}`);
  return found;
}

/** Title, fixed sections in order, no empty section, short agent note. @param {string} readme @param {string} packageName */
function checkStructure(readme, packageName) {
  assert.ok(
    readme.startsWith(`# ${packageName}\n\n`),
    "README starts with # <package name> and one sentence",
  );
  const intro = readme.split("\n\n")[1] ?? "";
  const stops = intro.match(/[!.?](?=\s|$)/gu) ?? [];
  assert.ok(stops.length === 1 && /[!.?]$/u.test(intro), "title: one sentence");
  const parts = sections(readme);
  assert.deepEqual(
    parts.map(({ name }) => name),
    SECTIONS,
    "README ## sections must be SECTIONS, in order",
  );
  parts.forEach((part) => {
    assert.ok(
      part.body.trim().length > 0,
      `section ${part.name} is empty; say in one line why it does not apply`,
    );
  });
  const note = section(parts, "For coding agents").body.trim();
  assert.ok(note.split("\n").length <= 3, "For coding agents: 3 lines at most");
  return parts;
}

/** 2-4 "Use it when" bullets, then 1-3 "Do not use it" bullets naming the alternative. @param {Section[]} parts */
function checkWhenToUse(parts) {
  const bullets = section(parts, "When to use")
    .body.replaceAll(/\n {2,}/gu, " ")
    .split("\n")
    .filter((line) => line.startsWith("- "));
  const use = bullets.filter((line) => line.startsWith("- Use it when "));
  const avoid = bullets.filter((line) =>
    line.startsWith("- Do not use it when "),
  );
  assert.ok(use.length >= 2 && use.length <= 4, "2 to 4 'Use it when' bullets");
  assert.ok(
    avoid.length > 0 && avoid.length <= 3,
    "1 to 3 'Do not use it when'",
  );
  assert.deepEqual(bullets, [...use, ...avoid], "'Use it when' bullets first");
  avoid.forEach((line) => {
    assert.match(line, /`[^`]+`/u, "'Do not use it' names the better choice");
  });
}

/** Install and first example near the top; badges below Quick start. @param {string} readme @param {string} packageName */
function checkTop(readme, packageName) {
  const lines = readme.split("\n");
  const name = packageName.replaceAll(/[$()*+./?[\\\]^{|}]/gu, String.raw`\$&`);
  const pattern = new RegExp(String.raw`\b(?:add|install)\s+${name}\b`, "u");
  const install = lines.findIndex((line) => pattern.test(line));
  assert.ok(install !== -1 && install < FIRST_LINES, "install near the top");
  const quick = section(sections(readme), "Quick start").line;
  const example = codeBlocks(readme).find((block) => block.line > quick);
  assert.ok(example && example.line <= FIRST_LINES, "example near the top");
  lines.forEach((line, index) => {
    if (/img\.shields\.io|badge\.svg/u.test(line))
      assert.ok(index + 1 > quick, "badges go below Quick start");
  });
}

/** Every block tagged and without `...` gaps; README `ts`/`tsx` blocks placed by path. @param {Record<string, string>} texts */
function checkCode(texts) {
  const gap = /^\s*(?:\/\/\s*)?(?:\.\.\.|…)\s*$/mu;
  Object.entries(texts).forEach(([file, text]) => {
    codeBlocks(text).forEach((block) => {
      const where = `${file}:${String(block.line)}`;
      assert.ok(block.lang, `${where} has no language`);
      assert.doesNotMatch(block.code, gap, `${where} has a ... gap`);
    });
  });
  return codeBlocks(String(texts["README.md"]))
    .filter((block) => block.lang === "ts" || block.lang === "tsx")
    .map((block) => {
      const where = `README.md:${String(block.line)}`;
      const path = /^\/\/ (\S+\.(?:m?ts|tsx))\n/u.exec(block.code)?.[1];
      assert.ok(path, `${where} must start with a // <path>.ts comment`);
      return { code: block.code, path };
    });
}

/** Relative links and their anchors resolve inside the package. @param {string} installed @param {Record<string, string>} texts */
function checkLinks(installed, texts) {
  Object.entries(texts).forEach(([file, text]) => {
    const links = text.matchAll(/\]\((?!https?:|mailto:)([^)\s]+)\)/gu);
    [...links].forEach((match) => {
      const link = String(match[1]);
      const [target = "", anchor] = link.split("#");
      const here = join(installed, file);
      const resolved = target ? join(dirname(here), target) : here;
      assert.ok(existsSync(resolved), `${file}: ${link} does not resolve`);
      if (anchor !== undefined) {
        const found = anchors(readFileSync(resolved, "utf8")).has(anchor);
        assert.ok(found, `${file}: ${link} has no such anchor`);
      }
    });
  });
}

/** @param {string} consumer @param {string} packageName @param {string[]} entries */
function probe(consumer, packageName, entries) {
  const file = join(consumer, "documentation-probe.ts");
  const imports = entries.map(
    (key, index) =>
      `import * as e${String(index)} from "${packageName}${key.slice(1)}";`,
  );
  writeFileSync(file, imports.join("\n"));
  const program = ts.createProgram([file], {
    module: ts.ModuleKind.ESNext,
    moduleResolution: ts.ModuleResolutionKind.Bundler,
    noEmit: true,
    skipLibCheck: true,
    target: ts.ScriptTarget.ES2022,
    types: [],
  });
  const source = program.getSourceFile(file);
  assert.ok(source, "the export probe did not compile");
  return { checker: program.getTypeChecker(), source };
}

/** Public exports of each entry point, from the installed types. @param {string} consumer @param {string} packageName @param {string[]} entries @returns {Entry[]} */
function exportsOf(consumer, packageName, entries) {
  const { checker, source } = probe(consumer, packageName, entries);
  const statements = source.statements.filter((node) =>
    ts.isImportDeclaration(node),
  );
  return statements.map((statement, index) => {
    const entry = String(entries[index]);
    const module = checker.getSymbolAtLocation(statement.moduleSpecifier);
    assert.ok(module, `cannot resolve ${entry}`);
    const symbols = checker.getExportsOfModule(module).map((symbol) => ({
      name: symbol.name,
      target:
        symbol.flags & ts.SymbolFlags.Alias
          ? checker.getAliasedSymbol(symbol)
          : symbol,
    }));
    assert.ok(symbols.length > 0, `${entry} exports nothing`);
    return { checker, entry, symbols };
  });
}

/** @param {ts.TypeChecker} checker @param {ts.Symbol} symbol */
const hasSummary = (checker, symbol) =>
  ts.displayPartsToString(symbol.getDocumentationComment(checker)).trim()
    .length > 0;

/** Public methods of a class symbol. @param {ts.TypeChecker} checker @param {ts.Symbol} symbol */
const publicMethods = (checker, symbol) =>
  checker
    .getDeclaredTypeOfSymbol(symbol)
    .getProperties()
    .filter((member) => {
      const declaration = member.declarations?.[0];
      if (!(member.flags & ts.SymbolFlags.Method) || !declaration) return false;
      const hidden = ts.ModifierFlags.NonPublicAccessibilityModifier;
      return !(ts.getCombinedModifierFlags(declaration) & hidden);
    });

/** A README API table row whose first cell starts with `cell` (optionally as a link). @param {string} table @param {string} cell */
const hasRow = (table, cell) =>
  new RegExp(
    String.raw`^\|\s*\[?${cell.replaceAll(/[$()*+.?[\\\]^{|}]/gu, String.raw`\$&`)}`,
    "mu",
  ).test(table);

/** TSDoc summary, README API row and reference heading. @param {Documented} documented @param {Entry} entry @param {Export} item */
function checkExport({ headings, table }, { checker, entry }, item) {
  const label = item.name === "default" ? entry.slice(2) : item.name;
  const row = item.name === "default" ? "`default" : `\`${label}\``;
  assert.ok(hasSummary(checker, item.target), `${label} has no TSDoc summary`);
  assert.ok(hasRow(table, row), `README API table lacks ${label}`);
  assert.ok(headings.has(slug(label)), `docs/API.md lacks a ${label} heading`);
  if (!(item.target.flags & ts.SymbolFlags.Class)) return;
  publicMethods(checker, item.target).forEach((method) => {
    const { name } = method;
    assert.ok(hasSummary(checker, method), `${name} has no TSDoc summary`);
    assert.ok(hasRow(table, `\`${name}(`), `README API table lacks ${name}`);
    assert.ok(headings.has(slug(name)), `docs/API.md lacks a ${name} heading`);
  });
}

/**
 * For each exported standalone function, a module that declares the
 * signature shown under its docs/API.md heading and asserts it is the same
 * type as the real export. Class methods are not covered: their `ctx`
 * parameter types are not exported, so docs cannot spell them out.
 * @param {string} reference docs/API.md @param {string} packageName @param {Entry[]} entries
 * @returns {{ code: string, path: string }[]}
 */
function signatureChecks(reference, packageName, entries) {
  return entries.flatMap(({ entry, symbols }) =>
    symbols
      .filter(({ target }) => target.flags & ts.SymbolFlags.Function)
      .map(({ name }) => {
        const start = reference.indexOf(`\n### \`${name}\`\n`);
        assert.ok(start !== -1, `docs/API.md lacks a ${name} heading`);
        const body = reference.slice(start + 1).split(/\n#{1,6} /u)[0] ?? "";
        const block = codeBlocks(body).find(({ lang }) => lang === "ts");
        assert.ok(block, `docs/API.md ${name}: no ts signature block`);
        const lines = block.code.split("\n");
        const at = lines.findIndex((line) => line.startsWith(name));
        assert.ok(at !== -1, `docs/API.md ${name}: no signature`);
        const text = lines.slice(at).join("\n").trim();
        const mismatch = `docs/API.md ${name} signature differs from the export`;
        const code = [
          ...lines.slice(0, at),
          `import { ${name} as actual } from "${packageName}${entry.slice(1)}";`,
          "type Same<A, B> = (<T>() => T extends A ? 1 : 2) extends (<T>() => T extends B ? 1 : 2) ? true : false;",
          `function documented${text.slice(name.length)} { throw new Error("signature only"); }`,
          `export const matches: Same<typeof documented, typeof actual> extends true ? "ok" : "${mismatch}" = "ok";`,
        ].join("\n");
        return { code, path: `documentation/${name}.signature.ts` };
      }),
  );
}

/** A main-entry export carries `@see <package page>`. @param {Entry[]} entries @param {string} page */
function checkSee(entries, page) {
  const main = entries.find(({ entry }) => entry === ".");
  assert.ok(main, "package has no main entry");
  const linked = main.symbols.some(({ target }) =>
    target
      .getJsDocTags(main.checker)
      .some(
        (tag) =>
          tag.name === "see" &&
          ts.displayPartsToString(tag.text).includes(page),
      ),
  );
  assert.ok(linked, `a main-entry export needs TSDoc @see ${page}`);
}

/**
 * Error codes in a source file: `code: "X"`, `fail("X")` and
 * `new Error("X")` / `new ConvexError("X")` literals, and the values of an
 * exported `*_ERROR_CODES = { KEY: "X" }` constant.
 * @param {string} text
 */
function codesIn(text) {
  const throwing =
    /\b(?:fail\(|code:|new (?:Convex)?Error\()\s*"([A-Z][\dA-Z_]+)"/gu;
  const table = /\b[A-Z_]*ERROR_CODES\s*=\s*\{([^}]*)\}/gu;
  const value = /:\s*"([A-Z][\dA-Z_]+)"/gu;
  return [
    ...[...text.matchAll(throwing)].map((match) => String(match[1])),
    ...[...text.matchAll(table)].flatMap((match) =>
      [...String(match[1]).matchAll(value)].map((entry) => String(entry[1])),
    ),
  ];
}

/** Every thrown error code has a row in the errors table and is in the reference. @param {string} installed @param {string} errors @param {string} reference */
function checkErrorCodes(installed, errors, reference) {
  const codes = new Set(
    filesUnder(join(installed, "src"))
      .filter((file) => /\.tsx?$/u.test(file) && !file.includes("_generated"))
      .flatMap((file) => codesIn(readFileSync(file, "utf8"))),
  );
  assert.ok(codes.size > 0, "found no error codes; update the pattern");
  codes.forEach((code) => {
    assert.ok(hasRow(errors, `\`${code}\``), `Errors and fixes lacks ${code}`);
    assert.ok(reference.includes(code), `docs/API.md lacks ${code}`);
  });
}

/** Summary, when to use, links to the reference and errors, ecosystem block. @param {string} llms @param {string} name */
function checkLlms(llms, name) {
  assert.match(llms, /^> \S/mu, "llms.txt needs a > summary line");
  assert.ok(llms.includes("\n## When to use\n"), "llms.txt: ## When to use");
  assert.ok(llms.includes("](./docs/API.md)"), "llms.txt: link ./docs/API.md");
  const errors = "](./README.md#errors-and-fixes)";
  assert.ok(llms.includes(errors), "llms.txt: link the errors table");
  assert.ok(llms.endsWith(ecosystem(name)), "llms.txt: ends with Ecosystem");
  const index = llms.split(`${OSS}/llms.txt`).length - 1;
  assert.equal(index, 1, "llms.txt links the package index once");
}

/** @vllnt names under "Related packages" link their package page; no retired vllnt domain anywhere. @param {string} installed @param {Record<string, string>} texts */
function checkBacklinks(installed, texts) {
  Object.entries(texts).forEach(([file, text]) => {
    const related =
      sections(text).find((part) => part.name === "Related packages")?.body ??
      "";
    const names = related.matchAll(/\[`?@vllnt\/([\w-]+)`?\]\(([^)]+)\)/gu);
    [...names].forEach(([, other = "", url]) => {
      const page = `${OSS}/packages/${other}`;
      assert.equal(url, page, `${file}: link @vllnt/${other} to ${page}`);
    });
  });
  filesUnder(installed).forEach((file) => {
    const text = readFileSync(file, "utf8");
    assert.doesNotMatch(
      text,
      /vllnt\.ai/iu,
      `${file} mentions the retired vllnt domain`,
    );
  });
}

/**
 * Docs cover every export of every entry point; the main entry links its page.
 * Returns the signature modules for the caller to compile.
 * @param {string} consumer
 * @param {{ exports: Record<string, unknown>, name: string }} metadata
 * @param {Documented} documented
 * @param {string} reference docs/API.md
 */
function checkApi(consumer, metadata, documented, reference) {
  const keys = Object.keys(metadata.exports).filter(
    (key) => key !== "./package.json" && !key.endsWith(".js"),
  );
  const entries = exportsOf(consumer, metadata.name, keys);
  entries.forEach((entry) => {
    entry.symbols.forEach((item) => {
      checkExport(documented, entry, item);
    });
  });
  const name = metadata.name.split("/").at(-1) ?? metadata.name;
  checkSee(entries, `${OSS}/packages/${name}`);
  return signatureChecks(reference, metadata.name, entries);
}

/**
 * Search metadata: a description of 160 characters at most that does not
 * mention vllnt, and 8 to 12 unique keywords.
 * @param {{ description?: unknown, keywords?: unknown }} metadata
 */
function checkMetadata({ description, keywords }) {
  assert.ok(typeof description === "string", "package.json needs description");
  assert.ok(description.length <= 160, "description: 160 characters at most");
  assert.doesNotMatch(description, /vllnt/iu, "description: not 'for vllnt'");
  assert.ok(Array.isArray(keywords), "package.json needs keywords");
  const unique = new Set(keywords);
  assert.equal(unique.size, keywords.length, "keywords repeat");
  assert.ok(unique.size >= 8 && unique.size <= 12, "8 to 12 keywords");
}

/**
 * The package.json description opens the README and is the llms.txt summary;
 * the README Links section and footer match the shared blocks.
 * @param {Record<string, string>} texts
 * @param {Section[]} parts
 * @param {{ description?: unknown, name: string, repository?: Repository }} metadata
 */
function checkIdentity(texts, parts, metadata) {
  const description = String(metadata.description);
  const readme = String(texts["README.md"]);
  const title = readme.indexOf("\n");
  const intro = readme.slice(title, readme.indexOf("\n## ", title)).trim();
  const sentence = intro.replaceAll(/\s*\n\s*/gu, " ");
  assert.equal(sentence, description, "README intro: package.json description");
  const summary = String(texts["llms.txt"]).split("\n");
  assert.ok(summary.includes(`> ${description}`), "llms.txt: > <description>");
  const { repository } = metadata;
  const source = typeof repository === "object" ? repository.url : repository;
  assert.ok(typeof source === "string", "package.json needs repository.url");
  const url = source.replace(/^git\+/u, "").replace(/\.git$/u, "");
  const name = metadata.name.split("/").at(-1) ?? metadata.name;
  const body = section(parts, "Links").body.trim();
  assert.equal(body, links(name, url), "README Links: the shared block");
  assert.ok(readme.endsWith(footer(name)), "README ends with the vllnt footer");
}

/** Shipped docs keyed by package-relative path. @param {string} installed */
function readTexts(installed) {
  const references = readdirSync(join(installed, "docs")).map(
    (file) => `docs/${file}`,
  );
  const files = ["README.md", "llms.txt", "CHANGELOG.md", ...references];
  return Object.fromEntries(
    files.map((file) => [file, readFileSync(join(installed, file), "utf8")]),
  );
}

/**
 * Checks README.md, llms.txt and docs/ of an installed package and returns
 * the README `ts`/`tsx` blocks and the docs/API.md signature modules for the
 * caller to compile (and the README test to run).
 * @param {string} installed package directory inside node_modules
 * @param {string} consumer project that has the package installed
 */
export function checkDocumentation(installed, consumer) {
  /** @type {{ description?: unknown, exports: Record<string, unknown>, keywords?: unknown, name: string, repository?: Repository }} */
  const metadata = JSON.parse(
    readFileSync(join(installed, "package.json"), "utf8"),
  );
  const name = metadata.name.split("/").at(-1) ?? metadata.name;
  checkMetadata(metadata);
  const texts = readTexts(installed);
  const readme = String(texts["README.md"]);
  const reference = String(texts["docs/API.md"]);
  const parts = checkStructure(readme, metadata.name);
  checkWhenToUse(parts);
  checkIdentity(texts, parts, metadata);
  checkTop(readme, metadata.name);
  checkLinks(installed, texts);
  const signatures = checkApi(
    consumer,
    metadata,
    {
      headings: anchors(reference),
      table: section(parts, "API")
        .body.split("\n")
        .filter((line) => line.startsWith("|"))
        .join("\n"),
    },
    reference,
  );
  checkErrorCodes(
    installed,
    section(parts, "Errors and fixes").body,
    reference,
  );
  checkLlms(String(texts["llms.txt"]), name);
  checkBacklinks(installed, texts);
  return [...checkCode(texts), ...signatures];
}

/**
 * Writes stub host files and the README examples under `consumer`, renaming
 * repeated paths, and returns the written paths.
 * @param {string} consumer @param {Record<string, string>} stubs @param {{ code: string, path: string }[]} examples
 */
export function writeHost(consumer, stubs, examples) {
  /** @type {string[]} */
  const seen = [];
  /** @type {string[]} */
  const written = [];
  const files = [
    ...Object.entries(stubs),
    ...examples.map(({ code, path }) => [path, code]),
  ];
  files.forEach(([path = "", code = ""]) => {
    const copies = seen.filter((file) => file === path).length;
    const target =
      copies === 0 ? path : path.replace(/\.(tsx?)$/u, `.${String(copies)}.$1`);
    seen.push(path);
    written.push(target);
    mkdirSync(dirname(join(consumer, target)), { recursive: true });
    writeFileSync(join(consumer, target), code);
  });
  return written;
}

/**
 * Component mount names used by the README's `convex.config.ts` blocks.
 * @param {string} installed @param {{ code: string, path: string }[]} examples
 */
function mountsOf(installed, examples) {
  const config = join(installed, "src/component/convex.config.ts");
  const definition = /defineComponent\(\s*"([^"]+)"/u;
  const component = definition.exec(readFileSync(config, "utf8"))?.[1];
  assert.ok(component, "cannot read the component name");
  const use = /app\.use\(\s*\w+\s*(?:,\s*\{\s*name:\s*"([^"]+)"\s*\})?\s*\)/gu;
  const names = examples
    .filter(({ path }) => path.endsWith("convex.config.ts"))
    .flatMap(({ code }) => [...code.matchAll(use)])
    .map((match) => match[1] ?? component);
  return [...new Set(names)];
}

/** README modules that define functions, as `api` keys. @param {{ path: string }[]} examples */
const modulesOf = (examples) =>
  [...new Set(examples.map(({ path }) => path))]
    .filter(
      (path) =>
        path.startsWith("convex/") &&
        !/convex\.config|\.test\.|_generated|schema/u.test(path),
    )
    .map((path) => path.slice("convex/".length, -".ts".length));

/**
 * Stub `convex/_generated` files typed from the README examples: `api` and
 * `internal` from the example modules, `components` from their mounts.
 * @param {string} installed @param {{ code: string, path: string }[]} examples
 * @returns {Record<string, string>}
 */
export function convexHost(installed, examples) {
  /** @type {{ name: string }} */
  const { name } = JSON.parse(
    readFileSync(join(installed, "package.json"), "utf8"),
  );
  const modules = modulesOf(examples);
  const fields = modules.map(
    (module, index) => `"${module}": typeof m${String(index)};`,
  );
  const mounts = mountsOf(installed, examples).map(
    (mount) => `"${mount}": ComponentApi;`,
  );
  const api = [
    `import type { ComponentApi } from "${name}/_generated/component.js";`,
    `import { anyApi, componentsGeneric, type ApiFromModules, type FilterApi, type FunctionReference } from "convex/server";`,
    ...modules.map(
      (module, index) =>
        `import type * as m${String(index)} from "../${module}.js";`,
    ),
    `type FullApi = ApiFromModules<{ ${fields.join(" ")} }>;`,
    `export const api = anyApi as unknown as FilterApi<FullApi, FunctionReference<any, "public">>;`,
    `export const internal = anyApi as unknown as FilterApi<FullApi, FunctionReference<any, "internal">>;`,
    `export const components = componentsGeneric() as unknown as { ${mounts.join(" ")} };`,
  ];
  return {
    "convex/_generated/api.ts": `${api.join("\n")}\n`,
    "convex/_generated/server.ts": `export { internalMutationGeneric as internalMutation, internalQueryGeneric as internalQuery, mutationGeneric as mutation, queryGeneric as query } from "convex/server";\n`,
    "convex/schema.ts": `import { defineSchema } from "convex/server";\nexport default defineSchema({});\n`,
  };
}
