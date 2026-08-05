import cors from "cors";
import express, { Application, NextFunction, Request, Response } from "express";
import * as http from "http";
import * as path from "path";
import { StatusCodes } from "http-status-codes";
import InsightFacade from "../controller/InsightFacade";
import { IInsightFacade, InsightDatasetKind, NotFoundError } from "../controller/IInsightFacade";
import { makeCoursePulseHandler } from "./coursePulse";

export default class Server {
	private readonly port: number;
	private readonly express: Application;
	private server: http.Server | undefined;
	private facade: IInsightFacade;

	constructor(port = 4321) {
		this.port = port;
		this.express = express();
		this.facade = new InsightFacade();
		this.registerMiddleware();
		this.registerRoutes();
	}

	public async start(): Promise<void> {
		return new Promise<void>((resolve, reject) => {
			if (this.server !== undefined) {
				reject(new Error("Server is already listening"));
				return;
			}
			this.server = this.express
				.listen(this.port, () => {
					resolve();
				})
				.on("error", (err: Error) => {
					reject(err);
				});
		});
	}

	public async stop(): Promise<void> {
		return new Promise<void>((resolve, reject) => {
			if (this.server === undefined) {
				reject(new Error("Server is not listening"));
				return;
			}
			this.server.close((err) => {
				if (err !== undefined && err !== null) reject(err);
				else {
					this.server = undefined;
					resolve();
				}
			});
		});
	}

	public getApp(): Application {
		return this.express;
	}

	private registerMiddleware(): void {
		this.express.use(cors());
		this.express.use(express.json({ limit: "100mb" }));
		this.express.use(express.raw({ type: "*/*", limit: "100mb" }));
		// Body-parse error handler: turn malformed JSON / oversized body into 400.
		this.express.use((err: Error, _req: Request, res: Response, next: NextFunction) => {
			if (err) {
				res.status(StatusCodes.BAD_REQUEST).json({ error: err.message });
				return;
			}
			next();
		});
		// Serve the Part 2 frontend (static files) from frontend/public at the site root.
		// Resolves to <projectRoot>/frontend/public whether run via ts-node (src/rest) or dist (dist/rest).
		this.express.use(express.static(path.join(__dirname, "..", "..", "frontend", "public")));
	}

	private registerRoutes(): void {
		this.express.get("/echo/:msg", (req, res) => {
			res.status(StatusCodes.OK).json({ result: req.params.msg });
		});

		this.express.put("/dataset/:id/:kind", this.handleAddDataset.bind(this));
		this.express.delete("/dataset/:id", this.handleRemoveDataset.bind(this));
		this.express.post("/query", this.handleQuery.bind(this));
		this.express.get("/datasets", this.handleListDatasets.bind(this));
		// Custom endpoint: per-course year-over-year pulse vs department baseline.
		this.express.post("/insights/course-pulse", makeCoursePulseHandler(this.facade));
	}

	private async handleAddDataset(req: Request, res: Response): Promise<void> {
		const { id, kind } = req.params;
		let kindEnum: InsightDatasetKind;
		if (kind === "sections") kindEnum = InsightDatasetKind.Sections;
		else if (kind === "rooms") kindEnum = InsightDatasetKind.Rooms;
		else {
			res.status(StatusCodes.BAD_REQUEST).json({ error: `Invalid kind "${kind}"` });
			return;
		}

		const body = req.body;
		let content: string;
		if (Buffer.isBuffer(body)) {
			content = body.toString("base64");
		} else if (typeof body === "string") {
			content = body;
		} else {
			res.status(StatusCodes.BAD_REQUEST).json({ error: "Request body must be a zip buffer" });
			return;
		}

		try {
			const result = await this.facade.addDataset(id, content, kindEnum);
			res.status(StatusCodes.OK).json({ result });
		} catch (err) {
			res.status(StatusCodes.BAD_REQUEST).json({ error: errMessage(err) });
		}
	}

	private async handleRemoveDataset(req: Request, res: Response): Promise<void> {
		const { id } = req.params;
		try {
			const result = await this.facade.removeDataset(id);
			res.status(StatusCodes.OK).json({ result });
		} catch (err) {
			if (err instanceof NotFoundError) {
				res.status(StatusCodes.NOT_FOUND).json({ error: errMessage(err) });
			} else {
				res.status(StatusCodes.BAD_REQUEST).json({ error: errMessage(err) });
			}
		}
	}

	private async handleQuery(req: Request, res: Response): Promise<void> {
		try {
			const body = req.body;
			let query: unknown = body;
			// When a non-JSON Content-Type made `express.raw` fire, body will be a Buffer.
			if (Buffer.isBuffer(body)) {
				try {
					query = JSON.parse(body.toString("utf8"));
				} catch {
					res.status(StatusCodes.BAD_REQUEST).json({ error: "Query body must be valid JSON" });
					return;
				}
			}
			const result = await this.facade.performQuery(query);
			res.status(StatusCodes.OK).json({ result });
		} catch (err) {
			res.status(StatusCodes.BAD_REQUEST).json({ error: errMessage(err) });
		}
	}

	private async handleListDatasets(_req: Request, res: Response): Promise<void> {
		const result = await this.facade.listDatasets();
		res.status(StatusCodes.OK).json({ result });
	}
}

function errMessage(err: unknown): string {
	if (err instanceof Error) return err.message;
	return String(err);
}

