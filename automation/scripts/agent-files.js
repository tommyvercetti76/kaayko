/**
 * agent-files.js — File collection, scoring, selection, and loading for agent runs.
 *
 * Fixes over original inline code:
 * - Max files: dynamic (15 for audit goals, 6 for edit goals)
 * - Char cap: 20,000 default, smart per-file (full for small files, summarized for large HTML)
 * - CSS inclusion: auto-boosted when goal mentions mobile/responsive/style/CSS
 * - View-specific JS boosted when goal mentions component/reusable/audit/pattern
 */

const fs = require("fs");
const path = require("path");

/**
 * Detect whether a goal is an "audit" (read-only analysis) vs "edit" (propose changes).
 */
function detectGoalMode(goal) {
  const lower = String(goal || "").toLowerCase();
  const auditPatterns = [
    /\baudit\b/, /\breview\b/, /\banalyze\b/, /\banalysis\b/, /\binventory\b/,
    /\blist\b.*\bcomponent/, /\bfind\b.*\bduplica/, /\bidentify\b/, /\bmap\b.*\b(component|module)/,
    /\bwhat\b.*\breusable/, /\bscope\b/, /\bassess\b/, /\binspect\b/
  ];
  return auditPatterns.some((p) => p.test(lower)) ? "audit" : "edit";
}

/**
 * Detect goal-relevant file type boosts.
 */
function detectGoalFileHints(goal) {
  const lower = String(goal || "").toLowerCase();
  return {
    wantsCss: /\bmobile\b|\bresponsive\b|\bcss\b|\bstyle\b|\bmedia\s*quer|\bbreakpoint\b|\blayout\b/.test(lower),
    wantsViews: /\bcomponent\b|\breusable\b|\bpattern\b|\bmodule\b|\bview\b|\bwidget\b|\baudit\b/.test(lower),
    wantsAll: /\ball\b/.test(lower)
  };
}

/**
 * Compute max files to select based on goal mode.
 * Audits need broad coverage, edits need focused depth.
 */
function computeMaxFiles(goalMode) {
  return goalMode === "audit" ? 18 : 8;
}

/**
 * Compute max chars per file based on goal mode and file size.
 * For audit: bigger budget (25k) since we're reading, not rewriting.
 * For edit: moderate budget (15k) since the model must produce rewrites.
 * Small files (< max) get sent in full always.
 */
function computeMaxCharsForFile(candidate, goalMode, runtimeOverride) {
  if (runtimeOverride) return Number(runtimeOverride);
  const base = goalMode === "audit" ? 25000 : 15000;
  // CSS files are usually compact — send full
  if (candidate.path.endsWith(".css")) return Math.max(base, 40000);
  // Small files: send full
  if (candidate.size_bytes < base) return candidate.size_bytes + 500;
  return base;
}

/**
 * Walk a directory tree, calling visit(absolutePath) for each file.
 * Skips node_modules, .git, dist, build, coverage.
 */
function walkDirectory(rootPath, visit) {
  fs.readdirSync(rootPath, { withFileTypes: true }).forEach((entry) => {
    const absolutePath = path.join(rootPath, entry.name);

    if (entry.isDirectory()) {
      if (["node_modules", ".git", "dist", "build", "coverage"].includes(entry.name)) {
        return;
      }
      walkDirectory(absolutePath, visit);
      return;
    }

    visit(absolutePath);
  });
}

/**
 * Check if a file is a valid agent source candidate.
 */
function isAgentSourceCandidate(filePath) {
  const extension = path.extname(filePath).toLowerCase();
  const allowedExtensions = new Set([".js", ".mjs", ".cjs", ".ts", ".tsx", ".css", ".html", ".json"]);

  if (!allowedExtensions.has(extension)) {
    return false;
  }

  return fs.statSync(filePath).size <= 80000;
}

/**
 * Tokenize a goal string into searchable tokens.
 */
function tokenizeGoal(goal) {
  const seen = new Set();
  return String(goal || "")
    .toLowerCase()
    .split(/[^a-z0-9]+/g)
    .filter((token) => token.length >= 3 && !seen.has(token) && seen.add(token));
}

/**
 * Score a candidate file for relevance.
 * Enhanced: boosts CSS when goal hints demand it, boosts view JS for component audits.
 */
