#!/usr/bin/env sh
set -eu

INPUT_PATH=""
OUTPUT_PATH=""

usage() {
  cat <<'EOF'
Usage: render-progress-ledger.sh --input <docs/tasks/.../super-plan.json> [--output <docs/tasks/.../progress-ledger.md>]
EOF
  exit 1
}

while [ "$#" -gt 0 ]; do
  case "$1" in
    --input)
      INPUT_PATH="$2"
      shift 2
      ;;
    --output)
      OUTPUT_PATH="$2"
      shift 2
      ;;
    *)
      usage
      ;;
  esac
done

if [ -z "$INPUT_PATH" ]; then
  usage
fi

if [ -z "$OUTPUT_PATH" ]; then
  OUTPUT_PATH="$(dirname "$INPUT_PATH")/progress-ledger.md"
fi

mkdir -p "$(dirname "$OUTPUT_PATH")"

python3 - "$INPUT_PATH" "$OUTPUT_PATH" <<'PY'
import json
import sys
from datetime import datetime, timezone
from pathlib import Path

input_path, output_path = sys.argv[1:]
input_path = Path(input_path)
output_path = Path(output_path)

with input_path.open("r", encoding="utf-8") as fh:
    payload = json.load(fh)

status_map = {
    "pending": "⏳ pending",
    "in_progress": "🔄 in progress",
    "ready_for_review": "🔎 ready for review",
    "reviewing": "🔍 reviewing",
    "needs_fix": "🔁 needs-fix",
    "blocked": "❌ blocked",
    "completed": "✅ completed",
    "cancelled": "⚪ cancelled",
}

summary_statuses = ["pending", "in_progress", "ready_for_review", "reviewing", "needs_fix", "blocked", "completed", "cancelled"]


def resolve_workspace_root():
    task_directory = payload.get("taskDirectory", "")
    if isinstance(task_directory, str) and task_directory:
        normalized_task_dir = task_directory.strip("/")
        expected_suffix = normalized_task_dir.split("/") + [input_path.name]
        input_parts = list(input_path.parts)
        if len(input_parts) >= len(expected_suffix) and input_parts[-len(expected_suffix) :] == expected_suffix:
            root_parts = input_parts[: -len(expected_suffix)]
            if root_parts:
                return Path(*root_parts)
            return Path(input_path.anchor or "/")
    return input_path.parent


workspace_root = resolve_workspace_root()


def resolve_repo_path(raw_path: str):
    if not raw_path:
        return None
    candidate = Path(raw_path)
    if candidate.is_absolute():
        return candidate
    cwd_candidate = Path.cwd() / candidate
    if cwd_candidate.exists():
        return cwd_candidate
    return workspace_root / candidate


def status_label(status: str):
    return status_map.get(status, status or "unknown")


def display_dependencies(dependencies):
    if not dependencies:
        return "—"
    return ", ".join(dependencies)


def display_profile_config(profile):
    if not isinstance(profile, dict):
        return "—", "—"
    model = profile.get("model", "")
    agent = profile.get("agent", "")
    return model or "default", agent or "default"


def collect_timeline(tasks):
    events = []
    for task in tasks:
        progress_log = resolve_repo_path(task.get("progressLog", ""))
        if progress_log is None or not progress_log.exists():
            continue
        with progress_log.open("r", encoding="utf-8") as fh:
            for line in fh:
                line = line.strip()
                if not line:
                    continue
                try:
                    event = json.loads(line)
                except json.JSONDecodeError:
                    continue
                events.append(
                    {
                        "timestamp": event.get("timestamp", "—"),
                        "task": event.get("task", task.get("id", "—")),
                        "event": event.get("event", "—"),
                        "try": event.get("try", "—"),
                    }
                )
    events.sort(key=lambda item: (item["timestamp"], item["task"], item["event"]))
    return events


generated_at = datetime.now(timezone.utc).strftime("%Y-%m-%dT%H:%M:%SZ")
plan_id = payload.get("planId", "")
feature_name = payload.get("featureName", "")
tasks = payload.get("tasks", [])
requirements = payload.get("requirementsChecklist", [])
timeline = collect_timeline(tasks)

status_counts = {status: 0 for status in summary_statuses}
for task in tasks:
    task_status = task.get("status")
    if task_status in status_counts:
        status_counts[task_status] += 1

lines = [
    f"# Progress Ledger: {feature_name}",
    "",
    f"> **Plan:** `{plan_id}`",
    f"> **Registry:** `{payload.get('taskDirectory', '')}/super-plan.json`",
    f"> **Generated:** {generated_at}",
    "> **Regenerated on every `super-plan.json` write via the active `render-progress-ledger.sh` helper path**",
    "",
    "## Summary",
    "",
    "| Status | Count |",
    "|--------|-------|",
]

for status in summary_statuses:
    lines.append(f"| {status} | {status_counts[status]} |")
lines.append(f"| **Total** | **{len(tasks)}** |")

lines.extend(
    [
        "",
        "## Agent Profiles",
        "",
        "| Profile | Model | Agent |",
        "|---------|-------|-------|",
    ]
)

for profile_name in ("general", "deep", "quick"):
    model, agent = display_profile_config(payload.get("agents", {}).get(profile_name, {}))
    lines.append(f"| {profile_name} | {model} | {agent} |")

lines.extend(
    [
        "",
        "## Tasks",
        "",
        "| Task ID | Title | Profile | Batch | Phase | Status | Dependencies |",
        "|---------|-------|---------|-------|-------|--------|-------------|",
    ]
)

if tasks:
    for task in tasks:
        lines.append(
            "| {id} | {title} | {profile} | {batch} | {phase} | {status} | {deps} |".format(
                id=task.get("id", "—"),
                title=task.get("title", "—"),
                profile=task.get("task_profile", "—"),
                batch=task.get("batch", "—"),
                phase=task.get("phase", "—"),
                status=status_label(task.get("status")),
                deps=display_dependencies(task.get("dependencies", [])),
            )
        )
else:
    lines.append("| — | no tasks defined yet | — | — | — | ⏳ pending | — |")

lines.extend(
    [
        "",
        "## Timeline",
        "",
        "| Timestamp | Task | Event | Try |",
        "|-----------|------|-------|-----|",
    ]
)

if timeline:
    for event in timeline:
        lines.append(f"| {event['timestamp']} | {event['task']} | {event['event']} | {event['try']} |")
else:
    lines.append("| — | — | no task events logged yet | — |")

lines.extend(
    [
        "",
        "## Requirements Coverage",
        "",
        "| Requirement | Status | Covered By |",
        "|-------------|--------|------------|",
    ]
)

if requirements:
    for requirement in requirements:
        lines.append(
            "| {req} | {status} | {covered} |".format(
                req=f"{requirement.get('id', '—')}: {requirement.get('title', '—')}",
                status=status_label(requirement.get("status")),
                covered=display_dependencies(requirement.get("coveredByTasks", [])),
            )
        )
else:
    lines.append("| — | no requirements defined yet | — |")

with output_path.open("w", encoding="utf-8") as fh:
    fh.write("\n".join(lines))
    fh.write("\n")
PY

printf '%s\n' "$OUTPUT_PATH"
