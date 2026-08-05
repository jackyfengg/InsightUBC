import { InsightDatasetKind } from "./IInsightFacade";

export type Record = { [key: string]: string | number };

export interface DatasetEntry {
	id: string;
	kind: InsightDatasetKind;
	rows: Record[];
}

export const SECTION_MFIELDS = new Set<string>(["avg", "pass", "fail", "audit", "year"]);
export const SECTION_SFIELDS = new Set<string>(["dept", "id", "instructor", "title", "uuid"]);

export const ROOM_MFIELDS = new Set<string>(["lat", "lon", "seats"]);
export const ROOM_SFIELDS = new Set<string>([
	"fullname",
	"shortname",
	"number",
	"name",
	"address",
	"type",
	"furniture",
	"href",
]);

export function mfieldsFor(kind: InsightDatasetKind): Set<string> {
	return kind === InsightDatasetKind.Rooms ? ROOM_MFIELDS : SECTION_MFIELDS;
}

export function sfieldsFor(kind: InsightDatasetKind): Set<string> {
	return kind === InsightDatasetKind.Rooms ? ROOM_SFIELDS : SECTION_SFIELDS;
}

