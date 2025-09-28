import { access, mkdir, readFile, writeFile } from "node:fs/promises";
import path from "node:path";
import { buildTaskKey } from "./taskIdentity.js";

const DEFAULT_STORE_FILE = path.join(process.cwd(), "data", "completed-tasks.json");

function getStoreFilePath() {
  const overridePath = process.env.COMPLETED_TASKS_STORE_PATH;
  if (overridePath) {
    return overridePath;
  }

  return DEFAULT_STORE_FILE;
}

async function ensureStoreInitialized(filePath) {
  const directory = path.dirname(filePath);
  await mkdir(directory, { recursive: true });

  try {
    await access(filePath);
  } catch {
    await writeFile(filePath, "[]", "utf8");
  }
}

async function readStore(filePath) {
  await ensureStoreInitialized(filePath);

  try {
    const raw = await readFile(filePath, "utf8");
    const data = JSON.parse(raw);

    if (Array.isArray(data)) {
      return data;
    }
  } catch (error) {
    console.error("Failed to read completed tasks store:", error);
  }

  return [];
}

async function writeStore(filePath, data) {
  await ensureStoreInitialized(filePath);
  await writeFile(filePath, JSON.stringify(data, null, 2), "utf8");
}

function normalizeSnapshot(snapshot = {}) {
  const normalized = { ...snapshot };

  if (normalized.source) {
    normalized.source = String(normalized.source);
  }

  if (normalized.originalId) {
    normalized.originalId = String(normalized.originalId);
  }

  if (normalized.notes && typeof normalized.notes !== "string") {
    normalized.notes = String(normalized.notes);
  }

  if (normalized.title && typeof normalized.title !== "string") {
    normalized.title = String(normalized.title);
  }

  return normalized;
}

function clone(value) {
  return JSON.parse(JSON.stringify(value));
}

export async function getAllCompletedTasks() {
  const filePath = getStoreFilePath();
  const entries = await readStore(filePath);
  return clone(entries);
}

export async function upsertCompletedTask(snapshot) {
  if (!snapshot || typeof snapshot !== "object") {
    throw new Error("A valid completed task snapshot is required.");
  }

  const normalized = normalizeSnapshot(snapshot);
  const source = normalized.source;
  const originalId = normalized.originalId;

  if (!source || !originalId) {
    throw new Error("Completed task snapshots must include both source and originalId.");
  }

  const filePath = getStoreFilePath();
  const entries = await readStore(filePath);
  const key = buildTaskKey(source, originalId);
  const now = new Date().toISOString();
  const fallbackId = normalized.id || `completed-${key.replace(/[^a-zA-Z0-9]/g, "-")}`;
  const existingIndex = entries.findIndex((entry) => buildTaskKey(entry.source, entry.originalId) === key);
  const existingEntry = existingIndex >= 0 ? entries[existingIndex] : null;

  const createdAt = existingEntry?.createdAt || normalized.createdAt || now;
  const completedAt = normalized.completedAt || existingEntry?.completedAt || now;

  const updatedEntry = {
    ...existingEntry,
    ...normalized,
    source,
    originalId,
    id: fallbackId,
    createdAt,
    completedAt,
    updatedAt: now,
  };

  if (existingIndex >= 0) {
    entries[existingIndex] = updatedEntry;
  } else {
    entries.push(updatedEntry);
  }

  await writeStore(filePath, entries);

  return clone(updatedEntry);
}
