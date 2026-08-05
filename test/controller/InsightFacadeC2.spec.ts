import {
	InsightError,
	IInsightFacade,
	InsightDatasetKind,
	InsightResult,
	ResultTooLargeError,
} from "../../src/controller/IInsightFacade";
import InsightFacade from "../../src/controller/InsightFacade";
import { clearDisk, getContentFromArchives, extractFileFromTestName } from "../TestUtil";
import { ITestQuery } from "./InsightFacade.spec";

import { expect, use } from "chai";
import chaiAsPromised from "chai-as-promised";
import JSZip from "jszip";
import * as fs from "fs-extra";

use(chaiAsPromised);

// Real UBC building addresses known to resolve via the cs310 geolocation service.
const ALRD_ADDRESS = "1822 East Mall";
const ANGU_ADDRESS = "2053 Main Mall";

function buildIndexHtml(buildings: { shortname: string; fullname: string; address: string; href: string }[]): string {
	const rows = buildings
		.map(
			(b) => `
        <tr>
          <td class="views-field views-field-field-building-code">${b.shortname}</td>
          <td class="views-field views-field-title">
            <a href="${b.href}" title="Building Details and Map">${b.fullname}</a>
          </td>
          <td class="views-field views-field-field-building-address">${b.address}</td>
        </tr>`
		)
		.join("");
	return `<!DOCTYPE html><html><body><table>
<thead><tr><th>code</th><th>name</th><th>address</th></tr></thead>
<tbody>${rows}</tbody></table></body></html>`;
}

function buildBuildingHtml(
	rooms: { number: string; seats: number; type: string; furniture: string; href: string }[]
): string {
	const rows = rooms
		.map(
			(r) => `
        <tr>
          <td class="views-field views-field-field-room-number"><a href="${r.href}">${r.number}</a></td>
          <td class="views-field views-field-field-room-capacity">${r.seats}</td>
          <td class="views-field views-field-field-room-furniture">${r.furniture}</td>
          <td class="views-field views-field-field-room-type">${r.type}</td>
          <td class="views-field views-field-nothing"><a href="${r.href}" title="Room Details">More</a></td>
        </tr>`
		)
		.join("");
	return `<!DOCTYPE html><html><body><table>
<thead><tr><th>num</th><th>cap</th><th>fur</th><th>type</th><th>more</th></tr></thead>
<tbody>${rows}</tbody></table></body></html>`;
}

async function buildTinyRoomsZip(): Promise<string> {
	const buildings = [
		{
			shortname: "ALRD",
			fullname: "Allard Hall (LAW)",
			address: ALRD_ADDRESS,
			href: "./campus/discover/buildings-and-classrooms/ALRD.htm",
		},
		{
			shortname: "ANGU",
			fullname: "Henry Angus",
			address: ANGU_ADDRESS,
			href: "./campus/discover/buildings-and-classrooms/ANGU.htm",
		},
	];
	const indexHtml = buildIndexHtml(buildings);
	const alrdHtml = buildBuildingHtml([
		{
			number: "105",
			seats: 94,
			type: "Case Style",
			furniture: "Classroom-Fixed Tables/Movable Chairs",
			href: "http://example.com/alrd-105",
		},
		{
			number: "112",
			seats: 20,
			type: "Open Design",
			furniture: "Classroom-Movable Tables & Chairs",
			href: "http://example.com/alrd-112",
		},
	]);
	const anguHtml = buildBuildingHtml([
		{
			number: "098",
			seats: 260,
			type: "Tiered Large Group",
			furniture: "Classroom-Fixed Tablets",
			href: "http://example.com/angu-098",
		},
		{
			number: "037",
			seats: 60,
			type: "Tiered Large Group",
			furniture: "Classroom-Fixed Tablets",
			href: "http://example.com/angu-037",
		},
	]);

	const zip = new JSZip();
	zip.file("index.htm", indexHtml);
	zip.folder("campus")!.folder("discover")!.folder("buildings-and-classrooms")!.file("ALRD.htm", alrdHtml);
	zip.file("campus/discover/buildings-and-classrooms/ANGU.htm", anguHtml);
	return zip.generateAsync({ type: "base64" });
}

async function buildRoomsZipNoIndex(): Promise<string> {
	const zip = new JSZip();
	zip.file("readme.txt", "no index here");
	return zip.generateAsync({ type: "base64" });
}

