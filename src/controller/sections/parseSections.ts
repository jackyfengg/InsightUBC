import JSZip from "jszip";
import { InsightError } from "../IInsightFacade";
import { Record } from "../types";

const COURSES_PREFIX_LENGTH = "courses/".length;
const OVERALL_YEAR = 1900;

export async function parseSectionsFromZip(content: string): Promise<Record[]> {
	let zip: JSZip;
	try {
		zip = await JSZip.loadAsync(content, { base64: true });
	} catch {
		throw new InsightError("Content is not a valid zip file");
	}
	const courseFiles = collectCourseFiles(zip);
	const texts = await Promise.all(courseFiles.map(readFileTextSafely));
	const sections: Record[] = [];
	for (const text of texts) appendSectionsFromText(text, sections);
	return sections;
}

function collectCourseFiles(zip: JSZip): JSZip.JSZipObject[] {
	const out: JSZip.JSZipObject[] = [];
	for (const [name, file] of Object.entries(zip.files)) {
		if (file.dir) continue;
		if (!name.startsWith("courses/")) continue;
		const relativePath = name.slice(COURSES_PREFIX_LENGTH);
		if (relativePath.includes("/") || relativePath.length === 0) continue;
		out.push(file);
	}
	return out;
}

async function readFileTextSafely(f: JSZip.JSZipObject): Promise<string | null> {
	return f.async("string").catch(() => null);
}

function appendSectionsFromText(text: string | null, out: Record[]): void {
	if (text === null) return;
	let parsed: unknown;
	try {
		parsed = JSON.parse(text);
	} catch {
		return;
	}
	if (typeof parsed !== "object" || parsed === null || Array.isArray(parsed)) return;
	const obj = parsed as { [k: string]: unknown };
	if (!Array.isArray(obj.result)) return;
	for (const item of obj.result as unknown[]) {
		const section = parseSection(item);
		if (section !== null) out.push(section);
	}
}

function parseSection(raw: unknown): Record | null {
	if (typeof raw !== "object" || raw === null || Array.isArray(raw)) return null;
	const r = raw as { [k: string]: unknown };
	if (!hasRequiredFields(r)) return null;
	const year = parseSectionYear(r);
	if (year === null) return null;
	const avg = Number(r.Avg);
	const pass = Number(r.Pass);
	const fail = Number(r.Fail);
	const audit = Number(r.Audit);
	if (!isFinite(avg) || !isFinite(pass) || !isFinite(fail) || !isFinite(audit)) return null;
	return {
		uuid: String(r.id),
		id: String(r.Course),
		title: String(r.Title),
		instructor: String(r.Professor),
		dept: String(r.Subject),
		year,
		avg,
		pass,
		fail,
		audit,
	};
}

function hasRequiredFields(r: { [k: string]: unknown }): boolean {
	const required = ["id", "Course", "Title", "Professor", "Subject", "Year", "Avg", "Pass", "Fail", "Audit", "Section"];
	for (const k of required) {
		if (!Object.hasOwn(r, k)) return false;
	}
	return true;
}

function parseSectionYear(r: { [k: string]: unknown }): number | null {
	if (r.Section === "overall") return OVERALL_YEAR;
	const rawYear = r.Year;
	const year = typeof rawYear === "string" ? parseInt(rawYear, 10) : Number(rawYear);
	if (!isFinite(year)) return null;
	return year;
}

