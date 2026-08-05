import {
	InsightError,
	NotFoundError,
	ResultTooLargeError,
	IInsightFacade,
	InsightDatasetKind,
	InsightResult,
} from "../../src/controller/IInsightFacade";
import InsightFacade from "../../src/controller/InsightFacade";
import { clearDisk, getContentFromArchives, loadTestQuery, extractFileFromTestName } from "../TestUtil";

import { expect, use } from "chai";
import chaiAsPromised from "chai-as-promised";
import JSZip from "jszip";
import * as fs from "fs-extra";

use(chaiAsPromised);

export interface ITestQuery {
	title?: string;
	input: unknown;
	errorExpected: boolean;
	expected: any;
}

async function createZipWithCourses(courses: Record<string, string>): Promise<string> {
	const zip = new JSZip();
	const coursesFolder = zip.folder("courses");
	for (const [name, content] of Object.entries(courses)) {
		coursesFolder!.file(name, content);
	}
	return zip.generateAsync({ type: "base64" });
}

describe("InsightFacade", function () {
	let facade: IInsightFacade;
	let sections: string;
	let validSmallDataset: string;
	let emptyZip: string;
	let noCoursesFolder: string;
	let noCoursesFolderButFiles: string;
	let noValidJSON: string;
	let noValidSections: string;
	let notAZip: string;

	before(async function () {
		sections = await getContentFromArchives("pair.zip");

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
		validSmallDataset = await createZipWithCourses({ "cpsc310.json": smallCourse });

		const emptyZipObj = new JSZip();
		emptyZip = await emptyZipObj.generateAsync({ type: "base64" });

		const noCoursesFolderZip = new JSZip();
		noCoursesFolderZip.file("readme.txt", "hello");
		noCoursesFolder = await noCoursesFolderZip.generateAsync({ type: "base64" });

		const noCoursesFolderZip2 = new JSZip();
		const otherFolder = noCoursesFolderZip2.folder("other");
		otherFolder!.file(
			"data.json",
			JSON.stringify({
				result: [
					{
						id: 1,
						Course: "310",
						Title: "X",
						Professor: "Y",
						Subject: "cpsc",
						Year: 2021,
						Avg: 80,
						Pass: 100,
						Fail: 10,
						Audit: 1,
						Section: "101",
					},
				],
			})
		);
		noCoursesFolderButFiles = await noCoursesFolderZip2.generateAsync({ type: "base64" });

		noValidJSON = await createZipWithCourses({ "bad.json": "this is not json {{{{" });

		const noSectionsCourse = JSON.stringify({
			result: [{ id: 1, Course: "310" }, { Title: "X" }],
		});
		noValidSections = await createZipWithCourses({ "incomplete.json": noSectionsCourse });

		notAZip = Buffer.from("this is definitely not a zip file content!").toString("base64");

		await clearDisk();
	});

	describe("AddDataset", function () {
		beforeEach(async function () {
			await clearDisk();
			facade = new InsightFacade();
		});
		it("should successfully add a valid dataset", async function () {
			const result = await facade.addDataset("small", validSmallDataset, InsightDatasetKind.Sections);
			expect(result).to.be.an("array");
			expect(result).to.include("small");
		});

		it("should return all added dataset ids on successful add", async function () {
			await facade.addDataset("first", validSmallDataset, InsightDatasetKind.Sections);
			const result = await facade.addDataset("second", validSmallDataset, InsightDatasetKind.Sections);
			expect(result).to.have.length(2);
			expect(result).to.include("first");
			expect(result).to.include("second");
		});

		it("should successfully add the large pair.zip dataset", async function () {
			const result = await facade.addDataset("ubc", sections, InsightDatasetKind.Sections);
			expect(result).to.include("ubc");
		});

		it("should accept an id with spaces in it (not only whitespace)", async function () {
			const result = await facade.addDataset("hello world", validSmallDataset, InsightDatasetKind.Sections);
			expect(result).to.include("hello world");
		});

		it("should reject with an id that is only whitespace", async function () {
			const result = facade.addDataset("   ", validSmallDataset, InsightDatasetKind.Sections);
			return expect(result).to.eventually.be.rejectedWith(InsightError);
		});

		it("should reject with an id containing an underscore", async function () {
			const result = facade.addDataset("invalid_id", validSmallDataset, InsightDatasetKind.Sections);
			return expect(result).to.eventually.be.rejectedWith(InsightError);
		});

		it("should reject with an empty string id", async function () {
			const result = facade.addDataset("", validSmallDataset, InsightDatasetKind.Sections);
			return expect(result).to.eventually.be.rejectedWith(InsightError);
		});

		it("should reject when adding a dataset with a duplicate id", async function () {
			await facade.addDataset("dup", validSmallDataset, InsightDatasetKind.Sections);
			const result = facade.addDataset("dup", validSmallDataset, InsightDatasetKind.Sections);
			return expect(result).to.eventually.be.rejectedWith(InsightError);
		});

		it("should reject when content is not a valid zip", async function () {
			const result = facade.addDataset("bad", notAZip, InsightDatasetKind.Sections);
			return expect(result).to.eventually.be.rejectedWith(InsightError);
		});

		it("should reject an empty zip file", async function () {
			const result = facade.addDataset("empty", emptyZip, InsightDatasetKind.Sections);
			return expect(result).to.eventually.be.rejectedWith(InsightError);
		});

		it("should reject a zip with no courses/ folder", async function () {
			const result = facade.addDataset("nocourses", noCoursesFolder, InsightDatasetKind.Sections);
			return expect(result).to.eventually.be.rejectedWith(InsightError);
		});

		it("should reject a zip with files in wrong folder (not courses/)", async function () {
			const result = facade.addDataset("wrongfolder", noCoursesFolderButFiles, InsightDatasetKind.Sections);
			return expect(result).to.eventually.be.rejectedWith(InsightError);
		});

		it("should reject a zip where courses/ contains only invalid JSON", async function () {
			const result = facade.addDataset("badjson", noValidJSON, InsightDatasetKind.Sections);
			return expect(result).to.eventually.be.rejectedWith(InsightError);
		});

		it("should reject a zip where courses/ contains JSON with no valid sections", async function () {
			const result = facade.addDataset("nosections", noValidSections, InsightDatasetKind.Sections);
			return expect(result).to.eventually.be.rejectedWith(InsightError);
		});

		it("should reject with Rooms kind in c1", async function () {
			const result = facade.addDataset("rooms", validSmallDataset, InsightDatasetKind.Rooms);
			return expect(result).to.eventually.be.rejectedWith(InsightError);
		});

		it("should add dataset that has a mix of valid and invalid sections", async function () {
			const mixedCourse = JSON.stringify({
				result: [
					{
						id: 1,
						Course: "310",
						Title: "SE",
						Professor: "X",
						Subject: "cpsc",
						Year: 2021,
						Avg: 80,
						Pass: 100,
						Fail: 5,
						Audit: 2,
						Section: "101",
					},
					{
						id: 2,
						Course: "210",
						Title: "Algo",
						Professor: "Y",
						Subject: "cpsc",
						Year: 2020,
						Avg: 70,
						Pass: 50,
						Fail: 10,
						Audit: 1,
						Section: "201",
					},
					{ id: 3, Course: "100" },
					{ Title: "no id" },
				],
			});
			const zip = await createZipWithCourses({ "mixed.json": mixedCourse });
			const result = await facade.addDataset("mixed", zip, InsightDatasetKind.Sections);
			expect(result).to.include("mixed");
		});

		it("should add dataset with multiple files where only one has valid sections", async function () {
			const validCourse = JSON.stringify({
				result: [
					{
						id: 10,
						Course: "100",
						Title: "Intro",
						Professor: "A",
						Subject: "math",
						Year: 2021,
						Avg: 75,
						Pass: 50,
						Fail: 5,
						Audit: 0,
						Section: "001",
					},
				],
			});
			const zip = await createZipWithCourses({
				"invalid.json": "not json",
				"valid.json": validCourse,
			});
			const result = await facade.addDataset("partial", zip, InsightDatasetKind.Sections);
			expect(result).to.include("partial");
		});

		it("should persist datasets across InsightFacade instances", async function () {
			await facade.addDataset("persist", validSmallDataset, InsightDatasetKind.Sections);
			const newFacade = new InsightFacade();
			const datasets = await newFacade.listDatasets();
			expect(datasets).to.have.length(1);
			expect(datasets[0].id).to.equal("persist");
		});

		it("should be queryable from a new InsightFacade after add", async function () {
			await facade.addDataset("persist2", validSmallDataset, InsightDatasetKind.Sections);
			const newFacade = new InsightFacade();
			const result = await newFacade.performQuery({
				WHERE: { IS: { persist2_dept: "engl" } },
				OPTIONS: { COLUMNS: ["persist2_dept", "persist2_avg"] },
			});
			expect(result).to.deep.equal([{ persist2_dept: "engl", persist2_avg: 88 }]);
		});

		it("should reject duplicate id across InsightFacade instances", async function () {
			await facade.addDataset("crossdup", validSmallDataset, InsightDatasetKind.Sections);
			const newFacade = new InsightFacade();
			const result = newFacade.addDataset("crossdup", validSmallDataset, InsightDatasetKind.Sections);
			return expect(result).to.eventually.be.rejectedWith(InsightError);
		});

		it("should reject when content is an empty string", async function () {
			const result = facade.addDataset("emptystr", "", InsightDatasetKind.Sections);
			return expect(result).to.eventually.be.rejectedWith(InsightError);
		});

		it("should ignore files in subdirectories within courses/", async function () {
			const validCourse = JSON.stringify({
				result: [
					{
						id: 1,
						Course: "310",
						Title: "SE",
						Professor: "X",
						Subject: "cpsc",
						Year: 2021,
						Avg: 80,
						Pass: 100,
						Fail: 5,
						Audit: 2,
						Section: "101",
					},
				],
			});
			const zip = new JSZip();
			const coursesFolder = zip.folder("courses");
			coursesFolder!.file("valid.json", validCourse);
			const subFolder = coursesFolder!.folder("subfolder");
			subFolder!.file("nested.json", "not valid json content");
			const content = await zip.generateAsync({ type: "base64" });
			const result = await facade.addDataset("subdir", content, InsightDatasetKind.Sections);
			expect(result).to.include("subdir");
		});

		it("should handle JSON file with result key that is not an array", async function () {
			const course = JSON.stringify({ result: "not an array" });
			const zip = await createZipWithCourses({ "bad.json": course });
			const result = facade.addDataset("badresult", zip, InsightDatasetKind.Sections);
			return expect(result).to.eventually.be.rejectedWith(InsightError);
		});

		it("should handle JSON file that is an array not an object", async function () {
			const course = JSON.stringify([{ id: 1, Course: "310" }]);
			const zip = await createZipWithCourses({ "array.json": course });
			const result = facade.addDataset("arrayjson", zip, InsightDatasetKind.Sections);
			return expect(result).to.eventually.be.rejectedWith(InsightError);
		});

		it("should skip section whose Avg is non-numeric", async function () {
			const course = JSON.stringify({
				result: [
					{
						id: 1,
						Course: "310",
						Title: "SE",
						Professor: "X",
						Subject: "cpsc",
						Year: 2021,
						Avg: "not a number",
						Pass: 100,
						Fail: 5,
						Audit: 2,
						Section: "101",
					},
				],
			});
			const zip = await createZipWithCourses({ "bad.json": course });
			const result = facade.addDataset("bad", zip, InsightDatasetKind.Sections);
			return expect(result).to.eventually.be.rejectedWith(InsightError);
		});
	});

	describe("RemoveDataset", function () {
		beforeEach(async function () {
			await clearDisk();
			facade = new InsightFacade();
		});

		it("should successfully remove an added dataset", async function () {
			await facade.addDataset("toremove", validSmallDataset, InsightDatasetKind.Sections);
			const result = await facade.removeDataset("toremove");
			expect(result).to.equal("toremove");
		});

		it("should no longer list a removed dataset", async function () {
			await facade.addDataset("toremove", validSmallDataset, InsightDatasetKind.Sections);
			await facade.removeDataset("toremove");
			const datasets = await facade.listDatasets();
			expect(datasets).to.have.length(0);
		});

		it("should reject with InsightError when id contains underscore", async function () {
			const result = facade.removeDataset("bad_id");
			return expect(result).to.eventually.be.rejectedWith(InsightError);
		});

		it("should reject with InsightError when id is only whitespace", async function () {
			const result = facade.removeDataset("   ");
			return expect(result).to.eventually.be.rejectedWith(InsightError);
		});

		it("should reject with InsightError when id is empty string", async function () {
			const result = facade.removeDataset("");
			return expect(result).to.eventually.be.rejectedWith(InsightError);
		});

		it("should reject with NotFoundError when dataset was never added", async function () {
			const result = facade.removeDataset("nonexistent");
			return expect(result).to.eventually.be.rejectedWith(NotFoundError);
		});

		it("should reject with NotFoundError when removing an already removed dataset", async function () {
			await facade.addDataset("once", validSmallDataset, InsightDatasetKind.Sections);
			await facade.removeDataset("once");
			const result = facade.removeDataset("once");
			return expect(result).to.eventually.be.rejectedWith(NotFoundError);
		});

		it("should persist removal across InsightFacade instances", async function () {
			await facade.addDataset("temp", validSmallDataset, InsightDatasetKind.Sections);
			await facade.removeDataset("temp");
			const newFacade = new InsightFacade();
			const result = newFacade.removeDataset("temp");
			return expect(result).to.eventually.be.rejectedWith(NotFoundError);
		});

		it("should allow re-adding a removed dataset", async function () {
			await facade.addDataset("readd", validSmallDataset, InsightDatasetKind.Sections);
			await facade.removeDataset("readd");
			const result = await facade.addDataset("readd", validSmallDataset, InsightDatasetKind.Sections);
			expect(result).to.include("readd");
		});

		it("should fail to query a removed dataset", async function () {
			await facade.addDataset("gone", validSmallDataset, InsightDatasetKind.Sections);
			await facade.removeDataset("gone");
			try {
				await facade.performQuery({
					WHERE: { IS: { gone_dept: "cpsc" } },
					OPTIONS: { COLUMNS: ["gone_dept"] },
				});
				expect.fail("Should have rejected!");
			} catch (err) {
				expect(err).to.be.an.instanceOf(InsightError);
			}
		});
	});

	describe("ListDatasets", function () {
		beforeEach(async function () {
			await clearDisk();
			facade = new InsightFacade();
		});

		it("should return an empty array when no datasets have been added", async function () {
			const result = await facade.listDatasets();
			expect(result).to.be.an("array");
			expect(result).to.have.length(0);
		});

		it("should return one dataset after adding one", async function () {
			await facade.addDataset("one", validSmallDataset, InsightDatasetKind.Sections);
			const result = await facade.listDatasets();
			expect(result).to.have.length(1);
			expect(result[0].id).to.equal("one");
			expect(result[0].kind).to.equal(InsightDatasetKind.Sections);
			expect(result[0].numRows).to.equal(7);
		});

		it("should return multiple datasets after adding multiple", async function () {
			await facade.addDataset("first", validSmallDataset, InsightDatasetKind.Sections);
			await facade.addDataset("second", validSmallDataset, InsightDatasetKind.Sections);
			const result = await facade.listDatasets();
			expect(result).to.have.length(2);
			const ids = result.map((d) => d.id);
			expect(ids).to.include("first");
			expect(ids).to.include("second");
		});

		it("should return correct numRows for the large pair.zip dataset", async function () {
			await facade.addDataset("ubc", sections, InsightDatasetKind.Sections);
			const result = await facade.listDatasets();
			expect(result).to.have.length(1);
			expect(result[0].numRows).to.equal(64612);
		});

		it("should not list a removed dataset", async function () {
			await facade.addDataset("remove-me", validSmallDataset, InsightDatasetKind.Sections);
			await facade.removeDataset("remove-me");
			const result = await facade.listDatasets();
			expect(result).to.have.length(0);
		});

		it("should show correct kind for sections dataset", async function () {
			await facade.addDataset("kind-test", validSmallDataset, InsightDatasetKind.Sections);
			const result = await facade.listDatasets();
			expect(result[0].kind).to.equal(InsightDatasetKind.Sections);
		});
	});

	describe("PerformQuery", function () {
		async function checkQuery(this: Mocha.Context): Promise<void> {
			if (!this.test) {
				throw new Error(
					"Invalid call to checkQuery." +
						"Usage: 'checkQuery' must be passed as the second parameter of Mocha's it(..) function." +
						"Do not invoke the function directly."
				);
			}

			const fileName = extractFileFromTestName(this.test.title);
			let testQuery: ITestQuery;

			if (fileName.endsWith(".jsonc")) {
				const raw = await fs.readFile(`test/resources/queries/${fileName}`, "utf-8");
				const stripped = raw.replace(/^\s*\/\/.*$/gm, "").trim();
				testQuery = JSON.parse(stripped) as ITestQuery;
			} else {
				testQuery = await loadTestQuery(this.test.title);
			}

			const { input, expected, errorExpected } = testQuery;
			let result: InsightResult[];
			try {
				result = await facade.performQuery(input);
			} catch (err) {
				if (!errorExpected) {
					expect.fail(`performQuery threw unexpected error: ${err}`);
				}
				if (expected === "InsightError") {
					expect(err).to.be.an.instanceOf(InsightError);
				} else if (expected === "ResultTooLargeError") {
					expect(err).to.be.an.instanceOf(ResultTooLargeError);
				} else {
					expect.fail(`Unexpected expected error type: ${expected}`);
				}
				return;
			}
			if (errorExpected) {
				expect.fail(`performQuery resolved when it should have rejected with ${expected}`);
			}
			expect(result).to.deep.equal(expected);
		}

		before(async function () {
			await clearDisk();
			facade = new InsightFacade();
			await facade.addDataset("sections", sections, InsightDatasetKind.Sections);
			await facade.addDataset("small", validSmallDataset, InsightDatasetKind.Sections);
		});

		// Valid queries
		it("[valid/simple.jsonc] SELECT dept, avg WHERE avg > 97", checkQuery);
		it("[valid/gtFilter.jsonc] GT filter on avg", checkQuery);
		it("[valid/ltFilter.jsonc] LT filter on avg", checkQuery);
		it("[valid/eqFilter.jsonc] EQ filter on year", checkQuery);
		it("[valid/isExact.jsonc] IS exact match on dept", checkQuery);
		it("[valid/isWildcardEnd.jsonc] IS wildcard at end", checkQuery);
		it("[valid/isWildcardStart.jsonc] IS wildcard at start", checkQuery);
		it("[valid/isWildcardBoth.jsonc] IS wildcard at both ends", checkQuery);
		it("[valid/andFilter.jsonc] AND logic filter", checkQuery);
		it("[valid/orFilter.jsonc] OR logic filter", checkQuery);
		it("[valid/notFilter.jsonc] NOT negation filter", checkQuery);
		it("[valid/nestedLogic.jsonc] nested AND/OR/NOT", checkQuery);
		it("[valid/noOrder.jsonc] valid query without ORDER", checkQuery);
		it("[valid/allColumns.jsonc] all mfields and sfields in COLUMNS", checkQuery);
		it("[valid/emptyWhere.jsonc] empty WHERE matches all entries", checkQuery);
		it("[valid/orderOnString.jsonc] ORDER by a string field", checkQuery);
		it("[valid/isOnlyWildcard.jsonc] IS with single wildcard matches all", checkQuery);
		it("[valid/doubleNot.jsonc] double NOT negation", checkQuery);
		it("[valid/eqDecimal.jsonc] EQ filter on decimal avg value", checkQuery);
		it("[valid/overallYear.jsonc] query overall section has year 1900", checkQuery);
		it("[valid/isEmptyString.jsonc] IS with empty string matches empty instructor", checkQuery);
		it("[valid/isWildcardSpecialChars.jsonc] IS exact match with no special chars returns correct result", checkQuery);
		it("[valid/singleResult.jsonc] query returning exactly one result", checkQuery);
		it("[valid/andSingleFilter.jsonc] AND with single filter element", checkQuery);
		it("[valid/orSingleFilter.jsonc] OR with single filter element", checkQuery);
		it("[valid/ltZero.jsonc] LT with zero value", checkQuery);
		it("[valid/uuidField.jsonc] query uuid string field", checkQuery);
		it("[valid/ltOnYear.jsonc] LT on year with overall sections", checkQuery);
		it("[valid/zeroResults.jsonc] query returning zero results", checkQuery);
		it("[valid/emptyInstructor.jsonc] IS empty string matches empty instructor", checkQuery);
		it("[valid/complexNestedOrAndNot.jsonc] Complex nested OR AND NOT", checkQuery);
		it("[valid/eqOnPass.jsonc] EQ on pass field", checkQuery);

		// Invalid queries
		it("[invalid/invalid.json] Query missing WHERE", checkQuery);
		it("[invalid/missingOptions.jsonc] Query missing OPTIONS", checkQuery);
		it("[invalid/missingColumns.jsonc] OPTIONS without COLUMNS", checkQuery);
		it("[invalid/emptyColumns.jsonc] COLUMNS is empty array", checkQuery);
		it("[invalid/invalidMfield.jsonc] invalid mfield in key", checkQuery);
		it("[invalid/invalidSfield.jsonc] invalid sfield in key", checkQuery);
		it("[invalid/orderNotInColumns.jsonc] ORDER key not in COLUMNS", checkQuery);
		it("[invalid/multipleDatasets.jsonc] references two dataset ids", checkQuery);
		it("[invalid/datasetNotAdded.jsonc] references dataset not added", checkQuery);
		it("[invalid/wildcardInMiddle.jsonc] asterisk in middle of IS string", checkQuery);
		it("[invalid/typeMismatchGT.jsonc] string value for GT comparator", checkQuery);
		it("[invalid/scomparisonNumber.jsonc] number value for IS comparator", checkQuery);
		it("[invalid/emptyAnd.jsonc] AND with empty array", checkQuery);
		it("[invalid/emptyOr.jsonc] OR with empty array", checkQuery);
		it("[invalid/resultTooLarge.jsonc] result exceeds 5000", checkQuery);
		it("[invalid/queryNotObject.jsonc] query is not an object", checkQuery);
		it("[invalid/invalidIdUnderscore.jsonc] underscore in idstring part of key", checkQuery);
		it("[invalid/whereTwoKeys.jsonc] WHERE with more than one key", checkQuery);
		it("[invalid/notEmpty.jsonc] NOT with empty object", checkQuery);
		it("[invalid/gtWithSfield.jsonc] GT comparator used with sfield", checkQuery);
		it("[invalid/isWithMfield.jsonc] IS comparator used with mfield", checkQuery);
		it("[invalid/queryNull.jsonc] query is null", checkQuery);
		it("[invalid/extraOptionsKey.jsonc] extra key in OPTIONS", checkQuery);
		it("[invalid/crossDatasetWhereOptions.jsonc] datasets in WHERE and OPTIONS differ", checkQuery);
		it("[invalid/gtTwoKeys.jsonc] GT with two keys inside", checkQuery);
		it("[invalid/queryArray.jsonc] query is an array", checkQuery);
		it("[invalid/orderNotString.jsonc] ORDER is a number not a string", checkQuery);
		it("[invalid/columnsNotArray.jsonc] COLUMNS is a string not an array", checkQuery);
		it("[invalid/unknownFilter.jsonc] unknown filter operator BETWEEN", checkQuery);
		it("[invalid/notMultipleKeys.jsonc] NOT with more than one key inside", checkQuery);
		it("[invalid/extraTopLevelKey.jsonc] extra top-level key TRANSFORMATIONS", checkQuery);
		it("[invalid/whereIsArray.jsonc] WHERE is an array", checkQuery);
		it("[invalid/emptyIdInKey.jsonc] IS with empty string key (no dataset id)", checkQuery);
		it("[invalid/ltWithSfield.jsonc] LT comparator used with sfield", checkQuery);
		it("[invalid/eqWithSfield.jsonc] EQ comparator used with sfield", checkQuery);
		it("[invalid/keyNoUnderscore.jsonc] key with no underscore", checkQuery);
		it("[invalid/orderDiffDataset.jsonc] ORDER key references different dataset than COLUMNS", checkQuery);
		it("[invalid/andNotArray.jsonc] AND value is object not array", checkQuery);
		it("[invalid/orNotArray.jsonc] OR value is object not array", checkQuery);
		it("[invalid/isNotObject.jsonc] IS value is a string not an object", checkQuery);
		it("[invalid/gtNotObject.jsonc] GT value is a number not an object", checkQuery);
		it("[invalid/notIsArray.jsonc] NOT value is an array not an object", checkQuery);
		it("[invalid/columnsHasNonString.jsonc] COLUMNS contains a non-string element", checkQuery);
		it("[invalid/optionsIsNull.jsonc] OPTIONS is null", checkQuery);
		it("[invalid/optionsIsArray.jsonc] OPTIONS is an array", checkQuery);
		it("[invalid/queryBoolean.jsonc] Query is a boolean", checkQuery);
		it("[invalid/queryString.jsonc] Query is a string", checkQuery);
		it("[invalid/whereIsNumber.jsonc] WHERE is a number", checkQuery);
		it("[invalid/resultTooLargeFiltered.jsonc] Filtered query exceeds 5000", checkQuery);
		it("[invalid/andListItemNotObject.jsonc] AND list contains a string", checkQuery);
		it("[invalid/andMixedDatasets.jsonc] AND with mixed dataset ids", checkQuery);
		it("[invalid/isTwoKeys.jsonc] IS with two keys", checkQuery);
	});
});


