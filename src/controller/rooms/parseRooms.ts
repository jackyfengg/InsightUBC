import JSZip from "jszip";
import { parse } from "parse5";
import { InsightError } from "../IInsightFacade";
import { Record } from "../types";
import { GeolocationCache } from "./geolocation";

interface BuildingInfo {
	shortname: string;
	fullname: string;
	address: string;
	href: string;
}

interface AnyNode {
	nodeName: string;
	tagName?: string;
	value?: string;
	attrs?: { name: string; value: string }[];
	childNodes?: AnyNode[];
}

const BUILDING_TABLE_MARKERS = [
	"views-field-field-building-code",
	"views-field-field-building-address",
	"views-field-title",
];

const ROOM_TABLE_MARKERS = [
	"views-field-field-room-number",
	"views-field-field-room-capacity",
	"views-field-field-room-furniture",
	"views-field-field-room-type",
];

const SHORTNAME_CLASS = "views-field-field-building-code";
const FULLNAME_CLASS = "views-field-title";
const ADDRESS_CLASS = "views-field-field-building-address";

const ROOM_NUMBER_CLASS = "views-field-field-room-number";
const ROOM_CAPACITY_CLASS = "views-field-field-room-capacity";
const ROOM_FURNITURE_CLASS = "views-field-field-room-furniture";
const ROOM_TYPE_CLASS = "views-field-field-room-type";
const ROOM_HREF_CLASS = "views-field-nothing";

export async function parseRoomsFromZip(content: string): Promise<Record[]> {
	const zip = await loadZip(content);
	const buildings = extractBuildingsFromIndex(await readIndexHtml(zip));
	if (buildings.length === 0) {
		throw new InsightError("Rooms index.htm building table contains no buildings");
	}

	const geoCache = new GeolocationCache();
	const buildingPromises = buildings.map(async (b) => buildBuildingRooms(zip, b, geoCache));
	const results = await Promise.all(buildingPromises);
	const allRooms: Record[] = [];
	for (const arr of results) allRooms.push(...arr);
	return allRooms;
}

async function loadZip(content: string): Promise<JSZip> {
	try {
		return await JSZip.loadAsync(content, { base64: true });
	} catch {
		throw new InsightError("Content is not a valid zip file");
	}
}

async function readIndexHtml(zip: JSZip): Promise<string> {
	const indexFile = zip.file("index.htm") ?? zip.file("./index.htm");
	if (indexFile === null || indexFile === undefined) {
		throw new InsightError("Rooms zip is missing index.htm");
	}
	return indexFile.async("string");
}

function extractBuildingsFromIndex(indexHtml: string): BuildingInfo[] {
	const indexDoc = parse(indexHtml);
	const buildingTable = findTableWithMarkers(indexDoc as unknown as AnyNode, BUILDING_TABLE_MARKERS);
	if (buildingTable === null) {
		throw new InsightError("Rooms index.htm has no building table");
	}
	return extractBuildings(buildingTable);
}

async function buildBuildingRooms(zip: JSZip, building: BuildingInfo, geoCache: GeolocationCache): Promise<Record[]> {
	const filePath = normalizeBuildingPath(building.href);
	const buildingFile = zip.file(filePath) ?? zip.file(building.href);
	if (buildingFile === null || buildingFile === undefined) return [];
	let html: string;
	try {
		html = await buildingFile.async("string");
	} catch {
		return [];
	}
	const roomTable = findTableWithMarkers(parse(html) as unknown as AnyNode, ROOM_TABLE_MARKERS);
	if (roomTable === null) return [];
	const partialRooms = extractRoomsFromBuildingTable(roomTable);
	if (partialRooms.length === 0) return [];
	const geo = await geoCache.get(building.address);
	if (geo.error !== undefined || typeof geo.lat !== "number" || typeof geo.lon !== "number") {
		return [];
	}
	const lat = geo.lat;
	const lon = geo.lon;
	return partialRooms.map<Record>((p) => ({
		fullname: building.fullname,
		shortname: building.shortname,
		number: p.number,
		name: `${building.shortname}_${p.number}`,
		address: building.address,
		lat,
		lon,
		seats: p.seats,
		type: p.type,
		furniture: p.furniture,
		href: p.href,
	}));
}

function normalizeBuildingPath(href: string): string {
	let p = href;
	if (p.startsWith("./")) p = p.slice(2);
	if (p.startsWith("/")) p = p.slice(1);
	return p;
}

function findTableWithMarkers(node: AnyNode, markers: string[]): AnyNode | null {
	const tables: AnyNode[] = [];
	collectTables(node, tables);
	for (const table of tables) {
		if (tableHasAnyMarker(table, markers)) return table;
	}
	return null;
}

