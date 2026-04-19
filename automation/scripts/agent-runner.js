/**
 * agent-runner.js — Orchestrates the complete agent lifecycle.
 *
 * Phases:
 * 1. PLAN — collect candidate files, detect goal mode (audit vs edit)
 * 2. SELECT — model picks files to inspect (dynamic limits based on mode)
 * 3. LOAD — read file contents with smart truncation
 * 4. ANALYZE — model produces findings (audit mode) or findings + edits (edit mode)
 * 5. VERIFY — apply edits (if edit mode), run syntax/lint checks, generate verification report
 * 6. GATE — require user approval via diff → approve/reject before anything is committed
 *
 * The user ALWAYS sees verification results and must approve.
 */

const path = require("path");
const agentFiles = require("./agent-files");
const agentPrompts = require("./agent-prompts");
const agentVerify = require("./agent-verify");

/**
 * Execute the full local model agent pipeline.
 *
 * @param {object} config - portfolio-loop config
 * @param {object} runtimeConfig - runtime.json config
 * @param {string} runDir - absolute path to the run directory
 * @param {object} manifest - run manifest
 * @param {object} args - { area, goal, apply, ... }
 * @param {object} helpers - shared functions from portfolio-loop.js:
 *   { ensureDir, writeText, writeJson, loadJson, updateRunManifest, relativeToRepo,
 *     resolvePrefixedPath, resolveRepo, resolveAgentRoots, slugify,
 *     buildAgentCoachingBundle, buildAgentCoachingMarkdown, buildAgentCoachingPromptSection,
 *     resolveRunCoachingContext, invokeOllamaPrompt, parseAgentJsonResponse, REPO_ROOT }
 */
