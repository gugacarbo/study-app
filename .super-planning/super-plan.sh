#!/usr/bin/env sh
set -eu

MODE="init"

if [ "$#" -gt 0 ]; then
  case "$1" in
    init|update)
      MODE="$1"
      shift
      ;;
    --*)
      MODE="init"
      ;;
    *)
      echo "Unknown subcommand: $1" >&2
      exit 1
      ;;
  esac
fi

SCRIPT_DIR="$(CDPATH= cd -- "$(dirname "$0")" && pwd)"
SKILL_DIR="$(dirname "$SCRIPT_DIR")"
LEDGER_SCRIPT="$SCRIPT_DIR/render-progress-ledger.sh"

usage() {
  cat <<'EOF'
Usage:
  super-plan.sh init \
    --plan-id <NNNN-feature-name> \
    --feature-name <feature-name> \
    --spec <docs/specs/...-spec.md> \
    --plan <docs/plans/...md> \
    --output <docs/tasks/.../super-plan.json> \
    [--base-branch <branch>] \
    [--feature-branch <branch>] \
    [--task-directory <docs/tasks/...>] \
    [--worktree-enabled true|false] \
    [--worktree-path <relative-path>] \
    [--execution-mode subagent-driven|sequential] \
    [--review-cadence per_task|per_batch|final_only] \
    [--schema <path/to/interfaces/super-plan.schema.json>]

  super-plan.sh update \
    --input <docs/tasks/.../super-plan.json> \
    [--set <path>=<json-or-string>] \
    [--append <path>=<json-or-@file>] \
    [--remove <path>] ...

Notes:
  - If no subcommand is provided, `init` is assumed for backward compatibility.
  - Every successful write regenerates `progress-ledger.md`.
  - Paths support dot notation plus array selectors by id, e.g.:
      tasks[Task-A-0001].status=ready_for_review
      requirementsChecklist[REQ-001].status=completed
EOF
  exit 1
}

render_ledger() {
  json_path="$1"
  "$LEDGER_SCRIPT" --input "$json_path" >/dev/null
}

