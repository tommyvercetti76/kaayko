#!/usr/bin/env node

const fs = require("fs");
const os = require("os");
const path = require("path");
const { spawnSync } = require("child_process");
const agentRunner = require("./agent-runner");
const agentFilesModule = require("./agent-files");
const agentVerifyModule = require("./agent-verify");

const SCRIPT_DIR = __dirname;
const AUTOMATION_ROOT = path.resolve(SCRIPT_DIR, "..");
const REPO_ROOT = path.resolve(AUTOMATION_ROOT, "..");
const CONFIG_PATH = path.join(AUTOMATION_ROOT, "config", "portfolio-loop.json");
const RUNTIME_CONFIG_PATH = path.join(AUTOMATION_ROOT, "config", "runtime.json");
const AGENT_COACHING_PATH = path.join(AUTOMATION_ROOT, "config", "agent-coaching.json");
const RUNS_ROOT = path.join(AUTOMATION_ROOT, "runs");
const DATASETS_ROOT = path.join(AUTOMATION_ROOT, "datasets");
const QUEUE_ROOT = path.join(AUTOMATION_ROOT, "queue");
const DASHBOARD_ROOT = path.join(AUTOMATION_ROOT, "dashboard");
const KNOWLEDGE_ROOT = path.join(AUTOMATION_ROOT, "knowledge");
const QUEUE_DIRS = {
  pending: path.join(QUEUE_ROOT, "pending"),
  processing: path.join(QUEUE_ROOT, "processing"),
  done: path.join(QUEUE_ROOT, "done"),
  failed: path.join(QUEUE_ROOT, "failed")
};
const FRONTEND_SURFACE_RULES = [
  { prefix: "kaayko:src/paddlingout.html", label: "/paddlingout" },
  { prefix: "kaayko:src/store.html", label: "/store" },
  { prefix: "kaayko:src/cart.html", label: "/cart" },
  { prefix: "kaayko:src/order-success.html", label: "/order-success" },
  { prefix: "kaayko:src/admin/", label: "/kortex and /admin/*" },
  { prefix: "kaayko:src/kreator/", label: "/kreator/*" },
  { prefix: "kaayko:src/karma/", label: "/karma/*" },
  { prefix: "kaayko:kutz/src/", label: "/kutz" },
  { prefix: "kaayko:src/js/", label: "shared site JS" },
  { prefix: "kaayko:src/css/", label: "shared site CSS" }
];
const BACKEND_ROUTE_RULES = [
  { prefix: "kaayko-api:functions/api/smartLinks/", label: "/smartlinks + /l/:id + /resolve" },
  { prefix: "kaayko-api:functions/api/billing/", label: "/billing" },
  { prefix: "kaayko-api:functions/api/auth/", label: "/auth" },
  { prefix: "kaayko-api:functions/api/kreators/", label: "/kreators" },
  { prefix: "kaayko-api:functions/api/products/", label: "/products + /images" },
  { prefix: "kaayko-api:functions/api/checkout/", label: "/createPaymentIntent" },
  { prefix: "kaayko-api:functions/api/weather/", label: "/paddlingOut + /nearbyWater + /paddleScore + /forecast + /fastForecast" },
  { prefix: "kaayko-api:functions/api/cameras/", label: "/cameras + /lenses + /presets" },
  { prefix: "kaayko-api:functions/index.js", label: "functions/index.js mounts" },
  { prefix: "kaayko-api:functions/middleware/", label: "auth/security middleware" }
];

main();

function main() {
  try {
    const args = parseArgs(process.argv.slice(2));
    const command = args._[0] || "help";
    const config = loadJson(CONFIG_PATH);
    const runtimeConfig = loadJson(RUNTIME_CONFIG_PATH);

    ensureAutomationDirs();

    switch (command) {
      case "init":
        initRun(config, args);
        break;
      case "capture":
        captureRun(config, args);
        break;
      case "review":
        reviewRun(config, args);
        break;
      case "publish":
        publishRun(config, args);
        break;
      case "status":
        printStatus(config, args);
        break;
      case "export":
        exportDatasets(config, args);
        break;
      case "pipeline":
        pipelineRun(config, args);
        break;
      case "enqueue":
        enqueueTask(config, args);
        break;
      case "worker":
        runWorker(config, args);
        break;
      case "dashboard":
        generateDashboard(config, args);
        break;
      case "reconcile":
        reconcileRuns(config, args);
        break;
      case "console":
        printConsole(config, runtimeConfig, args);
        break;
      case "settings":
        printSettings(config, runtimeConfig, args);
        break;
      case "model":
        handleModelCommand(runtimeConfig, args);
        break;
      case "doctor":
        runDoctor(config, runtimeConfig, args);
        break;
      case "results":
        printResults(config, args);
        break;
      case "agent":
        runAgent(config, runtimeConfig, args);
        break;
      case "mission":
        runMission(config, args);
        break;
      case "prune":
        handlePruneCommand(config, args);
        break;
      case "diff":
        handleDiffCommand(config, args);
        break;
      case "approve":
        handleApproveCommand(config, args);
        break;
      case "reject":
        handleRejectCommand(config, args);
        break;
      case "rollback":
        handleRollbackCommand(config, args);
        break;
      case "knowledge":
        handleKnowledgeCommand(config, runtimeConfig, args);
        break;
      case "serve":
        handleServeCommand(config, runtimeConfig, args);
        break;
      case "help":
      default:
        printHelp(config);
        break;
    }
  } catch (error) {
    const verbose = process.argv.includes("--verbose") || process.argv.includes("-v");
    console.error(verbose ? (error.stack || error.message) : error.message);
    process.exitCode = 1;
  }
}

function parseArgs(argv) {
  const args = { _: [] };

  for (let index = 0; index < argv.length; index += 1) {
    const value = argv[index];

    if (!value.startsWith("--")) {
      args._.push(value);
      continue;
    }

    const key = value.slice(2);
    const next = argv[index + 1];

    if (!next || next.startsWith("--")) {
      args[key] = true;
      continue;
    }

    args[key] = next;
    index += 1;
  }

  return args;
}

function printHelp(config) {
  const W = 68;
  const pad = (str, len) => str + " ".repeat(Math.max(0, len - str.length));
  const top = `  \u2554${"═".repeat(W)}\u2557`;
  const bot = `  \u255a${"═".repeat(W)}\u255d`;
  const div = `  \u2560${"═".repeat(W)}\u2563`;
  const row = (c) => `  \u2551  ${pad(c, W - 4)}  \u2551`;
  const blank = row("");

  const lines = [
    top, blank,
    row("K A A Y K O   C O M M A N D   R E F E R E N C E"),
    row("\u2500".repeat(48)),
    row("Local Model Loop  \u00b7  v2.0"),
    blank,
    div, row("\u25ba MISSIONS"), blank,
    row("  agent     --area <module> --goal \"...\"  [--apply safe|none]"),
    row("  mission   --area <module> --goal \"...\"  [--mode pipeline|queue]"),
    row("  pipeline  --track <t> --idea <i> --goal \"...\" [--dry-run]"),
    row("  enqueue   --track <t> --idea <i> --goal \"...\""),
    row("  worker    [--limit 5]"),
    row(""),
    row("  Interactive mode (agent pauses for review):"),
    row("  agent     --area <module> --goal \"...\" --interactive"),
    blank,
    div, row("\u25ba REVIEW LOOP"), blank,
    row("  diff      [--run <id|latest>] [--full] [--context N]"),
    row("  approve   [--run <id|latest>] [--no-branch] [-m \"msg\"]"),
    row("  reject    [--run <id|latest>]"),
    row("  rollback  [--run <id|latest>]"),
    row(""),
    row("  Flow:  agent → diff → approve ✓  (git branch + commit)"),
    row("                diff → reject  ✗  (restore from backups)"),
    row("         rollback undoes any past approved or applied run"),
    blank,
    div, row("\u25ba RUN LIFECYCLE"), blank,
    row("  init      --track <t> --idea <i> [--title \"...\"] [--goal \"...\"]"),
    row("  capture   --run <run-id|latest>"),
    row("  review    --run <run-id|latest> [--decision approved|rejected]"),
    row("  publish   --run <run-id|latest>"),
    blank,
    div, row("\u25ba OPERATIONS"), blank,
    row("  console     Operator dashboard with module launcher"),
    row("  doctor      Health check repos, model, and dashboard"),
    row("  status      Recent runs and queue state  [--limit N]"),
    row("  results     Inspect latest run detail  [--run <id|latest>]"),
    row("  dashboard   Refresh HTML dashboard"),
    row("  serve       Start control server  [--port 4400]"),
    row("  knowledge   Feature knowledge graph  [build|export]"),
    row("  prune       Clean old runs  [--keep N] [--dry-run]"),
    row("  export      JSONL dataset export  [--scope eligible|all]"),
    row("  reconcile   Re-evaluate run reviews  [--all]"),
    blank,
    div, row("\u25ba CONFIGURATION"), blank,
    row("  settings    View runtime and policy config"),
    row("  model       Show current model selection"),
    row("  model mode  <heuristic|ollama>"),
    row("  model use   <model-id>  [--provider ollama]"),
    blank,
    div, row("\u25ba MODULES"), blank,
    row("  Areas:  store \u00b7 paddling-out \u00b7 kortex \u00b7 kreator"),
    row("          kamera-quest \u00b7 frontend \u00b7 backend \u00b7 shared"),
    row(`  Tracks: ${Object.keys(config.tracks).join(" \u00b7 ")}`),
    blank, bot
  ];

  console.log(lines.join("\n"));
}

function printConsole(config, runtimeConfig, args) {
  const W = 68;
  const queueCounts = queueStatusCounts();
  const summary = readDashboardSummary();
  const modelRuntime = runtimeConfig.local_model_runtime || {};
  const reviewEngine = runtimeConfig.review_engine || {};
  const recentRuns = listRunManifests().slice(-5).reverse();
  const pad = (str, len) => str + " ".repeat(Math.max(0, len - str.length));
  const top = `  \u2554${"═".repeat(W)}\u2557`;
  const bot = `  \u255a${"═".repeat(W)}\u255d`;
  const div = `  \u2560${"═".repeat(W)}\u2563`;
  const row = (c) => `  \u2551  ${pad(c, W - 4)}  \u2551`;
  const blank = row("");
  const modules = [
    { key: "1", area: "store", name: "STORE", tags: "checkout \u00b7 cart \u00b7 payments \u00b7 products" },
    { key: "2", area: "paddling-out", name: "PADDLING OUT", tags: "forecast \u00b7 spots \u00b7 scores \u00b7 safety" },
    { key: "3", area: "kortex", name: "KORTEX", tags: "smart-links \u00b7 billing \u00b7 tenant \u00b7 auth" },
    { key: "4", area: "kreator", name: "KREATOR", tags: "onboard \u00b7 dashboard \u00b7 publishing" },
    { key: "5", area: "kamera", name: "KAMERA QUEST", tags: "cameras \u00b7 presets \u00b7 lenses \u00b7 skills" },
    { key: "6", area: "frontend", name: "SHARED", tags: "JS \u00b7 CSS \u00b7 drift \u00b7 debt reduction" }
  ];
  const lines = [];

  lines.push(top, blank);
  lines.push(row("K A A Y K O   A U T O M A T I O N   E N G I N E"));
  lines.push(row("\u2500".repeat(48)));
  lines.push(row("Local Model Loop  \u00b7  v2.0"));
  lines.push(blank);

  lines.push(div);
  lines.push(row("ENGINE"));
  lines.push(row(`  review    : ${reviewEngine.mode || "unknown"}`));
  lines.push(row(`  model     : ${modelRuntime.model || "unset"}`));
  lines.push(row(`  provider  : ${modelRuntime.provider || "unknown"}`));
  lines.push(row(`  execution : ${reviewEngine.mode === "heuristic" ? "evidence-only" : "model-driven"}`));
  lines.push(blank);

  lines.push(div);
  lines.push(row("SYSTEM"));
  lines.push(row(`  frontend  : ${relativeToRepo(path.resolve(REPO_ROOT, config.repos.kaayko.path))}`));
  lines.push(row(`  backend   : ${relativeToRepo(path.resolve(REPO_ROOT, config.repos["kaayko-api"].path))}`));
  lines.push(row(`  dashboard : ${relativeToRepo(path.join(DASHBOARD_ROOT, "index.html"))}`));
  lines.push(row(`  queue     : ${queueCounts.pending} pending \u2502 ${queueCounts.processing} active \u2502 ${queueCounts.done} done \u2502 ${queueCounts.failed} failed`));
  if (summary) {
    lines.push(row(`  runs      : ${summary.totals.runs} total \u2502 ${summary.totals.approved} approved \u2502 ${summary.totals.training_eligible} gold \u2502 ${summary.totals.gate_pass_rate}% gates`));
    lines.push(row(`  signal    : ${summary.totals.suggestions} suggestions \u2502 ${summary.totals.vulnerabilities} vulns \u2502 ${summary.totals.coached_products} guided`));
  }
  lines.push(blank);

  lines.push(div, blank);
  lines.push(row("\u25ba SELECT MODULE"));
  lines.push(blank);
  modules.forEach((mod) => {
    lines.push(row(`  [ ${mod.key} ]  ${pad(mod.name, 14)} ${mod.tags}`));
  });
  lines.push(blank);

  lines.push(div, blank);
  lines.push(row("\u25ba LAUNCH MISSION"));
  lines.push(blank);
  lines.push(row("  Run an agent on any module:"));
  lines.push(row("  $ kaayko agent --area store --goal \"Audit checkout\""));
  lines.push(row("  $ kaayko agent --area kortex --goal \"Harden tenant isolation\""));
  lines.push(row("  $ kaayko agent --area paddling-out --goal \"Fix forecast drift\""));
  lines.push(blank);
  lines.push(row("  Batch missions:"));
  lines.push(row("  $ kaayko mission --area frontend --goal \"Reduce drift\""));
  lines.push(row("  $ kaayko enqueue --track store --idea cart-audit --goal \"...\""));
  lines.push(row("  $ kaayko worker --limit 5"));
  lines.push(blank);

  lines.push(div, blank);
  lines.push(row("\u25ba REVIEW LOOP"));
  lines.push(blank);
  lines.push(row("  diff       See what the agent changed         [--full]"));
  lines.push(row("  approve    Git branch + commit approved edits [--no-branch]"));
  lines.push(row("  reject     Restore files from backups"));
  lines.push(row("  rollback   Undo any past run's applied edits"));
  lines.push(blank);
  lines.push(row("  Flow:  agent --interactive → diff → approve / reject"));
  lines.push(blank);

  lines.push(div, blank);
  lines.push(row("\u25ba OPERATIONS"));
  lines.push(blank);
  lines.push(row("  doctor       Health check engine, repos, model"));
  lines.push(row("  status       Recent runs and queue state"));
  lines.push(row("  results      Inspect latest run findings"));
  lines.push(row("  dashboard    Refresh the HTML dashboard"));
  lines.push(row("  knowledge    Build feature knowledge graph for models"));
  lines.push(row("  prune        Clean up old or failed runs"));
  lines.push(row("  export       Export JSONL training datasets"));
  lines.push(row("  settings     View runtime and policy config"));
  lines.push(row("  model        Configure local model and engine"));
  lines.push(blank);

  if (recentRuns.length) {
    lines.push(div, blank);
    lines.push(row("\u25ba RECENT MISSIONS"));
    lines.push(blank);
    recentRuns.forEach(({ manifest }) => {
      const coaching = resolveRunCoachingContext(manifest);
      const focus = coaching.focused_products.length ? coaching.focused_products[0] : "\u2014";
      const status = pad(manifest.review.decision.slice(0, 10), 10);
      const focusLabel = pad(focus.slice(0, 14), 14);
      const title = manifest.title.slice(0, 28);
      lines.push(row(`  ${status} \u2502 ${focusLabel} \u2502 ${title}`));
    });
    lines.push(blank);
  }

  lines.push(bot, "");
  console.log(lines.join("\n"));
}

function printSettings(config, runtimeConfig, args) {
  console.log("# Runtime Settings");
  console.log("");
  console.log(JSON.stringify(runtimeConfig, null, 2));
  console.log("");
  console.log("# Policy Settings");
  console.log("");
  console.log(JSON.stringify({
    training_policy: config.training_policy,
    auto_review_policy: config.auto_review_policy,
    tracks: Object.keys(config.tracks)
  }, null, 2));
}

function handleModelCommand(runtimeConfig, args) {
  const action = args._[1] || "show";
  const runtime = runtimeConfig.local_model_runtime || {};
  const presets = runtimeConfig.recommended_models || [];

  if (action === "mode") {
    const mode = String(args._[2] || args.mode || "").trim().toLowerCase();

    if (!["heuristic", "ollama"].includes(mode)) {
      throw new Error("`model mode` requires `heuristic` or `ollama`.");
    }

    runtimeConfig.review_engine = {
      ...(runtimeConfig.review_engine || {}),
      mode,
      notes:
        mode === "ollama"
          ? "Real local-model execution is enabled. `agent` will call the selected Ollama model and can apply guarded safe edits."
          : "The current pipeline uses heuristic auto-review. The local model selection below is the operator-selected runtime target for future local inference integration."
    };

    writeJson(RUNTIME_CONFIG_PATH, runtimeConfig);

    console.log(`Review engine updated`);
    console.log(`- Mode: ${runtimeConfig.review_engine.mode}`);
    console.log(`- Config: ${relativeToRepo(RUNTIME_CONFIG_PATH)}`);
    return;
  }

  if (action === "use") {
    const modelId = args._[2] || args.model;

    if (!modelId) {
      throw new Error("`model use` requires a model id, for example `qwen2.5-coder:14b`.");
    }

    runtimeConfig.local_model_runtime = {
      ...runtime,
      provider: args.provider || runtime.provider || "ollama",
      model: modelId,
      base_url: args["base-url"] || runtime.base_url || "http://127.0.0.1:11434"
    };

    writeJson(RUNTIME_CONFIG_PATH, runtimeConfig);

    console.log(`Model updated`);
    console.log(`- Provider: ${runtimeConfig.local_model_runtime.provider}`);
    console.log(`- Model: ${runtimeConfig.local_model_runtime.model}`);
    console.log(`- Base URL: ${runtimeConfig.local_model_runtime.base_url}`);
    console.log(`- Config: ${relativeToRepo(RUNTIME_CONFIG_PATH)}`);
    return;
  }

  console.log("Current Model Runtime");
  console.log(`- Review engine mode: ${runtimeConfig.review_engine?.mode || "unknown"}`);
  console.log(`- Provider: ${runtime.provider || "unknown"}`);
  console.log(`- Model: ${runtime.model || "unset"}`);
  console.log(`- Base URL: ${runtime.base_url || "unset"}`);
  console.log(`- Temperature: ${runtime.temperature ?? "unset"}`);
  console.log(`- Max tokens: ${runtime.max_tokens ?? "unset"}`);
  console.log("");
  console.log("Recommended Models");
  presets.forEach((preset) => {
    console.log(`- ${preset.id} | ${preset.label} | ${preset.fit}`);
  });
}

function buildModelRoster(runtimeConfig) {
  const runtime = runtimeConfig.local_model_runtime || {};
  const recommended = (runtimeConfig.recommended_models || []).map((m) => ({
    id: m.id,
    name: m.label || m.id,
    note: m.fit || "",
    provider: m.provider || "ollama"
  }));

  let installedModels = [];
  try {
    const tags = fetchOllamaTags(runtime, 5000);
    installedModels = tags.map((t) => ({
      id: t.name || t.model,
      size: t.size ? `${(t.size / (1024 * 1024 * 1024)).toFixed(1)} GB` : "?",
      modified: t.modified_at || ""
    }));
  } catch (_) {
    // Ollama not running or unreachable — show recommended list only
  }

  const installedIds = new Set(installedModels.map((m) => m.id));
  const roster = [];

  // Merge: recommended models with install status
  for (const rec of recommended) {
    const installed = installedModels.find((m) => m.id === rec.id);
    roster.push({
      id: rec.id,
      name: rec.name,
      note: rec.note,
      installed: installedIds.has(rec.id),
      size: installed ? installed.size : "",
      active: rec.id === runtime.model,
      source: "recommended"
    });
  }

  // Append installed models not in recommended list
  const recommendedIds = new Set(recommended.map((m) => m.id));
  for (const inst of installedModels) {
    if (!recommendedIds.has(inst.id)) {
      roster.push({
        id: inst.id,
        name: inst.id,
        note: "Locally installed",
        installed: true,
        size: inst.size,
        active: inst.id === runtime.model,
        source: "local"
      });
    }
  }

  return roster;
}

function runDoctor(config, runtimeConfig, args) {
  const checks = [];
  const ollamaPath = whichBinary("ollama");
  const dashboardSummaryPath = path.join(DASHBOARD_ROOT, "summary.json");
  const runtime = runtimeConfig.local_model_runtime || {};

  checks.push(makeCheck("frontend repo", fs.existsSync(path.join(REPO_ROOT, config.repos.kaayko.path)), relativeToRepo(path.join(REPO_ROOT, config.repos.kaayko.path))));
  checks.push(makeCheck("backend repo", fs.existsSync(path.join(REPO_ROOT, config.repos["kaayko-api"].path)), relativeToRepo(path.join(REPO_ROOT, config.repos["kaayko-api"].path))));
  checks.push(makeCheck("portfolio config", fs.existsSync(CONFIG_PATH), relativeToRepo(CONFIG_PATH)));
  checks.push(makeCheck("runtime config", fs.existsSync(RUNTIME_CONFIG_PATH), relativeToRepo(RUNTIME_CONFIG_PATH)));
  checks.push(makeCheck("ollama binary", Boolean(ollamaPath), ollamaPath || "not found"));
  checks.push(
    makeCheck(
      "dashboard summary",
      fs.existsSync(dashboardSummaryPath),
      fs.existsSync(dashboardSummaryPath) ? relativeToRepo(dashboardSummaryPath) : "generate with `./automation/kaayko dashboard`"
    )
  );

  if (runtimeConfig.review_engine?.mode === "ollama" && runtime.base_url) {
    try {
      const models = fetchOllamaTags(runtime, 5000);
      const selectedInstalled = models.some((model) => model.name === runtime.model || model.model === runtime.model);

      checks.push(makeCheck("ollama service", true, runtime.base_url));
      checks.push(
        makeCheck(
          "selected model",
          selectedInstalled,
          selectedInstalled ? `${runtime.model} is installed` : `${runtime.model} is not installed on the local Ollama daemon`
        )
      );
    } catch (error) {
      checks.push(makeCheck("ollama service", false, error.message));
    }
  }

  console.log("KAAYKO CLI DOCTOR");
  console.log("");
  checks.forEach((check) => {
    console.log(`${check.ok ? "[ok]" : "[warn]"} ${check.label}: ${check.detail}`);
  });
  console.log("");
  console.log(`Selected model: ${runtimeConfig.local_model_runtime?.provider || "unknown"} / ${runtimeConfig.local_model_runtime?.model || "unset"}`);
  console.log(`Review engine: ${runtimeConfig.review_engine?.mode || "unknown"}`);
  if (runtimeConfig.review_engine?.mode === "heuristic") {
    console.log("Execution mode: evidence-only (no Ollama-driven repo edits yet)");
  }

  return { checks };
}

function printResults(config, args) {
  const run = loadRun(args.run);
  const manifest = run.manifest;
  const review = loadReview(run.runDir);
  const coaching = resolveRunCoachingContext(manifest);
  const learningsPublishedAt = resolveLearningsPublishedAt(manifest);
  const openFindings = (review.findings || []).filter((finding) => {
    const status = String(finding.status || "open").toLowerCase();
    return status !== "resolved" && status !== "waived";
  });
  const dashboardPath = path.join(DASHBOARD_ROOT, "index.html");
  const approvedDatasetPath = path.join(DATASETS_ROOT, "approved-trajectories.jsonl");
  const fullDatasetPath = path.join(DATASETS_ROOT, "trajectories.jsonl");
  const findingsDatasetPath = path.join(DATASETS_ROOT, "review-findings.jsonl");

  console.log("KAAYKO CLI RESULTS");
  console.log("");
  console.log(`Run ID        : ${manifest.run_id}`);
  console.log(`Track         : ${manifest.track}`);
  console.log(`Title         : ${manifest.title}`);
  console.log(`Status        : ${manifest.status}`);
  console.log(`Review        : ${review.decision}`);
  console.log(`Training Gold : ${manifest.datasets.eligible ? "yes" : "no"}`);
  console.log(`Learnings Log : ${learningsPublishedAt ? "written" : "not written"}`);
  console.log(`Suggestions   : ${openFindings.filter(isSuggestionFinding).length + (review.required_followups || []).length}`);
  console.log(`Vulnerabilities: ${openFindings.filter(isVulnerabilityFinding).length}`);
  console.log(`Guided Areas  : ${coaching.guided_products.join(", ") || "none"}`);
  console.log(`Primary Focus : ${coaching.focused_products.join(", ") || "none"}`);
  console.log("");
  console.log("OUTPUTS");
  console.log(`  run folder  : ${relativeToRepo(run.runDir)}`);
  console.log(`  spec        : ${manifest.artifacts.spec_path}`);
  console.log(`  review md   : ${manifest.artifacts.review_notes_path}`);
  console.log(`  review json : ${manifest.artifacts.review_json_path}`);
  if (manifest.artifacts.agent_briefing_path) {
    console.log(`  briefing md : ${manifest.artifacts.agent_briefing_path}`);
  }
  if (manifest.artifacts.agent_analysis_path) {
    console.log(`  agent md    : ${manifest.artifacts.agent_analysis_path}`);
  }
  if (manifest.artifacts.agent_response_path) {
    console.log(`  agent json  : ${manifest.artifacts.agent_response_path}`);
  }
  if (manifest.artifacts.learning_summary_path) {
    console.log(`  learning md : ${manifest.artifacts.learning_summary_path}`);
  }
  if (manifest.artifacts.learning_latest_path) {
    console.log(`  learning js : ${manifest.artifacts.learning_latest_path}`);
  }
  console.log(`  dashboard   : ${relativeToRepo(dashboardPath)}`);
  console.log(`  gold data   : ${relativeToRepo(approvedDatasetPath)}`);
  console.log(`  all data    : ${relativeToRepo(fullDatasetPath)}`);
  console.log(`  findings    : ${relativeToRepo(findingsDatasetPath)}`);
  console.log("");
  console.log("DOCS");
  console.log(`  source docs : ${coaching.source_docs.join(", ") || "none"}`);
  console.log("");
  console.log("NEXT");
  console.log(`  inspect run : open ${relativeToRepo(run.runDir)}`);
  console.log(`  refresh ui  : ./automation/kaayko dashboard`);
  console.log(`  new mission : ./automation/kaayko mission --area frontend --goal "Analyse frontend and improve it"`);

  return { runDir: run.runDir, manifest, review };
}

function runAgent(config, runtimeConfig, args) {
  const area = String(args.area || "shared").toLowerCase();
  const goal = args.goal || args._.slice(1).join(" ").trim();
  const mode = String(args.mode || "pipeline").toLowerCase();
  const modelRuntime = runtimeConfig.local_model_runtime || {};
  const reviewEngine = runtimeConfig.review_engine || {};
  const allowEvidenceOnly = resolveBooleanArg(args["allow-evidence-only"], false);
  const applyMode = String(args.apply || "safe").toLowerCase();
  const coachingBundle = buildAgentCoachingBundle(resolveMissionTrack(area), area, goal);

  if (!goal) {
    throw new Error("`agent` requires --goal \"...\".");
  }

  if (!["pipeline"].includes(mode)) {
    throw new Error("`agent` currently supports only `--mode pipeline`.");
  }

  if (!["safe", "none"].includes(applyMode)) {
    throw new Error("`agent --apply` must be `safe` or `none`.");
  }

  if (reviewEngine.mode === "heuristic" && !allowEvidenceOnly) {
    throw new Error(
      "`agent` is disabled while review_engine.mode=heuristic because that mode does not run model-driven analysis or edits. Use `./automation/kaayko mission ...` for evidence capture only, or rerun with `--allow-evidence-only` if you intentionally want the non-agent pipeline."
    );
  }

  if (!resolveBooleanArg(args.silent, false)) {
    console.log("KAAYKO AGENT");
    console.log(`- Area: ${area}`);
    console.log(`- Goal: ${goal}`);
    console.log(`- Mode: ${mode}`);
    console.log(`- Review engine: ${reviewEngine.mode || "unknown"}`);
    console.log(`- Provider: ${modelRuntime.provider || "unknown"}`);
    console.log(`- Model: ${modelRuntime.model || "unset"}`);
    console.log(`- Apply mode: ${applyMode}`);
    console.log(`- Guided products: ${coachingBundle.guided_products.length ? coachingBundle.guided_products.join(", ") : "None"}`);
    console.log(`- Primary focus: ${coachingBundle.focused_products.length ? coachingBundle.focused_products.join(", ") : "None"}`);
    if (reviewEngine.mode === "heuristic") {
      console.log("- Execution: evidence-only pipeline; no Ollama-driven code edits will run.");
    }
    console.log("");
  }

  if (reviewEngine.mode === "heuristic") {
    return runMission(config, {
      ...args,
      area,
      goal,
      mode,
      source: "agent"
    });
  }

  return runModelDrivenAgent(config, runtimeConfig, {
    ...args,
    area,
    goal,
    mode,
    apply: applyMode,
    source: "agent"
  });
}

