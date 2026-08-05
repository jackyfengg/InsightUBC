import Server from "../../../src/rest/Server";
import { clearDisk, getContentFromArchives } from "../../TestUtil";

import { expect, use } from "chai";
import chaiAsPromised from "chai-as-promised";
import request, { SuperTest, Test } from "supertest";

use(chaiAsPromised);

const ZIP_TYPE = "application/x-zip-compressed";
const HTTP_OK = 200;
const HTTP_BAD_REQUEST = 400;
const HTTP_NOT_FOUND = 404;
const TEST_PORT = 4322;
const BASE_URL = `http://127.0.0.1:${TEST_PORT}`;

describe("Server (REST)", function () {
	this.timeout(30000);

	let server: Server;
	let agent: SuperTest<Test>;
	let pairZipBuffer: Buffer;
	let pairZipBase64: string;

	before(async function () {
		await clearDisk();
		pairZipBase64 = await getContentFromArchives("pair.zip");
		pairZipBuffer = Buffer.from(pairZipBase64, "base64");
		server = new Server(TEST_PORT);
		await server.start();
		agent = request(BASE_URL) as unknown as SuperTest<Test>;
	});

	after(async function () {
		try {
			await server.stop();
		} catch {
			// already stopped
		}
		await clearDisk();
	});

	describe("PUT /dataset/:id/:kind", function () {
		afterEach(async function () {
			// Best-effort: clean up between tests so each PUT can re-add cleanly.
			await agent.delete("/dataset/sm").catch(() => undefined);
		});

		it("adds a valid sections dataset", async function () {
			const res = await agent.put("/dataset/sm/sections").set("Content-Type", ZIP_TYPE).send(pairZipBuffer);
			expect(res.status).to.equal(HTTP_OK);
			expect(res.body).to.have.property("result");
			expect(res.body.result).to.include("sm");
		});

		it("rejects duplicate id", async function () {
			const first = await agent.put("/dataset/sm/sections").set("Content-Type", ZIP_TYPE).send(pairZipBuffer);
			expect(first.status).to.equal(HTTP_OK);
			const second = await agent.put("/dataset/sm/sections").set("Content-Type", ZIP_TYPE).send(pairZipBuffer);
			expect(second.status).to.equal(HTTP_BAD_REQUEST);
			expect(second.body).to.have.property("error");
		});

		it("rejects id with underscore", async function () {
			const res = await agent.put("/dataset/bad_id/sections").set("Content-Type", ZIP_TYPE).send(pairZipBuffer);
			expect(res.status).to.equal(HTTP_BAD_REQUEST);
			expect(res.body).to.have.property("error");
		});

		it("rejects invalid kind", async function () {
			const res = await agent.put("/dataset/sm/banana").set("Content-Type", ZIP_TYPE).send(pairZipBuffer);
			expect(res.status).to.equal(HTTP_BAD_REQUEST);
			expect(res.body).to.have.property("error");
		});

		it("rejects non-zip body", async function () {
			const res = await agent
				.put("/dataset/sm/sections")
				.set("Content-Type", ZIP_TYPE)
				.send(Buffer.from("not a zip", "utf8"));
			expect(res.status).to.equal(HTTP_BAD_REQUEST);
			expect(res.body).to.have.property("error");
		});
	});

	describe("GET /datasets", function () {
		before(async function () {
			await agent.put("/dataset/sm/sections").set("Content-Type", ZIP_TYPE).send(pairZipBuffer);
		});

		after(async function () {
			await agent.delete("/dataset/sm").catch(() => undefined);
		});

		it("lists currently added datasets", async function () {
			const res = await agent.get("/datasets");
			expect(res.status).to.equal(HTTP_OK);
			expect(res.body).to.have.property("result");
			expect(res.body.result).to.be.an("array");
			const ids = (res.body.result as Array<{ id: string }>).map((d) => d.id);
			expect(ids).to.include("sm");
		});
	});

	describe("POST /query", function () {
		before(async function () {
			await agent.put("/dataset/sm/sections").set("Content-Type", ZIP_TYPE).send(pairZipBuffer);
		});

		after(async function () {
			await agent.delete("/dataset/sm").catch(() => undefined);
		});

		it("returns results for a valid query", async function () {
			const query = {
				WHERE: { GT: { sm_avg: 99 } },
				OPTIONS: { COLUMNS: ["sm_dept", "sm_avg"], ORDER: "sm_avg" },
			};
			const res = await agent.post("/query").set("Content-Type", "application/json").send(query);
			expect(res.status).to.equal(HTTP_OK);
			expect(res.body).to.have.property("result");
			expect(res.body.result).to.be.an("array");
		});

		it("rejects malformed query", async function () {
			const res = await agent.post("/query").set("Content-Type", "application/json").send({ NOT_A_QUERY: true });
			expect(res.status).to.equal(HTTP_BAD_REQUEST);
			expect(res.body).to.have.property("error");
		});

		it("rejects query referencing missing dataset", async function () {
			const query = {
				WHERE: { GT: { missing_avg: 99 } },
				OPTIONS: { COLUMNS: ["missing_dept", "missing_avg"] },
			};
			const res = await agent.post("/query").set("Content-Type", "application/json").send(query);
			expect(res.status).to.equal(HTTP_BAD_REQUEST);
			expect(res.body).to.have.property("error");
		});
	});

	describe("DELETE /dataset/:id", function () {
		it("removes an existing dataset", async function () {
			await agent.put("/dataset/sm/sections").set("Content-Type", ZIP_TYPE).send(pairZipBuffer);
			const res = await agent.delete("/dataset/sm");
			expect(res.status).to.equal(HTTP_OK);
			expect(res.body).to.have.property("result", "sm");
		});

		it("returns 404 for a missing dataset", async function () {
			const res = await agent.delete("/dataset/doesnotexist");
			expect(res.status).to.equal(HTTP_NOT_FOUND);
			expect(res.body).to.have.property("error");
		});

		it("returns 400 for an invalid id (underscore)", async function () {
			const res = await agent.delete("/dataset/bad_id");
			expect(res.status).to.equal(HTTP_BAD_REQUEST);
			expect(res.body).to.have.property("error");
		});
	});

	describe("Persistence across Server restarts", function () {
		it("retains datasets when a new Server instance is constructed", async function () {
			await agent.put("/dataset/sm/sections").set("Content-Type", ZIP_TYPE).send(pairZipBuffer);

			await server.stop();
			server = new Server(TEST_PORT);
			await server.start();

			const res = await agent.get("/datasets");
			expect(res.status).to.equal(HTTP_OK);
			const ids = (res.body.result as Array<{ id: string }>).map((d) => d.id);
			expect(ids).to.include("sm");

			await agent.delete("/dataset/sm").catch(() => undefined);
		});
	});

	describe("POST /insights/course-pulse (custom)", function () {
		before(async function () {
			await agent.put("/dataset/sm/sections").set("Content-Type", ZIP_TYPE).send(pairZipBuffer);
		});
		after(async function () {
			await agent.delete("/dataset/sm").catch(() => undefined);
		});

		it("returns 404 for an unknown dataset id", async function () {
			const res = await agent
				.post("/insights/course-pulse")
				.set("Content-Type", "application/json")
				.send({ id: "nope", dept: "cpsc", course: "310" });
			expect(res.status).to.equal(HTTP_NOT_FOUND);
			expect(res.body).to.have.property("error");
		});

		it("returns 400 when required fields are missing", async function () {
			const res = await agent.post("/insights/course-pulse").set("Content-Type", "application/json").send({ id: "sm" });
			expect(res.status).to.equal(HTTP_BAD_REQUEST);
			expect(res.body).to.have.property("error");
		});

		it("returns 404 when the course has no matching sections", async function () {
			const res = await agent
				.post("/insights/course-pulse")
				.set("Content-Type", "application/json")
				.send({ id: "sm", dept: "zzz", course: "999" });
			expect(res.status).to.equal(HTTP_NOT_FOUND);
			expect(res.body).to.have.property("error");
		});

		it("returns trend, instructors and baseline for a real course", async function () {
			const res = await agent
				.post("/insights/course-pulse")
				.set("Content-Type", "application/json")
				.send({ id: "sm", dept: "cpsc", course: "310" });
			expect(res.status).to.equal(HTTP_OK);
			expect(res.body).to.have.keys([
				"dept",
				"course",
				"totalSections",
				"overallAvg",
				"trend",
				"topInstructors",
				"deptBaseline",
			]);
			expect(res.body.trend).to.be.an("array");
			expect(res.body.deptBaseline).to.be.an("array");
		});
	});
});