validate_json() {
  json_path="$1"
  python3 - "$json_path" <<'PY'
import json
import sys
from pathlib import Path

path = Path(sys.argv[1])

PLAN_STATUSES = {"pending", "in_progress", "ready_for_review", "needs_fix", "blocked", "completed"}
TASK_STATUSES = PLAN_STATUSES | {"reviewing", "cancelled"}
REVIEW_CADENCE = {"per_task", "per_batch", "final_only"}
EXECUTION_MODE = {"subagent-driven", "sequential"}
TASK_PHASES = {"foundation", "core", "surface", "final"}
TASK_PROFILES = {"general", "deep", "quick"}


def fail(message: str):
    raise ValueError(message)


def expect_type(value, expected_type, path_label: str):
    if not isinstance(value, expected_type):
        fail(f"{path_label} must be {expected_type.__name__}")


def expect_non_empty_string(value, path_label: str):
    if not isinstance(value, str) or not value:
        fail(f"{path_label} must be a non-empty string")


def expect_string_list(value, path_label: str):
    expect_type(value, list, path_label)
    for index, item in enumerate(value):
        expect_non_empty_string(item, f"{path_label}[{index}]")


def expect_status(value, allowed: set[str], path_label: str):
    expect_non_empty_string(value, path_label)
    if value not in allowed:
        fail(f"{path_label} must be one of: {', '.join(sorted(allowed))}")


def expect_keys(obj, required_keys, path_label: str):
    expect_type(obj, dict, path_label)
    missing = [key for key in required_keys if key not in obj]
    if missing:
        fail(f"{path_label} is missing required keys: {', '.join(missing)}")


with path.open("r", encoding="utf-8") as fh:
    payload = json.load(fh)

expect_keys(
    payload,
    [
        "$schema",
        "planId",
        "featureName",
        "status",
        "source",
        "goal",
        "architectureSummary",
        "techStack",
        "executionMode",
        "reviewCadence",
        "agents",
        "branchStrategy",
        "worktree",
        "globalConstraints",
        "fileStructure",
        "requirementsChecklist",
        "taskDirectory",
        "rules",
        "tasks",
    ],
    "root",
)

expect_non_empty_string(payload["$schema"], "$schema")
expect_non_empty_string(payload["planId"], "planId")
expect_non_empty_string(payload["featureName"], "featureName")
expect_status(payload["status"], PLAN_STATUSES, "status")
expect_type(payload["goal"], str, "goal")
expect_type(payload["architectureSummary"], str, "architectureSummary")
expect_string_list(payload["techStack"], "techStack")
expect_string_list(payload["globalConstraints"], "globalConstraints")
expect_string_list(payload["rules"], "rules")
expect_non_empty_string(payload["taskDirectory"], "taskDirectory")

expect_keys(payload["source"], ["spec", "plan"], "source")
expect_non_empty_string(payload["source"]["spec"], "source.spec")
expect_non_empty_string(payload["source"]["plan"], "source.plan")

expect_non_empty_string(payload["executionMode"], "executionMode")
if payload["executionMode"] not in EXECUTION_MODE:
    fail(f"executionMode must be one of: {', '.join(sorted(EXECUTION_MODE))}")

expect_non_empty_string(payload["reviewCadence"], "reviewCadence")
if payload["reviewCadence"] not in REVIEW_CADENCE:
    fail(f"reviewCadence must be one of: {', '.join(sorted(REVIEW_CADENCE))}")

expect_keys(payload["agents"], ["general", "deep", "quick"], "agents")
for profile_name in ("general", "deep", "quick"):
    profile = payload["agents"][profile_name]
    expect_keys(profile, ["model", "agent"], f"agents.{profile_name}")
    if not isinstance(profile["model"], str):
        fail(f"agents.{profile_name}.model must be a string")
    if not isinstance(profile["agent"], str):
        fail(f"agents.{profile_name}.agent must be a string")

expect_keys(payload["branchStrategy"], ["baseBranch", "featureBranch"], "branchStrategy")
expect_non_empty_string(payload["branchStrategy"]["baseBranch"], "branchStrategy.baseBranch")
expect_non_empty_string(payload["branchStrategy"]["featureBranch"], "branchStrategy.featureBranch")

expect_keys(payload["worktree"], ["enabled", "path"], "worktree")
if not isinstance(payload["worktree"]["enabled"], bool):
    fail("worktree.enabled must be a boolean")
if not isinstance(payload["worktree"]["path"], str):
    fail("worktree.path must be a string")
if payload["worktree"]["enabled"] and not payload["worktree"]["path"]:
    fail("worktree.path must be a non-empty string when worktree.enabled is true")

expect_type(payload["fileStructure"], list, "fileStructure")
for index, entry in enumerate(payload["fileStructure"]):
    path_label = f"fileStructure[{index}]"
    expect_keys(entry, ["path", "ownerTask", "notes"], path_label)
    expect_non_empty_string(entry["path"], f"{path_label}.path")
    expect_non_empty_string(entry["ownerTask"], f"{path_label}.ownerTask")
    expect_type(entry["notes"], str, f"{path_label}.notes")

expect_type(payload["requirementsChecklist"], list, "requirementsChecklist")
for index, requirement in enumerate(payload["requirementsChecklist"]):
    path_label = f"requirementsChecklist[{index}]"
    expect_keys(
        requirement,
        ["id", "title", "source", "status", "acceptanceCriteria", "coveredByTasks", "notes"],
        path_label,
    )
    expect_non_empty_string(requirement["id"], f"{path_label}.id")
    expect_non_empty_string(requirement["title"], f"{path_label}.title")
    expect_type(requirement["source"], str, f"{path_label}.source")
    expect_status(requirement["status"], PLAN_STATUSES, f"{path_label}.status")
    expect_string_list(requirement["acceptanceCriteria"], f"{path_label}.acceptanceCriteria")
    expect_string_list(requirement["coveredByTasks"], f"{path_label}.coveredByTasks")
    expect_string_list(requirement["notes"], f"{path_label}.notes")

expect_type(payload["tasks"], list, "tasks")
for index, task in enumerate(payload["tasks"]):
    path_label = f"tasks[{index}]"
    expect_keys(
        task,
        [
            "id",
            "title",
            "description",
            "status",
            "tryCount",
            "task_profile",
            "batch",
            "phase",
            "reportFile",
            "reviewPackage",
            "progressLog",
            "logTaskScript",
            "dependencies",
            "acceptanceCriteria",
            "requirements",
            "rules",
            "steps",
            "filesTouched",
            "files",
            "notes",
        ],
        path_label,
    )
    expect_non_empty_string(task["id"], f"{path_label}.id")
    expect_non_empty_string(task["title"], f"{path_label}.title")
    expect_type(task["description"], str, f"{path_label}.description")
    expect_status(task["status"], TASK_STATUSES, f"{path_label}.status")
    if not isinstance(task["tryCount"], int) or task["tryCount"] < 1:
        fail(f"{path_label}.tryCount must be an integer >= 1")
    expect_non_empty_string(task["task_profile"], f"{path_label}.task_profile")
    if task["task_profile"] not in TASK_PROFILES:
        fail(f"{path_label}.task_profile must be one of: {', '.join(sorted(TASK_PROFILES))}")
    expect_non_empty_string(task["batch"], f"{path_label}.batch")
    expect_non_empty_string(task["phase"], f"{path_label}.phase")
    if task["phase"] not in TASK_PHASES:
        fail(f"{path_label}.phase must be one of: {', '.join(sorted(TASK_PHASES))}")
    expect_non_empty_string(task["reportFile"], f"{path_label}.reportFile")
    expect_non_empty_string(task["reviewPackage"], f"{path_label}.reviewPackage")
    expect_non_empty_string(task["progressLog"], f"{path_label}.progressLog")
    expect_non_empty_string(task["logTaskScript"], f"{path_label}.logTaskScript")
    expect_string_list(task["dependencies"], f"{path_label}.dependencies")
    expect_string_list(task["acceptanceCriteria"], f"{path_label}.acceptanceCriteria")
    expect_string_list(task["requirements"], f"{path_label}.requirements")
    expect_string_list(task["rules"], f"{path_label}.rules")
    expect_string_list(task["filesTouched"], f"{path_label}.filesTouched")
    expect_string_list(task["notes"], f"{path_label}.notes")

    expect_type(task["steps"], list, f"{path_label}.steps")
    for step_index, step in enumerate(task["steps"]):
        step_label = f"{path_label}.steps[{step_index}]"
        expect_keys(step, ["order", "title", "description", "command", "expectedResult", "codeExample"], step_label)
        if not isinstance(step["order"], int) or step["order"] < 1:
            fail(f"{step_label}.order must be an integer >= 1")
        expect_non_empty_string(step["title"], f"{step_label}.title")
        expect_type(step["description"], str, f"{step_label}.description")
        if step["command"] is not None and not isinstance(step["command"], str):
            fail(f"{step_label}.command must be a string or null")
        if step["expectedResult"] is not None and not isinstance(step["expectedResult"], str):
            fail(f"{step_label}.expectedResult must be a string or null")
        if step["codeExample"] is not None and not isinstance(step["codeExample"], str):
            fail(f"{step_label}.codeExample must be a string or null")

    expect_keys(task["files"], ["created", "modified", "deleted"], f"{path_label}.files")
    expect_string_list(task["files"]["created"], f"{path_label}.files.created")
    expect_string_list(task["files"]["modified"], f"{path_label}.files.modified")
    expect_string_list(task["files"]["deleted"], f"{path_label}.files.deleted")
PY
}