function runMission(config, args) {
  const goal = args.goal || args._.slice(1).join(" ").trim();

  if (!goal) {
    throw new Error("`mission` requires --goal \"...\".");
  }

  const area = String(args.area || "shared").toLowerCase();
  const track = resolveMissionTrack(area);
  const mode = String(args.mode || "pipeline").toLowerCase();
  const title = args.title || goal;
  const idea = args.idea || slugify(goal).slice(0, 48) || `${track}-mission`;
  const missionArgs = {
    track,
    idea,
    title,
    goal,
    area,
    mode: args.kind || "coding",
    source: args.source || "mission",
    publish: args.publish,
    export: args.export,
    dashboard: args.dashboard,
    "review-mode": args["review-mode"] || args.reviewMode || "auto",
    "approve-training-if-clean": args["approve-training-if-clean"],
    decision: args.decision
  };

  if (mode === "queue") {
    return enqueueTask(config, missionArgs);
  }

  return pipelineRun(config, missionArgs);
}

function initRun(config, args) {
  const created = createRun(config, args);

  if (!resolveBooleanArg(args.silent, false)) {
    console.log(`Created run ${created.manifest.run_id}`);
    console.log(`Run folder: ${relativeToRepo(created.runDir)}`);
    console.log(`Next: fill ${created.manifest.artifacts.spec_path}, do the work, then run capture.`);
  }

  return created;
}

function pipelineRun(config, args) {
  if (resolveBooleanArg(args["dry-run"], false)) {
    validateInitArgs(config, args);
    const track = args.track;
    const idea = args.idea;
    const title = args.title || idea.replace(/[-_]/g, " ");
    const goal = args.goal || "Document the goal before implementation starts.";
    const reviewMode = String(args["review-mode"] || args.reviewMode || "auto").toLowerCase();
    console.log("[dry-run] Pipeline would execute:");
    console.log(`  track       : ${track}`);
    console.log(`  idea        : ${idea}`);
    console.log(`  title       : ${title}`);
    console.log(`  goal        : ${goal}`);
    console.log(`  review-mode : ${reviewMode}`);
    console.log(`  steps       : init → capture → ${reviewMode === "auto" ? "auto-review → " : ""}publish → export → dashboard`);
    return null;
  }

  const created = createRun(config, args);
  const capture = captureRunInternal(config, created.manifest.run_id);
  const reviewMode = String(args["review-mode"] || args.reviewMode || "auto").toLowerCase();
  let review = null;
  let published = null;
  let datasetExport = null;
  let dashboard = null;

  if (reviewMode === "auto") {
    applyAutoReview(config, created.runDir, {
      approveTrainingIfClean: resolveBooleanArg(
        args["approve-training-if-clean"],
        config.auto_review_policy.auto_training_approval_if_clean
      ),
      forceTrainingApproval: resolveBooleanArg(args["force-training-approval"], false)
    });
    review = reviewRunInternal(config, created.manifest.run_id);
  } else if (args.decision) {
    review = reviewRunInternal(config, created.manifest.run_id, args.decision);
  }

  if (resolveBooleanArg(args.publish, true) && review && review.review.decision !== "pending") {
    published = publishRunInternal(config, created.manifest.run_id);
  }

  if (resolveBooleanArg(args.export, true)) {
    datasetExport = exportDatasets(config, { scope: args.scope || "eligible", silent: true }, true);
  }

  if (resolveBooleanArg(args.dashboard, true)) {
    dashboard = generateDashboard(config, { silent: true }, true);
  }

  if (!resolveBooleanArg(args.silent, false)) {
    console.log(`Pipeline completed for ${created.manifest.run_id}`);
    console.log(`- Capture status: ${capture.manifest.status}`);
    console.log(`- Final run status: ${review ? review.manifest.status : capture.manifest.status}`);
    console.log(`- Review decision: ${review ? review.review.decision : "pending"}`);
    console.log(
      `- Training eligible: ${review ? review.manifest.datasets.eligible : created.manifest.datasets.eligible}`
    );
    console.log(`- Learnings snapshot written: ${published ? "yes" : "no"}`);
    console.log(`- Dashboard refreshed: ${dashboard ? "yes" : "no"}`);
    console.log(`- Dataset export refreshed: ${datasetExport ? "yes" : "no"}`);
  }

  return { created, capture, review, published, datasetExport, dashboard };
}

function runModelDrivenAgent(config, runtimeConfig, args) {
  const area = String(args.area || "shared").toLowerCase();
  const track = resolveMissionTrack(area);
  const title = args.title || args.goal;
  const idea = args.idea || slugify(args.goal).slice(0, 48) || `${track}-agent`;
  const applyMode = String(args.apply || "safe").toLowerCase();
  const created = createRun(config, {
    track,
    idea,
    title,
    goal: args.goal,
    area,
    mode: args.kind || "coding",
    source: args.source || "agent"
  });
  const runId = created.manifest.run_id;
  const runDir = created.runDir;
  let agentSession = null;
  let capture = null;
  let review = null;
  let published = null;
  let datasetExport = null;
  let dashboard = null;

  try {
    if (!resolveBooleanArg(args.silent, false)) {
      console.log(`[1/6] Planning agent context for ${runId}`);
    }

    updateRunManifest(runDir, (manifest) => {
      manifest.status = "agent_planning";
      manifest.agent = {
        provider: runtimeConfig.local_model_runtime?.provider || "unknown",
        model: runtimeConfig.local_model_runtime?.model || "unset",
        apply_mode: applyMode,
        area,
        stage: "planning",
        selected_files: [],
        applied_files: [],
        last_error: null,
        started_at: new Date().toISOString(),
        completed_at: null
      };
      return manifest;
    });

    agentSession = agentRunner.executeLocalModelAgent(config, runtimeConfig, runDir, created.manifest, {
      ...args,
      area,
      apply: applyMode
    }, {
      ensureDir, writeText, writeJson, loadJson, updateRunManifest, relativeToRepo,
      resolvePrefixedPath, resolveRepo, resolveAgentRoots, slugify,
      buildAgentCoachingBundle, buildAgentCoachingMarkdown, buildAgentCoachingPromptSection,
      resolveRunCoachingContext, invokeOllamaPrompt, parseAgentJsonResponse, REPO_ROOT
    });

    if (!resolveBooleanArg(args.silent, false)) {
      const modeLabel = agentSession.goal_mode === "audit" ? "AUDIT" : "EDIT";
      console.log(`[2/6] Model completed (${modeLabel}): ${agentSession.selected_files.length} files inspected, ${agentSession.applied_edits.length} safe edit(s) applied`);
      if (agentSession.verification) {
        const v = agentSession.verification;
        console.log(`       Verification: syntax=${v.syntax_check.passed ? "✓" : "✗"} lint=${v.lint_check.skipped ? "⊘" : v.lint_check.passed ? "✓" : "⚠"} → ${v.summary}`);
      }
    }

    if (resolveBooleanArg(args.interactive, false) && agentSession.applied_edits.length > 0) {
      console.log("");
      console.log("  ╔══════════════════════════════════════════════════════╗");
      console.log("  ║  VERIFIED LOCALLY — REVIEW BEFORE PROCEEDING        ║");
      console.log("  ╠══════════════════════════════════════════════════════╣");
      console.log("  ║                                                      ║");
      const v = agentSession.verification || {};
      console.log(`  ║  Syntax:  ${(v.syntax_check?.passed ? "✓ PASSED" : "✗ FAILED").padEnd(42)}║`);
      console.log(`  ║  Lint:    ${(v.lint_check?.skipped ? "⊘ SKIPPED" : v.lint_check?.passed ? "✓ PASSED" : "⚠ WARNINGS").padEnd(42)}║`);
      console.log("  ║                                                      ║");
      agentSession.applied_edits.forEach((edit) => {
        const short = edit.path.length > 48 ? "..." + edit.path.slice(-45) : edit.path;
        console.log(`  ║    ✎  ${short.padEnd(48)}║`);
      });
      if (agentSession.rejected_edits.length) {
        console.log("  ║                                                      ║");
        agentSession.rejected_edits.forEach((edit) => {
          const short = (edit.path || "?").length > 45 ? "..." + edit.path.slice(-42) : (edit.path || "?");
          console.log(`  ║    ✗  ${short.padEnd(48)}║`);
        });
      }
      console.log("  ║                                                      ║");
      console.log("  ║  Review changes:                                     ║");
      console.log(`  ║    $ kaayko diff --run ${runId.slice(0, 20)}…  ║`);
      console.log("  ║                                                      ║");
      console.log("  ║  Then choose:                                        ║");
      console.log(`  ║    $ kaayko approve --run ${runId.slice(0, 17)}…  ║`);
      console.log(`  ║    $ kaayko reject  --run ${runId.slice(0, 17)}…  ║`);
      console.log("  ║                                                      ║");
      console.log("  ╚══════════════════════════════════════════════════════╝");
      console.log("");
      console.log(`  Full run ID: ${runId}`);
      return { created, agentSession, capture: null, review: null, published: null, datasetExport: null, dashboard: null };
    }

    if (!resolveBooleanArg(args.silent, false)) {
      console.log(`[3/6] Capturing git state and quality gates`);
    }

    capture = captureRunInternal(config, runId);

    if (!resolveBooleanArg(args.silent, false)) {
      console.log(`[4/6] Building review evidence`);
    }

    applyAutoReview(config, runDir, {
      approveTrainingIfClean: resolveBooleanArg(
        args["approve-training-if-clean"],
        config.auto_review_policy.auto_training_approval_if_clean
      ),
      forceTrainingApproval: resolveBooleanArg(args["force-training-approval"], false)
    });
    review = reviewRunInternal(config, runId);

    if (resolveBooleanArg(args.publish, true) && review.review.decision !== "pending") {
      if (!resolveBooleanArg(args.silent, false)) {
        console.log(`[5/6] Writing learnings snapshot`);
      }
      published = publishRunInternal(config, runId);
    }

    if (!resolveBooleanArg(args.silent, false)) {
      console.log(`[6/6] Refreshing datasets and dashboard`);
    }

    if (resolveBooleanArg(args.export, true)) {
      datasetExport = exportDatasets(config, { scope: args.scope || "eligible", silent: true }, true);
    }

    if (resolveBooleanArg(args.dashboard, true)) {
      dashboard = generateDashboard(config, { silent: true }, true);
    }
  } catch (error) {
    updateRunManifest(runDir, (manifest) => {
      manifest.status = "agent_failed";
      manifest.agent = {
        ...(manifest.agent || {}),
        stage: "failed",
        last_error: error.message,
        completed_at: new Date().toISOString()
      };
      return manifest;
    });

    if (resolveBooleanArg(args.dashboard, true)) {
      generateDashboard(config, { silent: true }, true);
    }

    throw error;
  }

  if (!resolveBooleanArg(args.silent, false)) {
    console.log(`Agent completed for ${runId}`);
    console.log(`- Goal mode: ${agentSession ? agentSession.goal_mode : "unknown"}`);
    console.log(`- Final run status: ${review ? review.manifest.status : capture?.manifest.status || "unknown"}`);
    console.log(`- Review decision: ${review ? review.review.decision : "pending"}`);
    console.log(`- Files inspected: ${agentSession ? agentSession.selected_files.length : 0}`);
    console.log(`- Safe edits applied: ${agentSession ? agentSession.applied_edits.length : 0}`);
    if (agentSession?.verification) {
      console.log(`- Verification: ${agentSession.verification.summary}`);
    }
    console.log(`- Training eligible: ${review ? review.manifest.datasets.eligible : false}`);
    console.log(`- Learnings snapshot written: ${published ? "yes" : "no"}`);
    console.log(`- Dashboard refreshed: ${dashboard ? "yes" : "no"}`);
    console.log(`- Dataset export refreshed: ${datasetExport ? "yes" : "no"}`);
  }

  return { created, agentSession, capture, review, published, datasetExport, dashboard };
}


// ─── Agent module delegation ───
// executeLocalModelAgent → agent-runner.js
// File collection/scoring/loading → agent-files.js
// Prompt building (edit + audit modes) → agent-prompts.js
// Edit verification + user approval gate → agent-verify.js
//
// Only resolveAgentRoots, Ollama invocation, and parseAgentJsonResponse remain here
// because they are passed as helpers to the agent modules.

function resolveAgentRoots(config, manifest, area) {
  const normalizedArea = String(area || "shared").toLowerCase();
  const roots = [];
  const addRepoRoot = (repoKey, repoSubpath, logicalRoot) => {
    const repo = resolveRepo(config, repoKey);
    const absoluteRoot = path.join(repo.absolute_path, repoSubpath);
    roots.push({ repoKey, absoluteRoot, logicalRoot });
  };

  if (normalizedArea === "frontend") {
    addRepoRoot("kaayko", "src", "src");
    return roots;
  }

  if (normalizedArea === "backend") {
    addRepoRoot("kaayko-api", "functions", "functions");
    addRepoRoot("kaayko-api", "ml-service", "ml-service");
    return roots.filter((item) => fs.existsSync(item.absoluteRoot));
  }

  manifest.repos.forEach((repoKey) => {
    if (repoKey === "kaayko") {
      addRepoRoot(repoKey, "src", "src");
    }

    if (repoKey === "kaayko-api") {
      addRepoRoot(repoKey, "functions", "functions");
      addRepoRoot(repoKey, "ml-service", "ml-service");
    }
  });

  return roots.filter((item) => fs.existsSync(item.absoluteRoot));
}

function invokeOllamaPrompt(runtime, prompt, label) {
  const binary = whichBinary("ollama");
  const httpErrors = [];
  const allowCliFallback = runtime.allow_cli_fallback === true;

  if (!runtime.model) {
    throw new Error(`No local model is configured for ${label}. Use \`./automation/kaayko model use <model>\`.`);
  }

  if (runtime.base_url) {
    try {
      return invokeOllamaHttpPrompt(runtime, prompt, label);
    } catch (error) {
      httpErrors.push(error.message);
    }
  }

  if (runtime.base_url && !allowCliFallback) {
    throw new Error(`Ollama HTTP ${label} failed and CLI fallback is disabled: ${httpErrors.join("; ") || "unknown HTTP error"}`);
  }

  if (!binary) {
    throw new Error(
      `Ollama is required for ${label}, but the HTTP endpoint failed (${httpErrors.join("; ") || "no endpoint configured"}) and the \`ollama\` binary was not found.`
    );
  }

  const env = { ...process.env };

  if (runtime.base_url) {
    try {
      env.OLLAMA_HOST = new URL(runtime.base_url).host;
    } catch (error) {
      env.OLLAMA_HOST = runtime.base_url;
    }
  }

  const result = spawnSync(binary, ["run", runtime.model, prompt], {
    cwd: REPO_ROOT,
    env,
    encoding: "utf8",
    timeout: Number(runtime.timeout_ms || 120000),
    maxBuffer: 24 * 1024 * 1024
  });

  if (result.error) {
    throw new Error(`Ollama ${label} failed: ${result.error.message}`);
  }

  if (result.status !== 0) {
    throw new Error(`Ollama ${label} failed with exit code ${result.status}: ${String(result.stderr || result.stdout || "").trim()}`);
  }

  const output = String(result.stdout || "").trim();

  if (!output) {
    throw new Error(`Ollama ${label} returned no output.`);
  }

  return output;
}

function invokeOllamaHttpPrompt(runtime, prompt, label) {
  const curl = whichBinary("curl");

  if (!curl) {
    throw new Error("curl is required for Ollama HTTP requests.");
  }

  const requestUrl = `${String(runtime.base_url || "http://127.0.0.1:11434").replace(/\/$/, "")}/api/generate`;
  const payload = {
    model: runtime.model,
    prompt,
    stream: false,
    options: {
      temperature: runtime.temperature ?? 0.1,
      num_predict: runtime.max_tokens ?? 4096
    }
  };
  const payloadPath = path.join(os.tmpdir(), `kaayko-ollama-${process.pid}-${Date.now()}.json`);

  fs.writeFileSync(payloadPath, `${JSON.stringify(payload)}\n`);

  try {
    const result = spawnSync(
      curl,
      ["-sS", "-X", "POST", requestUrl, "-H", "Content-Type: application/json", "--data-binary", `@${payloadPath}`],
      {
        cwd: REPO_ROOT,
        encoding: "utf8",
        timeout: Number(runtime.timeout_ms || 120000),
        maxBuffer: 24 * 1024 * 1024,
        env: process.env
      }
    );

    if (result.error) {
      throw new Error(result.error.message);
    }

    if (result.status !== 0) {
      throw new Error(String(result.stderr || result.stdout || "").trim() || `curl exit ${result.status}`);
    }

    const parsed = JSON.parse(String(result.stdout || "{}"));
    const responseText = String(parsed.response || "").trim();

    if (!responseText) {
      throw new Error(`Ollama ${label} returned an empty HTTP response payload.`);
    }

    return responseText;
  } catch (error) {
    throw new Error(`Ollama HTTP ${label} failed: ${error.message}`);
  } finally {
    if (fs.existsSync(payloadPath)) {
      fs.unlinkSync(payloadPath);
    }
  }
}

function fetchOllamaTags(runtime, timeoutMs = 5000) {
  const curl = whichBinary("curl");

  if (!curl) {
    throw new Error("curl is required to query the Ollama daemon.");
  }

  const requestUrl = `${String(runtime.base_url || "http://127.0.0.1:11434").replace(/\/$/, "")}/api/tags`;
  const result = spawnSync(curl, ["-sS", requestUrl], {
    cwd: REPO_ROOT,
    encoding: "utf8",
    timeout: timeoutMs,
    maxBuffer: 4 * 1024 * 1024,
    env: process.env
  });

  if (result.error) {
    throw new Error(result.error.message);
  }

  if (result.status !== 0) {
    throw new Error(String(result.stderr || result.stdout || "").trim() || `curl exit ${result.status}`);
  }

  const parsed = JSON.parse(String(result.stdout || "{}"));
  return Array.isArray(parsed.models) ? parsed.models : [];
}

function parseAgentJsonResponse(rawText, label) {
  const candidates = [
    String(rawText || "").trim(),
    extractCodeFence(rawText),
    extractJsonBlock(rawText)
  ].filter(Boolean);

  for (const candidate of candidates) {
    try {
      return JSON.parse(candidate);
    } catch (error) {
      // continue trying fallbacks
    }
  }

  throw new Error(`Could not parse JSON from Ollama ${label} response.`);
}

function resolvePrefixedPath(prefixedPath) {
  const [repoKey, ...rest] = String(prefixedPath || "").split(":");
  const relativePath = rest.join(":");

  if (!repoKey || !relativePath) {
    throw new Error(`Invalid repo-prefixed path: ${prefixedPath}`);
  }

  const repoRoots = {
    kaayko: path.resolve(REPO_ROOT, "."),
    "kaayko-api": path.resolve(REPO_ROOT, "../kaayko-api")
  };
  const repoRoot = repoRoots[repoKey];

  if (!repoRoot) {
    throw new Error(`Unknown repo prefix in path: ${prefixedPath}`);
  }

  return path.join(repoRoot, relativePath);
}

function extractCodeFence(text) {
  const match = String(text || "").match(/```(?:json)?\s*([\s\S]*?)```/i);
  return match ? match[1].trim() : "";
}

function extractJsonBlock(text) {
  const source = String(text || "");
  const firstBrace = source.indexOf("{");
  const lastBrace = source.lastIndexOf("}");

  if (firstBrace === -1 || lastBrace === -1 || lastBrace <= firstBrace) {
    return "";
  }

  return source.slice(firstBrace, lastBrace + 1).trim();
}

function updateRunManifest(runDir, updater) {
  const manifestPath = path.join(runDir, "manifest.json");
  const manifest = loadJson(manifestPath);
  const updated = typeof updater === "function" ? updater(manifest) || manifest : { ...manifest, ...updater };

  updated.updated_at = new Date().toISOString();
  writeJson(manifestPath, updated);
  return updated;
}

function enqueueTask(config, args) {
  validateInitArgs(config, args);

  const createdAt = new Date().toISOString();
  const taskId = `${formatRunTimestamp(new Date())}-${slugify(`${args.track}-${args.idea}`).slice(0, 48)}`;
  const task = {
    schema_version: config.schema_version,
    task_id: taskId,
    created_at: createdAt,
    status: "pending",
    input: {
      track: args.track,
      idea: args.idea,
      title: args.title || args.idea.replace(/[-_]/g, " "),
      goal: args.goal || "Execute the requested change and preserve training-quality evidence.",
      mode: args.mode || "coding"
    },
    options: {
      review_mode: String(args["review-mode"] || args.reviewMode || "auto").toLowerCase(),
      publish: resolveBooleanArg(args.publish, true),
      export: resolveBooleanArg(args.export, true),
      dashboard: resolveBooleanArg(args.dashboard, true),
      approve_training_if_clean: resolveBooleanArg(
        args["approve-training-if-clean"],
        config.auto_review_policy.auto_training_approval_if_clean
      )
    }
  };

  ensureAutomationDirs();

  const taskPath = path.join(QUEUE_DIRS.pending, `${taskId}.json`);
  writeJson(taskPath, task);

  console.log(`Queued task ${taskId}`);
  console.log(`- Pending file: ${relativeToRepo(taskPath)}`);

  return { task, taskPath };
}

function runWorker(config, args) {
  ensureAutomationDirs();

  const limit = Number(args.limit || 1);
  const pendingFiles = listJsonFiles(QUEUE_DIRS.pending).slice(0, limit);
  const results = [];

  if (!pendingFiles.length) {
    const dashboard = resolveBooleanArg(args.dashboard, true)
      ? generateDashboard(config, { silent: true }, true)
      : null;
    const datasetExport = resolveBooleanArg(args.export, true)
      ? exportDatasets(config, { scope: args.scope || "eligible", silent: true }, true)
      : null;

    console.log("No pending tasks in automation/queue/pending.");
    console.log(`- Dashboard refreshed: ${dashboard ? "yes" : "no"}`);
    console.log(`- Dataset export refreshed: ${datasetExport ? "yes" : "no"}`);
    return { processed: 0, failed: 0, results };
  }

  pendingFiles.forEach((pendingPath) => {
    const fileName = path.basename(pendingPath);
    const processingPath = path.join(QUEUE_DIRS.processing, fileName);
    let task = null;

    try {
      fs.renameSync(pendingPath, processingPath);
    } catch (renameError) {
      if (renameError.code === "ENOENT") {
        return;
      }
      throw renameError;
    }

    try {
      task = loadJson(processingPath);

      const result = pipelineRun(
        config,
        {
          track: task.input.track,
          idea: task.input.idea,
          title: task.input.title,
          goal: task.input.goal,
          mode: task.input.mode,
          "review-mode": task.options.review_mode,
          "approve-training-if-clean": String(task.options.approve_training_if_clean),
          publish: "false",
          export: "false",
          dashboard: "false",
          silent: true,
          taskId: task.task_id,
          source: "queue-worker"
        }
      );

      const completedTask = {
        ...task,
        status: "done",
        completed_at: new Date().toISOString(),
        result: {
          run_id: result.created.manifest.run_id,
          run_status: result.review ? result.review.manifest.status : result.capture.manifest.status,
          review_decision: result.review ? result.review.review.decision : "pending",
          training_eligible: result.review ? result.review.manifest.datasets.eligible : false
        }
      };
      const donePath = path.join(QUEUE_DIRS.done, fileName);

      fs.renameSync(processingPath, donePath);
      writeJson(donePath, completedTask);
      results.push({ status: "done", task_id: task.task_id, run_id: completedTask.result.run_id });
    } catch (error) {
      const failedTask = {
        ...(task || {
          schema_version: config.schema_version,
          task_id: path.basename(fileName, ".json"),
          created_at: new Date().toISOString()
        }),
        status: "failed",
        failed_at: new Date().toISOString(),
        error: error.message
      };
      const failedPath = path.join(QUEUE_DIRS.failed, fileName);

      fs.renameSync(processingPath, failedPath);
      writeJson(failedPath, failedTask);
      results.push({ status: "failed", task_id: failedTask.task_id, error: error.message });
    }
  });

  const dashboard = resolveBooleanArg(args.dashboard, true)
    ? generateDashboard(config, { silent: true }, true)
    : null;
  const datasetExport = resolveBooleanArg(args.export, true)
    ? exportDatasets(config, { scope: args.scope || "eligible", silent: true }, true)
    : null;
  const failedCount = results.filter((item) => item.status === "failed").length;

  console.log(`Worker processed ${results.length} task(s)`);
  console.log(`- Failed: ${failedCount}`);
  console.log(`- Dashboard refreshed: ${dashboard ? "yes" : "no"}`);
  console.log(`- Dataset export refreshed: ${datasetExport ? "yes" : "no"}`);

  return { processed: results.length, failed: failedCount, results, dashboard, datasetExport };
}

function createRun(config, args) {
  validateInitArgs(config, args);

  const track = args.track;
  const idea = args.idea;
  const now = new Date();
  const nowIso = now.toISOString();
  const trackConfig = config.tracks[track];
  const title = args.title || idea.replace(/[-_]/g, " ");
  const goal = args.goal || "Document the goal before implementation starts.";
  const mode = args.mode || "coding";
  const runId = `${formatRunTimestamp(now)}-${slugify(`${track}-${idea}`).slice(0, 48)}`;
  const runDir = path.join(RUNS_ROOT, runId);
  const coachingBundle = buildAgentCoachingBundle(track, args.area, goal);
  const notesDir = path.join(runDir, "notes");
  const reviewDir = path.join(runDir, "review");
  const artifactsCommandsDir = path.join(runDir, "artifacts", "commands");
  const artifactsGitDir = path.join(runDir, "artifacts", "git");
  const exportsDir = path.join(runDir, "exports");

  [runDir, notesDir, reviewDir, artifactsCommandsDir, artifactsGitDir, exportsDir].forEach(ensureDir);

  const manifest = {
    schema_version: config.schema_version,
    run_id: runId,
    track,
    title,
    idea_slug: slugify(idea),
    goal,
    mode,
    source: args.source || "cli",
    requested_area: args.area || null,
    automation_task_id: args.taskId || null,
    status: "initialized",
    created_at: nowIso,
    updated_at: nowIso,
    repos: trackConfig.repos,
    quality_gates: trackConfig.quality_gates.map((gate) => ({
      ...gate,
      status: "pending",
      last_run_at: null,
      exit_code: null,
      duration_ms: null,
      log_path: null
    })),
    risk_checks: trackConfig.risk_checks,
    changed_files: [],
    git_snapshots: [],
    review: {
      decision: "pending",
      summary: "",
      accuracy_score: 0,
      maintainability_score: 0,
      confidence_score: 0,
      tech_debt_level: "unknown"
    },
    datasets: {
      eligible: false,
      reason: "Review has not been completed."
    },
    coaching: {
      profile_ids: coachingBundle.profile_ids,
      guided_products: coachingBundle.guided_products,
      focused_profile_ids: coachingBundle.focused_profile_ids,
      focused_products: coachingBundle.focused_products,
      source_docs: coachingBundle.source_docs,
      focused_source_docs: coachingBundle.focused_source_docs,
      validation_focus: coachingBundle.validation_focus,
      risk_focus: coachingBundle.risk_focus,
      route_focus: coachingBundle.route_focus
    },
    artifacts: {
      spec_path: relativeToRepo(path.join(notesDir, "spec.md")),
      decision_log_path: relativeToRepo(path.join(notesDir, "decision-log.md")),
      review_notes_path: relativeToRepo(path.join(reviewDir, "review.md")),
      review_json_path: relativeToRepo(path.join(reviewDir, "review.json")),
      agent_briefing_path: relativeToRepo(path.join(notesDir, "agent-briefing.md"))
    }
  };

  const replacements = {
    RUN_ID: runId,
    TRACK: track,
    TITLE: title,
    MODE: mode,
    GOAL: goal,
    CREATED_AT: nowIso,
    REPOS: trackConfig.repos.join(", "),
    RISK_CHECKS: trackConfig.risk_checks.map((item) => `- ${item}`).join("\n")
  };

  writeJson(path.join(runDir, "manifest.json"), manifest);
  writeText(path.join(notesDir, "spec.md"), renderTemplate("spec.md", replacements));
  writeText(path.join(notesDir, "decision-log.md"), renderTemplate("decision-log.md", replacements));
  writeText(path.join(notesDir, "agent-briefing.md"), buildAgentCoachingMarkdown(coachingBundle, { goal, area: args.area || track }));
  writeText(path.join(reviewDir, "review.md"), renderTemplate("review.md", replacements));
  writeText(path.join(reviewDir, "review.json"), renderTemplate("review.json", replacements));

  return { runDir, manifest };
}

function captureRun(config, args) {
  const result = captureRunInternal(config, args.run);

  if (!resolveBooleanArg(args.silent, false)) {
    console.log(`Captured ${result.manifest.run_id}`);
    result.manifest.quality_gates.forEach((gate) => {
      console.log(`- ${gate.label}: ${gate.status}`);
    });
  }

  return result;
}