function collectTables(node: AnyNode, out: AnyNode[]): void {
	if (node.tagName === "table") out.push(node);
	if (node.childNodes !== undefined) {
		for (const child of node.childNodes) collectTables(child, out);
	}
}

function tableHasAnyMarker(table: AnyNode, markers: string[]): boolean {
	const tds: AnyNode[] = [];
	collectByTag(table, "td", tds);
	for (const td of tds) {
		const classes = getClassList(td);
		for (const m of markers) {
			if (classes.includes(m)) return true;
		}
	}
	return false;
}

function collectByTag(node: AnyNode, tag: string, out: AnyNode[]): void {
	if (node.tagName === tag) out.push(node);
	if (node.childNodes !== undefined) {
		for (const child of node.childNodes) collectByTag(child, tag, out);
	}
}

function getClassList(node: AnyNode): string[] {
	if (node.attrs === undefined) return [];
	for (const a of node.attrs) {
		if (a.name === "class") return a.value.split(/\s+/).filter((s) => s.length > 0);
	}
	return [];
}

function getAttr(node: AnyNode, name: string): string | undefined {
	if (node.attrs === undefined) return undefined;
	for (const a of node.attrs) {
		if (a.name === name) return a.value;
	}
	return undefined;
}

function getText(node: AnyNode): string {
	if (node.nodeName === "#text" && typeof node.value === "string") return node.value;
	if (node.childNodes === undefined) return "";
	let s = "";
	for (const child of node.childNodes) s += getText(child);
	return s;
}

function findFirstByClass(table: AnyNode, tag: string, cls: string): AnyNode | null {
	const tags: AnyNode[] = [];
	collectByTag(table, tag, tags);
	for (const t of tags) {
		if (getClassList(t).includes(cls)) return t;
	}
	return null;
}

function findFirstByTag(node: AnyNode, tag: string): AnyNode | null {
	if (node.tagName === tag) return node;
	if (node.childNodes !== undefined) {
		for (const child of node.childNodes) {
			const found = findFirstByTag(child, tag);
			if (found !== null) return found;
		}
	}
	return null;
}

function extractBuildings(table: AnyNode): BuildingInfo[] {
	const tbody = findFirstByTag(table, "tbody") ?? table;
	const rows: AnyNode[] = [];
	collectByTag(tbody, "tr", rows);
	const buildings: BuildingInfo[] = [];
	for (const row of rows) {
		const shortCell = findFirstByClass(row, "td", SHORTNAME_CLASS);
		const fullCell = findFirstByClass(row, "td", FULLNAME_CLASS);
		const addressCell = findFirstByClass(row, "td", ADDRESS_CLASS);
		if (shortCell === null || fullCell === null || addressCell === null) continue;
		const anchor = findFirstByTag(fullCell, "a");
		if (anchor === null) continue;
		const href = getAttr(anchor, "href");
		if (href === undefined || href.length === 0) continue;
		buildings.push({
			shortname: getText(shortCell).trim(),
			fullname: getText(anchor).trim(),
			address: getText(addressCell).trim(),
			href,
		});
	}
	return buildings;
}

interface PartialRoom {
	number: string;
	seats: number;
	type: string;
	furniture: string;
	href: string;
}

function extractRoomsFromBuildingTable(table: AnyNode): PartialRoom[] {
	const tbody = findFirstByTag(table, "tbody") ?? table;
	const rows: AnyNode[] = [];
	collectByTag(tbody, "tr", rows);
	const out: PartialRoom[] = [];
	for (const row of rows) {
		const numCell = findFirstByClass(row, "td", ROOM_NUMBER_CLASS);
		const capCell = findFirstByClass(row, "td", ROOM_CAPACITY_CLASS);
		const furCell = findFirstByClass(row, "td", ROOM_FURNITURE_CLASS);
		const typeCell = findFirstByClass(row, "td", ROOM_TYPE_CLASS);
		const hrefCell = findFirstByClass(row, "td", ROOM_HREF_CLASS);
		if (numCell === null || capCell === null || furCell === null || typeCell === null) continue;

		const numAnchor = findFirstByTag(numCell, "a");
		const number = (numAnchor !== null ? getText(numAnchor) : getText(numCell)).trim();
		const seatsRaw = getText(capCell).trim();
		const seatsParsed = Number(seatsRaw);
		const seats = isFinite(seatsParsed) ? seatsParsed : 0;

		let href = "";
		if (hrefCell !== null) {
			const hrefAnchor = findFirstByTag(hrefCell, "a");
			if (hrefAnchor !== null) href = getAttr(hrefAnchor, "href") ?? "";
		}
		if (href.length === 0 && numAnchor !== null) {
			href = getAttr(numAnchor, "href") ?? "";
		}

		out.push({
			number,
			seats,
			type: getText(typeCell).trim(),
			furniture: getText(furCell).trim(),
			href,
		});
	}
	return out;
}