if [ "$MODE" = "init" ]; then
  PLAN_ID=""
  FEATURE_NAME=""
  SPEC_PATH=""
  PLAN_PATH=""
  OUTPUT_PATH=""
  BASE_BRANCH="${BASE_BRANCH:-main}"
  FEATURE_BRANCH=""
  TASK_DIRECTORY=""
  WORKTREE_ENABLED="${WORKTREE_ENABLED:-true}"
  WORKTREE_PATH=""
  EXECUTION_MODE="${EXECUTION_MODE:-subagent-driven}"
  REVIEW_CADENCE="${REVIEW_CADENCE:-per_task}"
  SCHEMA_PATH=""

  while [ "$#" -gt 0 ]; do
    case "$1" in
      --plan-id)
        PLAN_ID="$2"
        shift 2
        ;;
      --feature-name)
        FEATURE_NAME="$2"
        shift 2
        ;;
      --spec)
        SPEC_PATH="$2"
        shift 2
        ;;
      --plan)
        PLAN_PATH="$2"
        shift 2
        ;;
      --output)
        OUTPUT_PATH="$2"
        shift 2
        ;;
      --base-branch)
        BASE_BRANCH="$2"
        shift 2
        ;;
      --feature-branch)
        FEATURE_BRANCH="$2"
        shift 2
        ;;
      --task-directory)
        TASK_DIRECTORY="$2"
        shift 2
        ;;
      --worktree-enabled)
        WORKTREE_ENABLED="$2"
        shift 2
        ;;
      --worktree-path)
        WORKTREE_PATH="$2"
        shift 2
        ;;
      --execution-mode)
        EXECUTION_MODE="$2"
        shift 2
        ;;
      --review-cadence)
        REVIEW_CADENCE="$2"
        shift 2
        ;;
      --schema)
        SCHEMA_PATH="$2"
        shift 2
        ;;
      *)
        usage
        ;;
    esac
  done

  if [ -z "$PLAN_ID" ] || [ -z "$FEATURE_NAME" ] || [ -z "$SPEC_PATH" ] || [ -z "$PLAN_PATH" ] || [ -z "$OUTPUT_PATH" ]; then
    usage
  fi

  case "$WORKTREE_ENABLED" in
    true|false) ;;
    *)
      echo "Invalid --worktree-enabled value: $WORKTREE_ENABLED" >&2
      exit 1
      ;;
  esac

  case "$EXECUTION_MODE" in
    subagent-driven|sequential) ;;
    *)
      echo "Invalid --execution-mode value: $EXECUTION_MODE" >&2
      exit 1
      ;;
  esac

  case "$REVIEW_CADENCE" in
    per_task|per_batch|final_only) ;;
    *)
      echo "Invalid --review-cadence value: $REVIEW_CADENCE" >&2
      exit 1
      ;;
  esac

  if [ -z "$SCHEMA_PATH" ]; then
    if [ -f "$SCRIPT_DIR/super-plan.schema.json" ]; then
      SCHEMA_PATH="$SCRIPT_DIR/super-plan.schema.json"
    else
      SCHEMA_PATH="$SKILL_DIR/interfaces/super-plan.schema.json"
    fi
  fi

  if [ -z "$FEATURE_BRANCH" ]; then
    FEATURE_BRANCH="$PLAN_ID"
  fi

  if [ -z "$TASK_DIRECTORY" ]; then
    TASK_DIRECTORY="$(dirname "$OUTPUT_PATH")"
  fi

  if [ -z "$WORKTREE_PATH" ]; then
    WORKTREE_PATH="../$PLAN_ID-worktree"
  fi

  mkdir -p "$(dirname "$OUTPUT_PATH")"

  python3 - "$PLAN_ID" "$FEATURE_NAME" "$SPEC_PATH" "$PLAN_PATH" "$OUTPUT_PATH" "$BASE_BRANCH" "$FEATURE_BRANCH" "$TASK_DIRECTORY" "$WORKTREE_ENABLED" "$WORKTREE_PATH" "$EXECUTION_MODE" "$REVIEW_CADENCE" "$SCHEMA_PATH" <<'PY'
