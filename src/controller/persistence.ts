import * as fs from "fs-extra";
import * as path from "path";
import { InsightDatasetKind, InsightError } from "./IInsightFacade";
import { DatasetEntry, Record } from "./types";

export const DATA_DIR = "./data";
const JSON_SUFFIX_LENGTH = -".json".length;
const LEGACY_SECTION_COLUMNS = ["uuid", "id", "title", "instructor", "dept", "year", "avg", "pass", "fail", "audit"];

interface CompactPersisted {
	id: string;
	kind: InsightDatasetKind;
	numRows: number;
	columns?: string[];
	rows?: unknown[][];
	// legacy C1 sections format
	sections?: unknown[][] | unknown[];
}

export async function persistDataset(entry: DatasetEntry): Promise<void> {
	await fs.ensureDir(DATA_DIR);
	const filePath = path.join(DATA_DIR, `${entry.id}.json`);
	const columns = entry.rows.length > 0 ? Object.keys(entry.rows[0]) : [];
	const rows = entry.rows.map((row) => columns.map((c) => row[c]));
	const compact: CompactPersisted = {
		id: entry.id,
		kind: entry.kind,
		numRows: entry.rows.length,
		columns,
		rows,
	};
	await fs.writeJson(filePath, compact);
}

export async function loadDatasetFromDisk(id: string): Promise<DatasetEntry> {
	const filePath = path.join(DATA_DIR, `${id}.json`);
	let raw: unknown;
	try {
		raw = await fs.readJson(filePath);
	} catch {
		throw new InsightError(`Dataset "${id}" not found on disk`);
	}
	if (typeof raw !== "object" || raw === null) {
		throw new InsightError(`Dataset "${id}" is malformed on disk`);
	}
	const r = raw as CompactPersisted;
	if (Array.isArray(r.rows) && Array.isArray(r.columns)) {
		return { id: r.id, kind: r.kind, rows: hydrateRows(r.columns, r.rows) };
	}
	if (Array.isArray(r.sections)) {
		return { id: r.id, kind: r.kind, rows: hydrateRows(LEGACY_SECTION_COLUMNS, r.sections as unknown[][]) };
	}
	throw new InsightError(`Dataset "${id}" is malformed on disk`);
}

function hydrateRows(cols: string[], rows: unknown[][]): Record[] {
	return rows.map((arr) => {
		const obj: Record = {};
		for (let i = 0; i < cols.length; i++) {
			obj[cols[i]] = arr[i] as string | number;
		}
		return obj;
	});
}

export async function listDatasetIdsOnDisk(): Promise<Set<string>> {
	await fs.ensureDir(DATA_DIR);
	const files = await fs.readdir(DATA_DIR);
	const ids = new Set<string>();
	for (const file of files) {
		if (file.endsWith(".json")) {
			ids.add(file.slice(0, JSON_SUFFIX_LENGTH));
		}
	}
	return ids;
}

export async function removeDatasetFromDisk(id: string): Promise<void> {
	const filePath = path.join(DATA_DIR, `${id}.json`);
	await fs.remove(filePath);
}

export async function readDatasetMetadata(id: string): Promise<{ kind: InsightDatasetKind; numRows: number }> {
	const filePath = path.join(DATA_DIR, `${id}.json`);
	const raw = (await fs.readJson(filePath)) as CompactPersisted;
	let numRows: number;
	if (typeof raw.numRows === "number") {
		numRows = raw.numRows;
	} else if (Array.isArray(raw.rows)) {
		numRows = raw.rows.length;
	} else if (Array.isArray(raw.sections)) {
		numRows = raw.sections.length;
	} else {
		numRows = 0;
	}
	return { kind: raw.kind, numRows };
}

