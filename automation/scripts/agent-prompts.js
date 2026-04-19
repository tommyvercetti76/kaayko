/**
 * agent-prompts.js — Prompt building for agent inventory and analysis.
 *
 * Key fix: Detects "audit" goals and switches to analysis-only prompt
 * (richer findings schema, NO safe_edits, more files, broader coverage).
 */

/**
 * Build the inventory selection prompt sent to the model.
 * For audit goals: tells model to pick MORE files (up to 18) and include CSS/views.
 * For edit goals: original behavior (4–8 files, prefer small cleanup).
 */
function buildAgentInventoryPrompt(manifest, args, inventory, coachingBundle, goalMode, helpers) {
  const { buildAgentCoachingPromptSection } = helpers;
  const inventoryLines = inventory
    .map((item) => `- ${item.path} | ${item.line_count} lines | ${item.size_bytes} bytes | score ${item.score}`)
    .join("\n");

  const maxFilesRange = goalMode === "audit" ? "10 and 18" : "4 and 8";
  const selectionGuidance = goalMode === "audit"
    ? [
        "- Select between " + maxFilesRange + " files.",
        "- INCLUDE CSS files — they are essential for responsive/mobile audits.",
        "- INCLUDE view-specific JS files (under views/ or similar) — they contain reusable patterns.",
        "- Include utility/shared JS files (utils.js, ui.js, config.js, etc.).",
        "- Prefer broad coverage over narrow depth since this is an audit.",
        "- Use exact `repo:path` strings from the inventory."
      ]
    : [
        "- Select between " + maxFilesRange + " files.",
        "- Prefer source files over generated files.",
        "- Prefer files where a small, behavior-preserving cleanup is plausible.",
        "- Bias toward files that sit on critical product paths documented in the coaching section.",
        "- Use exact `repo:path` strings from the inventory."
      ];

  return [
    "You are selecting files for a local coding agent run.",
    `Run ID: ${manifest.run_id}`,
    `Track: ${manifest.track}`,
    `Area: ${args.area}`,
    `Goal: ${args.goal}`,
    `Mode: ${goalMode}`,
    "",
    buildAgentCoachingPromptSection(coachingBundle),
    "",
    goalMode === "audit"
      ? "Choose the files most relevant to thoroughly auditing this goal. Cover ALL file types (JS, CSS, HTML) that relate to the goal."
      : "Choose the files most relevant to achieving this goal. Use the coaching context above to prioritize files on critical product paths.",
    "Return JSON only with this shape:",
    '{"selected_files":["repo:path"],"reasoning":["short reason"]}',
    "",
    "Rules:",
    ...selectionGuidance,
    "",
    "Inventory:",
    inventoryLines
  ].join("\n");
}

/**
 * Build the analysis prompt for EDIT mode (propose safe rewrites).
 */
function buildEditAnalysisPrompt(manifest, args, selectedFiles, coachingBundle, helpers) {
  const { buildAgentCoachingPromptSection } = helpers;
  const fileBlocks = buildFileBlocks(selectedFiles);

  return [
    "You are a careful local coding agent reviewing repository files for duplication reduction and safe improvements.",
    `Run ID: ${manifest.run_id}`,
    `Track: ${manifest.track}`,
    `Area: ${args.area}`,
    `Goal: ${args.goal}`,
    "",
    buildAgentCoachingPromptSection(coachingBundle),
    "",
    "Analyze the selected files. Propose only low-risk, behavior-preserving edits.",
    "You should surface both safe cleanup suggestions and any real product risks you see around auth, tenant isolation, billing, route contracts, onboarding, checkout, or forecast/rendering behavior.",
    "Return JSON only using this exact shape:",
    '{"summary":"...","insights":["..."],"findings":[{"severity":"low|medium|high","title":"...","detail":"...","category":"duplication|maintainability|ux|quality|security|auth|billing|tenant|contract","file_paths":["repo:path"]}],"followups":["..."],"safe_edits":[{"path":"repo:path","kind":"rewrite","summary":"...","confidence":0.0,"content":"full file contents"}]}',
    "",
    "Rules:",
    "- `safe_edits` may contain at most 2 entries.",
    "- Only rewrite files from the provided file list.",
    "- Keep changes localized and behavior-preserving.",
    "- If you are not highly confident, return an empty `safe_edits` array.",
    "- Favor removing duplication, clarifying intent, or extracting repeated literals/helper logic without changing product behavior.",
    "- Preserve documented product routes, onboarding flows, billing surfaces, forecast flows, and contract-sensitive output shapes.",
    "- When you call out a risk, attach the most relevant `file_paths` from the provided file list.",
    "- Prefer a specific medium/high risk finding over a vague low-severity suggestion when the product contract looks wrong.",
    "",
    fileBlocks
  ].join("\n");
}