function executeLocalModelAgent(config, runtimeConfig, runDir, manifest, args, helpers) {
  const {
    ensureDir, writeText, writeJson, loadJson, updateRunManifest, relativeToRepo,
    resolvePrefixedPath, resolveRepo, resolveAgentRoots, slugify,
    buildAgentCoachingBundle, buildAgentCoachingMarkdown, buildAgentCoachingPromptSection,
    resolveRunCoachingContext, invokeOllamaPrompt, parseAgentJsonResponse, REPO_ROOT
  } = helpers;

  const agentDir = path.join(runDir, "artifacts", "agent");
  const backupsDir = path.join(agentDir, "backups");
  const runtime = runtimeConfig.local_model_runtime || {};

  // Detect goal mode: "audit" (read-only analysis) or "edit" (propose changes)
  const goalMode = agentFiles.detectGoalMode(args.goal);

  // Artifact paths
  const inventoryPath = path.join(agentDir, "inventory.json");
  const inventoryPromptPath = path.join(agentDir, "inventory-prompt.md");
  const inventoryRawPath = path.join(agentDir, "inventory-response.raw.txt");
  const inventoryJsonPath = path.join(agentDir, "inventory-response.json");
  const selectedPath = path.join(agentDir, "selected-files.json");
  const analysisPromptPath = path.join(agentDir, "analysis-prompt.md");
  const analysisRawPath = path.join(agentDir, "analysis-response.raw.txt");
  const analysisJsonPath = path.join(agentDir, "analysis-response.json");
  const analysisMarkdownPath = path.join(runDir, "notes", "agent-analysis.md");
  const verificationPath = path.join(runDir, "notes", "verification-report.md");

  ensureDir(agentDir);
  ensureDir(backupsDir);

  const coachingBundle = buildAgentCoachingBundle(manifest.track, args.area, args.goal);
  writeText(path.join(runDir, "notes", "agent-briefing.md"), buildAgentCoachingMarkdown(coachingBundle, args));

  // ──────────────── PHASE 1: COLLECT CANDIDATES ────────────────

  const inventory = agentFiles.collectAgentCandidateFiles(config, manifest, args.area, args.goal, coachingBundle, {
    resolveAgentRoots,
    resolveRepo
  });
  writeJson(inventoryPath, { generated_at: new Date().toISOString(), goal_mode: goalMode, files: inventory });

  updateRunManifest(runDir, (m) => {
    m.status = "agent_selecting";
    m.agent = {
      ...(m.agent || {}),
      stage: "selecting",
      goal_mode: goalMode,
      inventory_candidates: inventory.length
    };
    m.artifacts.agent_inventory_path = relativeToRepo(inventoryPath);
    return m;
  });

  // ──────────────── PHASE 2: MODEL SELECTS FILES ────────────────

  const inventoryPrompt = agentPrompts.buildAgentInventoryPrompt(manifest, args, inventory, coachingBundle, goalMode, {
    buildAgentCoachingPromptSection
  });
  writeText(inventoryPromptPath, inventoryPrompt);
  const inventoryRaw = invokeOllamaPrompt(runtime, inventoryPrompt, "inventory selection");
  writeText(inventoryRawPath, inventoryRaw);
  const inventoryResponse = parseAgentJsonResponse(inventoryRaw, "inventory selection");
  writeJson(inventoryJsonPath, inventoryResponse);

  // ──────────────── PHASE 3: LOAD FILE CONTENTS ────────────────

  const selectedFiles = agentFiles.chooseAgentSelectedFiles(inventory, inventoryResponse, goalMode);
  const selectedFilePayload = selectedFiles.map((candidate) =>
    agentFiles.loadAgentFilePayload(candidate, {
      goalMode,
      maxChars: runtime.analysis_max_file_chars || null,
      helpers: { resolvePrefixedPath }
    })
  );

  const analysisCoachingBundle = buildAgentCoachingBundle(manifest.track, args.area, args.goal, {
    filePaths: selectedFilePayload.map((item) => item.path)
  });
  writeJson(selectedPath, { selected_files: selectedFilePayload.map(agentFiles.serializeAgentFilePayload) });
  writeText(path.join(runDir, "notes", "agent-briefing.md"), buildAgentCoachingMarkdown(analysisCoachingBundle, args));

  updateRunManifest(runDir, (m) => {
    m.status = "agent_analyzing";
    m.agent = {
      ...(m.agent || {}),
      stage: "analyzing",
      goal_mode: goalMode,
      selected_files: selectedFilePayload.map((item) => item.path)
    };
    m.coaching = {
      ...(m.coaching || {}),
      profile_ids: analysisCoachingBundle.profile_ids,
      guided_products: analysisCoachingBundle.guided_products,
      focused_profile_ids: analysisCoachingBundle.focused_profile_ids,
      focused_products: analysisCoachingBundle.focused_products,
      source_docs: analysisCoachingBundle.source_docs,
      focused_source_docs: analysisCoachingBundle.focused_source_docs,
      validation_focus: analysisCoachingBundle.validation_focus,
      risk_focus: analysisCoachingBundle.risk_focus,
      route_focus: analysisCoachingBundle.route_focus
    };
    m.artifacts.agent_selected_files_path = relativeToRepo(selectedPath);
    return m;
  });

  // ──────────────── PHASE 4: MODEL ANALYZES ────────────────

  const analysisPrompt = agentPrompts.buildAgentAnalysisPrompt(manifest, args, selectedFilePayload, analysisCoachingBundle, goalMode, {
    buildAgentCoachingPromptSection
  });
  writeText(analysisPromptPath, analysisPrompt);
  const analysisRaw = invokeOllamaPrompt(runtime, analysisPrompt, "agent analysis");
  writeText(analysisRawPath, analysisRaw);
  const analysisResponse = parseAgentJsonResponse(analysisRaw, "agent analysis");
  const normalizedAnalysis = normalizeAgentAnalysis(analysisResponse, selectedFilePayload, goalMode);
  writeJson(analysisJsonPath, normalizedAnalysis);

  // ──────────────── PHASE 5: VERIFY & APPLY (edit mode only) ────────────────

  let appliedEdits = [];
  let rejectedEdits = [];
  let verification = { summary: "no_edits", syntax_check: { passed: true, details: [] }, lint_check: { passed: true, details: [], skipped: true } };

  if (goalMode === "edit" && args.apply === "safe" && normalizedAnalysis.safe_edits.length) {
    updateRunManifest(runDir, (m) => {
      m.status = "agent_applying";
      m.agent = { ...(m.agent || {}), stage: "applying" };
      return m;
    });

    const result = agentVerify.applyAndVerifyEdits(config, runDir, selectedFilePayload, normalizedAnalysis.safe_edits, backupsDir, {
      helpers: { resolvePrefixedPath, slugify, REPO_ROOT }
    });
    appliedEdits = result.applied;
    rejectedEdits = result.rejected;
    verification = result.verification;

    // If syntax failed, auto-rollback all applied edits
    if (verification.summary === "syntax_failed") {
      appliedEdits.forEach((edit) => {
        const backupContent = require("fs").readFileSync(edit.backup_path, "utf8");
        require("fs").writeFileSync(edit.absolute_path, backupContent);
      });
      rejectedEdits.push(...appliedEdits.map((e) => ({ path: e.path, reason: "Auto-rolled back due to syntax failure" })));
      appliedEdits = [];
    }
  }

  // ──────────────── PHASE 6: WRITE REPORTS ────────────────

  const analysisManifest = loadJson(path.join(runDir, "manifest.json"));
  const analysisMarkdown = agentPrompts.buildAgentAnalysisMarkdown(
    analysisManifest, args, normalizedAnalysis, selectedFilePayload,
    appliedEdits, rejectedEdits, goalMode,
    { resolveRunCoachingContext }
  );
  writeText(analysisMarkdownPath, analysisMarkdown);

  // Write verification report (always, even for audits — shows what was inspected)
  const verificationReport = agentVerify.buildVerificationReport(
    manifest.run_id, appliedEdits, rejectedEdits, verification
  );
  writeText(verificationPath, verificationReport);

  // Determine final status
  let finalStatus;
  if (goalMode === "audit") {
    finalStatus = "agent_analyzed";
  } else if (appliedEdits.length) {
    finalStatus = "pending_review";
  } else {
    finalStatus = "agent_analyzed";
  }

  updateRunManifest(runDir, (m) => {
    m.status = finalStatus;
    m.agent = {
      ...(m.agent || {}),
      stage: "completed",
      goal_mode: goalMode,
      summary: normalizedAnalysis.summary,
      findings_count: normalizedAnalysis.findings.length,
      applied_files: appliedEdits.map((item) => item.path),
      applied_edits_detail: appliedEdits.map((item) => ({
        path: item.path,
        absolute_path: item.absolute_path,
        summary: item.summary || "",
        confidence: item.confidence || "medium",
        backup_name: path.basename(item.backup_path)
      })),
      rejected_edits: rejectedEdits,
      verification: {
        summary: verification.summary,
        syntax_passed: verification.syntax_check.passed,
        lint_passed: verification.lint_check.passed,
        lint_skipped: verification.lint_check.skipped
      },
      completed_at: new Date().toISOString()
    };
    m.artifacts.agent_prompt_path = relativeToRepo(analysisPromptPath);
    m.artifacts.agent_response_path = relativeToRepo(analysisJsonPath);
    m.artifacts.agent_analysis_path = relativeToRepo(analysisMarkdownPath);
    m.artifacts.verification_report_path = relativeToRepo(verificationPath);
    return m;
  });

  return {
    goal_mode: goalMode,
    inventory,
    inventory_response: inventoryResponse,
    selected_files: selectedFilePayload,
    analysis: normalizedAnalysis,
    applied_edits: appliedEdits,
    rejected_edits: rejectedEdits,
    verification,
    artifacts: {
      inventory: relativeToRepo(inventoryPath),
      selected: relativeToRepo(selectedPath),
      analysis: relativeToRepo(analysisJsonPath),
      analysis_markdown: relativeToRepo(analysisMarkdownPath),
      verification_report: relativeToRepo(verificationPath)
    }
  };
}