import json
import sys

(
    plan_id,
    feature_name,
    spec_path,
    plan_path,
    output_path,
    base_branch,
    feature_branch,
    task_directory,
    worktree_enabled,
    worktree_path,
    execution_mode,
    review_cadence,
    schema_path,
) = sys.argv[1:]

payload = {
    "$schema": schema_path,
    "planId": plan_id,
    "featureName": feature_name,
    "status": "pending",
    "source": {
        "spec": spec_path,
        "plan": plan_path,
    },
    "goal": "",
    "architectureSummary": "",
    "techStack": [],
    "executionMode": execution_mode,
    "reviewCadence": review_cadence,
    "agents": {
        "general": {"model": "", "agent": ""},
        "deep": {"model": "", "agent": ""},
        "quick": {"model": "", "agent": ""},
    },
    "branchStrategy": {
        "baseBranch": base_branch,
        "featureBranch": feature_branch,
    },
    "worktree": {
        "enabled": worktree_enabled == "true",
        "path": worktree_path,
    },
    "globalConstraints": [],
    "fileStructure": [],
    "requirementsChecklist": [],
    "taskDirectory": task_directory,
    "rules": [],
    "tasks": [],
}

with open(output_path, "w", encoding="utf-8") as fh:
    json.dump(payload, fh, indent=2)
    fh.write("\n")
PY

  validate_json "$OUTPUT_PATH"
  render_ledger "$OUTPUT_PATH"
  printf '%s\n' "$OUTPUT_PATH"
  exit 0
fi

if [ "$MODE" = "update" ]; then
  INPUT_PATH=""
  UPDATE_ARGS_FILE="$(mktemp)"
  trap 'rm -f "$UPDATE_ARGS_FILE"' EXIT HUP INT TERM

  while [ "$#" -gt 0 ]; do
    case "$1" in
      --input)
        INPUT_PATH="$2"
        shift 2
        ;;
      --set|--append|--remove)
        op="$1"
        value="$2"
        shift 2
        printf '%s\t%s\n' "$op" "$value" >> "$UPDATE_ARGS_FILE"
        ;;
      *)
        usage
        ;;
    esac
  done

  if [ -z "$INPUT_PATH" ] || [ ! -s "$UPDATE_ARGS_FILE" ]; then
    usage
  fi

  TEMP_OUTPUT_PATH="$(mktemp)"
  trap 'rm -f "$UPDATE_ARGS_FILE" "$TEMP_OUTPUT_PATH"' EXIT HUP INT TERM

  python3 - "$INPUT_PATH" "$UPDATE_ARGS_FILE" "$TEMP_OUTPUT_PATH" <<'PY'