async function buildRoomsZipNoBuildingTable(): Promise<string> {
	const zip = new JSZip();
	zip.file("index.htm", "<!DOCTYPE html><html><body><h1>Hello</h1></body></html>");
	return zip.generateAsync({ type: "base64" });
}

async function buildRoomsZipBadHrefs(): Promise<string> {
	// Index points to building files that don't exist in the zip → no rooms.
	const indexHtml = buildIndexHtml([
		{ shortname: "FAKE", fullname: "Fake", address: "0 Nowhere", href: "./missing.htm" },
	]);
	const zip = new JSZip();
	zip.file("index.htm", indexHtml);
	return zip.generateAsync({ type: "base64" });
}

describe("InsightFacade C2", function () {
	this.timeout(15000); // Allow time for HTTP geolocation calls

	let facade: IInsightFacade;
	let tinyRoomsZip: string;
	let roomsNoIndex: string;
	let roomsNoBuildings: string;
	let roomsBadHrefs: string;

	before(async function () {
		tinyRoomsZip = await buildTinyRoomsZip();
		roomsNoIndex = await buildRoomsZipNoIndex();
		roomsNoBuildings = await buildRoomsZipNoBuildingTable();
		roomsBadHrefs = await buildRoomsZipBadHrefs();
		await clearDisk();
	});

	describe("AddDataset (Rooms)", function () {
		beforeEach(async function () {
			await clearDisk();
			facade = new InsightFacade();
		});

		it("should successfully add a tiny valid rooms dataset", async function () {
			const result = await facade.addDataset("rooms", tinyRoomsZip, InsightDatasetKind.Rooms);
			expect(result).to.include("rooms");
			const list = await facade.listDatasets();
			expect(list).to.have.length(1);
			expect(list[0].kind).to.equal(InsightDatasetKind.Rooms);
			expect(list[0].numRows).to.be.greaterThan(0);
		});

		it("should reject a rooms zip without index.htm", async function () {
			const result = facade.addDataset("noidx", roomsNoIndex, InsightDatasetKind.Rooms);
			return expect(result).to.eventually.be.rejectedWith(InsightError);
		});

		it("should reject a rooms zip whose index has no building table", async function () {
			const result = facade.addDataset("nobldg", roomsNoBuildings, InsightDatasetKind.Rooms);
			return expect(result).to.eventually.be.rejectedWith(InsightError);
		});

		it("should reject a rooms zip where every building href is broken", async function () {
			const result = facade.addDataset("badhrefs", roomsBadHrefs, InsightDatasetKind.Rooms);
			return expect(result).to.eventually.be.rejectedWith(InsightError);
		});

		it("should reject if id collides with an existing rooms id", async function () {
			await facade.addDataset("dup", tinyRoomsZip, InsightDatasetKind.Rooms);
			const result = facade.addDataset("dup", tinyRoomsZip, InsightDatasetKind.Rooms);
			return expect(result).to.eventually.be.rejectedWith(InsightError);
		});

		it("should persist rooms across InsightFacade instances", async function () {
			await facade.addDataset("persistRooms", tinyRoomsZip, InsightDatasetKind.Rooms);
			const fresh = new InsightFacade();
			const list = await fresh.listDatasets();
			expect(list).to.have.length(1);
			expect(list[0].id).to.equal("persistRooms");
			expect(list[0].kind).to.equal(InsightDatasetKind.Rooms);
		});

		it("should allow a rooms id and a sections id to coexist", async function () {
			const sectionsContent = await getContentFromArchives("pair.zip");
			await facade.addDataset("rooms", tinyRoomsZip, InsightDatasetKind.Rooms);
			await facade.addDataset("sections", sectionsContent, InsightDatasetKind.Sections);
			const list = await facade.listDatasets();
			expect(list).to.have.length(2);
		});
	});

	describe("PerformQuery (Rooms basics)", function () {
		before(async function () {
			await clearDisk();
			facade = new InsightFacade();
			await facade.addDataset("rooms", tinyRoomsZip, InsightDatasetKind.Rooms);
		});

		it("should query rooms with seats > 100", async function () {
			const result = await facade.performQuery({
				WHERE: { GT: { rooms_seats: 100 } },
				OPTIONS: { COLUMNS: ["rooms_shortname", "rooms_number", "rooms_seats"], ORDER: "rooms_seats" },
			});
			expect(result).to.have.length(1);
			expect(result[0]).to.deep.equal({ rooms_shortname: "ANGU", rooms_number: "098", rooms_seats: 260 });
		});

		it("should reject a query with an invalid rooms field", async function () {
			const result = facade.performQuery({
				WHERE: {},
				OPTIONS: { COLUMNS: ["rooms_avg"] },
			});
			return expect(result).to.eventually.be.rejectedWith(InsightError);
		});

		it("should support IS wildcard on rooms_furniture", async function () {
			const result = await facade.performQuery({
				WHERE: { IS: { rooms_furniture: "*Tables*" } },
				OPTIONS: { COLUMNS: ["rooms_shortname", "rooms_number"], ORDER: "rooms_number" },
			});
			expect(result.map((r) => r.rooms_number)).to.include("105");
			expect(result.map((r) => r.rooms_number)).to.include("112");
		});

		it("should support a rooms TRANSFORMATIONS query: max seats per shortname", async function () {
			const result = await facade.performQuery({
				WHERE: {},
				OPTIONS: { COLUMNS: ["rooms_shortname", "maxSeats"], ORDER: { dir: "DOWN", keys: ["maxSeats"] } },
				TRANSFORMATIONS: {
					GROUP: ["rooms_shortname"],
					APPLY: [{ maxSeats: { MAX: "rooms_seats" } }],
				},
			});
			expect(result).to.deep.equal([
				{ rooms_shortname: "ANGU", maxSeats: 260 },
				{ rooms_shortname: "ALRD", maxSeats: 94 },
			]);
		});

		it("should reject mixing rooms keys with a non-existent dataset key", async function () {
			const result = facade.performQuery({
				WHERE: { GT: { rooms_seats: 0 } },
				OPTIONS: { COLUMNS: ["rooms_shortname", "sections_avg"] },
			});
			return expect(result).to.eventually.be.rejectedWith(InsightError);
		});
	});

	describe("PerformQuery TRANSFORMATIONS (sections)", function () {
		async function checkQuery(this: Mocha.Context): Promise<void> {
			if (!this.test) throw new Error("checkQuery requires a test context");
			const fileName = extractFileFromTestName(this.test.title);
			const raw = await fs.readFile(`test/resources/queries/${fileName}`, "utf-8");
			const stripped = raw.replace(/^\s*\/\/.*$/gm, "").trim();
			const tq = JSON.parse(stripped) as ITestQuery;
			let result: InsightResult[];
			try {
				result = await facade.performQuery(tq.input);
			} catch (err) {
				if (!tq.errorExpected) expect.fail(`Unexpected error: ${err}`);
				if (tq.expected === "InsightError") expect(err).to.be.instanceOf(InsightError);
				else if (tq.expected === "ResultTooLargeError") expect(err).to.be.instanceOf(ResultTooLargeError);
				else expect.fail(`Unknown error type: ${tq.expected}`);
				return;
			}
			if (tq.errorExpected) expect.fail(`Expected ${tq.expected} but got result`);
			expect(result).to.deep.equal(tq.expected);
		}

		before(async function () {
			await clearDisk();
			facade = new InsightFacade();
			const smallCourse = JSON.stringify({
				result: [
					{
						id: 1,
						Course: "310",
						Title: "Software Engineering",
						Professor: "Reid Holmes",
						Subject: "cpsc",
						Year: 2021,
						Avg: 85.5,
						Pass: 200,
						Fail: 10,
						Audit: 5,
						Section: "101",
					},
					{
						id: 2,
						Course: "310",
						Title: "Software Engineering",
						Professor: "Reid Holmes",
						Subject: "cpsc",
						Year: 2020,
						Avg: 78.3,
						Pass: 180,
						Fail: 20,
						Audit: 3,
						Section: "102",
					},
					{
						id: 3,
						Course: "310",
						Title: "Software Engineering",
						Professor: "",
						Subject: "cpsc",
						Year: 1900,
						Avg: 82.0,
						Pass: 380,
						Fail: 30,
						Audit: 8,
						Section: "overall",
					},
					{
						id: 4,
						Course: "210",
						Title: "Basic Algorithms",
						Professor: "Steve Wolfman",
						Subject: "cpsc",
						Year: 2021,
						Avg: 72.4,
						Pass: 250,
						Fail: 50,
						Audit: 2,
						Section: "201",
					},
					{
						id: 5,
						Course: "121",
						Title: "Calculus I",
						Professor: "John Smith",
						Subject: "math",
						Year: 2021,
						Avg: 65.1,
						Pass: 300,
						Fail: 100,
						Audit: 10,
						Section: "001",
					},
					{
						id: 6,
						Course: "200",
						Title: "Calculus III",
						Professor: "Jane Doe",
						Subject: "math",
						Year: 2020,
						Avg: 91.2,
						Pass: 50,
						Fail: 2,
						Audit: 0,
						Section: "002",
					},
					{
						id: 7,
						Course: "100",
						Title: "Intro to English",
						Professor: "Alice Brown",
						Subject: "engl",
						Year: 2019,
						Avg: 88.0,
						Pass: 100,
						Fail: 5,
						Audit: 1,
						Section: "003",
					},
				],
			});
			const zip = new JSZip();
			zip.folder("courses")!.file("data.json", smallCourse);
			const content = await zip.generateAsync({ type: "base64" });
			await facade.addDataset("small", content, InsightDatasetKind.Sections);
		});

		// Valid
		it("[c2valid/groupMaxAvg.jsonc] GROUP by dept, MAX avg", checkQuery);
		it("[c2valid/groupAvgAvg.jsonc] GROUP by dept, AVG avg", checkQuery);
		it("[c2valid/groupSumPass.jsonc] GROUP by dept, SUM pass", checkQuery);
		it("[c2valid/groupCountIds.jsonc] GROUP by dept, COUNT unique id", checkQuery);
		it("[c2valid/multiApply.jsonc] Multiple APPLY rules MAX MIN AVG", checkQuery);
		it("[c2valid/orderDownApplyKey.jsonc] ORDER DOWN by applykey", checkQuery);
		it("[c2valid/orderMultiKey.jsonc] ORDER multi-key tie break", checkQuery);
		it("[c2valid/emptyApply.jsonc] Empty APPLY with GROUP", checkQuery);
		it("[c2valid/countOnNumeric.jsonc] COUNT on numeric field", checkQuery);
		it("[c2valid/orderDownSingleKey.jsonc] ORDER object DOWN no transformations", checkQuery);
		it("[c2valid/groupMultiKey.jsonc] GROUP by multiple keys, MIN avg", checkQuery);
		it("[c2valid/whereWithTransform.jsonc] WHERE filter combined with TRANSFORMATIONS", checkQuery);

		// Invalid
		it("[c2invalid/columnNotInGroupOrApply.jsonc] COLUMNS key not in GROUP/APPLY", checkQuery);
		it("[c2invalid/duplicateApplyKey.jsonc] duplicate applykey", checkQuery);
		it("[c2invalid/applyKeyUnderscore.jsonc] applykey contains underscore", checkQuery);
		it("[c2invalid/maxOnSfield.jsonc] MAX on sfield", checkQuery);
		it("[c2invalid/minOnSfield.jsonc] MIN on sfield", checkQuery);
		it("[c2invalid/avgOnSfield.jsonc] AVG on sfield", checkQuery);
		it("[c2invalid/sumOnSfield.jsonc] SUM on sfield", checkQuery);
		it("[c2invalid/unknownApplyToken.jsonc] unknown APPLYTOKEN", checkQuery);
		it("[c2invalid/groupEmpty.jsonc] GROUP empty array", checkQuery);
		it("[c2invalid/missingApply.jsonc] TRANSFORMATIONS missing APPLY", checkQuery);
		it("[c2invalid/missingGroup.jsonc] TRANSFORMATIONS missing GROUP", checkQuery);
		it("[c2invalid/orderMissingDir.jsonc] ORDER missing dir", checkQuery);
		it("[c2invalid/orderMissingKeys.jsonc] ORDER missing keys", checkQuery);
		it("[c2invalid/orderInvalidDir.jsonc] ORDER invalid dir value", checkQuery);
		it("[c2invalid/orderKeysNotInColumns.jsonc] ORDER keys not in COLUMNS", checkQuery);
		it("[c2invalid/orderKeysEmpty.jsonc] ORDER keys empty array", checkQuery);
		it("[c2invalid/applyEmptyBody.jsonc] APPLY rule body has no APPLYTOKEN", checkQuery);
		it("[c2invalid/groupInvalidField.jsonc] GROUP references unknown field", checkQuery);
		it("[c2invalid/applyTargetIsApplyKey.jsonc] APPLY target is an applykey", checkQuery);
		it("[c2invalid/applyDifferentDataset.jsonc] APPLY target references different dataset", checkQuery);
		it("[c2invalid/applyMultipleKeys.jsonc] APPLY rule has multiple keys", checkQuery);
	});
});