function captureRunInternal(config, runRef) {
  const run = loadRun(runRef);
  const manifest = run.manifest;
  const trackConfig = config.tracks[manifest.track];

  if (!trackConfig) {
    throw new Error(`Track ${manifest.track} is not configured.`);
  }

  const gitSnapshots = [];
  const changedFiles = new Set();

  trackConfig.repos.forEach((repoKey) => {
    const repoConfig = resolveRepo(config, repoKey);
    const snapshot = captureGitSnapshot(repoKey, repoConfig.absolute_path);

    gitSnapshots.push(snapshot);
    writeJson(path.join(run.runDir, "artifacts", "git", `${repoKey}.json`), snapshot);
    snapshot.changed_files.forEach((filePath) => changedFiles.add(filePath));
  });

  const gateResults = manifest.quality_gates.map((gate) => runQualityGate(config, run.runDir, gate));
  const failedGateCount = gateResults.filter((gate) => gate.status === "failed").length;
  const blockedGateCount = gateResults.filter((gate) => gate.status === "blocked").length;
  const nowIso = new Date().toISOString();

  manifest.quality_gates = gateResults;
  manifest.git_snapshots = gitSnapshots;
  manifest.changed_files = Array.from(changedFiles).sort();
  manifest.status =
    failedGateCount > 0 ? "capture_failed" : blockedGateCount > 0 ? "capture_blocked" : "captured";
  manifest.updated_at = nowIso;
  manifest.last_capture_at = nowIso;
  manifest.datasets = computeTrainingEligibility(config, manifest, loadReview(run.runDir));

  writeJson(path.join(run.runDir, "manifest.json"), manifest);

  return { runDir: run.runDir, manifest };
}

function reviewRun(config, args) {
  const result = reviewRunInternal(config, args.run, args.decision);

  if (!resolveBooleanArg(args.silent, false)) {
    console.log(`Reviewed ${result.manifest.run_id}`);
    console.log(`- Decision: ${result.review.decision}`);
    console.log(`- Training eligible: ${result.manifest.datasets.eligible ? "yes" : "no"}`);
    console.log(`- Reason: ${result.manifest.datasets.reason}`);
  }

  return result;
}

function reviewRunInternal(config, runRef, decisionOverride) {
  const run = loadRun(runRef);
  const manifest = run.manifest;
  const reviewPath = path.join(run.runDir, "review", "review.json");
  const review = loadReview(run.runDir);

  if (decisionOverride) {
    review.decision = decisionOverride;
  }

  validateReview(review);

  manifest.review = {
    decision: review.decision,
    summary: review.summary,
    accuracy_score: review.accuracy_score,
    maintainability_score: review.maintainability_score,
    confidence_score: review.confidence_score,
    tech_debt_level: review.tech_debt_level
  };
  manifest.status = statusFromReview(review.decision, manifest.status);
  manifest.updated_at = new Date().toISOString();
  manifest.datasets = computeTrainingEligibility(config, manifest, review);

  writeJson(reviewPath, review);
  writeJson(path.join(run.runDir, "manifest.json"), manifest);

  return { runDir: run.runDir, manifest, review };
}

function publishRun(config, args) {
  const result = publishRunInternal(config, args.run);

  if (!resolveBooleanArg(args.silent, false)) {
    console.log(`Wrote learnings snapshot for ${result.manifest.run_id}`);
    console.log(`- Summary: ${result.manifest.artifacts.learning_summary_path}`);
    console.log(`- Latest JSON: ${result.manifest.artifacts.learning_latest_path}`);
  }

  return result;
}

function reconcileRuns(config, args) {
  const includeManual = resolveBooleanArg(args["include-manual"], false);
  const manifests = args.all ? listRunManifests() : [loadRun(args.run)];
  const results = [];

  manifests.forEach(({ runDir, manifest }) => {
    const reconciled = reconcileSingleRun(config, runDir, manifest, { includeManual });
    if (reconciled) {
      results.push(reconciled);
    }
  });

  const dashboard = generateDashboard(config, { silent: true }, true);
  const datasetExport = exportDatasets(config, { scope: args.scope || "eligible", silent: true }, true);

  if (!resolveBooleanArg(args.silent, false)) {
    console.log(`Reconciled ${results.length} run(s)`);
    console.log(`- Dashboard refreshed: ${dashboard ? "yes" : "no"}`);
    console.log(`- Dataset export refreshed: ${datasetExport ? "yes" : "no"}`);
  }

  return { results, dashboard, datasetExport };
}

function reconcileSingleRun(config, runDir, manifest, options = {}) {
  const manifestPath = path.join(runDir, "manifest.json");
  const reviewPath = path.join(runDir, "review", "review.json");
  const reviewNotesPath = path.join(runDir, "review", "review.md");
  const review = loadReview(runDir);
  const autoReview = isAutoReviewRun(runDir, review);

  manifest.quality_gates = reconcileQualityGatesFromLogs(manifest.quality_gates);
  manifest.updated_at = new Date().toISOString();
  manifest.learnings_published_at = resolveLearningsPublishedAt(manifest);
  manifest.datasets = computeTrainingEligibility(config, manifest, review);

  if (autoReview || options.includeManual) {
    const regeneratedReview = buildAutoReview(config, manifest, review, {
      approveTrainingIfClean: config.auto_review_policy.auto_training_approval_if_clean
    });

    writeJson(reviewPath, regeneratedReview);
    writeText(reviewNotesPath, buildAutoReviewMarkdown(manifest, regeneratedReview));

    manifest.review = {
      decision: regeneratedReview.decision,
      summary: regeneratedReview.summary,
      accuracy_score: regeneratedReview.accuracy_score,
      maintainability_score: regeneratedReview.maintainability_score,
      confidence_score: regeneratedReview.confidence_score,
      tech_debt_level: regeneratedReview.tech_debt_level
    };
    manifest.status = statusFromReview(regeneratedReview.decision, manifest.status);
    manifest.datasets = computeTrainingEligibility(config, manifest, regeneratedReview);
  }

  writeJson(manifestPath, manifest);

  return { runDir, manifest };
}

function publishRunInternal(config, runRef) {
  const run = loadRun(runRef);
  const manifest = run.manifest;
  const trackConfig = config.tracks[manifest.track];
  const review = loadReview(run.runDir);

  validateReview(review);

  if (review.decision === "pending") {
    throw new Error("Cannot publish a run while review.decision is still pending.");
  }

  const learningsDir = path.join(
    REPO_ROOT,
    "docs",
    "learnings",
    trackConfig.learnings_slug,
    "local-model-loop"
  );
  const publishDate = new Date();
  const publishTimestamp = publishDate.toISOString();
  const dateStamp = publishDate.toISOString().slice(0, 10);
  const summaryFilename = `${dateStamp}-${manifest.run_id}.md`;
  const summaryPath = path.join(learningsDir, summaryFilename);
  const latestPath = path.join(learningsDir, "latest.json");
  const notes = {
    spec: safeRead(path.join(run.runDir, "notes", "spec.md")),
    decisionLog: safeRead(path.join(run.runDir, "notes", "decision-log.md")),
    review: safeRead(path.join(run.runDir, "review", "review.md"))
  };

  ensureDir(learningsDir);

  manifest.updated_at = publishTimestamp;
  manifest.learnings_published_at = publishTimestamp;
  manifest.published_at = publishTimestamp;
  manifest.datasets = computeTrainingEligibility(config, manifest, review);

  const latest = {
    automation: "local-model-loop",
    timestamp: publishTimestamp,
    run_id: manifest.run_id,
    track: manifest.track,
    status: manifest.status,
    learnings_published_at: manifest.learnings_published_at,
    files_changed: manifest.changed_files,
    backend_routes_checked: review.context_checks.backend_routes_checked,
    frontend_surfaces_checked: review.context_checks.frontend_surfaces_checked,
    tests_run: review.context_checks.tests_run,
    security_findings: review.security_findings,
    debt_findings: review.debt_findings,
    ux_findings: review.ux_findings,
    next_actions: review.required_followups
  };

  writeText(summaryPath, buildLearningSummary(manifest, review, notes));
  writeJson(latestPath, latest);

  manifest.artifacts.learning_summary_path = relativeToRepo(summaryPath);
  manifest.artifacts.learning_latest_path = relativeToRepo(latestPath);

  writeJson(path.join(run.runDir, "manifest.json"), manifest);

  return { runDir: run.runDir, manifest, review };
}

function printStatus(config, args) {
  const limit = Number(args.limit || 10);
  const manifests = listRunManifests().slice(-limit).reverse();
  const queueCounts = queueStatusCounts();

  if (!manifests.length) {
    console.log("No local loop runs found.");
  } else {
    manifests.forEach(({ manifest }) => {
      console.log(
        `${manifest.run_id} | ${manifest.track} | ${manifest.status} | ${manifest.review.decision} | ${manifest.title}`
      );
    });
  }

  console.log("");
  console.log(
    `Queue | pending ${queueCounts.pending} | processing ${queueCounts.processing} | done ${queueCounts.done} | failed ${queueCounts.failed}`
  );
  console.log(`Dashboard | ${relativeToRepo(path.join(DASHBOARD_ROOT, "index.html"))}`);

  return { manifests, queueCounts, config };
}

function exportDatasets(config, args = {}, silent = false) {
  const scope = args.scope || "eligible";
  const manifests = listRunManifests();
  const selectedRuns = manifests.filter(({ manifest, runDir }) => {
    if (scope === "all") {
      return true;
    }

    return computeTrainingEligibility(config, manifest, loadReview(runDir)).eligible;
  });

  ensureDir(DATASETS_ROOT);

  const trajectoriesPath = path.join(DATASETS_ROOT, "trajectories.jsonl");
  const approvedPath = path.join(DATASETS_ROOT, "approved-trajectories.jsonl");
  const findingsPath = path.join(DATASETS_ROOT, "review-findings.jsonl");
  const manifestPath = path.join(DATASETS_ROOT, "dataset-manifest.json");
  const trajectoryLines = [];
  const approvedLines = [];
  const findingLines = [];
  const summary = {
    exported_at: new Date().toISOString(),
    scope,
    total_runs: 0,
    eligible_runs: 0,
    runs_by_track: {}
  };

  selectedRuns.forEach(({ runDir, manifest }) => {
    const review = loadReview(runDir);
    const eligibility = computeTrainingEligibility(config, manifest, review);
    const trajectory = buildTrajectoryRecord(runDir, manifest, review, eligibility);

    summary.total_runs += 1;
    summary.runs_by_track[manifest.track] = (summary.runs_by_track[manifest.track] || 0) + 1;
    trajectoryLines.push(JSON.stringify(trajectory));

    if (eligibility.eligible) {
      summary.eligible_runs += 1;
      approvedLines.push(JSON.stringify(trajectory));
    }

    review.findings.forEach((finding) => {
      findingLines.push(
        JSON.stringify({
          run_id: manifest.run_id,
          track: manifest.track,
          title: manifest.title,
          decision: review.decision,
          finding
        })
      );
    });
  });

  fs.writeFileSync(trajectoriesPath, joinJsonl(trajectoryLines));
  fs.writeFileSync(approvedPath, joinJsonl(approvedLines));
  fs.writeFileSync(findingsPath, joinJsonl(findingLines));
  writeJson(manifestPath, summary);

  if (!silent && !resolveBooleanArg(args.silent, false)) {
    console.log(`Exported ${summary.total_runs} runs to ${relativeToRepo(DATASETS_ROOT)}`);
    console.log(`- trajectories.jsonl`);
    console.log(`- approved-trajectories.jsonl`);
    console.log(`- review-findings.jsonl`);
    console.log(`- dataset-manifest.json`);
  }

  return {
    summary,
    files: {
      trajectories: relativeToRepo(trajectoriesPath),
      approved: relativeToRepo(approvedPath),
      findings: relativeToRepo(findingsPath),
      manifest: relativeToRepo(manifestPath)
    }
  };
}

function generateDashboard(config, args = {}, silent = false) {
  const manifests = listRunManifests();
  const coachingConfig = loadAgentCoachingConfig();
  const runtimeConfig = loadOptionalJson(RUNTIME_CONFIG_PATH, { review_engine: {}, local_model_runtime: {} });
  const records = manifests
    .map(({ runDir, manifest }) => {
      const review = loadReview(runDir);
      const eligibility = computeTrainingEligibility(config, manifest, review);
      const metrics = computeRunMetrics(manifest);
      const coaching = resolveRunCoachingContext(manifest, coachingConfig);
      const openFindings = (review.findings || []).filter((finding) => {
        const status = String(finding.status || "open").toLowerCase();
        return status !== "resolved" && status !== "waived";
      });
      const suggestionFindings = openFindings.filter(isSuggestionFinding);
      const vulnerabilityFindings = openFindings.filter(isVulnerabilityFinding);
      const suggestionsCount =
        suggestionFindings.length + (Array.isArray(review.required_followups) ? review.required_followups.length : 0);
      const vulnerabilitiesCount = vulnerabilityFindings.length;
      const rejectedRewritesCount = Array.isArray(manifest.agent?.rejected_edits) ? manifest.agent.rejected_edits.length : 0;

      return {
        run_id: manifest.run_id,
        title: manifest.title,
        track: manifest.track,
        requested_area: manifest.requested_area || manifest.track,
        status: manifest.status,
        learnings_published_at: resolveLearningsPublishedAt(manifest),
        review_decision: review.decision,
        training_eligible: eligibility.eligible,
        training_reason: eligibility.reason,
        suggestions_count: suggestionsCount,
        vulnerabilities_count: vulnerabilitiesCount,
        rejected_rewrites_count: rejectedRewritesCount,
        accuracy_score: review.accuracy_score,
        maintainability_score: review.maintainability_score,
        confidence_score: review.confidence_score,
        changed_files_count: manifest.changed_files.length,
        total_churn: metrics.total_churn,
        updated_at: manifest.updated_at,
        created_at: manifest.created_at,
        changed_files: manifest.changed_files,
        quality_gates: manifest.quality_gates,
        findings: openFindings,
        suggestion_findings: suggestionFindings,
        vulnerability_findings: vulnerabilityFindings,
        required_followups: review.required_followups,
        guided_profile_ids: coaching.profile_ids,
        guided_products: coaching.guided_products,
        guided_products_count: coaching.guided_products.length,
        focused_profile_ids: coaching.focused_profile_ids,
        focused_products: coaching.focused_products,
        focused_products_count: coaching.focused_products.length,
        coached_products: coaching.guided_products,
        coached_products_count: coaching.guided_products.length,
        agent_model: manifest.agent?.model || (manifest.source === "agent" ? "configured-model" : null),
        agent_provider: manifest.agent?.provider || null,
        agent_goal_mode: manifest.agent?.goal_mode || "edit",
        agent_inspected_files_count: Array.isArray(manifest.agent?.selected_files) ? manifest.agent.selected_files.length : 0,
        agent_applied_files_count: Array.isArray(manifest.agent?.applied_files) ? manifest.agent.applied_files.length : 0,
        agent_selected_files: manifest.agent?.selected_files || [],
        agent_summary: manifest.agent?.summary || "",
        agent_verification: manifest.agent?.verification || null,
        coaching_source_docs: coaching.source_docs,
        coaching_doc_snapshots: coaching.doc_snapshots
      };
    })
    .sort((left, right) => right.updated_at.localeCompare(left.updated_at));

  const gateStats = {};
  const trackStats = {};
  const statusCounts = {};
  const reviewCounts = {};
  const openFindings = [];
  const suggestionFindings = [];
  const vulnerabilityFindings = [];
  const modelStats = {};
  const coachingCoverage = Object.entries(coachingConfig.profiles || {}).reduce((acc, [id, profile]) => {
    acc[id] = {
      id,
      name: profile.name,
      purpose: profile.purpose,
      source_docs: profile.source_docs || [],
      validation_focus: profile.validation_focus || [],
      risk_focus: profile.risk_focus || [],
      guided_runs: 0,
      focused_runs: 0,
      last_seen_at: null
    };
    return acc;
  }, {});
  let totalGateEvaluations = 0;
  let passedGateEvaluations = 0;
  let totalSuggestions = 0;
  let totalVulnerabilities = 0;
  let totalRejectedRewrites = 0;
  const guidedProductsSet = new Set();
  const focusedProductsSet = new Set();

  records.forEach((record) => {
    statusCounts[record.status] = (statusCounts[record.status] || 0) + 1;
    reviewCounts[record.review_decision] = (reviewCounts[record.review_decision] || 0) + 1;
    totalSuggestions += Number(record.suggestions_count || 0);
    totalVulnerabilities += Number(record.vulnerabilities_count || 0);
    totalRejectedRewrites += Number(record.rejected_rewrites_count || 0);
    (record.guided_products || []).forEach((product) => guidedProductsSet.add(product));
    (record.focused_products || []).forEach((product) => focusedProductsSet.add(product));
    (record.guided_profile_ids || []).forEach((profileId) => {
      if (!coachingCoverage[profileId]) {
        return;
      }
      coachingCoverage[profileId].guided_runs += 1;
      coachingCoverage[profileId].last_seen_at =
        !coachingCoverage[profileId].last_seen_at || coachingCoverage[profileId].last_seen_at < record.updated_at
          ? record.updated_at
          : coachingCoverage[profileId].last_seen_at;
    });
    (record.focused_profile_ids || []).forEach((profileId) => {
      if (!coachingCoverage[profileId]) {
        return;
      }
      coachingCoverage[profileId].focused_runs += 1;
      coachingCoverage[profileId].last_seen_at =
        !coachingCoverage[profileId].last_seen_at || coachingCoverage[profileId].last_seen_at < record.updated_at
          ? record.updated_at
          : coachingCoverage[profileId].last_seen_at;
    });

    if (!trackStats[record.track]) {
      trackStats[record.track] = {
        runs: 0,
        approved: 0,
        training_eligible: 0,
        learnings_published: 0,
        suggestions: 0,
        vulnerabilities: 0,
        accuracy_total: 0,
        maintainability_total: 0
      };
    }

    trackStats[record.track].runs += 1;
    trackStats[record.track].accuracy_total += Number(record.accuracy_score || 0);
    trackStats[record.track].maintainability_total += Number(record.maintainability_score || 0);
    trackStats[record.track].suggestions += Number(record.suggestions_count || 0);
    trackStats[record.track].vulnerabilities += Number(record.vulnerabilities_count || 0);

    if (record.review_decision === "approved") {
      trackStats[record.track].approved += 1;
    }

    if (record.training_eligible) {
      trackStats[record.track].training_eligible += 1;
    }

    if (record.learnings_published_at) {
      trackStats[record.track].learnings_published += 1;
    }

    const modelKey = record.agent_model || "heuristic";
    if (!modelStats[modelKey]) {
      modelStats[modelKey] = {
        model: modelKey,
        runs: 0,
        suggestions: 0,
        vulnerabilities: 0,
        applied_edits: 0,
        rejected_rewrites: 0
      };
    }

    modelStats[modelKey].runs += 1;
    modelStats[modelKey].suggestions += Number(record.suggestions_count || 0);
    modelStats[modelKey].vulnerabilities += Number(record.vulnerabilities_count || 0);
    modelStats[modelKey].applied_edits += Number(record.agent_applied_files_count || 0);
    modelStats[modelKey].rejected_rewrites += Number(record.rejected_rewrites_count || 0);

    record.quality_gates.forEach((gate) => {
      if (!gateStats[gate.id]) {
        gateStats[gate.id] = {
          id: gate.id,
          label: gate.label,
          total: 0,
          passed: 0,
          failed: 0,
          blocked: 0
        };
      }

      gateStats[gate.id].total += 1;
      totalGateEvaluations += 1;

      if (gate.status === "passed") {
        gateStats[gate.id].passed += 1;
        passedGateEvaluations += 1;
      }

      if (gate.status === "failed") {
        gateStats[gate.id].failed += 1;
      }

      if (gate.status === "blocked") {
        gateStats[gate.id].blocked += 1;
      }
    });

    record.findings.forEach((finding) => {
      const normalizedFinding = {
        run_id: record.run_id,
        track: record.track,
        severity: finding.severity || "unknown",
        title: finding.title || "Untitled finding",
        detail: finding.detail || "",
        category: finding.category || "maintainability",
        requested_area: record.requested_area,
        model: record.agent_model || "heuristic"
      };

      openFindings.push(normalizedFinding);

      if (isVulnerabilityFinding(finding)) {
        vulnerabilityFindings.push(normalizedFinding);
      } else if (isSuggestionFinding(finding)) {
        suggestionFindings.push(normalizedFinding);
      }
    });
  });

  const trackSummary = Object.entries(trackStats)
    .map(([track, stats]) => ({
      track,
      runs: stats.runs,
      approved: stats.approved,
      training_eligible: stats.training_eligible,
      learnings_published: stats.learnings_published,
      suggestions: stats.suggestions,
      vulnerabilities: stats.vulnerabilities,
      average_accuracy: stats.runs ? roundNumber(stats.accuracy_total / stats.runs) : 0,
      average_maintainability: stats.runs ? roundNumber(stats.maintainability_total / stats.runs) : 0
    }))
    .sort((left, right) => left.track.localeCompare(right.track));

  const summary = {
    generated_at: new Date().toISOString(),
    totals: {
      runs: records.length,
      learnings_published: records.filter((record) => record.learnings_published_at).length,
      approved: records.filter((record) => record.review_decision === "approved").length,
      training_eligible: records.filter((record) => record.training_eligible).length,
      suggestions: totalSuggestions,
      vulnerabilities: totalVulnerabilities,
      rejected_rewrites: totalRejectedRewrites,
      coached_products: guidedProductsSet.size,
      focused_products: focusedProductsSet.size,
      portfolio_profiles: Object.keys(coachingCoverage).length,
      agent_runs: records.filter((record) => record.agent_model).length,
      capture_failures: records.filter((record) => record.status === "capture_failed").length,
      gate_pass_rate: totalGateEvaluations ? roundNumber((passedGateEvaluations / totalGateEvaluations) * 100) : 0
    },
    status_counts: statusCounts,
    review_counts: reviewCounts,
    queue_counts: queueStatusCounts(),
    runtime: {
      review_engine_mode: runtimeConfig.review_engine?.mode || "unknown",
      provider: runtimeConfig.local_model_runtime?.provider || "unknown",
      model: runtimeConfig.local_model_runtime?.model || "unset"
    },
    model_roster: buildModelRoster(runtimeConfig),
    tracks: trackSummary,
    models: Object.values(modelStats).sort((left, right) => left.model.localeCompare(right.model)),
    coaching: {
      portfolio_overview: coachingConfig.portfolio_overview || "",
      guided_products: Array.from(guidedProductsSet).sort((left, right) => left.localeCompare(right)),
      focused_products: Array.from(focusedProductsSet).sort((left, right) => left.localeCompare(right)),
      profiles: Object.entries(coachingConfig.profiles || {})
        .map(([id, profile]) => ({
          id,
          name: profile.name,
          purpose: profile.purpose,
          source_docs: profile.source_docs || [],
          validation_focus: profile.validation_focus || [],
          risk_focus: profile.risk_focus || [],
          keywords: profile.keywords || [],
          guided_runs: coachingCoverage[id]?.guided_runs || 0,
          focused_runs: coachingCoverage[id]?.focused_runs || 0,
          last_seen_at: coachingCoverage[id]?.last_seen_at || null
        }))
        .sort((left, right) => left.name.localeCompare(right.name))
    },
    gates: Object.values(gateStats).sort((left, right) => left.label.localeCompare(right.label)),
    recent_runs: records.slice(0, 20),
    latest_agent_run: records.find((record) => record.agent_model) || null,
    suggestion_findings: suggestionFindings
      .sort((left, right) => severityRank(left.severity) - severityRank(right.severity))
      .slice(0, 12),
    vulnerability_findings: vulnerabilityFindings
      .sort((left, right) => severityRank(left.severity) - severityRank(right.severity))
      .slice(0, 12),
    open_findings: openFindings
      .sort((left, right) => severityRank(left.severity) - severityRank(right.severity))
      .slice(0, 25)
  };

  const summaryPath = path.join(DASHBOARD_ROOT, "summary.json");
  const runsPath = path.join(DASHBOARD_ROOT, "runs.json");
  const markdownPath = path.join(DASHBOARD_ROOT, "latest.md");
  const htmlPath = path.join(DASHBOARD_ROOT, "index.html");

  ensureDir(DASHBOARD_ROOT);
  writeJson(summaryPath, summary);
  writeJson(runsPath, { generated_at: summary.generated_at, runs: records });
  writeText(markdownPath, buildDashboardMarkdown(summary));
  writeText(htmlPath, buildDashboardHtml(summary));

  if (!silent && !resolveBooleanArg(args.silent, false)) {
    console.log(`Dashboard refreshed at ${relativeToRepo(htmlPath)}`);
    console.log(`- Summary JSON: ${relativeToRepo(summaryPath)}`);
    console.log(`- Runs JSON: ${relativeToRepo(runsPath)}`);
    console.log(`- Markdown: ${relativeToRepo(markdownPath)}`);
  }

  return {
    summary,
    files: {
      html: relativeToRepo(htmlPath),
      summary: relativeToRepo(summaryPath),
      runs: relativeToRepo(runsPath),
      markdown: relativeToRepo(markdownPath)
    }
  };
}

function applyAutoReview(config, runDir, options = {}) {
  const manifestPath = path.join(runDir, "manifest.json");
  const reviewPath = path.join(runDir, "review", "review.json");
  const reviewNotesPath = path.join(runDir, "review", "review.md");
  const manifest = loadJson(manifestPath);
  const existingReview = loadReview(runDir);
  const generatedReview = buildAutoReview(config, manifest, existingReview, options);

  writeJson(reviewPath, generatedReview);
  writeText(reviewNotesPath, buildAutoReviewMarkdown(manifest, generatedReview));

  return generatedReview;
}