function scoreAgentCandidateFile(prefixedPath, area, track, goalTokens, sizeBytes, logicalRoot, coachingBundle, goalHints) {
  const normalizedPath = prefixedPath.toLowerCase();
  let score = 0;

  if (normalizedPath.startsWith("kaayko:src/")) {
    score += area === "frontend" ? 18 : 8;
  }

  if (normalizedPath.startsWith("kaayko-api:functions/") || normalizedPath.startsWith("kaayko-api:ml-service/")) {
    score += area === "backend" ? 18 : 8;
  }

  if (normalizedPath.includes("/js/")) {
    score += 12;
  }

  // CSS scoring — boosted when goal wants mobile/responsive/style analysis
  if (normalizedPath.includes("/css/") || normalizedPath.endsWith(".css")) {
    score += goalHints.wantsCss ? 18 : 10;
  }

  // View-specific JS — boosted when goal wants component/reusable/audit
  if (normalizedPath.includes("/views/") && normalizedPath.endsWith(".js")) {
    score += goalHints.wantsViews ? 16 : 6;
  }

  // View-specific CSS — boosted for mobile audits
  if (normalizedPath.includes("/views/") && normalizedPath.endsWith(".css")) {
    score += goalHints.wantsCss ? 16 : 4;
  }

  if (normalizedPath.endsWith(".html")) {
    score += 8;
  }

  if (normalizedPath.includes(track.replace(/[^a-z0-9]+/g, ""))) {
    score += 6;
  }

  goalTokens.forEach((token) => {
    if (normalizedPath.includes(token)) {
      score += 5;
    }
  });

  (coachingBundle?.priority_path_prefixes || []).forEach((prefix) => {
    if (normalizedPath.startsWith(String(prefix).toLowerCase())) {
      score += 16;
    }
  });

  (coachingBundle?.critical_path_prefixes || []).forEach((prefix) => {
    if (normalizedPath.startsWith(String(prefix).toLowerCase())) {
      score += 12;
    }
  });

  if (logicalRoot === "src") {
    score += 4;
  }

  if (sizeBytes < 12000) {
    score += 4;
  } else if (sizeBytes > 30000) {
    score -= 4;
  }

  return score;
}

/**
 * Collect candidate files from the repo for agent inspection.
 * Returns sorted by score, capped at 80 candidates for model inventory prompt.
 */
function collectAgentCandidateFiles(config, manifest, area, goal, coachingBundle, helpers) {
  const { resolveAgentRoots, resolveRepo } = helpers;
  const roots = resolveAgentRoots(config, manifest, area);
  const goalTokens = tokenizeGoal(goal);
  const goalHints = detectGoalFileHints(goal);
  const candidates = [];

  roots.forEach(({ repoKey, absoluteRoot, logicalRoot }) => {
    if (!fs.existsSync(absoluteRoot)) {
      return;
    }

    walkDirectory(absoluteRoot, (absolutePath) => {
      if (!isAgentSourceCandidate(absolutePath)) {
        return;
      }

      const stat = fs.statSync(absolutePath);
      const relativePath = path.relative(resolveRepo(config, repoKey).absolute_path, absolutePath);
      const prefixedPath = `${repoKey}:${relativePath}`;
      const score = scoreAgentCandidateFile(prefixedPath, area, manifest.track, goalTokens, stat.size, logicalRoot, coachingBundle, goalHints);

      candidates.push({
        path: prefixedPath,
        repo: repoKey,
        relative_path: relativePath,
        logical_root: logicalRoot,
        size_bytes: stat.size,
        line_count: fs.readFileSync(absolutePath, "utf8").split("\n").length,
        score
      });
    });
  });

  return candidates.sort((left, right) => right.score - left.score || left.path.localeCompare(right.path)).slice(0, 80);
}

/**
 * Choose files from inventory based on model response.
 * Max files is now dynamic based on goal mode.
 */
function chooseAgentSelectedFiles(inventory, inventoryResponse, goalMode) {
  const maxFiles = computeMaxFiles(goalMode);
  const requested = Array.isArray(inventoryResponse.selected_files) ? inventoryResponse.selected_files : [];
  const selected = [];

  requested.forEach((requestedPath) => {
    const exactMatch =
      inventory.find((item) => item.path === requestedPath) ||
      inventory.find((item) => item.path.endsWith(String(requestedPath).replace(/^[^:]+:/, "")));

    if (exactMatch && !selected.some((item) => item.path === exactMatch.path)) {
      selected.push(exactMatch);
    }
  });

  if (!selected.length) {
    return inventory.slice(0, maxFiles);
  }

  return selected.slice(0, maxFiles);
}

/**
 * Load a candidate file's content, with smart truncation.
 */
function loadAgentFilePayload(candidate, options = {}) {
  const { resolvePrefixedPath } = options.helpers || {};
  const absolutePath = resolvePrefixedPath
    ? resolvePrefixedPath(candidate.path)
    : candidate.absolute_path;
  const rawContent = fs.readFileSync(absolutePath, "utf8");
  const goalMode = options.goalMode || "edit";
  const maxChars = computeMaxCharsForFile(candidate, goalMode, options.maxChars);
  const truncated = rawContent.length > maxChars;
  const content = truncated ? `${rawContent.slice(0, maxChars)}\n/* [truncated — ${rawContent.length} chars total, showing first ${maxChars}] */\n` : rawContent;

  return {
    ...candidate,
    absolute_path: absolutePath,
    char_count: rawContent.length,
    truncated,
    full_content: rawContent,
    content
  };
}

/**
 * Serialize a file payload for storage (strips content to save disk).
 */
function serializeAgentFilePayload(payload) {
  return {
    path: payload.path,
    repo: payload.repo,
    relative_path: payload.relative_path,
    logical_root: payload.logical_root,
    size_bytes: payload.size_bytes,
    line_count: payload.line_count,
    char_count: payload.char_count,
    truncated: payload.truncated
  };
}

module.exports = {
  detectGoalMode,
  detectGoalFileHints,
  computeMaxFiles,
  computeMaxCharsForFile,
  walkDirectory,
  isAgentSourceCandidate,
  tokenizeGoal,
  scoreAgentCandidateFile,
  collectAgentCandidateFiles,
  chooseAgentSelectedFiles,
  loadAgentFilePayload,
  serializeAgentFilePayload
};