/**
 * Normalize analysis response from the model.
 * Handles both audit and edit response shapes.
 */
function normalizeAgentAnalysis(response, selectedFiles, goalMode) {
  const selectedPaths = new Set(selectedFiles.map((file) => file.path));

  const findings = Array.isArray(response.findings)
    ? response.findings
        .map((finding) => ({
          severity: ["low", "medium", "high"].includes(String(finding.severity || "").toLowerCase())
            ? String(finding.severity).toLowerCase()
            : "medium",
          status: "open",
          title: String(finding.title || "Agent finding").trim(),
          detail: String(finding.detail || "").trim(),
          category: String(finding.category || "maintainability").trim(),
          file_paths: Array.isArray(finding.file_paths) ? finding.file_paths.filter((item) => selectedPaths.has(item)) : []
        }))
        .filter((finding) => finding.title && finding.detail)
    : [];

  const base = {
    summary: String(response.summary || "").trim(),
    insights: Array.isArray(response.insights) ? response.insights.map((item) => String(item).trim()).filter(Boolean) : [],
    findings,
    followups: Array.isArray(response.followups) ? response.followups.map((item) => String(item).trim()).filter(Boolean) : []
  };

  if (goalMode === "audit") {
    // Audit-specific fields
    base.reusable_components = Array.isArray(response.reusable_components)
      ? response.reusable_components.map((c) => ({
          name: String(c.name || "").trim(),
          file: String(c.file || "").trim(),
          description: String(c.description || "").trim(),
          used_by: Array.isArray(c.used_by) ? c.used_by : [],
          reuse_level: String(c.reuse_level || "medium").trim()
        }))
      : [];
    base.duplicated_patterns = Array.isArray(response.duplicated_patterns)
      ? response.duplicated_patterns.map((d) => ({
          pattern: String(d.pattern || "").trim(),
          files: Array.isArray(d.files) ? d.files : [],
          severity: String(d.severity || "medium").trim(),
          recommendation: String(d.recommendation || "").trim()
        }))
      : [];
    base.mobile_audit = Array.isArray(response.mobile_audit)
      ? response.mobile_audit.map((m) => ({
          file: String(m.file || "").trim(),
          has_media_queries: Boolean(m.has_media_queries),
          breakpoints: Array.isArray(m.breakpoints) ? m.breakpoints : [],
          has_touch_events: Boolean(m.has_touch_events),
          viewport_meta: Boolean(m.viewport_meta),
          gaps: Array.isArray(m.gaps) ? m.gaps : []
        }))
      : [];
    base.component_opportunities = Array.isArray(response.component_opportunities)
      ? response.component_opportunities.map((o) => ({
          name: String(o.name || "").trim(),
          description: String(o.description || "").trim(),
          source_files: Array.isArray(o.source_files) ? o.source_files : [],
          effort: String(o.effort || "medium").trim(),
          impact: String(o.impact || "medium").trim()
        }))
      : [];
    base.safe_edits = []; // Audits never have edits
  } else {
    // Edit mode — normalize safe_edits
    base.safe_edits = Array.isArray(response.safe_edits)
      ? response.safe_edits
          .map((edit) => ({
            path: String(edit.path || "").trim(),
            kind: String(edit.kind || "rewrite").trim(),
            summary: String(edit.summary || "").trim(),
            confidence: Number(edit.confidence || 0),
            content: typeof edit.content === "string" ? edit.content : ""
          }))
          .filter((edit) => selectedPaths.has(edit.path) && edit.kind === "rewrite" && edit.content.trim())
          .slice(0, 2)
      : [];
  }

  return base;
}

module.exports = {
  executeLocalModelAgent,
  normalizeAgentAnalysis
};