function buildAutoReview(config, manifest, existingReview, options) {
  const autoPolicy = config.auto_review_policy;
  const trainingPolicy = config.training_policy;
  const metrics = computeRunMetrics(manifest);
  const requestedArea = String(manifest.requested_area || manifest.track || "shared").toLowerCase();
  const agentAnalysis = loadAgentAnalysisFromManifest(manifest);
  const failedGates = manifest.quality_gates.filter((gate) => gate.status === "failed");
  const blockedGates = manifest.quality_gates.filter((gate) => gate.status === "blocked");
  const nonPassingGates = manifest.quality_gates.filter((gate) => gate.status !== "passed");
  const findings = [];
  const securityFindings = [];
  const debtFindings = [];
  const uxFindings = [];

  failedGates.forEach((gate) => {
    const finding = {
      severity: gate.repo === "kaayko-api" ? "high" : "medium",
      status: "open",
      title: `Quality gate failed: ${gate.label}`,
      detail: `Command \`${gate.command}\` exited with code ${gate.exit_code}. Review ${gate.log_path}.`,
      category: "quality-gate"
    };

    findings.push(finding);

    if (gate.repo === "kaayko-api") {
      securityFindings.push(finding);
    }
  });

  blockedGates.forEach((gate) => {
    findings.push({
      severity: "medium",
      status: "open",
      title: `Quality gate blocked: ${gate.label}`,
      detail: `Command \`${gate.command}\` could not complete because the environment blocked it (${gate.blocking_reason || "environment"}). Review ${gate.log_path}.`,
      category: "environment"
    });
  });

  if (metrics.changed_files_count === 0) {
    findings.push({
      severity: "medium",
      status: "open",
      title: "No git-visible file changes captured",
      detail: "The run did not capture any changed files, so the dataset record may be incomplete.",
      category: "traceability"
    });
  }

  if (metrics.meaningful_product_files_changed === 0) {
    findings.push({
      severity: "medium",
      status: "open",
      title: "No product-scope code changes captured",
      detail: "This run did not capture changes in product code paths such as `src/`, `kutz/src/`, `functions/`, or `ml-service/`. It should not be treated as a real improvement run.",
      category: "scope"
    });
  }

  if (requestedArea === "frontend" && metrics.meaningful_frontend_files_changed === 0) {
    findings.push({
      severity: "medium",
      status: "open",
      title: "Frontend mission without frontend code changes",
      detail: "The run was requested as a frontend mission, but no product frontend files were changed under `src/` or `kutz/src/`.",
      category: "scope"
    });
  }

  if (requestedArea === "backend" && metrics.meaningful_backend_files_changed === 0) {
    findings.push({
      severity: "medium",
      status: "open",
      title: "Backend mission without backend code changes",
      detail: "The run was requested as a backend mission, but no backend code files were changed under `functions/` or `ml-service/`.",
      category: "scope"
    });
  }

  if (metrics.changed_files_count > autoPolicy.large_change_changed_files_threshold) {
    const finding = {
      severity: "medium",
      status: "open",
      title: "Large change set",
      detail: `This run touched ${metrics.changed_files_count} files. Split large ideas when possible to keep review quality high.`,
      category: "maintainability"
    };
    findings.push(finding);
    debtFindings.push(finding);
  }

  if (metrics.total_churn > autoPolicy.large_change_churn_threshold) {
    const finding = {
      severity: "medium",
      status: "open",
      title: "High diff churn",
      detail: `This run changed ${metrics.total_churn} lines of churn. Large diffs are harder to verify and less stable for gold training data.`,
      category: "maintainability"
    };
    findings.push(finding);
    debtFindings.push(finding);
  }

  if (metrics.frontend_files_changed > 0 && !deriveFrontendSurfaces(manifest.changed_files).length) {
    const finding = {
      severity: "low",
      status: "open",
      title: "Frontend surface mapping incomplete",
      detail: "Frontend files changed, but no surface label was derived. Tighten the dashboard rules if this repeats.",
      category: "ux"
    };
    findings.push(finding);
    uxFindings.push(finding);
  }

  if (agentAnalysis) {
    agentAnalysis.findings.forEach((finding) => {
      const normalizedFinding = {
        severity: finding.severity || "medium",
        status: finding.status || "open",
        title: finding.title || "Local model finding",
        detail: finding.detail || "",
        category: finding.category || "maintainability"
      };

      findings.push(normalizedFinding);

      if (normalizedFinding.category === "ux") {
        uxFindings.push(normalizedFinding);
      } else if (["quality", "security", "auth", "billing", "tenant", "contract"].includes(normalizedFinding.category)) {
        securityFindings.push(normalizedFinding);
      } else {
        debtFindings.push(normalizedFinding);
      }
    });
  }

  const unsafeAgentEdits = agentAnalysis ? agentVerifyModule.detectUnsafeEdits(agentAnalysis.safe_edits) : [];

  unsafeAgentEdits.forEach((unsafeEdit) => {
    const finding = {
      severity: "high",
      status: "open",
      title: "Unsafe model rewrite proposal",
      detail: `${unsafeEdit.path}: ${unsafeEdit.reason}`,
      category: "quality"
    };

    findings.push(finding);
    securityFindings.push(finding);
  });

  if (agentAnalysis && agentAnalysis.rejected_edits.length) {
    const finding = {
      severity: "medium",
      status: "open",
      title: "Agent edit proposals rejected by guardrails",
      detail: agentAnalysis.rejected_edits.map((item) => `${item.path}: ${item.reason}`).join(" | "),
      category: "maintainability"
    };
    findings.push(finding);
    debtFindings.push(finding);
  }

  const accuracyScore = clampScore(
    autoPolicy.base_accuracy_score -
      failedGates.length * 18 -
      blockedGates.length * 8 -
      (metrics.changed_files_count > autoPolicy.large_change_changed_files_threshold ? 4 : 0) -
      (metrics.total_churn > autoPolicy.large_change_churn_threshold ? 6 : 0)
  );
  const maintainabilityScore = clampScore(
    autoPolicy.base_maintainability_score -
      failedGates.length * 15 -
      blockedGates.length * 6 -
      (metrics.changed_files_count > autoPolicy.large_change_changed_files_threshold ? 8 : 0) -
      (metrics.total_churn > autoPolicy.large_change_churn_threshold ? 6 : 0)
  );
  const confidenceScore = clampScore(
    autoPolicy.base_confidence_score -
      failedGates.length * 20 -
      blockedGates.length * 10 -
      (metrics.changed_files_count > autoPolicy.large_change_changed_files_threshold ? 6 : 0) -
      (metrics.total_churn > autoPolicy.large_change_churn_threshold ? 6 : 0)
  );
  const blockingFinding = findings.some((finding) => {
    const severity = String(finding.severity || "").toLowerCase();
    const status = String(finding.status || "open").toLowerCase();

    return trainingPolicy.disqualifying_open_severities.includes(severity) && status !== "waived" && status !== "resolved";
  });
  const scopeSatisfied =
    metrics.meaningful_product_files_changed > 0 &&
    (requestedArea !== "frontend" || metrics.meaningful_frontend_files_changed > 0) &&
    (requestedArea !== "backend" || metrics.meaningful_backend_files_changed > 0);
  const autoApproved =
    nonPassingGates.length === 0 &&
    !blockingFinding &&
    scopeSatisfied &&
    accuracyScore >= trainingPolicy.minimum_accuracy_score &&
    maintainabilityScore >= trainingPolicy.minimum_maintainability_score &&
    confidenceScore >= autoPolicy.minimum_confidence_for_auto_approval;
  const approveTrainingIfClean =
    options.forceTrainingApproval ||
    (options.approveTrainingIfClean &&
      metrics.changed_files_count <= autoPolicy.gold_changed_files_threshold &&
      metrics.total_churn <= autoPolicy.gold_churn_threshold);
  const reviewDecision = autoApproved ? "approved" : "changes_requested";
  const trainingApproved = autoApproved && approveTrainingIfClean;
  const requiredFollowups = [];

  if (failedGates.length) {
    failedGates.forEach((gate) => {
      requiredFollowups.push(`Fix the failing gate: ${gate.label}`);
    });
  }

  if (blockedGates.length) {
    blockedGates.forEach((gate) => {
      requiredFollowups.push(`Re-run the blocked gate in a less restricted local environment: ${gate.label}`);
    });
  }

  if (metrics.changed_files_count > autoPolicy.large_change_changed_files_threshold) {
    requiredFollowups.push("Split this idea into smaller runs if the same breadth keeps recurring.");
  }

  if (metrics.total_churn > autoPolicy.large_change_churn_threshold) {
    requiredFollowups.push("Add narrower regression checks for this change area before promoting it to gold data.");
  }

  if (reviewDecision === "approved" && !trainingApproved) {
    requiredFollowups.push("Keep this run as reviewed-only data until a cleaner or narrower version exists.");
  }

  if (!scopeSatisfied) {
    requiredFollowups.push("Capture real product-scope code changes before treating this run as an improvement or gold training example.");
  }

  if (agentAnalysis) {
    requiredFollowups.push(...agentAnalysis.followups);
  }

  const frontendSurfaces = deriveFrontendSurfaces(manifest.changed_files);
  const backendRoutes = deriveBackendRoutes(manifest.changed_files);
  const testsRun = manifest.quality_gates
    .filter((gate) => gate.status === "passed")
    .map((gate) => `${gate.label} (${gate.command})`);
  const localModelChecks = agentAnalysis
    ? [`Local model analysis inspected ${agentAnalysis.selected_files.length} files and applied ${agentAnalysis.applied_edits.length} safe edit(s).`]
    : [];
  const summary = [
    "Automated review generated from configured quality gates, git metadata, and conservative heuristics.",
    agentAnalysis ? `Local model summary: ${agentAnalysis.summary || "No model summary returned."}` : null,
    `Gate failures: ${failedGates.length}.`,
    `Gate blocks: ${blockedGates.length}.`,
    `Changed files: ${metrics.changed_files_count}.`,
    `Meaningful product files: ${metrics.meaningful_product_files_changed}.`,
    `Diff churn: ${metrics.total_churn}.`,
    `Decision: ${reviewDecision}.`,
    `Training approval: ${trainingApproved ? "true" : "false"}.`
  ]
    .filter(Boolean)
    .join(" ");

  return {
    ...existingReview,
    decision: reviewDecision,
    summary,
    accuracy_score: accuracyScore,
    maintainability_score: maintainabilityScore,
    confidence_score: confidenceScore,
    tech_debt_level: debtLevelFromMetrics(failedGates.length, metrics),
    findings,
    security_findings: securityFindings,
    debt_findings: debtFindings,
    ux_findings: uxFindings,
    required_followups: uniqueStrings(requiredFollowups),
    waivers: [],
    context_checks: {
      frontend_surfaces_checked: frontendSurfaces,
      backend_routes_checked: backendRoutes,
      tests_run: [...testsRun, ...localModelChecks]
    },
    training_labels: {
      approved_for_training: trainingApproved,
      preferred_outcome: trainingApproved ? "gold_train" : reviewDecision === "approved" ? "reviewed_only" : "revise",
      notes: trainingApproved
        ? "Automatically approved for gold training because the run cleared the configured strict thresholds."
        : "This run remains below the gold threshold or needs revision."
    }
  };
}

function buildAutoReviewMarkdown(manifest, review) {
  const findings = review.findings.length
    ? review.findings
        .map((finding) => `- [${finding.severity}] ${finding.title}: ${finding.detail}`)
        .join("\n")
    : "- No findings were recorded.";
  const followups = review.required_followups.length
    ? review.required_followups.map((item) => `- ${item}`).join("\n")
    : "- No follow-up actions were recorded.";
  const tests = review.context_checks.tests_run.length
    ? review.context_checks.tests_run.map((item) => `- ${item}`).join("\n")
    : "- No passing gate commands were recorded.";
  const frontendSurfaces = review.context_checks.frontend_surfaces_checked.length
    ? review.context_checks.frontend_surfaces_checked.map((item) => `- ${item}`).join("\n")
    : "- None captured.";
  const backendRoutes = review.context_checks.backend_routes_checked.length
    ? review.context_checks.backend_routes_checked.map((item) => `- ${item}`).join("\n")
    : "- None captured.";

  return `# Review Notes

- Run ID: \`${manifest.run_id}\`
- Review Status: \`${review.decision}\`
- Generated By: \`auto-review\`

## What Changed

- Track: \`${manifest.track}\`
- Goal: ${manifest.goal}
- Changed files captured: ${manifest.changed_files.length}

## Findings

${findings}

## Debt

- New debt introduced: ${review.debt_findings.length ? "See findings above." : "None detected by automation."}
- Debt reduced: Not inferred automatically.
- Debt intentionally deferred: ${review.training_labels.approved_for_training ? "None." : "Gold training approval was withheld unless the run cleared the strict thresholds."}

## Validation

- Commands run:
${tests}
- Frontend surfaces checked:
${frontendSurfaces}
- Backend routes checked:
${backendRoutes}
- Residual risks:
${followups}

## Training Decision

- Approved for training: ${review.training_labels.approved_for_training}
- Why: ${review.training_labels.notes}
`;
}

function buildTrajectoryRecord(runDir, manifest, review, eligibility) {
  const coaching = resolveRunCoachingContext(manifest);

  return {
    schema_version: manifest.schema_version,
    run_id: manifest.run_id,
    track: manifest.track,
    title: manifest.title,
    goal: manifest.goal,
    mode: manifest.mode,
    status: manifest.status,
    created_at: manifest.created_at,
    updated_at: manifest.updated_at,
    learnings_published_at: resolveLearningsPublishedAt(manifest),
    published_at: manifest.published_at || null,
    training_eligibility: eligibility,
    quality_gates: manifest.quality_gates,
    changed_files: manifest.changed_files,
    git_snapshots: manifest.git_snapshots,
    coaching: {
      guided_products: coaching.guided_products,
      focused_products: coaching.focused_products,
      source_docs: coaching.source_docs,
      validation_focus: coaching.validation_focus,
      risk_focus: coaching.risk_focus
    },
    agent: manifest.agent || null,
    notes: {
      spec_markdown: safeRead(path.join(runDir, "notes", "spec.md")),
      decision_log_markdown: safeRead(path.join(runDir, "notes", "decision-log.md")),
      review_markdown: safeRead(path.join(runDir, "review", "review.md"))
    },
    review
  };
}

function buildLearningSummary(manifest, review, notes) {
  const coaching = resolveRunCoachingContext(manifest);
  const gateLines = manifest.quality_gates
    .map((gate) => `- ${gate.label}: ${gate.status} (${gate.command})`)
    .join("\n");
  const changedFiles = manifest.changed_files.length
    ? manifest.changed_files.map((filePath) => `- ${filePath}`).join("\n")
    : "- No git-visible file changes captured.";
  const findings = review.findings.length
    ? review.findings
        .map(
          (finding) =>
            `- [${finding.severity || "unknown"}] ${finding.title || "Untitled finding"}: ${finding.detail || ""}`
        )
        .join("\n")
    : "- No findings were recorded.";
  const nextActions = review.required_followups.length
    ? review.required_followups.map((item) => `- ${item}`).join("\n")
    : "- No follow-up actions were recorded.";

  return `# Local Model Loop Summary

- Run ID: \`${manifest.run_id}\`
- Track: \`${manifest.track}\`
- Title: ${manifest.title}
- Goal: ${manifest.goal}
- Status: \`${manifest.status}\`
- Review decision: \`${review.decision}\`
- Training eligible: \`${manifest.datasets.eligible}\`
- Guided products: ${coaching.guided_products.length ? coaching.guided_products.join(", ") : "None"}
- Primary focus: ${coaching.focused_products.length ? coaching.focused_products.join(", ") : "None"}

## Review Summary

${review.summary || "No summary was provided."}

## Quality Gates

${gateLines}

## Changed Files

${changedFiles}

## Findings

${findings}

## Next Actions

${nextActions}

## Training Eligibility

- Eligible: \`${manifest.datasets.eligible}\`
- Reason: ${manifest.datasets.reason}

## Spec Snapshot

${notes.spec}

## Decision Log Snapshot

${notes.decisionLog}

## Review Notes Snapshot

${notes.review}
`;
}

function buildDashboardMarkdown(summary) {
  const tracks = summary.tracks.length
    ? summary.tracks
        .map(
          (track) =>
            `- ${track.track}: ${track.runs} runs, ${track.approved} approved, ${track.training_eligible} gold, ${track.suggestions} suggestions, ${track.vulnerabilities} vulnerabilities, avg accuracy ${track.average_accuracy}`
        )
        .join("\n")
    : "- No runs yet.";
  const models = summary.models.length
    ? summary.models
        .map(
          (model) =>
            `- ${model.model}: ${model.runs} runs, ${model.suggestions} suggestions, ${model.vulnerabilities} vulnerabilities, ${model.applied_edits} applied edits, ${model.rejected_rewrites} rejected rewrites`
        )
        .join("\n")
    : "- No model-backed runs yet.";
  const coaching = summary.coaching.profiles.length
    ? summary.coaching.profiles
        .map(
          (profile) =>
            `- ${profile.name}: guided in ${profile.guided_runs} run(s), primary focus in ${profile.focused_runs} run(s). ${profile.purpose}`
        )
        .join("\n")
    : "- No coaching profiles configured.";
  const latestAgent = summary.latest_agent_run
    ? [
        `- Run: ${summary.latest_agent_run.run_id}`,
        `- Model: ${summary.latest_agent_run.agent_provider || "unknown"} / ${summary.latest_agent_run.agent_model || "heuristic"}`,
        `- Area: ${summary.latest_agent_run.requested_area || summary.latest_agent_run.track}`,
        `- Guided products: ${summary.latest_agent_run.guided_products.length ? summary.latest_agent_run.guided_products.join(", ") : "None"}`,
        `- Primary focus: ${summary.latest_agent_run.focused_products.length ? summary.latest_agent_run.focused_products.join(", ") : "None"}`,
        `- Files inspected: ${summary.latest_agent_run.agent_inspected_files_count}`,
        `- Safe edits applied: ${summary.latest_agent_run.agent_applied_files_count}`,
        `- Summary: ${summary.latest_agent_run.agent_summary || "No agent summary recorded."}`
      ].join("\n")
    : "- No model-backed runs yet.";
  const recentRuns = summary.recent_runs.length
    ? summary.recent_runs
        .map(
          (run) =>
            `- ${run.run_id} | ${run.track}/${run.requested_area} | ${run.status} | ${run.review_decision} | focus=${run.focused_products.length ? run.focused_products.join(", ") : "none"} | suggestions=${run.suggestions_count} | vulnerabilities=${run.vulnerabilities_count} | eligible=${run.training_eligible}`
        )
        .join("\n")
    : "- No runs yet.";
  const suggestionBoard = summary.suggestion_findings.length
    ? summary.suggestion_findings
        .map((finding) => `- [${finding.severity}] ${finding.track}/${finding.requested_area} ${finding.run_id}: ${finding.title}`)
        .join("\n")
    : "- No suggestion findings were recorded.";
  const vulnerabilityBoard = summary.vulnerability_findings.length
    ? summary.vulnerability_findings
        .map((finding) => `- [${finding.severity}] ${finding.track}/${finding.requested_area} ${finding.run_id}: ${finding.title}`)
        .join("\n")
    : "- No vulnerability findings were recorded.";
  const findings = summary.open_findings.length
    ? summary.open_findings
        .map((finding) => `- [${finding.severity}] ${finding.track} ${finding.run_id}: ${finding.title}`)
        .join("\n")
    : "- No open findings.";

  return `# Local Model Loop Dashboard

- Generated at: ${summary.generated_at}
- Total runs: ${summary.totals.runs}
- Learnings snapshots: ${summary.totals.learnings_published}
- Approved runs: ${summary.totals.approved}
- Training-eligible runs: ${summary.totals.training_eligible}
- Suggestions surfaced: ${summary.totals.suggestions}
- Vulnerabilities surfaced: ${summary.totals.vulnerabilities}
- Rejected rewrites: ${summary.totals.rejected_rewrites}
- Guided products across runs: ${summary.totals.coached_products}
- Primary-focus products across runs: ${summary.totals.focused_products}
- Portfolio profiles configured: ${summary.totals.portfolio_profiles}
- Engine: ${summary.runtime.review_engine_mode} (${summary.runtime.provider} / ${summary.runtime.model})
- Gate pass rate: ${summary.totals.gate_pass_rate}%

## Queue

- Pending: ${summary.queue_counts.pending}
- Processing: ${summary.queue_counts.processing}
- Done: ${summary.queue_counts.done}
- Failed: ${summary.queue_counts.failed}

## Tracks

${tracks}

## Model Signal

${models}

## Portfolio Coaching

${coaching}

## Latest Agent Run

${latestAgent}

## Suggestion Board

${suggestionBoard}

## Vulnerability Board

${vulnerabilityBoard}

## Recent Runs

${recentRuns}

## Top Open Findings

${findings}
`;
}