import json
import sys
from pathlib import Path

input_path = Path(sys.argv[1])
ops_path = Path(sys.argv[2])
output_path = Path(sys.argv[3])

with input_path.open("r", encoding="utf-8") as fh:
    data = json.load(fh)


def parse_value(raw: str):
    if raw.startswith("@"):
        with open(raw[1:], "r", encoding="utf-8") as fh:
            return json.load(fh)
    try:
        return json.loads(raw)
    except json.JSONDecodeError:
        return raw


def parse_path(path: str):
    tokens = []
    current = ""
    idx = 0
    while idx < len(path):
        char = path[idx]
        if char == ".":
            if current:
                tokens.append((current, None))
                current = ""
            idx += 1
            continue
        if char == "[":
            field = current
            current = ""
            end = path.find("]", idx)
            if end == -1:
                raise ValueError(f"Invalid path selector: {path}")
            selector = path[idx + 1 : end]
            tokens.append((field, selector))
            idx = end + 1
            if idx < len(path) and path[idx] == ".":
                idx += 1
            continue
        current += char
        idx += 1
    if current:
        tokens.append((current, None))
    return tokens


def select_child(container, field, selector):
    if field:
        container = container[field]
    if selector is None:
        return container
    if not isinstance(container, list):
        raise TypeError(f"Path selector requires a list at {field!r}")
    if selector.isdigit():
        return container[int(selector)]
    for item in container:
        if isinstance(item, dict) and item.get("id") == selector:
            return item
    raise KeyError(f"Could not find list item with id {selector!r} in {field!r}")


def get_parent(root, tokens):
    cursor = root
    for field, selector in tokens[:-1]:
        cursor = select_child(cursor, field, selector)
    return cursor, tokens[-1]


def set_value(root, path, value, append=False):
    tokens = parse_path(path)
    parent, (field, selector) = get_parent(root, tokens)
    if selector is None:
        if append:
            target = parent[field]
            if not isinstance(target, list):
                raise TypeError(f"Append target is not a list: {path}")
            target.append(value)
        else:
            parent[field] = value
        return
    target = select_child(parent, field, None)
    if selector.isdigit():
        index = int(selector)
        if append:
            nested = target[index]
            if not isinstance(nested, list):
                raise TypeError(f"Append target is not a list: {path}")
            nested.append(value)
        else:
            target[index] = value
        return
    for index, item in enumerate(target):
        if isinstance(item, dict) and item.get("id") == selector:
            if append:
                if not isinstance(item, list):
                    raise TypeError(f"Append target is not a list: {path}")
                item.append(value)
            else:
                target[index] = value
            return
    raise KeyError(f"Could not replace list item with id {selector!r}")


def remove_value(root, path):
    tokens = parse_path(path)
    parent, (field, selector) = get_parent(root, tokens)
    if selector is None:
        del parent[field]
        return
    target = select_child(parent, field, None)
    if selector.isdigit():
        del target[int(selector)]
        return
    for index, item in enumerate(target):
        if isinstance(item, dict) and item.get("id") == selector:
            del target[index]
            return
    raise KeyError(f"Could not remove list item with id {selector!r}")


with ops_path.open("r", encoding="utf-8") as fh:
    for raw_line in fh:
        raw_line = raw_line.rstrip("\n")
        if not raw_line:
            continue
        op, payload = raw_line.split("\t", 1)
        if op == "--remove":
            remove_value(data, payload)
            continue
        if "=" not in payload:
            raise ValueError(f"Expected <path>=<value> for {op}: {payload}")
        path, raw_value = payload.split("=", 1)
        value = parse_value(raw_value)
        set_value(data, path, value, append=(op == "--append"))

with output_path.open("w", encoding="utf-8") as fh:
    json.dump(data, fh, indent=2)
    fh.write("\n")
PY

  validate_json "$TEMP_OUTPUT_PATH"
  mv "$TEMP_OUTPUT_PATH" "$INPUT_PATH"
  render_ledger "$INPUT_PATH"
  printf '%s\n' "$INPUT_PATH"
  exit 0
fi

usage
