export function buildTaskKey(source, originalId) {
  const normalizedSource = source || "Unknown";
  const normalizedOriginalId = originalId ?? "";
  return `${normalizedSource}::${normalizedOriginalId}`;
}

function stripPrefix(value, prefix) {
  if (typeof value !== "string") {
    return value;
  }

  if (!value.startsWith(prefix)) {
    return value;
  }

  return value.slice(prefix.length);
}

export function deriveOriginalId(task) {
  if (!task || typeof task !== "object") {
    return "";
  }

  if (task.originalId) {
    return String(task.originalId);
  }

  const source = task.source;

  if (source === "GitHub") {
    if (task.issue_id) {
      return String(task.issue_id);
    }

    if (task.issue_number && task.repo) {
      return `${task.repo}#${task.issue_number}`;
    }

    if (task.issue_number) {
      return String(task.issue_number);
    }

    if (task.id) {
      return stripPrefix(String(task.id), "github-");
    }
  }

  if (source === "Google Tasks") {
    if (task.googleTaskId) {
      return String(task.googleTaskId);
    }

    if (task.id) {
      return stripPrefix(String(task.id), "google-");
    }
  }

  if (source === "Trello") {
    if (task.trelloCardId) {
      return String(task.trelloCardId);
    }

    if (task.id) {
      return stripPrefix(String(task.id), "trello-");
    }
  }

  if (source === "Fellow") {
    if (task.fellowActionId) {
      return String(task.fellowActionId);
    }

    if (task.id) {
      return stripPrefix(String(task.id), "fellow-");
    }
  }

  if (task.id) {
    return String(task.id);
  }

  return "";
}