/**
 * Build the analysis prompt for AUDIT mode (read-only, deep analysis, NO safe_edits).
 */
function buildAuditAnalysisPrompt(manifest, args, selectedFiles, coachingBundle, helpers) {
  const { buildAgentCoachingPromptSection } = helpers;
  const fileBlocks = buildFileBlocks(selectedFiles);

  return [
    "You are a thorough code auditor performing a deep analysis of repository files.",
    `Run ID: ${manifest.run_id}`,
    `Track: ${manifest.track}`,
    `Area: ${args.area}`,
    `Goal: ${args.goal}`,
    "",
    buildAgentCoachingPromptSection(coachingBundle),
    "",
    "Perform a comprehensive audit of ALL provided files. This is a READ-ONLY analysis — do NOT propose edits.",
    "Your job is to enumerate, categorize, and assess — not to rewrite code.",
    "",
    "For each file, analyze:",
    "1. What reusable functions/components/patterns does it export or define?",
    "2. What patterns are duplicated across files (copy-paste, similar logic, repeated markup)?",
    "3. Mobile/responsive readiness: media queries, viewport handling, touch events, breakpoints.",
    "4. Architecture quality: separation of concerns, dependency clarity, naming consistency.",
    "5. Any security, auth, tenant isolation, or contract risks.",
    "",
    "Return JSON only using this exact shape:",
    JSON.stringify({
      summary: "2-3 paragraph executive summary of audit findings",
      reusable_components: [
        { name: "functionOrComponentName", file: "repo:path", description: "what it does", used_by: ["repo:path", "..."], reuse_level: "high|medium|low" }
      ],
      duplicated_patterns: [
        { pattern: "description of repeated pattern", files: ["repo:path"], severity: "high|medium|low", recommendation: "how to consolidate" }
      ],
      mobile_audit: [
        { file: "repo:path", has_media_queries: true, breakpoints: ["768px"], has_touch_events: false, viewport_meta: true, gaps: ["description of gap"] }
      ],
      findings: [
        { severity: "low|medium|high", title: "...", detail: "Detailed explanation with specific line references or function names", category: "duplication|maintainability|ux|quality|security|auth|mobile|architecture", file_paths: ["repo:path"] }
      ],
      component_opportunities: [
        { name: "proposedComponentName", description: "what it would extract", source_files: ["repo:path"], effort: "low|medium|high", impact: "high|medium|low" }
      ],
      insights: ["..."],
      followups: ["..."]
    }, null, 2),
    "",
    "Rules:",
    "- Do NOT include a `safe_edits` field. This is audit-only.",
    "- Be SPECIFIC: name exact functions, CSS classes, line patterns. Vague findings are useless.",
    "- Every finding must reference at least one file from the provided list.",
    "- If a file is truncated, note what you can see and flag that the full file may contain more.",
    "- For mobile_audit: check every CSS file for @media rules. Check every HTML for viewport meta.",
    "- For reusable_components: list EVERY exported or window-assigned function, not just the obvious ones.",
    "- For duplicated_patterns: compare across files, not just within one file.",
    "- Produce at least 5 findings. Shallow audits are failures.",
    "",
    fileBlocks
  ].join("\n");
}

/**
 * Build the right analysis prompt based on goal mode.
 */
function buildAgentAnalysisPrompt(manifest, args, selectedFiles, coachingBundle, goalMode, helpers) {
  if (goalMode === "audit") {
    return buildAuditAnalysisPrompt(manifest, args, selectedFiles, coachingBundle, helpers);
  }
  return buildEditAnalysisPrompt(manifest, args, selectedFiles, coachingBundle, helpers);
}

/**
 * Format selected files into content blocks for the prompt.
 */