function buildDashboardHtml(summary) {
  const esc = escapeHtml;
  const modules = [
    { key: "1", area: "store", name: "STORE", desc: "Checkout, cart, payments, products", icon: "\ud83d\uded2" },
    { key: "2", area: "paddling-out", name: "PADDLING OUT", desc: "Forecast, spots, scores, safety", icon: "\ud83c\udfc4" },
    { key: "3", area: "kortex", name: "KORTEX", desc: "Smart-links, billing, tenant, auth", icon: "\ud83d\udd17" },
    { key: "4", area: "kreator", name: "KREATOR", desc: "Onboard, dashboard, publishing", icon: "\ud83c\udfa8" },
    { key: "5", area: "kamera-quest", name: "KAMERA QUEST", desc: "Cameras, presets, lenses, skills", icon: "\ud83d\udcf7" },
    { key: "6", area: "shared", name: "SHARED", desc: "JS, CSS, drift, debt reduction", icon: "\u2699\ufe0f" }
  ];
  const recommended = [
    { id: "qwen2.5-coder:7b", name: "Qwen 2.5 Coder 7B", note: "Fast local iteration", ram: "~5 GB" },
    { id: "qwen2.5-coder:14b", name: "Qwen 2.5 Coder 14B", note: "Best default for local coding", ram: "~9 GB" },
    { id: "qwen2.5-coder:32b", name: "Qwen 2.5 Coder 32B", note: "Higher quality if memory allows", ram: "~20 GB" },
    { id: "qwen3:8b", name: "Qwen 3 8B", note: "Balanced general reasoning", ram: "~5 GB" },
    { id: "deepseek-coder-v2:16b", name: "DeepSeek Coder V2 16B", note: "Strong code review & refactor", ram: "~10 GB" },
    { id: "llama3.1:8b", name: "Llama 3.1 8B", note: "General fallback", ram: "~5 GB" }
  ];
  const roster = summary.model_roster || [];
  const statusIcon = (s) => {
    if (s === "approved" || s === "reviewed") return "\u2705";
    if (s === "rejected" || s === "rolled_back") return "\u274c";
    if (s === "pending_review" || s === "agent_applied") return "\ud83d\udfe1";
    if (s === "changes_requested") return "\ud83d\udfe0";
    if (s === "agent_failed" || s === "capture_failed") return "\ud83d\udd34";
    return "\u2b1c";
  };
  const pct = (n, d) => d ? Math.round((n / d) * 100) : 0;

  const moduleCards = modules.map((m) => {
    const trackData = summary.tracks.find((t) => t.track === m.area) || {};
    return `<div class="mod-card" data-area="${esc(m.area)}">
      <div class="mod-icon">${m.icon}</div>
      <div class="mod-info">
        <div class="mod-key">[${m.key}]</div>
        <div class="mod-name">${esc(m.name)}</div>
        <div class="mod-desc">${esc(m.desc)}</div>
        <div class="mod-stats">${trackData.runs || 0} runs \u00b7 ${trackData.approved || 0} approved \u00b7 ${trackData.suggestions || 0} suggestions</div>
      </div>
    </div>`;
  }).join("");

  const modelRows = (roster.length ? roster : recommended.map((m) => ({ ...m, installed: false, active: summary.runtime.model === m.id, size: m.ram, source: "recommended" }))).map((m) => {
    const installBadge = m.installed
      ? `<span class="status-badge s-approved">installed</span>`
      : `<span class="status-badge s-agent-failed">not installed</span>`;
    const actionBtn = m.installed
      ? (m.active ? `<button class="model-btn active">active</button>` : `<button class="model-btn" onclick="switchModel('${esc(m.id)}')">use</button>`)
      : `<code class="cmd-copy">ollama pull ${esc(m.id)}</code>`;
    return `<tr class="${m.active ? "active-model" : ""}">
      <td>${m.active ? "\u25b6" : "\u00a0"}</td>
      <td><code>${esc(m.id)}</code></td>
      <td>${esc(m.note)}</td>
      <td>${esc(m.size || "")}</td>
      <td>${installBadge}</td>
      <td>${actionBtn}</td>
    </tr>`;
  }).join("");

  const recentRows = summary.recent_runs.slice(0, 15).map((run, idx) => {
    const findingsList = (run.suggestion_findings || []).concat(run.vulnerability_findings || []);
    const followups = run.required_followups || [];
    const inspected = run.agent_selected_files || [];
    const detailId = `run-detail-${idx}`;
    const findingsHtml = findingsList.length
      ? findingsList.map((f) => `<div class="detail-finding"><span class="sev sev-${esc(f.severity || "info")}">${esc(f.severity || "info")}</span> <b>${esc(f.title)}</b><br/><span class="detail-text">${esc(f.detail || "")}</span></div>`).join("")
      : `<span class="detail-text">No findings.</span>`;
    const followupsHtml = followups.length
      ? `<div class="detail-section"><b>Required Follow-ups:</b>${followups.map((f) => `<div class="detail-followup">\u2192 ${esc(f)}</div>`).join("")}</div>`
      : "";
    const inspectedHtml = inspected.length
      ? `<div class="detail-section"><b>Inspected Files (${inspected.length}):</b><div class="detail-files">${inspected.map((f) => `<code>${esc(f)}</code>`).join(" ")}</div></div>`
      : "";
    return `<tr class="run-row" onclick="toggleDetail('${detailId}')">
      <td>${statusIcon(run.status)}</td>
      <td class="mono">${esc(run.run_id.slice(0, 30))}\u2026</td>
      <td>${esc(run.track)}</td>
      <td><span class="status-badge s-${esc(run.status.replace(/_/g, "-"))}">${esc(run.status)}</span></td>
      <td>${esc(run.review_decision)}</td>
      <td>${esc(run.agent_model || "heuristic")}${run.agent_goal_mode === "audit" ? ' <span class="chip" style="font-size:0.65rem;padding:1px 4px;vertical-align:middle">AUDIT</span>' : ""}</td>
      <td>${run.agent_applied_files_count}</td>
      <td>${run.suggestions_count}</td>
      <td>${run.vulnerabilities_count}</td>
      <td>${run.training_eligible ? "\u2b50" : "\u2014"}</td>
    </tr>
    <tr class="detail-row" id="${detailId}" style="display:none">
      <td colspan="10">
        <div class="detail-panel">
          <div class="detail-summary">${esc(run.agent_summary || run.title || "")}</div>
          ${run.agent_verification ? `<div class="detail-section"><b>Verification:</b> syntax=${run.agent_verification.syntax_passed ? "\u2713" : "\u2717"} lint=${run.agent_verification.lint_skipped ? "\u2298" : run.agent_verification.lint_passed ? "\u2713" : "\u26a0"} \u2192 <span class="status-badge s-${run.agent_verification.summary === "all_passed" ? "approved" : "changes-requested"}">${esc(run.agent_verification.summary)}</span></div>` : ""}
          <div class="detail-section"><b>Findings (${findingsList.length}):</b>${findingsHtml}</div>
          ${followupsHtml}
          ${inspectedHtml}
        </div>
      </td>
    </tr>`;
  }).join("");

  const trackRows = summary.tracks.map((t) => {
    return `<tr>
      <td>${esc(t.track)}</td>
      <td>${t.runs}</td>
      <td>${t.approved}</td>
      <td>${t.training_eligible}</td>
      <td>${t.suggestions}</td>
      <td>${t.vulnerabilities}</td>
      <td>${t.average_accuracy}</td>
      <td>${t.average_maintainability}</td>
    </tr>`;
  }).join("");

  const gateRows = summary.gates.map((g) => {
    const rate = g.total ? Math.round((g.passed / g.total) * 100) : 0;
    return `<tr>
      <td>${esc(g.label)}</td>
      <td>${g.passed}/${g.total}</td>
      <td><div class="bar-bg"><div class="bar-fill" style="width:${rate}%"></div></div></td>
      <td>${rate}%</td>
    </tr>`;
  }).join("");

  const coachingCards = summary.coaching.profiles.map((p) => {
    return `<div class="coach-card ${p.focused_runs ? "focused" : ""}">
      <h4>${esc(p.name)}</h4>
      <p>${esc(p.purpose || "")}</p>
      <div class="coach-stats">${p.focused_runs} focus \u00b7 ${p.guided_runs} guided</div>
      <div class="chip-row">
        ${(p.keywords || []).slice(0, 4).map((k) => `<span class="chip">${esc(k)}</span>`).join("")}
      </div>
    </div>`;
  }).join("");

  const vulnRows = summary.vulnerability_findings.slice(0, 10).map((f) => {
    return `<tr class="vuln-row">
      <td><span class="sev sev-${esc(f.severity)}">${esc(f.severity)}</span></td>
      <td>${esc(f.track)}</td>
      <td>${esc(f.title)}</td>
    </tr>`;
  }).join("") || `<tr><td colspan="3" class="empty">No vulnerabilities \u2014 clean!</td></tr>`;

  const sugRows = summary.suggestion_findings.slice(0, 10).map((f) => {
    return `<tr>
      <td><span class="sev sev-${esc(f.severity)}">${esc(f.severity)}</span></td>
      <td>${esc(f.track)}</td>
      <td>${esc(f.title)}</td>
    </tr>`;
  }).join("") || `<tr><td colspan="3" class="empty">No suggestions yet.</td></tr>`;

  const latestAgent = summary.latest_agent_run;

  return `<!DOCTYPE html>
<html lang="en">
<head>
<meta charset="UTF-8">
<meta name="viewport" content="width=device-width,initial-scale=1">
<title>KAAYKO \u2022 Automation Engine</title>
<style>
  @import url('https://fonts.googleapis.com/css2?family=JetBrains+Mono:wght@400;600;700&family=Inter:wght@400;500;600;700&display=swap');
  :root {
    --bg: #0a0e14; --surface: #111820; --surface2: #172030;
    --border: #1e2d3d; --border-hi: #2a4060;
    --text: #c8d6e5; --text-dim: #6b7f94; --text-bright: #e8f0f8;
    --cyan: #22d3ee; --green: #34d399; --amber: #f59e0b;
    --red: #ef4444; --purple: #a78bfa; --blue: #60a5fa;
    --cyan-glow: rgba(34,211,238,0.15); --green-glow: rgba(52,211,153,0.1);
    --mono: 'JetBrains Mono', 'Fira Code', 'Cascadia Code', monospace;
    --sans: 'Inter', -apple-system, 'Segoe UI', sans-serif;
  }
  * { box-sizing: border-box; margin: 0; padding: 0; }
  body {
    background: var(--bg); color: var(--text); font-family: var(--sans);
    min-height: 100vh;
    background-image:
      radial-gradient(ellipse at 20% 0%, rgba(34,211,238,0.06) 0%, transparent 50%),
      radial-gradient(ellipse at 80% 100%, rgba(167,139,250,0.04) 0%, transparent 50%);
  }

  /* ── Header ── */
  .header {
    border-bottom: 1px solid var(--border);
    padding: 24px 32px;
    display: flex; align-items: center; justify-content: space-between; flex-wrap: wrap; gap: 16px;
  }
  .header h1 {
    font-family: var(--mono); font-size: 1.4rem; font-weight: 700;
    color: var(--cyan); letter-spacing: 0.08em;
    text-shadow: 0 0 20px rgba(34,211,238,0.3);
  }
  .header h1 span { color: var(--text-dim); font-weight: 400; }
  .header-meta { display: flex; gap: 16px; align-items: center; }
  .engine-badge {
    font-family: var(--mono); font-size: 0.78rem;
    background: var(--surface2); border: 1px solid var(--border);
    border-radius: 6px; padding: 6px 12px; color: var(--text-dim);
  }
  .engine-badge b { color: var(--green); }

  /* ── Layout ── */
  .dash { max-width: 1440px; margin: 0 auto; padding: 24px 28px 48px; }
  .row { display: grid; gap: 20px; margin-bottom: 20px; }
  .row-2 { grid-template-columns: 1fr 1fr; }
  .row-3 { grid-template-columns: 1fr 1fr 1fr; }
  .row-auto { grid-template-columns: repeat(auto-fit, minmax(200px, 1fr)); }
  @media (max-width: 960px) { .row-2, .row-3 { grid-template-columns: 1fr; } }

  /* ── Panels ── */
  .panel {
    background: var(--surface); border: 1px solid var(--border);
    border-radius: 12px; padding: 20px; overflow: hidden;
  }
  .panel h2 {
    font-family: var(--mono); font-size: 0.85rem; font-weight: 600;
    color: var(--cyan); letter-spacing: 0.06em; text-transform: uppercase;
    margin-bottom: 16px; padding-bottom: 10px; border-bottom: 1px solid var(--border);
  }
  .panel h2::before { content: "\u25b8 "; color: var(--text-dim); }
  .panel.highlight { border-color: var(--cyan); box-shadow: 0 0 30px rgba(34,211,238,0.08); }

  /* ── Stat cards ── */
  .stat-grid { display: grid; grid-template-columns: repeat(auto-fit, minmax(140px, 1fr)); gap: 12px; }
  .stat-card {
    background: var(--surface2); border: 1px solid var(--border);
    border-radius: 10px; padding: 16px; text-align: center;
    transition: border-color 0.2s;
  }
  .stat-card:hover { border-color: var(--border-hi); }
  .stat-card .stat-val {
    font-family: var(--mono); font-size: 2rem; font-weight: 700; color: var(--text-bright);
    display: block; line-height: 1.1;
  }
  .stat-card .stat-label { font-size: 0.75rem; color: var(--text-dim); margin-top: 4px; display: block; text-transform: uppercase; letter-spacing: 0.04em; }
  .stat-card.glow-cyan .stat-val { color: var(--cyan); }
  .stat-card.glow-green .stat-val { color: var(--green); }
  .stat-card.glow-amber .stat-val { color: var(--amber); }
  .stat-card.glow-red .stat-val { color: var(--red); }

  /* ── Module selector ── */
  .mod-grid { display: grid; grid-template-columns: repeat(auto-fit, minmax(220px, 1fr)); gap: 14px; }
  .mod-card {
    background: var(--surface2); border: 1px solid var(--border);
    border-radius: 10px; padding: 16px; display: flex; gap: 14px;
    cursor: default; transition: border-color 0.2s, box-shadow 0.2s;
  }
  .mod-card { cursor: pointer; }
  .mod-card:hover { border-color: var(--cyan); box-shadow: 0 0 20px rgba(34,211,238,0.08); }
  .mod-card.selected { border-color: var(--cyan); background: rgba(34,211,238,0.06); box-shadow: 0 0 20px rgba(34,211,238,0.12); }
  .mod-icon { font-size: 1.8rem; line-height: 1; }
  .mod-key {
    font-family: var(--mono); font-size: 0.7rem; color: var(--cyan);
    background: rgba(34,211,238,0.1); border-radius: 4px; padding: 2px 6px;
    display: inline-block; margin-bottom: 4px;
  }
  .mod-name { font-weight: 700; font-size: 0.92rem; color: var(--text-bright); }
  .mod-desc { font-size: 0.78rem; color: var(--text-dim); margin-top: 2px; }
  .mod-stats { font-family: var(--mono); font-size: 0.7rem; color: var(--text-dim); margin-top: 6px; }

  /* ── Tables ── */
  table { width: 100%; border-collapse: collapse; }
  th {
    text-align: left; padding: 8px 10px; font-size: 0.72rem;
    color: var(--text-dim); text-transform: uppercase; letter-spacing: 0.05em;
    border-bottom: 1px solid var(--border); font-family: var(--mono);
  }
  td {
    padding: 8px 10px; font-size: 0.82rem; border-bottom: 1px solid rgba(30,45,61,0.5);
    vertical-align: middle;
  }
  tr:hover td { background: rgba(34,211,238,0.03); }
  .mono { font-family: var(--mono); font-size: 0.76rem; }
  .empty { color: var(--text-dim); font-style: italic; text-align: center; padding: 20px; }

  /* ── Status badges ── */
  .status-badge {
    font-family: var(--mono); font-size: 0.7rem; padding: 3px 8px;
    border-radius: 4px; display: inline-block; font-weight: 600;
  }
  .s-approved, .s-reviewed { background: rgba(52,211,153,0.15); color: var(--green); }
  .s-pending-review, .s-agent-applied { background: rgba(96,165,250,0.15); color: var(--blue); }
  .s-changes-requested { background: rgba(245,158,11,0.15); color: var(--amber); }
  .s-rejected, .s-rolled-back { background: rgba(239,68,68,0.15); color: var(--red); }
  .s-agent-failed, .s-capture-failed { background: rgba(239,68,68,0.1); color: var(--red); }

  .active-model td { background: rgba(52,211,153,0.06); }
  .active-model code { color: var(--green); }

  .sev {
    font-family: var(--mono); font-size: 0.7rem; padding: 2px 6px;
    border-radius: 3px; font-weight: 600;
  }
  .sev-critical, .sev-blocking { background: rgba(239,68,68,0.2); color: var(--red); }
  .sev-high, .sev-major { background: rgba(245,158,11,0.2); color: var(--amber); }
  .sev-medium, .sev-moderate { background: rgba(96,165,250,0.15); color: var(--blue); }
  .sev-low, .sev-minor, .sev-info { background: rgba(107,127,148,0.15); color: var(--text-dim); }

  /* ── Finding cards ── */
  .finding-card { background: var(--surface2); border: 1px solid var(--border); border-radius: 10px; padding: 16px; margin-bottom: 12px; }
  .finding-header { display: flex; align-items: center; gap: 10px; flex-wrap: wrap; }
  .finding-title { font-weight: 700; font-size: .92rem; color: var(--text-bright); }
  .finding-detail { color: var(--text-dim); font-size: .82rem; margin: 8px 0; line-height: 1.5; }
  .finding-meta { display: flex; align-items: center; gap: 8px; flex-wrap: wrap; }
  .finding-meta code { font-size: .72rem; background: var(--surface); padding: 2px 6px; border-radius: 3px; }
  .finding-status { font-family: var(--mono); font-size: .72rem; margin-left: auto; padding: 3px 8px; border-radius: 4px; }
  .finding-status.implementing { background: rgba(245,158,11,0.15); color: var(--amber); }
  .finding-status.done { background: rgba(52,211,153,0.15); color: var(--green); }
  .finding-status.error { background: rgba(239,68,68,0.15); color: var(--red); }
  .implement-btn, .pr-btn { font-family: var(--mono); font-size: .72rem; padding: 4px 10px; border-radius: 5px; border: 1px solid var(--border); cursor: pointer; transition: all .2s; }
  .implement-btn { background: rgba(245,158,11,0.1); color: var(--amber); }
  .implement-btn:hover { background: rgba(245,158,11,0.25); border-color: var(--amber); }
  .pr-btn { background: rgba(167,139,250,0.1); color: var(--purple); }
  .pr-btn:hover { background: rgba(167,139,250,0.25); border-color: var(--purple); }
  .section-toggle { cursor: pointer; list-style: none; }
  .section-toggle::-webkit-details-marker { display: none; }
  .table-hint { color: var(--text-dim); font-size: .82rem; margin-bottom: 12px; }

  .vuln-row td { border-left: 3px solid var(--red); }

  /* ── Bars ── */
  .bar-bg { background: var(--surface); border-radius: 4px; height: 8px; overflow: hidden; min-width: 80px; }
  .bar-fill { background: var(--green); height: 100%; border-radius: 4px; transition: width 0.3s; }

  /* ── Code / commands ── */
  code {
    font-family: var(--mono); font-size: 0.78rem; color: var(--cyan);
    background: rgba(34,211,238,0.08); padding: 2px 6px; border-radius: 4px;
  }
  .cmd-copy {
    cursor: pointer; transition: background 0.2s;
  }
  .cmd-copy:hover { background: rgba(34,211,238,0.2); }

  /* ── How-to section ── */
  .howto {
    background: linear-gradient(135deg, var(--surface) 0%, var(--surface2) 100%);
    border: 1px solid var(--cyan); border-radius: 12px; padding: 24px;
    box-shadow: 0 0 40px rgba(34,211,238,0.06);
  }
  .howto h2 { color: var(--cyan); }
  .howto h2::before { content: "\ud83c\udfae "; }
  .step-grid { display: grid; gap: 20px; margin-top: 12px; }
  .step {
    background: var(--bg); border: 1px solid var(--border);
    border-radius: 10px; padding: 18px; position: relative;
    border-left: 3px solid var(--cyan);
  }
  .step-num {
    font-family: var(--mono); font-size: 0.7rem; font-weight: 700;
    color: var(--bg); background: var(--cyan); border-radius: 4px;
    padding: 2px 8px; position: absolute; top: -1px; left: -1px;
    border-top-left-radius: 10px;
  }
  .step h3 {
    font-family: var(--mono); font-size: 0.88rem; color: var(--text-bright);
    margin: 4px 0 8px 40px;
  }
  .step p { font-size: 0.82rem; color: var(--text); margin: 6px 0; line-height: 1.6; }
  .step pre {
    background: var(--surface2); border: 1px solid var(--border);
    border-radius: 8px; padding: 12px 16px; margin: 10px 0 4px;
    overflow-x: auto; font-size: 0.8rem; line-height: 1.5;
    color: var(--text-bright); font-family: var(--mono);
  }
  .step pre .comment { color: var(--text-dim); }
  .step pre .highlight { color: var(--green); }
  .step pre .flag { color: var(--amber); }

  /* ── Coach cards ── */
  .coach-grid { display: grid; grid-template-columns: repeat(auto-fit, minmax(240px, 1fr)); gap: 14px; }
  .coach-card {
    background: var(--surface2); border: 1px solid var(--border);
    border-radius: 10px; padding: 16px;
  }
  .coach-card.focused { border-color: var(--green); box-shadow: 0 0 15px rgba(52,211,153,0.08); }
  .coach-card h4 { font-size: 0.88rem; color: var(--text-bright); margin-bottom: 6px; }
  .coach-card p { font-size: 0.78rem; color: var(--text-dim); }
  .coach-stats { font-family: var(--mono); font-size: 0.7rem; color: var(--text-dim); margin-top: 8px; }
  .chip-row { display: flex; flex-wrap: wrap; gap: 6px; margin-top: 8px; }
  .chip {
    font-family: var(--mono); font-size: 0.68rem; color: var(--text-dim);
    background: rgba(107,127,148,0.1); border-radius: 4px; padding: 2px 8px;
  }

  /* ── Queue bar ── */
  .queue-bar { display: flex; gap: 14px; flex-wrap: wrap; }
  .q-item {
    font-family: var(--mono); font-size: 0.82rem;
    background: var(--surface2); border: 1px solid var(--border);
    border-radius: 8px; padding: 10px 16px;
  }
  .q-item b { color: var(--text-bright); }

  /* ── Latest agent ── */
  .agent-summary { font-size: 0.85rem; color: var(--text); line-height: 1.6; margin: 10px 0; }
  .agent-meta { display: flex; flex-wrap: wrap; gap: 8px; margin: 10px 0; }

  /* ── Footer ── */
  .footer {
    text-align: center; padding: 32px; color: var(--text-dim);
    font-family: var(--mono); font-size: 0.72rem;
    border-top: 1px solid var(--border); margin-top: 32px;
  }

  /* ── Launch Pad ── */
  .launch-form { display: grid; gap: 12px; max-width: 680px; }
  .launch-row {
    display: flex; align-items: center; gap: 12px;
  }
  .launch-row label {
    font-family: var(--mono); font-size: 0.78rem; color: var(--text-dim);
    min-width: 70px; text-transform: uppercase; letter-spacing: 0.04em;
  }
  .launch-row select, .launch-row input {
    flex: 1; background: var(--bg); border: 1px solid var(--border);
    border-radius: 6px; padding: 10px 14px; color: var(--text-bright);
    font-family: var(--mono); font-size: 0.82rem;
    outline: none; transition: border-color 0.2s;
  }
  .launch-row select:focus, .launch-row input:focus {
    border-color: var(--cyan);
  }
  .launch-row select option { background: var(--surface); }
  #lp-launch {
    background: var(--cyan); color: var(--bg); border: none;
    border-radius: 6px; padding: 10px 24px; font-family: var(--mono);
    font-size: 0.82rem; font-weight: 700; cursor: pointer;
    letter-spacing: 0.06em; transition: opacity 0.2s;
  }
  #lp-launch:hover { opacity: 0.85; }
  #lp-launch:disabled { opacity: 0.4; cursor: not-allowed; }
  .launch-status {
    font-family: var(--mono); font-size: 0.78rem; color: var(--text-dim);
  }
  .launch-log-area { margin-top: 16px; }
  .launch-log {
    background: var(--bg); border: 1px solid var(--border);
    border-radius: 8px; padding: 14px; max-height: 300px;
    overflow-y: auto; font-size: 0.76rem; line-height: 1.5;
    color: var(--text); font-family: var(--mono); white-space: pre-wrap;
  }

  /* ── Model switch buttons ── */
  .model-btn {
    background: transparent; border: 1px solid var(--border);
    color: var(--cyan); border-radius: 4px; padding: 4px 10px;
    font-family: var(--mono); font-size: 0.72rem; cursor: pointer;
    transition: all 0.2s;
  }
  .model-btn:hover { border-color: var(--cyan); background: rgba(34,211,238,0.1); }
  .model-btn.active { background: rgba(52,211,153,0.15); border-color: var(--green); color: var(--green); cursor: default; }

  /* ── Server indicator ── */
  .server-dot {
    display: inline-block; width: 8px; height: 8px; border-radius: 50%;
    margin-right: 6px; vertical-align: middle;
  }
  .server-dot.online { background: var(--green); box-shadow: 0 0 6px var(--green); }
  .server-dot.offline { background: var(--red); }

  /* ── Expandable run details ── */
  .run-row { cursor: pointer; }
  .run-row:hover td { background: rgba(34,211,238,0.06) !important; }
  .detail-row td { padding: 0 !important; border-bottom: 1px solid var(--border); }
  .detail-panel {
    background: var(--bg); border-left: 3px solid var(--cyan);
    padding: 16px 20px; margin: 0;
  }
  .detail-summary {
    font-size: 0.84rem; color: var(--text); line-height: 1.6;
    margin-bottom: 12px; padding-bottom: 10px; border-bottom: 1px solid var(--border);
  }
  .detail-section { margin-top: 10px; }
  .detail-section b { font-size: 0.78rem; color: var(--text-dim); display: block; margin-bottom: 6px; }
  .detail-finding {
    padding: 8px 10px; margin: 6px 0; border-radius: 6px;
    background: var(--surface2); border: 1px solid var(--border);
    font-size: 0.82rem; line-height: 1.5;
  }
  .detail-finding .sev { margin-right: 6px; }
  .detail-text { color: var(--text-dim); font-size: 0.8rem; }
  .detail-followup {
    font-family: var(--mono); font-size: 0.78rem; color: var(--amber);
    padding: 4px 0;
  }
  .detail-files { display: flex; flex-wrap: wrap; gap: 6px; margin-top: 4px; }
  .detail-files code { font-size: 0.72rem; padding: 3px 8px; }
</style>
</head>
<body>

<div class="header">
  <h1>KAAYKO <span>\u2022 AUTOMATION ENGINE</span></h1>
  <div class="header-meta">
    <span class="engine-badge"><span id="server-dot" class="server-dot offline"></span><span id="server-label">serve offline</span></span>
    <span class="engine-badge">engine <b>${esc(summary.runtime.review_engine_mode)}</b></span>
    <span class="engine-badge">model <b>${esc(summary.runtime.model)}</b></span>
    <span class="engine-badge">provider <b>${esc(summary.runtime.provider)}</b></span>
  </div>
</div>

<div class="dash">

  <!-- ═══ STATS ═══ -->
  <div class="row">
    <div class="stat-grid">
      <div class="stat-card glow-cyan"><span class="stat-val">${summary.totals.runs}</span><span class="stat-label">Total Runs</span></div>
      <div class="stat-card glow-green"><span class="stat-val">${summary.totals.approved}</span><span class="stat-label">Approved</span></div>
      <div class="stat-card"><span class="stat-val">${summary.totals.training_eligible}</span><span class="stat-label">Gold Eligible</span></div>
      <div class="stat-card glow-green"><span class="stat-val">${summary.totals.gate_pass_rate}%</span><span class="stat-label">Gate Pass Rate</span></div>
      <div class="stat-card glow-amber"><span class="stat-val">${summary.totals.suggestions}</span><span class="stat-label">Suggestions</span></div>
      <div class="stat-card${summary.totals.vulnerabilities ? " glow-red" : ""}"><span class="stat-val">${summary.totals.vulnerabilities}</span><span class="stat-label">Vulnerabilities</span></div>
      <div class="stat-card"><span class="stat-val">${summary.totals.agent_runs}</span><span class="stat-label">Agent Runs</span></div>
      <div class="stat-card"><span class="stat-val">${summary.totals.coached_products}</span><span class="stat-label">Guided Products</span></div>
    </div>
  </div>

  <!-- ═══ QUEUE ═══ -->
  <div class="row">
    <div class="panel">
      <h2>Queue Status</h2>
      <div class="queue-bar">
        <span class="q-item">pending <b>${summary.queue_counts.pending}</b></span>
        <span class="q-item">processing <b>${summary.queue_counts.processing}</b></span>
        <span class="q-item">done <b>${summary.queue_counts.done}</b></span>
        <span class="q-item">failed <b>${summary.queue_counts.failed}</b></span>
      </div>
    </div>
  </div>

  <!-- ═══ LAUNCH PAD ═══ -->
  <div class="row">
    <div class="panel highlight" id="launchpad">
      <h2>Launch Pad</h2>
      <p style="color:var(--text-dim);font-size:0.82rem;margin-bottom:14px">
        Launch an agent mission directly from this dashboard. Requires <code>kaayko serve</code> to be running.
      </p>
      <div class="launch-form">
        <div class="launch-row">
          <label>Module</label>
          <select id="lp-area">
            <option value="store">Store</option>
            <option value="paddling-out">Paddling Out</option>
            <option value="kortex">Kortex</option>
            <option value="kreator">Kreator</option>
            <option value="kamera-quest">Kamera Quest</option>
            <option value="shared" selected>Shared</option>
          </select>
        </div>
        <div class="launch-row">
          <label>Goal</label>
          <input id="lp-goal" type="text" placeholder="e.g. Audit checkout flow for duplication" />
        </div>
        <div class="launch-row">
          <label>Mode</label>
          <select id="lp-mode">
            <option value="auto">Auto (full pipeline)</option>
            <option value="dry-run">Dry Run (no edits)</option>
          </select>
        </div>
        <div class="launch-row">
          <button id="lp-launch" onclick="launchMission()">LAUNCH MISSION</button>
          <span id="lp-status" class="launch-status"></span>
        </div>
      </div>
      <div id="lp-log-area" class="launch-log-area" style="display:none">
        <h3 style="font-family:var(--mono);font-size:0.78rem;color:var(--cyan);margin-bottom:8px">LIVE OUTPUT</h3>
        <pre id="lp-log" class="launch-log"></pre>
      </div>
    </div>
  </div>

  <!-- ═══ HOW TO: STEP-BY-STEP ═══ -->
  <div class="row">
    <div class="howto">
      <h2>Mission Control \u2014 How to Run</h2>
      <div class="step-grid">

        <div class="step">
          <span class="step-num">STEP 1</span>
          <h3>Install &amp; verify a model</h3>
          <p>The engine uses <b>Ollama</b> to run local models. First, make sure Ollama is running and pull a model:</p>
          <pre><span class="comment"># Pull the recommended default model</span>
ollama pull <span class="highlight">qwen2.5-coder:14b</span>

<span class="comment"># Verify it's installed</span>
ollama list</pre>
          <p>See the <b>Model Roster</b> table below for all tested models with RAM requirements.</p>
        </div>

        <div class="step">
          <span class="step-num">STEP 2</span>
          <h3>Select a model in Kaayko</h3>
          <p>Tell the engine which model to use. This writes to <code>automation/config/runtime.json</code>:</p>
          <pre><span class="comment"># Set the active model</span>
./automation/kaayko model use <span class="highlight">qwen2.5-coder:14b</span>

<span class="comment"># Confirm the selection</span>
./automation/kaayko model

<span class="comment"># Switch to a lighter model for faster iteration</span>
./automation/kaayko model use <span class="highlight">qwen2.5-coder:7b</span>

<span class="comment"># Switch engine mode (ollama = model-driven, heuristic = evidence-only)</span>
./automation/kaayko model mode <span class="highlight">ollama</span></pre>
        </div>

        <div class="step">
          <span class="step-num">STEP 3</span>
          <h3>Pick a module &amp; launch an agent</h3>
          <p>Choose one of the 6 modules below and describe what you want the model to do:</p>
          <pre><span class="comment"># Interactive mode \u2014 agent pauses after edits for your review</span>
./automation/kaayko agent <span class="flag">--area</span> <span class="highlight">store</span> <span class="flag">--goal</span> <span class="highlight">"Audit checkout flow for duplication"</span> <span class="flag">--interactive</span>

<span class="comment"># Auto mode \u2014 runs the full pipeline without pausing</span>
./automation/kaayko agent <span class="flag">--area</span> <span class="highlight">kortex</span> <span class="flag">--goal</span> <span class="highlight">"Harden tenant isolation"</span>

<span class="comment"># Dry run \u2014 see what would happen without executing</span>
./automation/kaayko agent <span class="flag">--area</span> <span class="highlight">shared</span> <span class="flag">--goal</span> <span class="highlight">"Reduce JS drift"</span> <span class="flag">--apply</span> <span class="highlight">none</span></pre>
          <p><b>Areas:</b> <code>store</code> \u00b7 <code>paddling-out</code> \u00b7 <code>kortex</code> \u00b7 <code>kreator</code> \u00b7 <code>kamera-quest</code> \u00b7 <code>shared</code> \u00b7 <code>frontend</code> \u00b7 <code>backend</code></p>
        </div>

        <div class="step">
          <span class="step-num">STEP 4</span>
          <h3>Review, approve, or reject</h3>
          <p>After the agent finishes (or pauses in <code>--interactive</code> mode), review the changes:</p>
          <pre><span class="comment"># See what the agent changed (colored diff)</span>
./automation/kaayko diff
./automation/kaayko diff <span class="flag">--full</span>            <span class="comment"># full file diff</span>
./automation/kaayko diff <span class="flag">--run</span> <span class="highlight">&lt;run-id&gt;</span>    <span class="comment"># specific run</span>

<span class="comment"># Approve \u2014 creates a git branch and commits the changes</span>
./automation/kaayko approve
./automation/kaayko approve <span class="flag">--no-branch</span>    <span class="comment"># commit on current branch</span>
./automation/kaayko approve <span class="flag">-m</span> <span class="highlight">"Custom commit message"</span>

<span class="comment"># Reject \u2014 restores all files from backups</span>
./automation/kaayko reject

<span class="comment"># Rollback \u2014 undo any past run (even approved ones)</span>
./automation/kaayko rollback <span class="flag">--run</span> <span class="highlight">&lt;run-id&gt;</span></pre>
        </div>

        <div class="step">
          <span class="step-num">STEP 5</span>
          <h3>Batch &amp; queue missions</h3>
          <p>For multiple runs or overnight batch processing:</p>
          <pre><span class="comment"># Queue missions for batch execution</span>
./automation/kaayko enqueue <span class="flag">--track</span> <span class="highlight">store</span> <span class="flag">--idea</span> <span class="highlight">cart-audit</span> <span class="flag">--goal</span> <span class="highlight">"Audit cart logic"</span>
./automation/kaayko enqueue <span class="flag">--track</span> <span class="highlight">kortex</span> <span class="flag">--idea</span> <span class="highlight">billing-check</span> <span class="flag">--goal</span> <span class="highlight">"Check billing"</span>

<span class="comment"># Process the queue (runs up to 5 missions)</span>
./automation/kaayko worker <span class="flag">--limit</span> <span class="highlight">5</span>

<span class="comment"># Check system health</span>
./automation/kaayko doctor

<span class="comment"># Build knowledge graph for model context</span>
./automation/kaayko knowledge build</pre>
        </div>

      </div>
    </div>
  </div>

  <!-- ═══ MODULE SELECTOR ═══ -->
  <div class="row">
    <div class="panel highlight">
      <h2>Select Module</h2>
      <div class="mod-grid">${moduleCards}</div>
    </div>
  </div>

  <!-- ═══ MODEL ROSTER ═══ -->
  <div class="row">
    <details class="panel" open>
      <summary class="section-toggle"><h2>Model Roster <button class="model-btn" onclick="event.stopPropagation();refreshModels()" style="font-size:.7rem;padding:3px 10px;margin-left:12px;vertical-align:middle" id="model-refresh-btn">\u21bb refresh</button></h2></summary>
      <p style="color:var(--text-dim);font-size:0.82rem;margin-bottom:12px">
        Current: <code>${esc(summary.runtime.model)}</code> via <code>${esc(summary.runtime.provider)}</code>.
        Click any command to copy. Active model is highlighted in green.
      </p>
      <table id="model-table">
        <thead><tr><th></th><th>Model ID</th><th>Best For</th><th>Size</th><th>Status</th><th>Action</th></tr></thead>
        <tbody>${modelRows}</tbody>
      </table>
    </details>
  </div>

  <!-- ═══ LATEST AGENT MISSION ═══ -->
  <div class="row">
    <div class="panel">
      <h2>Latest Agent Mission</h2>
      ${latestAgent ? `
        <div class="agent-meta">
          <span class="status-badge s-${esc((latestAgent.status || "").replace(/_/g, "-"))}">${esc(latestAgent.status)}</span>
          <code>${esc(latestAgent.run_id)}</code>
          <code>${esc(latestAgent.agent_model || "heuristic")}</code>
        </div>
        <p class="agent-summary">${esc(latestAgent.agent_summary || "No summary recorded.")}</p>
        <div class="stat-grid" style="margin-top:12px">
          <div class="stat-card"><span class="stat-val">${latestAgent.agent_inspected_files_count}</span><span class="stat-label">Files Inspected</span></div>
          <div class="stat-card"><span class="stat-val">${latestAgent.agent_applied_files_count}</span><span class="stat-label">Edits Applied</span></div>
          <div class="stat-card"><span class="stat-val">${latestAgent.suggestions_count}</span><span class="stat-label">Suggestions</span></div>
          <div class="stat-card"><span class="stat-val">${latestAgent.vulnerabilities_count}</span><span class="stat-label">Vulnerabilities</span></div>
        </div>
        <p style="color:var(--text-dim);font-size:0.78rem;margin-top:10px">
          Focus: ${esc(latestAgent.focused_products.length ? latestAgent.focused_products.join(", ") : "None")}
          \u00b7 Guided: ${esc(latestAgent.guided_products.length ? latestAgent.guided_products.join(", ") : "None")}
        </p>
      ` : `<p class="empty">No model-backed runs recorded yet.</p>`}
    </div>
  </div>

  <!-- ═══ RECENT RUNS ═══ -->
  <div class="row">
    <div class="panel">
      <h2>Recent Missions</h2>
      <div style="overflow-x:auto">
      <table>
        <thead><tr>
          <th></th><th>Run</th><th>Track</th><th>Status</th><th>Review</th><th>Model</th><th>Edits</th><th>Sug.</th><th>Vuln.</th><th>Gold</th>
        </tr></thead>
        <tbody>${recentRows || `<tr><td colspan="10" class="empty">No runs yet.</td></tr>`}</tbody>
      </table>
      </div>
    </div>
  </div>

  <!-- ═══ TRACK HEALTH + GATES ═══ -->
  <div class="row row-2">
    <div class="panel">
      <h2>Track Health</h2>
      <table>
        <thead><tr><th>Track</th><th>Runs</th><th>OK</th><th>Gold</th><th>Sug.</th><th>Vuln.</th><th>Acc.</th><th>Maint.</th></tr></thead>
        <tbody>${trackRows || `<tr><td colspan="8" class="empty">No runs yet.</td></tr>`}</tbody>
      </table>
    </div>
    <div class="panel">
      <h2>Gate Reliability</h2>
      <table>
        <thead><tr><th>Gate</th><th>Pass/Total</th><th>Bar</th><th>Rate</th></tr></thead>
        <tbody>${gateRows || `<tr><td colspan="4" class="empty">No gate data.</td></tr>`}</tbody>
      </table>
    </div>
  </div>

  <!-- ═══ FINDINGS — LIVE ═══ -->
  <div class="row">
    <details class="panel" open>
      <summary class="section-toggle"><h2>Findings &amp; Suggestions <button class="model-btn" onclick="event.stopPropagation();loadFindings()" style="font-size:.7rem;padding:3px 10px;margin-left:12px;vertical-align:middle" id="findings-refresh-btn">\u21bb load</button></h2></summary>
      <p class="table-hint">Actionable findings from all runs across both repos. Click "Implement" to auto-fix via agent.</p>
      <div id="findings-container"><p class="empty">Click "load" to fetch findings.</p></div>
    </details>
  </div>

  <!-- ═══ FINDINGS — STATIC BOARDS ═══ -->
  <div class="row row-2">
    <details class="panel"><summary class="section-toggle"><h2>Vulnerability Board</h2></summary>
      <table>
        <thead><tr><th>Severity</th><th>Track</th><th>Finding</th></tr></thead>
        <tbody>${vulnRows}</tbody>
      </table>
    </details>
    <details class="panel"><summary class="section-toggle"><h2>Suggestion Board</h2></summary>
      <table>
        <thead><tr><th>Severity</th><th>Track</th><th>Suggestion</th></tr></thead>
        <tbody>${sugRows}</tbody>
      </table>
    </details>
  </div>

  <!-- ═══ COACHING ═══ -->
  <div class="row">
    <div class="panel">
      <h2>Portfolio Coaching</h2>
      <p style="color:var(--text-dim);font-size:0.82rem;margin-bottom:14px">${esc(summary.coaching.portfolio_overview || "")}</p>
      <div class="coach-grid">${coachingCards || `<p class="empty">No coaching profiles.</p>`}</div>
    </div>
  </div>

</div>

<div class="footer">
  KAAYKO AUTOMATION ENGINE \u00b7 Generated ${esc(summary.generated_at)} \u00b7 <button class="model-btn" onclick="manualRefresh()" style="font-size:.72rem;padding:4px 12px">\u21bb Refresh Page</button>
</div>

<script>
document.querySelectorAll('.cmd-copy').forEach(el => {
  el.title = 'Click to copy';
  el.addEventListener('click', () => {
    navigator.clipboard.writeText(el.textContent.trim());
    const orig = el.style.color;
    el.style.color = 'var(--green)';
    setTimeout(() => el.style.color = orig, 600);
  });
});

const BASE = (location.protocol === 'file:' || location.origin === 'null') ? 'http://localhost:4400' : location.origin;
let serverOnline = false;
let activePollToken = null;
window._findingsData = [];

function esc(s) { const d = document.createElement('div'); d.textContent = s; return d.innerHTML; }
function manualRefresh() { location.reload(); }

async function checkServer() {
  try {
    const c = new AbortController();
    const t = setTimeout(() => c.abort(), 2000);
    const r = await fetch(BASE + '/api/health', { signal: c.signal });
    clearTimeout(t);
    serverOnline = r.ok;
  } catch { serverOnline = false; }
  const dot = document.getElementById('server-dot');
  const label = document.getElementById('server-label');
  if (dot) {
    dot.className = 'server-dot ' + (serverOnline ? 'online' : 'offline');
    label.textContent = serverOnline ? 'serve active' : 'serve offline';
  }
  const btn = document.getElementById('lp-launch');
  if (btn) btn.disabled = !serverOnline;
}

async function launchMission() {
  if (!serverOnline) return;
  const area = document.getElementById('lp-area').value;
  const goal = document.getElementById('lp-goal').value.trim();
  const mode = document.getElementById('lp-mode').value;
  const status = document.getElementById('lp-status');
  if (!goal) { status.textContent = 'Goal is required'; status.style.color = 'var(--red)'; return; }
  const btn = document.getElementById('lp-launch');
  btn.disabled = true;
  status.textContent = 'Launching...';
  status.style.color = 'var(--amber)';
  try {
    const r = await fetch(BASE + '/api/launch', {
      method: 'POST', headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ area, goal, mode })
    });
    const data = await r.json();
    if (data.ok) {
      status.textContent = 'Running (PID ' + data.pid + ')';
      status.style.color = 'var(--green)';
      activePollToken = data.logFile;
      document.getElementById('lp-log-area').style.display = 'block';
      pollLog();
    } else {
      status.textContent = data.error || 'Failed';
      status.style.color = 'var(--red)';
      btn.disabled = false;
    }
  } catch (e) {
    status.textContent = e.message;
    status.style.color = 'var(--red)';
    btn.disabled = false;
  }
}

async function pollLog() {
  if (!activePollToken) return;
  try {
    const r = await fetch(BASE + '/api/log/' + activePollToken);
    if (r.ok) {
      const text = await r.text();
      const el = document.getElementById('lp-log');
      el.textContent = text;
      el.scrollTop = el.scrollHeight;
      if (text.includes('[exit ')) {
        document.getElementById('lp-status').textContent = 'Complete';
        document.getElementById('lp-status').style.color = 'var(--green)';
        document.getElementById('lp-launch').disabled = false;
        activePollToken = null;
        return;
      }
    }
  } catch {}
  setTimeout(pollLog, 1500);
}

async function switchModel(modelId) {
  if (!serverOnline) { alert('Start serve first'); return; }
  try {
    const r = await fetch(BASE + '/api/model', {
      method: 'POST', headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ model: modelId })
    });
    const data = await r.json();
    if (data.ok) await refreshModels();
  } catch (e) { alert('Error: ' + e.message); }
}

async function pullModel(id, btn) {
  if (!serverOnline) { alert('Start serve first'); return; }
  btn.disabled = true; btn.textContent = 'pulling...'; btn.style.color = 'var(--amber)';
  try {
    const r = await fetch(BASE + '/api/pull', {
      method: 'POST', headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ model: id })
    });
    const d = await r.json();
    if (d.ok) { btn.textContent = 'started...'; pollPull(id, btn); }
    else { btn.textContent = d.error || 'failed'; btn.style.color = 'var(--red)'; setTimeout(() => { btn.textContent = 'pull'; btn.style.color = ''; btn.disabled = false; }, 3000); }
  } catch { btn.textContent = 'error'; btn.style.color = 'var(--red)'; setTimeout(() => { btn.textContent = 'pull'; btn.style.color = ''; btn.disabled = false; }, 3000); }
}

async function pollPull(id, btn) {
  let tries = 0;
  const poll = async () => {
    tries++;
    try {
      const r = await fetch(BASE + '/api/models');
      const d = await r.json();
      if (d.ok) { const m = d.models.find(x => x.id === id); if (m && m.installed) { btn.textContent = '\\u2713 done'; btn.style.color = 'var(--green)'; setTimeout(() => refreshModels(), 500); return; } }
    } catch {}
    if (tries < 60) setTimeout(poll, 5000);
    else { btn.textContent = 'timeout'; btn.style.color = 'var(--amber)'; setTimeout(() => { btn.textContent = 'pull'; btn.style.color = ''; btn.disabled = false; }, 3000); }
  };
  setTimeout(poll, 3000);
}

async function refreshModels() {
  if (!serverOnline) return;
  const btn = document.getElementById('model-refresh-btn');
  if (btn) { btn.disabled = true; btn.textContent = '\\u21bb ...'; }
  try {
    const r = await fetch(BASE + '/api/models');
    const d = await r.json();
    if (d.ok && d.html) {
      const tbl = document.getElementById('model-table');
      if (tbl) { const tbody = tbl.querySelector('tbody'); if (tbody) tbody.innerHTML = d.html; }
    }
  } catch (e) { console.error('refreshModels error', e); }
  finally { if (btn) { btn.disabled = false; btn.textContent = '\\u21bb refresh'; } }
}

async function loadFindings() {
  if (!serverOnline) { alert('Start serve first'); return; }
  const container = document.getElementById('findings-container');
  const btn = document.getElementById('findings-refresh-btn');
  if (btn) { btn.disabled = true; btn.textContent = '\\u21bb loading...'; }
  container.innerHTML = '<p class="empty">Loading findings...</p>';
  try {
    const r = await fetch(BASE + '/api/findings');
    const d = await r.json();
    if (!d.ok) { container.innerHTML = '<p class="empty">Error: ' + esc(d.error || 'unknown') + '</p>'; return; }
    const findings = d.findings || [];
    window._findingsData = findings;
    if (!findings.length) { container.innerHTML = '<p class="empty">No findings across any runs.</p>'; return; }
    container.innerHTML = findings.map((f, i) => {
      const sevClass = 'sev-' + (f.severity || 'info');
      return '<div class="finding-card" id="finding-' + i + '">'
        + '<div class="finding-header"><span class="sev ' + esc(sevClass) + '">' + esc(f.severity || 'info') + '</span>'
        + '<span class="finding-title">' + esc(f.title) + '</span>'
        + '<span id="finding-status-' + i + '" class="finding-status"></span></div>'
        + '<div class="finding-detail">' + esc(f.detail || '') + '</div>'
        + '<div class="finding-meta"><code>' + esc(f.track) + '</code><code>' + esc(f.repo || '') + '</code>'
        + '<button class="implement-btn" onclick="implementFinding(' + i + ',this)">\\u26a1 Implement Fix</button>'
        + '<button class="pr-btn" onclick="createPR(\\'' + esc(f.track).replace(/'/g, "\\\\\\'") + '\\',\\'' + esc(f.title).replace(/'/g, "\\\\\\'") + '\\',this)">\\ud83d\\udd00 Create PR</button>'
        + '</div></div>';
    }).join('');
  } catch (e) { container.innerHTML = '<p class="empty">Error loading: ' + esc(e.message) + '</p>'; }
  finally { if (btn) { btn.disabled = false; btn.textContent = '\\u21bb load'; } }
}

async function implementFinding(idx, btn) {
  if (!serverOnline) { alert('Start serve first'); return; }
  const findings = window._findingsData;
  if (!findings[idx]) { alert('Finding data not loaded'); return; }
  const f = findings[idx];
  btn.disabled = true; btn.textContent = '\\u26a1 implementing...';
  const status = document.getElementById('finding-status-' + idx);
  if (status) { status.textContent = 'running agent...'; status.className = 'finding-status implementing'; }
  try {
    const r = await fetch(BASE + '/api/implement', {
      method: 'POST', headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ track: f.track, title: f.title, detail: f.detail, severity: f.severity })
    });
    const d = await r.json();
    if (d.ok) {
      if (status) { status.textContent = '\\u2713 agent launched (PID ' + d.pid + ')'; status.className = 'finding-status done'; }
      btn.textContent = '\\u2713 launched';
    } else {
      if (status) { status.textContent = 'failed: ' + (d.error || 'unknown'); status.className = 'finding-status error'; }
      btn.textContent = 'retry'; btn.disabled = false;
    }
  } catch (e) {
    if (status) { status.textContent = 'error: ' + e.message; status.className = 'finding-status error'; }
    btn.textContent = 'retry'; btn.disabled = false;
  }
}

async function createPR(track, title, btn) {
  if (!serverOnline) { alert('Start serve first'); return; }
  btn.disabled = true; btn.textContent = '\\ud83d\\udd00 creating...';
  try {
    const r = await fetch(BASE + '/api/pr', {
      method: 'POST', headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ track, title })
    });
    const d = await r.json();
    if (d.ok) {
      btn.textContent = '\\u2713 ' + (d.branch || 'created');
      if (d.pushed) btn.textContent += ' (pushed)';
    } else { btn.textContent = d.error || 'failed'; btn.disabled = false; }
  } catch (e) { btn.textContent = 'error'; btn.disabled = false; }
}

function toggleDetail(id) {
  const row = document.getElementById(id);
  if (!row) return;
  row.style.display = row.style.display === 'none' ? 'table-row' : 'none';
}

document.querySelectorAll('.mod-card').forEach(card => {
  card.addEventListener('click', () => {
    const area = card.dataset.area;
    const sel = document.getElementById('lp-area');
    if (sel) sel.value = area;
    document.querySelectorAll('.mod-card').forEach(c => c.classList.remove('selected'));
    card.classList.add('selected');
    const lp = document.getElementById('launchpad');
    if (lp) lp.scrollIntoView({ behavior: 'smooth', block: 'start' });
    const goalInput = document.getElementById('lp-goal');
    if (goalInput) goalInput.focus();
  });
});

// Boot: check server, then load data
checkServer();
setInterval(checkServer, 15000);
setTimeout(async () => {
  if (serverOnline) { await refreshModels(); loadFindings(); }
}, 2500);
</script>

</body>
</html>`;
}

