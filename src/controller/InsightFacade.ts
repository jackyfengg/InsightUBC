import {
	IInsightFacade,
	InsightDataset,
	InsightDatasetKind,
	InsightError,
	InsightResult,
	NotFoundError,
} from "./IInsightFacade";
import { DatasetEntry } from "./types";
import { validateId } from "./validation";
import {
	listDatasetIdsOnDisk,
	loadDatasetFromDisk,
	persistDataset,
	readDatasetMetadata,
	removeDatasetFromDisk,
} from "./persistence";
import { parseSectionsFromZip } from "./sections/parseSections";
import { parseRoomsFromZip } from "./rooms/parseRooms";
import { validateQuery } from "./query/validateQuery";
import { executeQuery } from "./query/executeQuery";

import { AddDatasetFactory } from "./strategy/AddDatasetFactory";

export default class InsightFacade implements IInsightFacade {
	private datasets = new Map<string, DatasetEntry>();
	// Tracks all known ids (in memory + on disk). null means not yet loaded.
	private diskIds: Set<string> | null = null;
	// Per-id kind cache for query validation without forcing full dataset load.
	private kindCache = new Map<string, InsightDatasetKind>();
	private mutationLock: Promise<void> = Promise.resolve();

	public async addDataset(id: string, content: string, kind: InsightDatasetKind): Promise<string[]> {
		validateId(id);

		const factory = new AddDatasetFactory();
		const AddDatasetStrategy = factory.createDatasetStrategy(kind);
		const rows = await AddDatasetStrategy.parseDataset(content);

		if (rows.length === 0) {
			throw new InsightError("Dataset contains no valid records");
		}

		return this.serialized(async () => {
			const ids = await this.getDiskIds();
			if (ids.has(id)) {
				throw new InsightError(`Dataset with id "${id}" already exists`);
			}
			const entry: DatasetEntry = { id, kind, rows };
			await persistDataset(entry);
			this.datasets.set(id, entry);
			this.kindCache.set(id, kind);
			ids.add(id);
			return Array.from(ids);
		});
	}

	public async removeDataset(id: string): Promise<string> {
		validateId(id);
		return this.serialized(async () => {
			const ids = await this.getDiskIds();
			if (!ids.has(id)) {
				throw new NotFoundError(`Dataset with id "${id}" not found`);
			}
			await removeDatasetFromDisk(id);
			this.datasets.delete(id);
			this.kindCache.delete(id);
			ids.delete(id);
			return id;
		});
	}

	public async performQuery(query: unknown): Promise<InsightResult[]> {
		// Two-phase resolution: peek the dataset id from the raw query so we can look up its kind,
		// then run full validation with that kind.
		const peekedId = peekDatasetId(query);
		if (peekedId === null) {
			// Force the validator to surface its own structural error.
			validateQuery(query, () => null);
			throw new InsightError("Query must reference a dataset");
		}

		const ids = await this.getDiskIds();
		if (!ids.has(peekedId)) {
			// Let validateQuery determine the precise error (e.g. structural issues take priority).
			validateQuery(query, () => null);
			throw new InsightError(`Dataset "${peekedId}" has not been added`);
		}
		const kind = await this.getKind(peekedId);

		const validated = validateQuery(query, (id) => (id === peekedId ? kind : null));

		const dataset = await this.loadDataset(validated.datasetId);
		return executeQuery(dataset.rows, validated);
	}

	public async listDatasets(): Promise<InsightDataset[]> {
		const ids = await this.getDiskIds();
		const idArr = Array.from(ids);
		const settled = await Promise.all(idArr.map(async (id) => this.describeDataset(id)));
		const result: InsightDataset[] = [];
		for (const item of settled) {
			if (item !== null) result.push(item);
		}
		return result;
	}

	private async describeDataset(id: string): Promise<InsightDataset | null> {
		if (this.datasets.has(id)) {
			const entry = this.datasets.get(id)!;
			return { id: entry.id, kind: entry.kind, numRows: entry.rows.length };
		}
		try {
			const meta = await readDatasetMetadata(id);
			return { id, kind: meta.kind, numRows: meta.numRows };
		} catch {
			return null;
		}
	}

	private async getDiskIds(): Promise<Set<string>> {
		if (this.diskIds !== null) return this.diskIds;
		this.diskIds = await listDatasetIdsOnDisk();
		return this.diskIds;
	}

	private async getKind(id: string): Promise<InsightDatasetKind> {
		const cached = this.kindCache.get(id);
		if (cached !== undefined) return cached;
		if (this.datasets.has(id)) {
			const k = this.datasets.get(id)!.kind;
			this.kindCache.set(id, k);
			return k;
		}
		const meta = await readDatasetMetadata(id);
		this.kindCache.set(id, meta.kind);
		return meta.kind;
	}

	private async loadDataset(id: string): Promise<DatasetEntry> {
		if (this.datasets.has(id)) return this.datasets.get(id)!;
		const entry = await loadDatasetFromDisk(id);
		this.datasets.set(id, entry);
		this.kindCache.set(id, entry.kind);
		return entry;
	}

	private async serialized<T>(fn: () => Promise<T>): Promise<T> {
		const prev = this.mutationLock;
		let resolve: () => void;
		this.mutationLock = new Promise<void>((r) => {
			resolve = r;
		});
		return prev.then(fn).finally(() => resolve!());
	}
}

// Best-effort: extract a dataset id from any "id_field" key in the query, without doing full validation.
// Used to resolve kind before calling validateQuery. Validation will properly enforce single-dataset.
function peekDatasetId(query: unknown): string | null {
	if (typeof query !== "object" || query === null || Array.isArray(query)) return null;
	const q = query as { [k: string]: unknown };
	const candidates: string[] = [];
	scanForKeys(q, candidates);
	for (const c of candidates) {
		const idx = c.indexOf("_");
		if (idx > 0) {
			const id = c.slice(0, idx);
			if (id.length > 0 && !id.includes("__")) return id;
		}
	}
	return null;
}

function scanForKeys(node: unknown, out: string[]): void {
	if (node === null || node === undefined) return;
	if (Array.isArray(node)) {
		for (const e of node) scanForKeys(e, out);
		return;
	}
	if (typeof node === "object") {
		const obj = node as { [k: string]: unknown };
		for (const k of Object.keys(obj)) {
			if (k.includes("_")) out.push(k);
			// COLUMNS and TRANSFORMATIONS.GROUP and ORDER.keys — values may be string keys too
			const v = obj[k];
			if (typeof v === "string" && v.includes("_")) out.push(v);
			else scanForKeys(v, out);
		}
		return;
	}
	if (typeof node === "string" && node.includes("_")) out.push(node);
}