function buildFileBlocks(selectedFiles) {
  return selectedFiles
    .map((file) => {
      return [
        `FILE: ${file.path}`,
        `LINES: ${file.line_count}`,
        `CHARS: ${file.char_count}`,
        `TRUNCATED: ${file.truncated ? `yes (showing ${file.content.length} of ${file.char_count} chars)` : "no"}`,
        "--- BEGIN CONTENT ---",
        file.content,
        "--- END CONTENT ---"
      ].join("\n");
    })
    .join("\n\n");
}

/**
 * Build the analysis markdown report.
 */
function buildAgentAnalysisMarkdown(manifest, args, analysis, selectedFiles, appliedEdits, rejectedEdits, goalMode, helpers) {
  const { resolveRunCoachingContext } = helpers;
  const coaching = resolveRunCoachingContext(manifest);
  const findings = analysis.findings.length
    ? analysis.findings.map((finding) => `- [${finding.severity}] ${finding.title}: ${finding.detail}`).join("\n")
    : "- No model findings were recorded.";
  const insights = analysis.insights.length ? analysis.insights.map((item) => `- ${item}`).join("\n") : "- None.";
  const followups = analysis.followups.length ? analysis.followups.map((item) => `- ${item}`).join("\n") : "- None.";
  const inspected = selectedFiles.map((file) => `- ${file.path} (${file.line_count} lines${file.truncated ? ", truncated" : ""})`).join("\n");

  let editSection = "";
  if (goalMode === "edit") {
    const edits = appliedEdits.length
      ? appliedEdits.map((edit) => `- ${edit.path}: ${edit.summary || "Applied safe rewrite."} (confidence ${edit.confidence || 0})`).join("\n")
      : "- No safe rewrites were applied.";
    const rejected = rejectedEdits.length
      ? rejectedEdits.map((edit) => `- ${edit.path}: ${edit.reason}`).join("\n")
      : "- No edit proposals were rejected.";
    editSection = `
## Applied Safe Edits

${edits}

## Rejected Safe Edits

${rejected}
`;
  }

  let auditSection = "";
  if (goalMode === "audit") {
    const reusable = (analysis.reusable_components || []).length
      ? (analysis.reusable_components || []).map((c) => `- **${c.name}** (${c.file}): ${c.description} [reuse: ${c.reuse_level}]`).join("\n")
      : "- None identified.";
    const duplicated = (analysis.duplicated_patterns || []).length
      ? (analysis.duplicated_patterns || []).map((d) => `- ${d.pattern} in ${d.files.join(", ")} [${d.severity}] → ${d.recommendation}`).join("\n")
      : "- None identified.";
    const mobile = (analysis.mobile_audit || []).length
      ? (analysis.mobile_audit || []).map((m) => {
          const gaps = (m.gaps || []).length ? m.gaps.join("; ") : "none";
          return `- ${m.file}: media_queries=${m.has_media_queries}, breakpoints=${(m.breakpoints || []).join(",") || "none"}, touch=${m.has_touch_events}, viewport=${m.viewport_meta}, gaps=[${gaps}]`;
        }).join("\n")
      : "- Not analyzed.";
    const opportunities = (analysis.component_opportunities || []).length
      ? (analysis.component_opportunities || []).map((o) => `- **${o.name}**: ${o.description} [effort: ${o.effort}, impact: ${o.impact}]`).join("\n")
      : "- None identified.";
    auditSection = `
## Reusable Components Found

${reusable}

## Duplicated Patterns

${duplicated}

## Mobile/Responsive Audit

${mobile}

## Component Opportunities

${opportunities}
`;
  }

  return `# Agent Analysis

- Run ID: \`${manifest.run_id}\`
- Track: \`${manifest.track}\`
- Area: \`${args.area}\`
- Goal: ${args.goal}
- Mode: ${goalMode}
- Guided products: ${coaching.guided_products.length ? coaching.guided_products.join(", ") : "None"}
- Primary focus: ${coaching.focused_products.length ? coaching.focused_products.join(", ") : "None"}

## Summary

${analysis.summary || "No summary returned by the local model."}

## Inspected Files

${inspected}

## Findings

${findings}
${auditSection}${editSection}
## Insights

${insights}

## Follow-ups

${followups}
`;
}

module.exports = {
  buildAgentInventoryPrompt,
  buildAgentAnalysisPrompt,
  buildEditAnalysisPrompt,
  buildAuditAnalysisPrompt,
  buildAgentAnalysisMarkdown,
  buildFileBlocks
};