function handlePruneCommand(config, args) {
  const keep = Number(args.keep || 10);
  const dryRun = resolveBooleanArg(args["dry-run"], false);
  const manifests = listRunManifests();

  if (manifests.length <= keep) {
    console.log(`Only ${manifests.length} run(s) exist. Nothing to prune (keeping ${keep}).`);
    return { pruned: 0, kept: manifests.length };
  }

  const toKeep = manifests.slice(-keep);
  const toPrune = manifests.slice(0, -keep);
  const pruned = [];

  toPrune.forEach(({ runDir, manifest }) => {
    if (dryRun) {
      console.log(`[dry-run] Would remove: ${manifest.run_id} (${manifest.status})`);
      pruned.push(manifest.run_id);
      return;
    }

    fs.rmSync(runDir, { recursive: true, force: true });
    pruned.push(manifest.run_id);
  });

  if (!dryRun && pruned.length) {
    generateDashboard(config, { silent: true }, true);
    exportDatasets(config, { scope: "eligible", silent: true }, true);
  }

  console.log(`${dryRun ? "[dry-run] " : ""}Pruned ${pruned.length} run(s), kept ${toKeep.length}.`);
  if (!dryRun && pruned.length) {
    console.log("Dashboard and datasets refreshed.");
  }

  return { pruned: pruned.length, kept: toKeep.length };
}

// ── Review Loop Commands ────────────────────────────────────────────

function resolveRunForReview(config, args) {
  const runRef = args.run || args._[1] || "latest";
  return loadRun(runRef);
}

function resolveAbsolutePathFromPrefixed(config, prefixedPath) {
  const colonIndex = prefixedPath.indexOf(":");
  if (colonIndex === -1) return path.resolve(REPO_ROOT, prefixedPath);
  const repoKey = prefixedPath.slice(0, colonIndex);
  const relativePath = prefixedPath.slice(colonIndex + 1);
  try {
    const repo = resolveRepo(config, repoKey);
    return path.join(repo.absolute_path, relativePath);
  } catch {
    return path.resolve(REPO_ROOT, relativePath);
  }
}

function getAppliedEditsForRun(config, runDir, manifest) {
  const backupsDir = path.join(runDir, "artifacts", "agent", "backups");
  const details = manifest.agent?.applied_edits_detail || [];
  const appliedPaths = manifest.agent?.applied_files || [];

  if (details.length) {
    return details.map((detail) => ({
      path: detail.path,
      absolute_path: detail.absolute_path || resolveAbsolutePathFromPrefixed(config, detail.path),
      summary: detail.summary || "",
      confidence: detail.confidence || "medium",
      backup_path: path.join(backupsDir, detail.backup_name)
    }));
  }

  // Fallback for older runs without applied_edits_detail
  return appliedPaths.map((prefixedPath) => {
    const backupName = slugify(prefixedPath.replace(":", "-")) || "backup";
    return {
      path: prefixedPath,
      absolute_path: resolveAbsolutePathFromPrefixed(config, prefixedPath),
      summary: "",
      confidence: "medium",
      backup_path: path.join(backupsDir, `${backupName}.bak`)
    };
  });
}

function computeSimpleDiff(originalLines, currentLines) {
  const result = [];
  const maxLen = Math.max(originalLines.length, currentLines.length);
  let i = 0;
  let j = 0;

  while (i < originalLines.length || j < currentLines.length) {
    if (i < originalLines.length && j < currentLines.length && originalLines[i] === currentLines[j]) {
      result.push({ type: "context", line: originalLines[i], lineNo: j + 1 });
      i++;
      j++;
    } else {
      // Find next common line
      let foundI = -1;
      let foundJ = -1;
      const searchWindow = 8;
      outer: for (let di = 0; di <= searchWindow && i + di <= originalLines.length; di++) {
        for (let dj = 0; dj <= searchWindow && j + dj <= currentLines.length; dj++) {
          if (di === 0 && dj === 0) continue;
          if (i + di < originalLines.length && j + dj < currentLines.length && originalLines[i + di] === currentLines[j + dj]) {
            foundI = i + di;
            foundJ = j + dj;
            break outer;
          }
        }
      }
      if (foundI === -1) {
        // No match found in window — dump remaining
        while (i < originalLines.length) {
          result.push({ type: "removed", line: originalLines[i] });
          i++;
        }
        while (j < currentLines.length) {
          result.push({ type: "added", line: currentLines[j], lineNo: j + 1 });
          j++;
        }
      } else {
        while (i < foundI) {
          result.push({ type: "removed", line: originalLines[i] });
          i++;
        }
        while (j < foundJ) {
          result.push({ type: "added", line: currentLines[j], lineNo: j + 1 });
          j++;
        }
      }
    }
  }
  return result;
}

function handleDiffCommand(config, args) {
  const { runDir, manifest } = resolveRunForReview(config, args);
  const edits = getAppliedEditsForRun(config, runDir, manifest);

  if (!edits.length) {
    console.log(`Run ${manifest.run_id} has no applied edits to diff.`);
    return;
  }

  const showFull = resolveBooleanArg(args.full, false);
  const contextLines = Number(args.context) || 3;

  console.log(`\n  DIFF — ${manifest.run_id}`);
  console.log(`  Track: ${manifest.track}  Status: ${manifest.status}`);
  console.log(`  ${"─".repeat(60)}`);

  let totalAdded = 0;
  let totalRemoved = 0;

  edits.forEach((edit, idx) => {
    const backupExists = fs.existsSync(edit.backup_path);
    const currentExists = fs.existsSync(edit.absolute_path);

    console.log(`\n  [${ idx + 1}/${edits.length}]  ${edit.path}`);
    if (edit.summary) console.log(`  Summary: ${edit.summary}`);

    if (!backupExists) {
      console.log("  ⚠ Backup not found — cannot show diff");
      return;
    }

    const originalContent = fs.readFileSync(edit.backup_path, "utf8");
    const currentContent = currentExists ? fs.readFileSync(edit.absolute_path, "utf8") : "";

    if (originalContent === currentContent) {
      console.log("  (no differences — file matches backup)");
      return;
    }

    const originalLines = originalContent.split("\n");
    const currentLines = currentContent.split("\n");
    const diffEntries = computeSimpleDiff(originalLines, currentLines);

    let added = 0;
    let removed = 0;
    diffEntries.forEach((entry) => {
      if (entry.type === "added") added++;
      if (entry.type === "removed") removed++;
    });
    totalAdded += added;
    totalRemoved += removed;

    console.log(`  +${added}  -${removed}  (${originalLines.length} → ${currentLines.length} lines)`);
    console.log("");

    if (showFull) {
      diffEntries.forEach((entry) => {
        if (entry.type === "added") console.log(`  \x1b[32m+ ${entry.line}\x1b[0m`);
        else if (entry.type === "removed") console.log(`  \x1b[31m- ${entry.line}\x1b[0m`);
        else console.log(`    ${entry.line}`);
      });
    } else {
      // Show only hunks with context
      let lastPrintedIdx = -1;
      diffEntries.forEach((entry, eIdx) => {
        if (entry.type === "context") return;
        const start = Math.max(0, eIdx - contextLines);
        const end = Math.min(diffEntries.length - 1, eIdx + contextLines);
        if (start > lastPrintedIdx + 1 && lastPrintedIdx !== -1) {
          console.log(`  \x1b[36m  ···\x1b[0m`);
        }
        for (let k = Math.max(start, lastPrintedIdx + 1); k <= end; k++) {
          const e = diffEntries[k];
          if (e.type === "added") console.log(`  \x1b[32m+ ${e.line}\x1b[0m`);
          else if (e.type === "removed") console.log(`  \x1b[31m- ${e.line}\x1b[0m`);
          else console.log(`    ${e.line}`);
        }
        lastPrintedIdx = Math.max(lastPrintedIdx, end);
      });
    }
  });

  console.log(`\n  ${"─".repeat(60)}`);
  console.log(`  Total: +${totalAdded}  -${totalRemoved}  across ${edits.length} file(s)`);
  console.log(`  Status: ${manifest.status}`);
  if (manifest.status === "pending_review" || manifest.status === "agent_applied" || manifest.status === "changes_requested") {
    console.log(`\n  $ kaayko approve --run ${manifest.run_id}`);
    console.log(`  $ kaayko reject  --run ${manifest.run_id}`);
  }
  console.log("");
}

function handleApproveCommand(config, args) {
  const { runDir, manifest } = resolveRunForReview(config, args);
  const edits = getAppliedEditsForRun(config, runDir, manifest);
  const noBranch = resolveBooleanArg(args["no-branch"], false);
  const message = args.message || args.m || `kaayko: ${manifest.title || manifest.idea_slug || manifest.run_id}`;

  if (!edits.length) {
    console.log(`Run ${manifest.run_id} has no applied edits to approve.`);
    return;
  }

  if (manifest.status === "approved" || manifest.status === "reviewed") {
    console.log(`Run ${manifest.run_id} is already approved.`);
    return;
  }

  if (manifest.status === "rejected" || manifest.status === "rolled_back") {
    console.log(`Run ${manifest.run_id} is ${manifest.status} — edits were already reverted.`);
    return;
  }

  // Verify files still have the agent's changes (not already reverted)
  const validEdits = edits.filter((edit) => {
    if (!fs.existsSync(edit.absolute_path)) return false;
    if (!fs.existsSync(edit.backup_path)) return true; // no backup = trust current state
    const current = fs.readFileSync(edit.absolute_path, "utf8");
    const backup = fs.readFileSync(edit.backup_path, "utf8");
    return current !== backup; // file still has agent changes
  });

  if (!validEdits.length) {
    console.log("All edited files have been manually reverted — nothing to approve.");
    return;
  }

  // Determine which repo to commit in (use first edit's repo)
  const primaryRepo = edits[0].path.includes(":") ? edits[0].path.split(":")[0] : "kaayko";
  let repoAbsolute;
  try {
    repoAbsolute = resolveRepo(config, primaryRepo).absolute_path;
  } catch {
    repoAbsolute = REPO_ROOT;
  }

  const branchName = `kaayko/${manifest.track}/${manifest.idea_slug || slugify(manifest.title || manifest.run_id)}`;
  let originalBranch = null;

  // Get current branch
  const branchResult = spawnSync("git", ["branch", "--show-current"], { cwd: repoAbsolute, encoding: "utf8" });
  originalBranch = (branchResult.stdout || "").trim();

  if (!noBranch) {
    // Create and checkout a new branch
    const checkoutResult = spawnSync("git", ["checkout", "-b", branchName], { cwd: repoAbsolute, encoding: "utf8" });
    if (checkoutResult.status !== 0) {
      // Branch may already exist — try checking it out
      const switchResult = spawnSync("git", ["checkout", branchName], { cwd: repoAbsolute, encoding: "utf8" });
      if (switchResult.status !== 0) {
        console.error(`Failed to create branch ${branchName}: ${(checkoutResult.stderr || "").trim()}`);
        return;
      }
    }
    console.log(`Branch: ${branchName}`);
  }

  // Stage the applied files
  const filesToStage = validEdits.map((edit) => {
    const colonIndex = edit.path.indexOf(":");
    return colonIndex === -1 ? edit.path : edit.path.slice(colonIndex + 1);
  });

  const addResult = spawnSync("git", ["add", ...filesToStage], { cwd: repoAbsolute, encoding: "utf8" });
  if (addResult.status !== 0) {
    console.error(`git add failed: ${(addResult.stderr || "").trim()}`);
    if (!noBranch && originalBranch) {
      spawnSync("git", ["checkout", originalBranch], { cwd: repoAbsolute });
    }
    return;
  }

  // Commit
  const commitBody = [
    `Run: ${manifest.run_id}`,
    `Track: ${manifest.track}`,
    `Goal: ${manifest.goal || manifest.title || ""}`,
    `Model: ${manifest.agent?.model || "unknown"}`,
    `Files: ${validEdits.length}`,
    "",
    "Applied edits:",
    ...validEdits.map((e) => `  - ${e.path}${e.summary ? ": " + e.summary : ""}`)
  ].join("\n");

  const commitResult = spawnSync("git", ["commit", "-m", message, "-m", commitBody], { cwd: repoAbsolute, encoding: "utf8" });
  if (commitResult.status !== 0) {
    console.error(`git commit failed: ${(commitResult.stderr || "").trim()}`);
    spawnSync("git", ["reset", "HEAD", ...filesToStage], { cwd: repoAbsolute });
    if (!noBranch && originalBranch) {
      spawnSync("git", ["checkout", originalBranch], { cwd: repoAbsolute });
    }
    return;
  }

  const commitHash = spawnSync("git", ["rev-parse", "HEAD"], { cwd: repoAbsolute, encoding: "utf8" }).stdout.trim();
  console.log(`Commit: ${commitHash.slice(0, 10)}`);
  console.log(`Files:  ${validEdits.length} approved`);

  // Update manifest
  updateRunManifest(runDir, (m) => {
    m.status = "approved";
    m.review = { ...(m.review || {}), decision: "approved" };
    m.approval = {
      approved_at: new Date().toISOString(),
      commit_hash: commitHash,
      branch: noBranch ? originalBranch : branchName,
      approved_files: validEdits.map((e) => e.path)
    };
    return m;
  });

  // Run quality gates post-approve
  console.log("Running quality gates...");
  const captureResult = captureRunInternal(config, manifest.run_id);
  const failedGates = (captureResult.manifest.quality_gates || []).filter((g) => g.status === "failed");

  if (failedGates.length) {
    console.log(`\x1b[33m⚠ ${failedGates.length} quality gate(s) failed after approval:\x1b[0m`);
    failedGates.forEach((g) => console.log(`  ✗ ${g.label}`));
    console.log(`\n  Rollback: kaayko rollback --run ${manifest.run_id}`);
  } else {
    console.log("All quality gates passed.");
  }

  if (!noBranch) {
    console.log(`\n  Merge to ${originalBranch}:`);
    console.log(`    $ git checkout ${originalBranch} && git merge ${branchName}`);
    console.log(`  Or rollback:`);
    console.log(`    $ kaayko rollback --run ${manifest.run_id}`);
  }

  // Auto-publish learnings
  if (resolveBooleanArg(args.publish, true)) {
    publishRunInternal(config, manifest.run_id);
  }

  generateDashboard(config, { silent: true }, true);
}

function handleRejectCommand(config, args) {
  const { runDir, manifest } = resolveRunForReview(config, args);
  return restoreFromBackups(config, runDir, manifest, "rejected");
}

function handleRollbackCommand(config, args) {
  const { runDir, manifest } = resolveRunForReview(config, args);
  if (manifest.status === "rolled_back") {
    console.log(`Run ${manifest.run_id} was already rolled back.`);
    return;
  }
  return restoreFromBackups(config, runDir, manifest, "rolled_back");
}

function restoreFromBackups(config, runDir, manifest, newStatus) {
  const edits = getAppliedEditsForRun(config, runDir, manifest);

  if (!edits.length) {
    console.log(`Run ${manifest.run_id} has no applied edits to restore.`);
    return;
  }

  let restored = 0;
  let skipped = 0;

  edits.forEach((edit) => {
    if (!fs.existsSync(edit.backup_path)) {
      console.log(`  ⚠ No backup for ${edit.path} — skipping`);
      skipped++;
      return;
    }

    const backupContent = fs.readFileSync(edit.backup_path, "utf8");
    const targetExists = fs.existsSync(edit.absolute_path);
    const currentContent = targetExists ? fs.readFileSync(edit.absolute_path, "utf8") : null;

    if (currentContent === backupContent) {
      console.log(`  ○ ${edit.path} (already matches backup)`);
      skipped++;
      return;
    }

    fs.writeFileSync(edit.absolute_path, backupContent);
    console.log(`  ✓ ${edit.path} restored`);
    restored++;
  });

  updateRunManifest(runDir, (m) => {
    m.status = newStatus;
    if (newStatus === "rejected") {
      m.review = { ...(m.review || {}), decision: "rejected" };
    }
    m.rollback = {
      rolled_back_at: new Date().toISOString(),
      restored_files: restored,
      skipped_files: skipped
    };
    return m;
  });

  console.log(`\n${newStatus === "rejected" ? "Rejected" : "Rolled back"}: ${restored} file(s) restored, ${skipped} skipped.`);

  // If there's an approval commit, tell user how to undo it
  if (manifest.approval?.commit_hash) {
    console.log(`\n  Git commit ${manifest.approval.commit_hash.slice(0, 10)} still exists.`);
    console.log(`  To undo: git revert ${manifest.approval.commit_hash.slice(0, 10)}`);
    if (manifest.approval.branch) {
      console.log(`  Or delete branch: git branch -D ${manifest.approval.branch}`);
    }
  }

  generateDashboard(config, { silent: true }, true);
}

function handleKnowledgeCommand(config, runtimeConfig, args) {
  const graphExists = fs.existsSync(path.join(KNOWLEDGE_ROOT, "graph.json"));
  const action = args._[1] || (graphExists ? "show" : "build");

  if (action === "build" || action === "export") {
    const graph = buildKnowledgeGraph(config);
    const graphPath = path.join(KNOWLEDGE_ROOT, "graph.json");
    const contextPath = path.join(KNOWLEDGE_ROOT, "context.md");

    ensureDir(KNOWLEDGE_ROOT);
    writeJson(graphPath, graph);
    writeText(contextPath, buildKnowledgeContextMarkdown(graph));

    console.log("Knowledge graph built");
    console.log(`  graph.json  : ${relativeToRepo(graphPath)}`);
    console.log(`  context.md  : ${relativeToRepo(contextPath)}`);
    console.log(`  products    : ${Object.keys(graph.products).length}`);
    console.log(`  files       : ${Object.keys(graph.files).length}`);
    console.log(`  routes      : ${Object.keys(graph.routes).length}`);
    console.log(`  shared      : ${Object.keys(graph.shared_modules).length}`);

    if (action === "export") {
      console.log("");
      console.log(fs.readFileSync(contextPath, "utf8"));
    }

    return { graph, files: { graph: graphPath, context: contextPath } };
  }

  const graphPath = path.join(KNOWLEDGE_ROOT, "graph.json");

  if (!fs.existsSync(graphPath)) {
    console.log("No knowledge graph found. Run `./automation/kaayko knowledge build` first.");
    return null;
  }

  const graph = loadJson(graphPath);

  console.log("KAAYKO KNOWLEDGE GRAPH");
  console.log(`  generated   : ${graph.generated_at}`);
  console.log(`  products    : ${Object.keys(graph.products).length}`);
  console.log(`  files       : ${Object.keys(graph.files).length}`);
  console.log(`  routes      : ${Object.keys(graph.routes).length}`);
  console.log(`  shared      : ${Object.keys(graph.shared_modules).length}`);
  console.log(`  conventions : ${graph.conventions.length}`);
  console.log("");
  console.log("Products:");
  Object.values(graph.products).forEach((product) => {
    console.log(`  ${product.name}: ${product.frontend_files.length} frontend, ${product.backend_files.length} backend, ${product.routes.length} routes`);
  });
  console.log("");
  console.log("Rebuild: ./automation/kaayko knowledge build");
  console.log("Export:  ./automation/kaayko knowledge export");
  console.log(`File:    ${relativeToRepo(graphPath)}`);

  return { graph };
}

function handleServeCommand(config, runtimeConfig, args) {
  const http = require("http");
  const port = parseInt(args.port || args.p || "4400", 10);
  const host = args.host || "127.0.0.1";

  // Regenerate dashboard on startup
  generateDashboard(config, { silent: true }, true);

  const MIME = {
    ".html": "text/html",
    ".json": "application/json",
    ".css": "text/css",
    ".js": "application/javascript",
    ".md": "text/markdown"
  };

  const server = http.createServer((req, res) => {
    const url = new URL(req.url, `http://${host}:${port}`);
    const pathname = url.pathname;

    // CORS for local dev
    res.setHeader("Access-Control-Allow-Origin", "*");
    res.setHeader("Access-Control-Allow-Methods", "GET, POST, OPTIONS");
    res.setHeader("Access-Control-Allow-Headers", "Content-Type");
    if (req.method === "OPTIONS") { res.writeHead(204); res.end(); return; }

    // ─── API Routes ───
    if (pathname === "/api/health") {
      res.writeHead(200, { "Content-Type": "application/json" });
      res.end(JSON.stringify({ ok: true, uptime: process.uptime() }));
      return;
    }

    if (pathname === "/api/findings") {
      try {
        const allFindings = [];
        // Gather findings from ALL repo run directories
        const runDirs = [RUNS_ROOT];
        Object.entries(config.repos).forEach(([key, repo]) => {
          if (key === "kaayko") return; // already covered by RUNS_ROOT
          const repoRuns = path.resolve(REPO_ROOT, repo.path, "automation", "runs");
          if (fs.existsSync(repoRuns)) runDirs.push(repoRuns);
        });
        runDirs.forEach((runsDir) => {
          if (!fs.existsSync(runsDir)) return;
          const repoLabel = runsDir === RUNS_ROOT ? "kaayko" : path.basename(path.resolve(runsDir, "..", ".."));
          fs.readdirSync(runsDir, { withFileTypes: true })
            .filter((e) => e.isDirectory())
            .forEach((entry) => {
              const reviewPath = path.join(runsDir, entry.name, "review", "review.json");
              if (!fs.existsSync(reviewPath)) return;
              try {
                const review = JSON.parse(fs.readFileSync(reviewPath, "utf8"));
                const manifestPath = path.join(runsDir, entry.name, "manifest.json");
                let track = repoLabel;
                if (fs.existsSync(manifestPath)) {
                  try { track = JSON.parse(fs.readFileSync(manifestPath, "utf8")).track || repoLabel; } catch {}
                }
                (review.findings || []).forEach((f) => {
                  const status = String(f.status || "open").toLowerCase();
                  if (status === "resolved" || status === "waived") return;
                  allFindings.push({
                    title: f.title || "Untitled",
                    detail: f.detail || "",
                    severity: f.severity || "info",
                    category: f.category || "",
                    status: f.status || "open",
                    track,
                    repo: repoLabel,
                    run_id: entry.name
                  });
                });
              } catch {}
            });
        });
        // Sort by severity
        const sevRank = { critical: 0, high: 1, medium: 2, low: 3, info: 4 };
        allFindings.sort((a, b) => (sevRank[a.severity] ?? 5) - (sevRank[b.severity] ?? 5));
        res.writeHead(200, { "Content-Type": "application/json" });
        res.end(JSON.stringify({ ok: true, findings: allFindings, count: allFindings.length }));
      } catch (e) {
        res.writeHead(500, { "Content-Type": "application/json" });
        res.end(JSON.stringify({ ok: false, error: e.message }));
      }
      return;
    }

    if (pathname === "/api/implement" && req.method === "POST") {
      let body = "";
      req.on("data", (chunk) => { body += chunk; });
      req.on("end", () => {
        try {
          const { track, title, detail, severity } = JSON.parse(body);
          if (!track || !title) throw new Error("track and title are required");
          const goal = `Fix: ${title}. ${detail || ""}`.trim();
          const child = require("child_process").spawn(
            process.argv[0],
            [
              path.join(AUTOMATION_ROOT, "scripts", "portfolio-loop.js"),
              "agent",
              "--area", track,
              "--goal", goal,
              "--apply", "none"
            ],
            {
              cwd: REPO_ROOT,
              stdio: ["ignore", "pipe", "pipe"],
              detached: true,
              env: process.env
            }
          );
          const runToken = `impl-${track}-${Date.now()}`;
          const logPath = path.join(DASHBOARD_ROOT, `live-${runToken}.log`);
          const logStream = fs.createWriteStream(logPath, { flags: "w" });
          child.stdout.pipe(logStream);
          child.stderr.pipe(logStream);
          child.on("close", (code) => {
            try { fs.appendFileSync(logPath, `\n[exit ${code}]\n`); } catch {}
          });
          child.unref();
          res.writeHead(200, { "Content-Type": "application/json" });
          res.end(JSON.stringify({ ok: true, pid: child.pid, logFile: `live-${runToken}.log` }));
        } catch (e) {
          res.writeHead(400, { "Content-Type": "application/json" });
          res.end(JSON.stringify({ ok: false, error: e.message }));
        }
      });
      return;
    }

    if (pathname === "/api/pr" && req.method === "POST") {
      let body = "";
      req.on("data", (chunk) => { body += chunk; });
      req.on("end", () => {
        try {
          const { track, title } = JSON.parse(body);
          if (!track || !title) throw new Error("track and title are required");
          const branchName = `auto/${track}-${Date.now()}`;
          const repoPath = REPO_ROOT;

          // Get current branch
          const curBranch = spawnSync("git", ["branch", "--show-current"], { cwd: repoPath, encoding: "utf8" });
          const originalBranch = (curBranch.stdout || "").trim() || "main";

          // Check for uncommitted changes
          const statusResult = spawnSync("git", ["status", "--porcelain"], { cwd: repoPath, encoding: "utf8" });
          const hasChanges = (statusResult.stdout || "").trim().length > 0;
          if (!hasChanges) {
            res.writeHead(200, { "Content-Type": "application/json" });
            res.end(JSON.stringify({ ok: false, error: "No uncommitted changes to commit" }));
            return;
          }

          // Create branch
          const checkout = spawnSync("git", ["checkout", "-b", branchName], { cwd: repoPath, encoding: "utf8" });
          if (checkout.status !== 0) {
            res.writeHead(200, { "Content-Type": "application/json" });
            res.end(JSON.stringify({ ok: false, error: `Branch creation failed: ${(checkout.stderr || "").trim()}` }));
            return;
          }

          // Stage + commit
          spawnSync("git", ["add", "-A"], { cwd: repoPath, encoding: "utf8" });
          const commitMsg = `auto: ${title}`;
          const commit = spawnSync("git", ["commit", "-m", commitMsg], { cwd: repoPath, encoding: "utf8" });
          if (commit.status !== 0) {
            spawnSync("git", ["checkout", originalBranch], { cwd: repoPath, encoding: "utf8" });
            res.writeHead(200, { "Content-Type": "application/json" });
            res.end(JSON.stringify({ ok: false, error: `Commit failed: ${(commit.stderr || "").trim()}` }));
            return;
          }

          const commitHash = spawnSync("git", ["rev-parse", "--short", "HEAD"], { cwd: repoPath, encoding: "utf8" }).stdout.trim();

          // Push
          const push = spawnSync("git", ["push", "-u", "origin", branchName], { cwd: repoPath, encoding: "utf8", timeout: 30000 });
          const pushed = push.status === 0;

          // Return to original branch
          spawnSync("git", ["checkout", originalBranch], { cwd: repoPath, encoding: "utf8" });

          res.writeHead(200, { "Content-Type": "application/json" });
          res.end(JSON.stringify({
            ok: true,
            branch: branchName,
            commit: commitHash,
            pushed,
            push_error: pushed ? null : (push.stderr || "").trim()
          }));
        } catch (e) {
          res.writeHead(400, { "Content-Type": "application/json" });
          res.end(JSON.stringify({ ok: false, error: e.message }));
        }
      });
      return;
    }

    if (pathname === "/api/summary") {
      generateDashboard(config, { silent: true }, true);
      const summaryPath = path.join(DASHBOARD_ROOT, "summary.json");
      if (fs.existsSync(summaryPath)) {
        res.writeHead(200, { "Content-Type": "application/json" });
        res.end(fs.readFileSync(summaryPath, "utf8"));
      } else {
        res.writeHead(404, { "Content-Type": "application/json" });
        res.end(JSON.stringify({ error: "No summary. Run a mission first." }));
      }
      return;
    }

    if (pathname === "/api/runs") {
      const runsPath = path.join(DASHBOARD_ROOT, "runs.json");
      if (fs.existsSync(runsPath)) {
        res.writeHead(200, { "Content-Type": "application/json" });
        res.end(fs.readFileSync(runsPath, "utf8"));
      } else {
        res.writeHead(200, { "Content-Type": "application/json" });
        res.end(JSON.stringify({ runs: [] }));
      }
      return;
    }

    if (pathname === "/api/models") {
      const roster = buildModelRoster(runtimeConfig);
      const activeModel = runtimeConfig.local_model_runtime?.model || "unset";
      const esc = escapeHtml;
      const html = roster.map((m) => {
        const installBadge = m.installed
          ? `<span class="status-badge s-approved">installed</span>`
          : `<span class="status-badge s-agent-failed">not installed</span>`;
        const actionBtn = m.installed
          ? (m.active ? `<button class="model-btn active">active</button>` : `<button class="model-btn" onclick="switchModel('${esc(m.id)}')">use</button>`)
          : `<button class="model-btn" onclick="pullModel('${esc(m.id)}',this)">pull</button>`;
        return `<tr class="${m.active ? "active-model" : ""}">
          <td>${m.active ? "\u25b6" : "\u00a0"}</td>
          <td><code>${esc(m.id)}</code></td>
          <td>${esc(m.note || "")}</td>
          <td>${esc(m.size || "")}</td>
          <td>${installBadge}</td>
          <td>${actionBtn}</td>
        </tr>`;
      }).join("");
      res.writeHead(200, { "Content-Type": "application/json" });
      res.end(JSON.stringify({ ok: true, models: roster, active: activeModel, html }));
      return;
    }

    if (pathname === "/api/model" && req.method === "POST") {
      let body = "";
      req.on("data", (chunk) => { body += chunk; });
      req.on("end", () => {
        try {
          const { model } = JSON.parse(body);
          if (!model) throw new Error("model is required");
          runtimeConfig.local_model_runtime = {
            ...(runtimeConfig.local_model_runtime || {}),
            model,
            provider: runtimeConfig.local_model_runtime?.provider || "ollama"
          };
          writeJson(RUNTIME_CONFIG_PATH, runtimeConfig);
          res.writeHead(200, { "Content-Type": "application/json" });
          res.end(JSON.stringify({ ok: true, model }));
        } catch (e) {
          res.writeHead(400, { "Content-Type": "application/json" });
          res.end(JSON.stringify({ error: e.message }));
        }
      });
      return;
    }

    if (pathname === "/api/pull" && req.method === "POST") {
      let body = "";
      req.on("data", (chunk) => { body += chunk; });
      req.on("end", () => {
        try {
          const { model } = JSON.parse(body);
          if (!model) throw new Error("model is required");
          const child = require("child_process").spawn("ollama", ["pull", model], {
            stdio: ["ignore", "pipe", "pipe"],
            detached: true
          });
          child.unref();
          res.writeHead(200, { "Content-Type": "application/json" });
          res.end(JSON.stringify({ ok: true, model, pid: child.pid }));
        } catch (e) {
          res.writeHead(400, { "Content-Type": "application/json" });
          res.end(JSON.stringify({ ok: false, error: e.message }));
        }
      });
      return;
    }

    if (pathname === "/api/launch" && req.method === "POST") {
      let body = "";
      req.on("data", (chunk) => { body += chunk; });
      req.on("end", () => {
        try {
          const { area, goal, mode } = JSON.parse(body);
          if (!area || !goal) throw new Error("area and goal are required");

          const child = require("child_process").spawn(
            process.argv[0],
            [
              path.join(AUTOMATION_ROOT, "scripts", "portfolio-loop.js"),
              "agent",
              "--area", area,
              "--goal", goal,
              ...(mode === "dry-run" ? ["--apply", "none"] : [])
            ],
            {
              cwd: REPO_ROOT,
              stdio: ["ignore", "pipe", "pipe"],
              detached: true,
              env: process.env
            }
          );

          const runToken = `${area}-${Date.now()}`;
          const logPath = path.join(DASHBOARD_ROOT, `live-${runToken}.log`);
          const logStream = fs.createWriteStream(logPath, { flags: "w" });
          child.stdout.pipe(logStream);
          child.stderr.pipe(logStream);

          child.on("close", (code) => {
            try {
              fs.appendFileSync(logPath, `\n[exit ${code}]\n`);
              generateDashboard(config, { silent: true }, true);
            } catch (_) {}
          });

          child.unref();

          res.writeHead(200, { "Content-Type": "application/json" });
          res.end(JSON.stringify({ ok: true, token: runToken, pid: child.pid, logFile: `live-${runToken}.log` }));
        } catch (e) {
          res.writeHead(400, { "Content-Type": "application/json" });
          res.end(JSON.stringify({ error: e.message }));
        }
      });
      return;
    }

    if (pathname === "/api/queue" && req.method === "POST") {
      let body = "";
      req.on("data", (chunk) => { body += chunk; });
      req.on("end", () => {
        try {
          const { track, idea, goal } = JSON.parse(body);
          if (!track || !idea || !goal) throw new Error("track, idea, and goal are required");
          enqueueTask(config, { _: ["enqueue"], track, idea, goal });
          res.writeHead(200, { "Content-Type": "application/json" });
          res.end(JSON.stringify({ ok: true, track, idea }));
        } catch (e) {
          res.writeHead(400, { "Content-Type": "application/json" });
          res.end(JSON.stringify({ error: e.message }));
        }
      });
      return;
    }

    if (pathname.startsWith("/api/log/")) {
      const logFile = pathname.replace("/api/log/", "");
      const sanitized = path.basename(logFile);
      const logPath = path.join(DASHBOARD_ROOT, sanitized);
      if (fs.existsSync(logPath)) {
        res.writeHead(200, { "Content-Type": "text/plain" });
        res.end(fs.readFileSync(logPath, "utf8"));
      } else {
        res.writeHead(404, { "Content-Type": "application/json" });
        res.end(JSON.stringify({ error: "Log not found" }));
      }
      return;
    }

    // ─── Static files from dashboard/ ───
    let filePath;
    if (pathname === "/" || pathname === "/index.html") {
      // Regenerate dashboard HTML on each page load for freshness
      generateDashboard(config, { silent: true }, true);
      filePath = path.join(DASHBOARD_ROOT, "index.html");
    } else {
      const safeName = path.basename(pathname);
      filePath = path.join(DASHBOARD_ROOT, safeName);
    }

    if (fs.existsSync(filePath)) {
      const ext = path.extname(filePath);
      res.writeHead(200, { "Content-Type": MIME[ext] || "application/octet-stream" });
      res.end(fs.readFileSync(filePath));
    } else {
      res.writeHead(404, { "Content-Type": "text/plain" });
      res.end("Not found");
    }
  });

  server.listen(port, host, () => {
    console.log("");
    console.log("  KAAYKO CONTROL SERVER");
    console.log(`  ────────────────────────────────────`);
    console.log(`  Dashboard : http://${host}:${port}`);
    console.log(`  API       : http://${host}:${port}/api/summary`);
    console.log(`  Models    : http://${host}:${port}/api/models`);
    console.log(`  Launch    : POST http://${host}:${port}/api/launch`);
    console.log(`  Queue     : POST http://${host}:${port}/api/queue`);
    console.log("");
    console.log("  Press Ctrl+C to stop");
    console.log("");
  });
}

function buildKnowledgeGraph(config) {
  const coaching = loadAgentCoachingConfig();
  const profiles = coaching.profiles || {};
  const graph = {
    schema_version: "knowledge.v1",
    generated_at: new Date().toISOString(),
    portfolio: {
      name: "Kaayko",
      overview: coaching.portfolio_overview || "",
      repos: Object.entries(config.repos).map(([key, repo]) => ({
        key,
        path: repo.path,
        role: repo.role
      })),
      architecture: {
        frontend: "Static Firebase-hosted HTML pages with vanilla JavaScript",
        backend: "Express API mounted on Firebase Cloud Functions",
        hosting: "Firebase Hosting with static file serving",
        database: "Firestore document database",
        auth: "Firebase Auth with custom tenant isolation"
      }
    },
    products: {},
    files: {},
    routes: {},
    shared_modules: {},
    conventions: [
      "Static HTML pages \u2014 no frontend build system or bundler",
      "Shared JS in src/js/ is loaded via <script> tags, not ES module imports",
      "Backend routes are mounted in functions/index.js",
      "All persistent state lives in Firestore collections",
      "Assets served from src/ via Firebase Hosting",
      "No frontend test runner \u2014 quality gates use backend tests and static analysis",
      "Tenant isolation is enforced in backend middleware, not frontend",
      "Product-specific CSS lives alongside product HTML pages",
      "Window exports (window.X = ...) are the public API for shared JS modules",
      "API client in kaayko_apiClient.js is the single entry point for all backend calls"
    ]
  };

  Object.entries(profiles).forEach(([id, profile]) => {
    const trackConfig = config.tracks[id];
    const product = {
      id,
      name: profile.name,
      purpose: profile.purpose,
      keywords: profile.keywords || [],
      frontend_files: [],
      backend_files: [],
      entry_points: {},
      routes: (profile.backend_routes || []).map((route) => ({
        definition: route,
        product: id
      })),
      validation_focus: profile.validation_focus || [],
      risk_focus: profile.risk_focus || [],
      source_docs: profile.source_docs || [],
      test_commands: trackConfig
        ? trackConfig.quality_gates.map((g) => ({
            id: g.id,
            label: g.label,
            command: g.command,
            repo: g.repo,
            cwd: g.cwd
          }))
        : [],
      features: []
    };

    (profile.frontend_paths || []).forEach((prefixedPath) => {
      try {
        const absolutePath = resolvePrefixedPath(prefixedPath);

        if (!fs.existsSync(absolutePath)) {
          return;
        }

        const stat = fs.statSync(absolutePath);

        if (stat.isFile()) {
          scanFileForKnowledge(graph, config, prefixedPath, absolutePath, id, "frontend");
          product.frontend_files.push(prefixedPath);

          if (prefixedPath.endsWith(".html")) {
            product.entry_points[path.basename(prefixedPath, ".html")] = prefixedPath;
          }
        } else if (stat.isDirectory()) {
          agentFilesModule.walkDirectory(absolutePath, (filePath) => {
            if (!isKnowledgeCandidate(filePath)) {
              return;
            }

            const repoKey = prefixedPath.split(":")[0];
            const repoRoot = resolveRepo(config, repoKey).absolute_path;
            const relPath = path.relative(repoRoot, filePath);
            const prefixed = `${repoKey}:${relPath}`;

            scanFileForKnowledge(graph, config, prefixed, filePath, id, "frontend");
            product.frontend_files.push(prefixed);
          });
        }
      } catch (error) {
        /* skip unresolvable paths */
      }
    });

    (profile.backend_routes || []).forEach((routeDef) => {
      const repoKey = "kaayko-api";

      try {
        const routeParts = routeDef.replace(/^(GET|POST|PUT|DELETE|PATCH)\s+/i, "").split("/").filter(Boolean);
        const guessedApiDir = path.join(resolveRepo(config, repoKey).absolute_path, "functions", "api", routeParts[0] || "");

        if (fs.existsSync(guessedApiDir) && fs.statSync(guessedApiDir).isDirectory()) {
          agentFilesModule.walkDirectory(guessedApiDir, (filePath) => {
            if (!isKnowledgeCandidate(filePath)) {
              return;
            }

            const repoRoot = resolveRepo(config, repoKey).absolute_path;
            const relPath = path.relative(repoRoot, filePath);
            const prefixed = `${repoKey}:${relPath}`;

            scanFileForKnowledge(graph, config, prefixed, filePath, id, "backend");
            product.backend_files.push(prefixed);
          });
        }
      } catch (error) {
        /* skip missing backend paths */
      }
    });

    product.features = deriveProductFeatures(product, profile);
    graph.products[id] = product;
  });

  Object.entries(profiles).forEach(([id, profile]) => {
    (profile.backend_routes || []).forEach((route) => {
      graph.routes[route] = {
        product: id,
        product_name: profile.name,
        definition: route
      };
    });
  });

  Object.entries(graph.files).forEach(([filePath, fileInfo]) => {
    const products = uniqueStrings(fileInfo.products || []);

    if (products.length > 1) {
      graph.shared_modules[filePath] = {
        used_by_products: products,
        exports: fileInfo.exports || [],
        classes: fileInfo.classes || [],
        role: fileInfo.role,
        line_count: fileInfo.line_count
      };
    }
  });

  return graph;
}

function scanFileForKnowledge(graph, config, prefixedPath, absolutePath, productId, role) {
  const content = fs.readFileSync(absolutePath, "utf8");
  const stat = fs.statSync(absolutePath);
  const ext = path.extname(absolutePath).toLowerCase();
  const existing = graph.files[prefixedPath] || {
    path: prefixedPath,
    role,
    products: [],
    size_bytes: stat.size,
    line_count: content.split("\n").length,
    type: ext,
    exports: [],
    classes: [],
    imports: [],
    script_sources: [],
    title: null
  };

  if (!existing.products.includes(productId)) {
    existing.products.push(productId);
  }

  if ([".js", ".mjs", ".cjs"].includes(ext)) {
    existing.exports = uniqueStrings([...existing.exports, ...agentVerifyModule.extractWindowExports(content)]);
    existing.classes = uniqueStrings([...existing.classes, ...agentVerifyModule.extractDeclaredClasses(content)]);
    existing.imports = uniqueStrings([...existing.imports, ...extractKnowledgeImports(content)]);
  }

  if (ext === ".html") {
    existing.script_sources = uniqueStrings([...existing.script_sources, ...extractKnowledgeScriptSources(content)]);
    existing.title = existing.title || extractKnowledgeHtmlTitle(content);
  }

  graph.files[prefixedPath] = existing;
}

function isKnowledgeCandidate(filePath) {
  const ext = path.extname(filePath).toLowerCase();
  const allowed = new Set([".js", ".mjs", ".cjs", ".ts", ".tsx", ".css", ".html", ".json"]);

  if (!allowed.has(ext)) {
    return false;
  }

  try {
    return fs.statSync(filePath).size <= 100000;
  } catch (error) {
    return false;
  }
}

function extractKnowledgeImports(content) {
  const imports = [];
  const text = String(content || "");

  Array.from(text.matchAll(/require\(["']([^"']+)["']\)/g)).forEach((m) => imports.push(m[1]));
  Array.from(text.matchAll(/import\s+.*?\s+from\s+["']([^"']+)["']/g)).forEach((m) => imports.push(m[1]));

  return uniqueStrings(imports);
}

function extractKnowledgeScriptSources(content) {
  return Array.from(String(content || "").matchAll(/<script[^>]+src=["']([^"']+)["']/gi)).map((m) => m[1]);
}

function extractKnowledgeHtmlTitle(content) {
  const match = String(content || "").match(/<title[^>]*>([^<]+)<\/title>/i);
  return match ? match[1].trim() : null;
}

function deriveProductFeatures(product, profile) {
  const features = [];
  const htmlFiles = product.frontend_files.filter((f) => f.endsWith(".html"));
  const jsFiles = product.frontend_files.filter((f) => f.endsWith(".js"));

  htmlFiles.forEach((htmlFile) => {
    const rawName = path.basename(htmlFile, ".html").replace(/[-_]/g, " ");
    const relatedJs = jsFiles.filter((js) => {
      const jsBase = path.basename(js, ".js").toLowerCase();
      const htmlBase = path.basename(htmlFile, ".html").toLowerCase();
      return jsBase.includes(htmlBase) || htmlBase.includes(jsBase);
    });
    const relatedRoutes = (profile.backend_routes || []).filter((route) => {
      const routeBase = route.replace(/^(GET|POST|PUT|DELETE|PATCH)\s+/i, "").split("/")[1] || "";
      const htmlBase = path.basename(htmlFile, ".html").toLowerCase();
      return routeBase.toLowerCase().includes(htmlBase) || htmlBase.includes(routeBase.toLowerCase());
    });

    features.push({
      id: slugify(rawName),
      name: rawName,
      type: "page",
      entry: htmlFile,
      related_js: relatedJs,
      routes: relatedRoutes
    });
  });

  return features;
}

function buildKnowledgeContextMarkdown(graph) {
  const productSections = Object.values(graph.products)
    .map((product) => {
      const routes = product.routes.map((r) => `  - ${r.definition}`).join("\n") || "  - None";
      const entries = Object.entries(product.entry_points)
        .map(([k, v]) => `  - ${k}: \`${v}\``)
        .join("\n") || "  - None";
      const risks = product.risk_focus.map((r) => `  - ${r}`).join("\n") || "  - None";
      const validation = product.validation_focus.map((v) => `  - ${v}`).join("\n") || "  - None";
      const tests = product.test_commands.map((t) => `  - ${t.label}: \`${t.command}\``).join("\n") || "  - None";
      const critical = product.frontend_files
        .filter((f) => f.endsWith(".html") || f.endsWith(".js"))
        .slice(0, 12)
        .map((f) => `  - \`${f}\``)
        .join("\n") || "  - None";
      const features = product.features.length
        ? product.features
            .map((f) => {
              const jsNote = f.related_js.length ? ` \u2192 ${f.related_js.map((j) => path.basename(j)).join(", ")}` : "";
              return `  - **${f.name}** (\`${f.entry}\`)${jsNote}`;
            })
            .join("\n")
        : "  - No features derived";

      return `### ${product.name}

**Purpose:** ${product.purpose}
**Keywords:** ${product.keywords.join(", ")}

**Entry points:**
${entries}

**Features:**
${features}

**Backend routes:**
${routes}

**Critical files:**
${critical}

**Validation focus:**
${validation}

**Risks:**
${risks}

**Tests:**
${tests}`;
    })
    .join("\n\n---\n\n");

  const sharedSection = Object.keys(graph.shared_modules).length
    ? Object.entries(graph.shared_modules)
        .map(([filePath, info]) => {
          const exportsNote = info.exports.length ? ` (exports: ${info.exports.slice(0, 5).join(", ")})` : "";
          return `- **\`${filePath}\`** \u2014 used by ${info.used_by_products.join(", ")}${exportsNote}`;
        })
        .join("\n")
    : "- None identified";

  const conventions = graph.conventions.map((c) => `- ${c}`).join("\n");

  const routeIndex = Object.entries(graph.routes)
    .map(([route, info]) => `- \`${route}\` \u2192 ${info.product_name}`)
    .join("\n") || "- None";

  return `# Kaayko Feature Knowledge Graph

> Auto-generated context for local model consumption.
> Rebuild: \`./automation/kaayko knowledge build\`
> Generated: ${graph.generated_at}

## Portfolio Overview

${graph.portfolio.overview}

## Architecture

- **Frontend:** ${graph.portfolio.architecture.frontend}
- **Backend:** ${graph.portfolio.architecture.backend}
- **Hosting:** ${graph.portfolio.architecture.hosting}
- **Database:** ${graph.portfolio.architecture.database}
- **Auth:** ${graph.portfolio.architecture.auth}

## Conventions

${conventions}

## Products

${productSections}

## Shared Modules

${sharedSection}

## Route Index

${routeIndex}

## Statistics

- Total indexed files: ${Object.keys(graph.files).length}
- Shared modules: ${Object.keys(graph.shared_modules).length}
- Products: ${Object.keys(graph.products).length}
- Routes: ${Object.keys(graph.routes).length}
`;
}

function captureGitSnapshot(repoKey, repoPath) {
  const branch = runShell("git branch --show-current", repoPath);
  const head = runShell("git rev-parse HEAD", repoPath);
  const statusShort = runShell("git status --short", repoPath);
  const diffStat = runShell("git diff --stat", repoPath);
  const diffNameOnly = runShell("git diff --name-only", repoPath);
  const stagedNameOnly = runShell("git diff --cached --name-only", repoPath);
  const changedFiles = Array.from(
    new Set(
      [diffNameOnly.stdout, stagedNameOnly.stdout, extractFilesFromStatus(statusShort.stdout)]
        .join("\n")
        .split("\n")
        .map((line) => line.trim())
        .filter(Boolean)
    )
  ).sort();
  const prefixedChangedFiles = changedFiles.map((filePath) => `${repoKey}:${filePath}`);

  return {
    repo: repoKey,
    path: relativeToRepo(repoPath),
    branch: branch.stdout.trim(),
    head: head.stdout.trim(),
    status_short: statusShort.stdout.trim(),
    diff_stat: diffStat.stdout.trim(),
    changed_files: prefixedChangedFiles,
    repo_relative_changed_files: changedFiles,
    captured_at: new Date().toISOString()
  };
}

function runQualityGate(config, runDir, gate) {
  const repoConfig = resolveRepo(config, gate.repo);
  const workingDir = path.resolve(repoConfig.absolute_path, gate.cwd || ".");
  const result = runShell(gate.command, workingDir);
  const logPath = path.join(runDir, "artifacts", "commands", `${gate.id}.log`);
  const assessment = assessQualityGateResult(result);

  writeText(
    logPath,
    [
      `# ${gate.label}`,
      `repo: ${gate.repo}`,
      `cwd: ${workingDir}`,
      `command: ${gate.command}`,
      `exit_code: ${result.exit_code}`,
      `duration_ms: ${result.duration_ms}`,
      "",
      "## stdout",
      result.stdout,
      "",
      "## stderr",
      result.stderr
    ].join("\n")
  );

  return {
    ...gate,
    status: assessment.status,
    blocking_reason: assessment.reason,
    last_run_at: new Date().toISOString(),
    exit_code: result.exit_code,
    duration_ms: result.duration_ms,
    log_path: relativeToRepo(logPath)
  };
}

function reconcileQualityGatesFromLogs(gates) {
  return gates.map((gate) => {
    if (!gate.log_path || gate.exit_code === null || gate.exit_code === undefined) {
      return gate;
    }

    const logPath = path.resolve(REPO_ROOT, gate.log_path);

    if (!fs.existsSync(logPath)) {
      return gate;
    }

    const logContent = fs.readFileSync(logPath, "utf8");
    const assessment = assessQualityGateResult({
      exit_code: gate.exit_code,
      stdout: "",
      stderr: logContent
    });

    return {
      ...gate,
      status: assessment.status,
      blocking_reason: assessment.reason
    };
  });
}

function assessQualityGateResult(result) {
  if (result.exit_code === 0) {
    return { status: "passed", reason: null };
  }

  const combinedOutput = `${result.stdout}\n${result.stderr}`;
  const blockedPatterns = [
    /listen EPERM/i,
    /operation not permitted/i,
    /EACCES/i,
    /sandbox/i,
    /permission denied/i
  ];

  if (blockedPatterns.some((pattern) => pattern.test(combinedOutput))) {
    return { status: "blocked", reason: "environment_restriction" };
  }

  return { status: "failed", reason: "command_failed" };
}

function isAutoReviewRun(runDir, review) {
  const reviewNotes = safeRead(path.join(runDir, "review", "review.md"));
  const summary = String(review.summary || "");

  return (
    reviewNotes.includes("Generated By: `auto-review`") ||
    summary.startsWith("Automated review generated from configured quality gates")
  );
}

function computeTrainingEligibility(config, manifest, review) {
  const policy = config.training_policy;
  const gateFailed =
    policy.require_quality_gates_passed &&
    manifest.quality_gates.some((gate) => gate.status && gate.status !== "passed");
  const openBlockingFinding = review.findings.some((finding) => {
    const severity = String(finding.severity || "").toLowerCase();
    const status = String(finding.status || "open").toLowerCase();

    return policy.disqualifying_open_severities.includes(severity) && status !== "waived" && status !== "resolved";
  });

  if (review.decision !== "approved") {
    return { eligible: false, reason: "Review decision is not approved." };
  }

  if (!review.training_labels.approved_for_training) {
    return { eligible: false, reason: "Reviewer has not approved this run for training use." };
  }

  if (Number(review.accuracy_score) < policy.minimum_accuracy_score) {
    return { eligible: false, reason: `Accuracy score is below ${policy.minimum_accuracy_score}.` };
  }

  if (Number(review.maintainability_score) < policy.minimum_maintainability_score) {
    return { eligible: false, reason: `Maintainability score is below ${policy.minimum_maintainability_score}.` };
  }

  if (gateFailed) {
    return { eligible: false, reason: "At least one quality gate failed." };
  }

  if (openBlockingFinding) {
    return { eligible: false, reason: "There is at least one unresolved high-severity finding." };
  }

  return { eligible: true, reason: "Approved review with passing gates and threshold scores." };
}

function validateReview(review) {
  const decisions = new Set(["pending", "approved", "changes_requested", "rejected"]);

  if (!decisions.has(review.decision)) {
    throw new Error("review.json decision must be one of pending, approved, changes_requested, rejected.");
  }

  if (review.decision !== "pending" && !String(review.summary || "").trim()) {
    throw new Error("review.json summary is required once a review decision is recorded.");
  }

  ["accuracy_score", "maintainability_score", "confidence_score"].forEach((field) => {
    const value = Number(review[field]);

    if (Number.isNaN(value) || value < 0 || value > 100) {
      throw new Error(`review.json ${field} must be a number between 0 and 100.`);
    }
  });

  ["findings", "security_findings", "debt_findings", "ux_findings", "required_followups", "waivers"].forEach((field) => {
    if (!Array.isArray(review[field])) {
      throw new Error(`review.json ${field} must be an array.`);
    }
  });

  if (!review.context_checks || typeof review.context_checks !== "object") {
    throw new Error("review.json context_checks must be present.");
  }

  ["frontend_surfaces_checked", "backend_routes_checked", "tests_run"].forEach((field) => {
    if (!Array.isArray(review.context_checks[field])) {
      throw new Error(`review.json context_checks.${field} must be an array.`);
    }
  });

  if (!review.training_labels || typeof review.training_labels !== "object") {
    throw new Error("review.json training_labels must be present.");
  }

  if (typeof review.training_labels.approved_for_training !== "boolean") {
    throw new Error("review.json training_labels.approved_for_training must be true or false.");
  }
}

function validateInitArgs(config, args) {
  if (!args.track || !config.tracks[args.track]) {
    throw new Error("This command requires --track with one of the configured tracks.");
  }

  if (!args.idea) {
    throw new Error("This command requires --idea.");
  }
}

function resolveRepo(config, repoKey) {
  const repo = config.repos[repoKey];

  if (!repo) {
    throw new Error(`Unknown repo key ${repoKey}`);
  }

  return {
    ...repo,
    absolute_path: path.resolve(REPO_ROOT, repo.path)
  };
}

function loadRun(runRef) {
  const manifests = listRunManifests();

  if (!manifests.length) {
    throw new Error("No runs exist yet. Start with `init` or `pipeline`.");
  }

  if (!runRef || runRef === "latest") {
    return manifests[manifests.length - 1];
  }

  const match = manifests.find(({ manifest }) => manifest.run_id === runRef);

  if (!match) {
    throw new Error(`Run ${runRef} was not found.`);
  }

  return match;
}

function listRunManifests() {
  ensureDir(RUNS_ROOT);

  return fs
    .readdirSync(RUNS_ROOT, { withFileTypes: true })
    .filter((entry) => entry.isDirectory())
    .map((entry) => {
      const runDir = path.join(RUNS_ROOT, entry.name);
      const manifestPath = path.join(runDir, "manifest.json");

      if (!fs.existsSync(manifestPath)) {
        return null;
      }

      return {
        runDir,
        manifest: loadJson(manifestPath)
      };
    })
    .filter(Boolean)
    .sort((left, right) => left.manifest.run_id.localeCompare(right.manifest.run_id));
}

function loadReview(runDir) {
  return loadJson(path.join(runDir, "review", "review.json"));
}

function loadAgentAnalysisFromManifest(manifest) {
  const relativePath = manifest?.artifacts?.agent_response_path;

  if (!relativePath) {
    return null;
  }

  const absolutePath = path.resolve(REPO_ROOT, relativePath);

  if (!fs.existsSync(absolutePath)) {
    return null;
  }

  const parsed = loadJson(absolutePath);

  return {
    summary: String(parsed.summary || "").trim(),
    findings: Array.isArray(parsed.findings) ? parsed.findings : [],
    followups: Array.isArray(parsed.followups) ? parsed.followups : [],
    safe_edits: Array.isArray(parsed.safe_edits) ? parsed.safe_edits : [],
    selected_files: manifest?.agent?.selected_files || [],
    applied_edits: manifest?.agent?.applied_files || [],
    rejected_edits: manifest?.agent?.rejected_edits || []
  };
}

function resolveLearningsPublishedAt(manifest) {
  return manifest.learnings_published_at || manifest.published_at || null;
}

function statusFromReview(decision, currentStatus) {
  if (decision === "approved") {
    return "reviewed";
  }

  if (decision === "changes_requested") {
    return "changes_requested";
  }

  if (decision === "rejected") {
    return "rejected";
  }

  return currentStatus || "initialized";
}

function renderTemplate(templateName, replacements) {
  const templatePath = path.join(AUTOMATION_ROOT, "templates", templateName);
  let template = fs.readFileSync(templatePath, "utf8");

  Object.entries(replacements).forEach(([key, value]) => {
    template = template.replaceAll(`{{${key}}}`, value);
  });

  return template;
}

function queueStatusCounts() {
  return {
    pending: listJsonFiles(QUEUE_DIRS.pending).length,
    processing: listJsonFiles(QUEUE_DIRS.processing).length,
    done: listJsonFiles(QUEUE_DIRS.done).length,
    failed: listJsonFiles(QUEUE_DIRS.failed).length
  };
}

function listJsonFiles(directoryPath) {
  ensureDir(directoryPath);

  return fs
    .readdirSync(directoryPath, { withFileTypes: true })
    .filter((entry) => entry.isFile() && entry.name.endsWith(".json"))
    .map((entry) => path.join(directoryPath, entry.name))
    .sort();
}

function computeRunMetrics(manifest) {
  const diffSummary = manifest.git_snapshots.reduce(
    (accumulator, snapshot) => {
      const parsed = parseDiffStatSummary(snapshot.diff_stat);

      accumulator.files_changed += parsed.files_changed;
      accumulator.insertions += parsed.insertions;
      accumulator.deletions += parsed.deletions;
      accumulator.repos_touched += snapshot.changed_files.length ? 1 : 0;

      return accumulator;
    },
    { files_changed: 0, insertions: 0, deletions: 0, repos_touched: 0 }
  );
  const changedFiles = manifest.changed_files || [];
  const meaningfulProductFiles = changedFiles.filter(isMeaningfulProductFile);
  const meaningfulFrontendFiles = changedFiles.filter(isMeaningfulFrontendFile);
  const meaningfulBackendFiles = changedFiles.filter(isMeaningfulBackendFile);

  return {
    changed_files_count: changedFiles.length,
    frontend_files_changed: changedFiles.filter(
      (filePath) => filePath.startsWith("kaayko:src/") || filePath.startsWith("kaayko:kutz/src/")
    ).length,
    backend_files_changed: changedFiles.filter((filePath) => filePath.startsWith("kaayko-api:functions/")).length,
    meaningful_product_files_changed: meaningfulProductFiles.length,
    meaningful_frontend_files_changed: meaningfulFrontendFiles.length,
    meaningful_backend_files_changed: meaningfulBackendFiles.length,
    total_churn: diffSummary.insertions + diffSummary.deletions,
    insertions: diffSummary.insertions,
    deletions: diffSummary.deletions,
    repos_touched: diffSummary.repos_touched
  };
}

function parseDiffStatSummary(diffStat) {
  const text = String(diffStat || "");

  return {
    files_changed: extractFirstNumber(text, /(\d+)\s+files?\s+changed/),
    insertions: extractFirstNumber(text, /(\d+)\s+insertions?\(\+\)/),
    deletions: extractFirstNumber(text, /(\d+)\s+deletions?\(-\)/)
  };
}

function deriveFrontendSurfaces(changedFiles) {
  return uniqueStrings(
    changedFiles.flatMap((filePath) =>
      FRONTEND_SURFACE_RULES.filter((rule) => filePath.startsWith(rule.prefix)).map((rule) => rule.label)
    )
  );
}

function deriveBackendRoutes(changedFiles) {
  return uniqueStrings(
    changedFiles.flatMap((filePath) =>
      BACKEND_ROUTE_RULES.filter((rule) => filePath.startsWith(rule.prefix)).map((rule) => rule.label)
    )
  );
}

function debtLevelFromMetrics(failedGateCount, metrics) {
  if (failedGateCount > 0 || metrics.total_churn > 700) {
    return "high";
  }

  if (metrics.changed_files_count > 18 || metrics.total_churn > 500) {
    return "medium";
  }

  return "low";
}

function severityRank(severity) {
  const value = String(severity || "").toLowerCase();
  const order = { critical: 0, high: 1, medium: 2, low: 3, unknown: 4 };

  return order[value] !== undefined ? order[value] : order.unknown;
}

function isVulnerabilityFinding(finding) {
  const severity = String(finding?.severity || "").toLowerCase();
  const category = String(finding?.category || "").toLowerCase();

  return ["critical", "high"].includes(severity) || ["quality", "security", "auth", "billing", "tenant"].includes(category);
}

function isSuggestionFinding(finding) {
  const severity = String(finding?.severity || "").toLowerCase();
  const category = String(finding?.category || "").toLowerCase();

  if (isVulnerabilityFinding(finding)) {
    return false;
  }

  return ["low", "medium"].includes(severity) || ["duplication", "maintainability", "ux", "scope", "traceability"].includes(category);
}

function clampScore(value) {
  return Math.max(0, Math.min(100, Math.round(value)));
}

function roundNumber(value) {
  return Math.round(value * 10) / 10;
}

function isMeaningfulProductFile(filePath) {
  return isMeaningfulFrontendFile(filePath) || isMeaningfulBackendFile(filePath);
}

function isMeaningfulFrontendFile(filePath) {
  return filePath.startsWith("kaayko:src/") || filePath.startsWith("kaayko:kutz/src/");
}

function isMeaningfulBackendFile(filePath) {
  return filePath.startsWith("kaayko-api:functions/") || filePath.startsWith("kaayko-api:ml-service/");
}

function runShell(command, cwd, timeoutMs = 90000) {
  const startedAt = Date.now();
  const result = spawnSync(command, {
    cwd,
    shell: true,
    encoding: "utf8",
    env: process.env,
    timeout: timeoutMs,
    maxBuffer: 16 * 1024 * 1024
  });

  return {
    exit_code: result.status === null ? 1 : result.status,
    stdout: result.stdout || "",
    stderr: result.stderr || "",
    duration_ms: Date.now() - startedAt
  };
}

function formatRunTimestamp(date) {
  return date.toISOString().replace(/[-:]/g, "").replace(/\.\d{3}Z$/, "z").replace("T", "-");
}

function extractFilesFromStatus(statusText) {
  return String(statusText || "")
    .split("\n")
    .map((line) => line.replace(/\s+$/, ""))
    .filter(Boolean)
    .map((line) => {
      const match = line.match(/^[ MARCUD\?!]{1,2}\s+(.*)$/);
      return match ? match[1].trim() : "";
    })
    .filter(Boolean)
    .join("\n");
}

function extractFirstNumber(text, pattern) {
  const match = String(text || "").match(pattern);

  return match ? Number(match[1]) : 0;
}

function slugify(value) {
  return String(value)
    .trim()
    .toLowerCase()
    .replace(/[^a-z0-9]+/g, "-")
    .replace(/^-+|-+$/g, "")
    .slice(0, 80);
}

function relativeToRepo(targetPath) {
  return path.relative(REPO_ROOT, targetPath) || ".";
}

function resolveBooleanArg(value, fallback) {
  if (value === undefined || value === null) {
    return fallback;
  }

  if (typeof value === "boolean") {
    return value;
  }

  const normalized = String(value).trim().toLowerCase();

  if (["true", "1", "yes", "y"].includes(normalized)) {
    return true;
  }

  if (["false", "0", "no", "n"].includes(normalized)) {
    return false;
  }

  return fallback;
}

function uniqueStrings(values) {
  return Array.from(new Set(values.filter(Boolean)));
}

function readDashboardSummary() {
  const summaryPath = path.join(DASHBOARD_ROOT, "summary.json");

  if (!fs.existsSync(summaryPath)) {
    return null;
  }

  return loadJson(summaryPath);
}

function whichBinary(name) {
  const result = spawnSync(`which ${name}`, {
    cwd: REPO_ROOT,
    shell: true,
    encoding: "utf8",
    env: process.env
  });

  if (result.status !== 0) {
    return null;
  }

  return String(result.stdout || "").trim() || null;
}

function makeCheck(label, ok, detail) {
  return { label, ok, detail };
}

function resolveMissionTrack(area) {
  const normalized = String(area || "shared").toLowerCase();
  const map = {
    frontend: "shared",
    backend: "shared",
    shared: "shared",
    store: "store",
    kortex: "kortex",
    kreator: "kreator",
    "kamera-quest": "kamera-quest",
    kamera: "kamera-quest",
    "paddling-out": "paddling-out",
    paddlingout: "paddling-out",
    paddling: "paddling-out"
  };

  return map[normalized] || "shared";
}

function loadAgentCoachingConfig() {
  return loadOptionalJson(AGENT_COACHING_PATH, {
    portfolio_overview: "",
    track_profiles: {},
    profiles: {}
  });
}

function normalizeCoachingPath(value) {
  return String(value || "")
    .trim()
    .toLowerCase()
    .replace(/\/+$/g, "");
}

function coachingPathMatches(prefix, candidatePath) {
  const normalizedPrefix = normalizeCoachingPath(prefix);
  const normalizedCandidate = normalizeCoachingPath(candidatePath);

  return Boolean(normalizedPrefix) && Boolean(normalizedCandidate) && normalizedCandidate.startsWith(normalizedPrefix);
}

function buildCoachingProfileKeywords(profile) {
  return uniqueStrings(
    [
      profile.id,
      ...(profile.keywords || []),
      ...String(profile.name || "")
        .toLowerCase()
        .split(/[^a-z0-9]+/g)
        .filter((token) => token.length >= 4)
    ].map((item) => String(item || "").trim().toLowerCase())
  );
}

function scoreCoachingProfile(profile, context) {
  const goalLower = String(context.goal || "").toLowerCase();
  const goalTokens = Array.isArray(context.goalTokens) ? context.goalTokens : [];
  const area = String(context.area || "").toLowerCase();
  const track = String(context.track || "").toLowerCase();
  const filePaths = Array.isArray(context.filePaths) ? context.filePaths : [];
  let score = 0;

  if (profile.id === track) {
    score += 16;
  }

  if (profile.id === area) {
    score += 14;
  }

  if (track === "shared" && profile.id === "shared") {
    score += 18;
  }

  if (area === "frontend" && profile.id === "shared") {
    score += 6;
  }

  if (goalLower.includes(String(profile.name || "").toLowerCase())) {
    score += 12;
  }

  buildCoachingProfileKeywords(profile).forEach((keyword) => {
    if (!keyword) {
      return;
    }

    if (goalTokens.includes(keyword)) {
      score += 8;
    } else if (keyword.length >= 6 && goalLower.includes(keyword)) {
      score += 6;
    }
  });

  const profilePaths = uniqueStrings([...(profile.frontend_paths || []), ...(profile.backend_paths || [])]);
  if (filePaths.some((filePath) => profilePaths.some((prefix) => coachingPathMatches(prefix, filePath)))) {
    score += 20;
  }

  return score;
}

function selectFocusedProfiles(scoredProfiles) {
  if (!scoredProfiles.length) {
    return [];
  }

  const focused = [scoredProfiles[0]];
  scoredProfiles.slice(1).forEach((profile) => {
    if (focused.length >= 3) {
      return;
    }

    if (profile.focus_score >= 10) {
      focused.push(profile);
    }
  });

  return focused;
}

function extractDocSnapshot(content) {
  const selectedLines = [];
  let totalChars = 0;
  const maxChars = 1000;

  String(content || "")
    .split(/\r?\n/g)
    .map((line) => line.trim())
    .forEach((line) => {
      if (!line || totalChars >= maxChars || selectedLines.length >= 8) {
        return;
      }

      const isInteresting =
        /^#{1,3}\s/.test(line) ||
        /^[-*]\s/.test(line) ||
        /^\d+\.\s/.test(line) ||
        (line.length >= 40 && line.length <= 220);

      if (!isInteresting) {
        return;
      }

      const normalized = line.replace(/^#{1,3}\s*/, "").replace(/^[-*]\s*/, "").trim();
      if (!normalized) {
        return;
      }

      selectedLines.push(normalized);
      totalChars += normalized.length;
    });

  return selectedLines.join(" ");
}

function buildCoachingDocSnapshots(sourceDocs) {
  return uniqueStrings(sourceDocs)
    .slice(0, 4)
    .map((docPath) => {
      const absolutePath = path.resolve(REPO_ROOT, docPath);
      if (!fs.existsSync(absolutePath)) {
        return {
          path: docPath,
          status: "missing",
          summary: "Document not found in the current workspace."
        };
      }

      const summary = extractDocSnapshot(fs.readFileSync(absolutePath, "utf8"));
      return {
        path: docPath,
        status: "ok",
        summary: summary || "No concise snapshot was extracted."
      };
    });
}

function buildAgentCoachingBundle(track, area, goal, context = {}) {
  const coachingConfig = context.coachingConfig || loadAgentCoachingConfig();
  const trackProfiles = coachingConfig.track_profiles || {};
  const profilesMap = coachingConfig.profiles || {};
  const requestedTrack = String(track || resolveMissionTrack(area)).toLowerCase();
  const requestedArea = String(area || requestedTrack || "shared").toLowerCase();
  const goalValue = String(goal || "").trim();
  const goalTokens = agentFilesModule.tokenizeGoal(goalValue);
  const filePaths = uniqueStrings(context.filePaths || []);
  const candidateIds = uniqueStrings(trackProfiles[requestedTrack] || Object.keys(profilesMap));
  const scoredProfiles = candidateIds
    .map((id) => ({ id, ...(profilesMap[id] || {}) }))
    .filter((profile) => profile && profile.name)
    .map((profile) => ({
      ...profile,
      focus_score: scoreCoachingProfile(profile, {
        goal: goalValue,
        goalTokens,
        area: requestedArea,
        track: requestedTrack,
        filePaths
      })
    }))
    .sort((left, right) => right.focus_score - left.focus_score || left.name.localeCompare(right.name));
  const focusedProfiles = selectFocusedProfiles(scoredProfiles);
  const focusedProfileIds = focusedProfiles.map((profile) => profile.id);
  const focusedSourceDocs = uniqueStrings(focusedProfiles.flatMap((profile) => profile.source_docs || []));
  const supportingProfiles = scoredProfiles.filter((profile) => !focusedProfileIds.includes(profile.id));

  return {
    portfolio_overview: coachingConfig.portfolio_overview || "",
    goal: goalValue,
    area: requestedArea,
    track: requestedTrack,
    profile_ids: scoredProfiles.map((profile) => profile.id),
    guided_products: scoredProfiles.map((profile) => profile.name),
    focused_profile_ids: focusedProfileIds,
    focused_products: focusedProfiles.map((profile) => profile.name),
    source_docs: uniqueStrings(scoredProfiles.flatMap((profile) => profile.source_docs || [])),
    focused_source_docs: focusedSourceDocs,
    critical_path_prefixes: uniqueStrings(scoredProfiles.flatMap((profile) => profile.frontend_paths || [])),
    priority_path_prefixes: uniqueStrings(focusedProfiles.flatMap((profile) => profile.frontend_paths || [])),
    route_focus: uniqueStrings(scoredProfiles.flatMap((profile) => profile.backend_routes || [])),
    validation_focus: uniqueStrings(scoredProfiles.flatMap((profile) => profile.validation_focus || [])),
    risk_focus: uniqueStrings(scoredProfiles.flatMap((profile) => profile.risk_focus || [])),
    doc_snapshots: buildCoachingDocSnapshots(focusedSourceDocs.length ? focusedSourceDocs : uniqueStrings(scoredProfiles.flatMap((profile) => profile.source_docs || []))),
    profiles: scoredProfiles,
    focused_profiles: focusedProfiles,
    supporting_profiles: supportingProfiles
  };
}

function resolveRunCoachingContext(manifest, coachingConfig = loadAgentCoachingConfig()) {
  const filePaths = uniqueStrings([
    ...(manifest.changed_files || []),
    ...(manifest.agent?.selected_files || []),
    ...(manifest.agent?.applied_files || [])
  ]);
  const inferred = buildAgentCoachingBundle(manifest.track, manifest.requested_area, manifest.goal, {
    coachingConfig,
    filePaths
  });
  const persisted = manifest.coaching || {};

  return {
    ...inferred,
    profile_ids: uniqueStrings([...(persisted.profile_ids || []), ...inferred.profile_ids]),
    guided_products: uniqueStrings([...(persisted.guided_products || []), ...inferred.guided_products]),
    focused_profile_ids: uniqueStrings([...(persisted.focused_profile_ids || []), ...inferred.focused_profile_ids]),
    focused_products: uniqueStrings([...(persisted.focused_products || []), ...inferred.focused_products]),
    source_docs: uniqueStrings([...(persisted.source_docs || []), ...inferred.source_docs]),
    focused_source_docs: uniqueStrings([...(persisted.focused_source_docs || []), ...inferred.focused_source_docs]),
    route_focus: uniqueStrings([...(persisted.route_focus || []), ...inferred.route_focus]),
    validation_focus: uniqueStrings([...(persisted.validation_focus || []), ...inferred.validation_focus]),
    risk_focus: uniqueStrings([...(persisted.risk_focus || []), ...inferred.risk_focus])
  };
}

function buildAgentCoachingMarkdown(bundle, context = {}) {
  const profiles = bundle.profiles.length
    ? bundle.profiles
        .map((profile) => {
          const docs = (profile.source_docs || []).map((doc) => `- ${doc}`).join("\n");
          const validation = (profile.validation_focus || []).map((item) => `- ${item}`).join("\n");
          const risks = (profile.risk_focus || []).map((item) => `- ${item}`).join("\n");
          const paths = (profile.frontend_paths || []).slice(0, 8).map((item) => `- ${item}`).join("\n");
          const routes = (profile.backend_routes || []).map((item) => `- ${item}`).join("\n");
          const priority = bundle.focused_profile_ids.includes(profile.id) ? "primary" : "supporting";

          return `## ${profile.name}

- Priority: ${priority}
- Purpose: ${profile.purpose || "No purpose documented."}
- Source docs:
${docs || "- None."}
- Critical paths:
${paths || "- None."}
- Backend routes:
${routes || "- None."}
- Validation focus:
${validation || "- None."}
- Risk focus:
${risks || "- None."}
`;
        })
        .join("\n")
    : "No coaching profiles were configured for this track.";
  const docSnapshots = bundle.doc_snapshots.length
    ? bundle.doc_snapshots.map((doc) => `- ${doc.path}: ${doc.summary}`).join("\n")
    : "- No focused product docs were snapshot for this run.";

  return `# Agent Briefing

- Track: \`${bundle.track}\`
- Area: \`${context.area || bundle.area}\`
- Goal: ${context.goal || bundle.goal || "No goal provided."}
- Guided products: ${bundle.guided_products.length ? bundle.guided_products.join(", ") : "None"}
- Primary focus products: ${bundle.focused_products.length ? bundle.focused_products.join(", ") : "None"}
- Source docs: ${bundle.source_docs.length ? bundle.source_docs.join(", ") : "None"}

## Portfolio Overview

${bundle.portfolio_overview || "No portfolio overview configured."}

## Focused Doc Snapshots

${docSnapshots}

${profiles}
`;
}

function buildAgentCoachingPromptSection(bundle) {
  const profileSections = bundle.profiles.length
    ? bundle.profiles
        .map((profile) => {
          const validations = (profile.validation_focus || []).map((item) => `  - ${item}`).join("\n");
          const risks = (profile.risk_focus || []).map((item) => `  - ${item}`).join("\n");
          const routes = (profile.backend_routes || []).map((item) => `  - ${item}`).join("\n");
          const paths = (profile.frontend_paths || []).slice(0, 8).map((item) => `  - ${item}`).join("\n");
          const priority = bundle.focused_profile_ids.includes(profile.id) ? "Primary focus" : "Supporting context";

          return [
            `Product: ${profile.name} (${priority})`,
            `Purpose: ${profile.purpose || "No purpose documented."}`,
            "Critical paths:",
            paths || "  - None.",
            "Backend routes:",
            routes || "  - None.",
            "Validation focus:",
            validations || "  - None.",
            "Risk focus:",
            risks || "  - None."
          ].join("\n");
        })
        .join("\n\n")
    : "No product coaching is configured for this run.";
  const docSnapshots = bundle.doc_snapshots.length
    ? bundle.doc_snapshots.map((doc) => `- ${doc.path}: ${doc.summary}`).join("\n")
    : "- No focused product docs were available.";

  return [
    "PORTFOLIO COACHING",
    `Portfolio overview: ${bundle.portfolio_overview || "No overview configured."}`,
    `Guided products: ${bundle.guided_products.length ? bundle.guided_products.join(", ") : "None"}`,
    `Primary focus products: ${bundle.focused_products.length ? bundle.focused_products.join(", ") : "None"}`,
    `Source docs: ${bundle.source_docs.length ? bundle.source_docs.join(", ") : "None"}`,
    "",
    "Focused doc snapshots:",
    docSnapshots,
    "",
    profileSections
  ].join("\n");
}

function joinJsonl(lines) {
  return lines.length ? `${lines.join("\n")}\n` : "";
}

function ensureAutomationDirs() {
  [RUNS_ROOT, DATASETS_ROOT, QUEUE_ROOT, DASHBOARD_ROOT, KNOWLEDGE_ROOT, ...Object.values(QUEUE_DIRS)].forEach(ensureDir);
}

function ensureDir(directoryPath) {
  fs.mkdirSync(directoryPath, { recursive: true });
}

function escapeHtml(value) {
  return String(value)
    .replaceAll("&", "&amp;")
    .replaceAll("<", "&lt;")
    .replaceAll(">", "&gt;")
    .replaceAll('"', "&quot;")
    .replaceAll("'", "&#39;");
}

function safeRead(filePath) {
  if (!fs.existsSync(filePath)) {
    return "";
  }

  return fs.readFileSync(filePath, "utf8").trim();
}

function loadJson(filePath) {
  try {
    return JSON.parse(fs.readFileSync(filePath, "utf8"));
  } catch (error) {
    throw new Error(`Failed to load ${filePath}: ${error.message}`);
  }
}

function loadOptionalJson(filePath, fallback) {
  if (!fs.existsSync(filePath)) {
    return fallback;
  }

  try {
    return loadJson(filePath);
  } catch (error) {
    return fallback;
  }
}

function writeJson(filePath, value) {
  fs.writeFileSync(filePath, `${JSON.stringify(value, null, 2)}\n`);
}

function writeText(filePath, value) {
  fs.writeFileSync(filePath, value.endsWith("\n") ? value : `${value}\n`);
}
