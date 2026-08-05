/* ============================================================================
 * InsightUBC — frontend logic (Part 3)
 * Same-origin REST API:
 *   PUT    /dataset/:id/:kind             body = raw .zip bytes
 *   GET    /datasets                      -> { result: [{ id, kind, numRows }] }
 *   DELETE /dataset/:id                   -> { result: id }
 *   POST   /query                         -> { result: InsightResult[] }
 *   POST   /insights/course-pulse         -> { trend, topInstructors, deptBaseline, ... }
 *
 * Editorial-product UI: ledger-style dataset list, magazine-style mastheads,
 * prose-style presets, ink-black primary buttons, and the Course Pulse
 * custom feature with three GROUP+APPLY queries merged in-process.
 * ========================================================================== */
(function () {
	"use strict";

	// =========================================================================
	// Constants
	// =========================================================================
	const MAX_TABLE_ROWS = 500;

	const FIELD_LABELS = {
		dept: "Dept", id: "Course", title: "Title", instructor: "Professor",
		avg: "Average", year: "Year", uuid: "Section",
		pass: "Pass", fail: "Fail", audit: "Audit",
		fullname: "Building", shortname: "Code", number: "Room",
		name: "Name", address: "Address", seats: "Seats",
		type: "Type", furniture: "Furniture", href: "Link",
		lat: "Lat", lon: "Lon",
	};
	const NUMERIC_FIELDS = new Set(["avg", "year", "pass", "fail", "audit", "seats", "lat", "lon"]);
	const DEFAULT_DROPZONE_HTML = 'Drag a <strong>.zip</strong> here, or <span class="link">browse</span>';

	// -------------------------------------------------------------------------
	// UBC subject codes — full names. Sourced from
	// vancouver.calendar.ubc.ca/course-descriptions/courses-subject and used
	// for both result-table dept labels and for the dept-name disclosure
	// beneath the Course Pulse course chip.
	// -------------------------------------------------------------------------
	const DEPT_NAMES = {
		adhe: "Adult and Higher Education", afst: "African Studies", agec: "Agricultural Economics",
		asl: "American Sign Language", anat: "Anatomy",
		amne: "Ancient Mediterranean and Near Eastern Studies", arcl: "Anthropological Archaeology",
		anth: "Anthropology", aanb: "Applied Animal Biology", apbi: "Applied Biology",
		apsc: "Applied Science", appp: "Applied Science Professional Program",
		aqua: "Aquaculture", arch: "Architecture", arst: "Archival Studies", arth: "Art History",
		ai: "Artificial Intelligence", arts: "Arts",
		asic: "Arts and Science Interdisciplinary", artc: "Arts Co-Op", astu: "Arts Studies",
		acam: "Asian Canadian and Migration Studies", asla: "Asian Languages",
		asia: "Asian Studies", asix: "Asian Studies Crossings", astr: "Astronomy",
		atsc: "Atmospheric Science", audi: "Audiology and Speech Sciences",
		bioc: "Biochemistry", fsct: "Biochemistry and Forensic Science",
		biof: "Bioinformatics", biol: "Biology", bmeg: "Biomedical Engineering",
		biot: "Biotechnology", bota: "Botany", busi: "Business",
		baac: "Business Administration: Accounting",
		babs: "Business Administration: Business Statistics",
		bait: "Business Administration: Business Technology",
		ba: "Business Administration: Core",
		baen: "Business Administration: Entrepreneurship",
		bafi: "Business Administration: Finance",
		bahr: "Business Administration: Human Resources",
		bala: "Business Administration: Law",
		bams: "Business Administration: Management Science",
		bama: "Business Administration: Marketing",
		bapa: "Business Administration: Policy Analysis",
		basm: "Business Administration: Strategic Management",
		basc: "Business Administration: Supply Chain",
		baul: "Business Administration: Urban Land Economics",
		cdst: "Canadian Studies", cnto: "Cantonese", ctln: "Catalan",
		cell: "Cell and Developmental Biology", phyl: "Cellular and Physiological Sciences",
		caps: "Cellular, Anatomical and Physiological Sciences",
		cens: "Central, Eastern and Northern European Studies",
		ccfi: "Centre for Cross-Faculty Inquiry",
		chbe: "Chemical and Biological Engineering", chem: "Chemistry",
		chil: "Children's Literature", chin: "Chinese", cmst: "Cinema and Media Studies",
		cine: "Cinema Studies", civl: "Civil Engineering", arbc: "Classical Arabic",
		clst: "Classical Studies", ceen: "Clean Energy Engineering",
		cogs: "Cognitive Systems", comm: "Commerce", coec: "Commerce Economics",
		cohr: "Commerce Human Resources", comr: "Commerce Minor",
		plan: "Community and Regional Planning", colx: "Computational Linguistics",
		cpen: "Computer Engineering", cpsc: "Computer Science",
		cap: "Coordinated Arts Program", cspw: "Coordinated Science Program Workshop",
		cnps: "Counselling Psychology", crwr: "Creative Writing",
		ccst: "Critical and Curatorial Studies", csis: "Critical Studies in Sexuality",
		edcp: "Curriculum and Pedagogy", dani: "Danish", dsci: "Data Science",
		dhyg: "Dental Hygiene", dent: "Dentistry", des: "Design", dmed: "Digital Media",
		medd: "Doctor of Medicine", eced: "Early Childhood Education",
		eosc: "Earth and Ocean Sciences", econ: "Economics", educ: "Education",
		ecps: "Educational & Counselling Psychology",
		epse: "Educational Psychology and Special Education",
		edst: "Educational Studies", etec: "Educational Technology",
		eece: "Electrical and Computer Engineering", elec: "Electrical Engineering",
		enpp: "Engineering and Public Policy", enph: "Engineering Physics", engl: "English",
		enso: "Environment and Society", enst: "Environment and Sustainability",
		enve: "Environmental Engineering", envr: "Environmental Science",
		iest: "European Studies", exgr: "Exchange Graduate Research",
		exch: "Exchange Programs", emba: "Executive M.B.A.", fmpr: "Family Practice",
		fmst: "Family Studies", fipr: "Film Production",
		fnel: "First Nations and Endangered Languages",
		fnis: "First Nations and Indigenous Studies", fish: "Fisheries Research",
		fre: "Food and Resource Economics", food: "Food Science",
		fnh: "Food, Nutrition and Health",
		best: "Forest Bioeconomy Sciences and Technology", fopr: "Forest Operations",
		frst: "Forestry", fcor: "Forestry Core",
		fope: "Forestry Online Professional Education", fren: "French",
		grsj: "Gender, Race, Sexuality and Social Justice",
		gsat: "Genome Science and Technology", geos: "Geographical Sciences",
		geog: "Geography", gem: "Geomatics for Environmental Management",
		gern: "German", gmst: "Germanic Studies", glbh: "Global Health",
		grs: "Global Resource Systems", grek: "Greek", hgse: "Haida Gwaii Semesters",
		heso: "Health and Society", hebr: "Hebrew", hpb: "High Performance Buildings",
		hinu: "Hindi-Urdu", hist: "History", hunu: "Human Nutrition",
		ils: "Indigenous Land Stewardship", inlb: "Indigenous Land-Based Studies",
		indo: "Indonesian", info: "Information Studies",
		iar: "Institute of Asian Research", igen: "Integrated Engineering",
		isci: "Integrated Sciences", iwme: "Integrated Water Management Engineering",
		rads: "Interdisciplinary Radiology", inds: "Interdisciplinary Studies",
		intr: "International Relations", ital: "Italian", japn: "Japanese",
		jwst: "Jewish Studies", jrnl: "Journalism", kin: "Kinesiology", korn: "Korean",
		lfs: "Land and Food Systems", lws: "Land and Water Systems",
		larc: "Landscape Architecture", lled: "Language and Literacy Education",
		latn: "Latin", last: "Latin American Studies", law: "Law", laso: "Law and Society",
		libr: "Library and Information Studies",
		lais: "Library, Archival and Information Studies", ling: "Linguistics",
		mgmt: "Management", manu: "Manufacturing Engineering", mrne: "Marine Science",
		mtrl: "Materials Engineering", math: "Mathematics", mech: "Mechanical Engineering",
		mdia: "Media Studies", medg: "Medical Genetics", medi: "Medicine",
		mdvl: "Medieval Studies", micb: "Microbiology", mes: "Middle East Studies",
		midw: "Midwifery", mine: "Mining Engineering", arbm: "Modern Standard Arabic",
		musc: "Music", nres: "Natural Resources",
		cons: "Natural Resources Conservation",
		// "name" is a real UBC code (Naval Architecture and Marine Engineering)
		// — keep this entry for completeness even though it collides with the
		// JS Object.prototype.name name; lookups go through hasOwn.
		name: "Naval Architecture and Marine Engineering",
		nest: "Near Eastern Studies", nepl: "Nepali", nrsc: "Neuroscience",
		nsci: "Neuroscience Undergraduate", neur: "Neurosurgery", nord: "Nordic Studies",
		nurs: "Nursing", obst: "Obstetrics and Gynaecology",
		osot: "Occupational Science and Therapy", onco: "Oncology",
		obms: "Oral Biological Medical Sciences", ohs: "Oral Health Sciences",
		orpa: "Orthopaedics", path: "Pathology", pers: "Persian",
		phar: "Pharmaceutical Sciences", pcth: "Pharmacology and Therapeutics",
		phrm: "Pharmacy", phil: "Philosophy", phth: "Physical Therapy", phys: "Physics",
		plnt: "Plant Science", pols: "Polish", poli: "Political Science",
		port: "Portuguese", psyt: "Psychiatry", psyc: "Psychology",
		ppga: "Public Policy and Global Affairs", punj: "Punjabi", radi: "Radiology",
		rhsc: "Rehabilitation Sciences", relg: "Religious Studies",
		res: "Resources, Environment and Sustainability", rmst: "Romance Studies",
		russ: "Russian", sans: "Sanskrit", spha: "School of Population & Public Health",
		spph: "School of Population & Public Health", scie: "Science",
		sts: "Science and Technology Studies",
		slav: "Slavic and Eastern European Studies", sges: "Smart Grid Energy Systems",
		sowk: "Social Work", soci: "Sociology", soil: "Soil Science",
		soal: "South Asian Languages", seal: "Southeast Asian Languages",
		span: "Spanish", stat: "Statistics", rgst: "Study of Religion", surg: "Surgery",
		spe: "Sustainable Process Engineering", swah: "Swahili", swed: "Swedish",
		libe: "Teacher Librarianship", thtr: "Theatre", thfl: "Theatre and Film",
		tibt: "Tibetan", ukrn: "Ukrainian", writ: "University Writing Centre",
		udes: "Urban Design", ufor: "Urban Forestry", urst: "Urban Studies",
		ursy: "Urban Systems", urol: "Urological Surgery", vant: "Vantage College",
		visa: "Visual Arts", vrhc: "Vocational Rehabilitation Counselling",
		wach: "Women+ and Children's Health Sciences", wood: "Wood Products Processing",
		wrds: "Writing, Research, and Discourse Studies", ydsh: "Yiddish", zool: "Zoology",
	};
	function deptName(dept) {
		const k = String(dept || "").toLowerCase();
		return Object.prototype.hasOwnProperty.call(DEPT_NAMES, k) ? DEPT_NAMES[k] : null;
	}
	function populateDeptOptions() {
		if (!deptOptions) return;
		deptOptions.innerHTML = "";
		const codes = Object.keys(DEPT_NAMES).sort();
		for (const code of codes) {
			const opt = document.createElement("option");
			opt.value = code;
			opt.label = DEPT_NAMES[code]; // shown in some browsers
			deptOptions.appendChild(opt);
		}
	}

	// Populate the title-contains datalist with substrings the user might type.
	// We draw from: the abbreviated UBC vocabulary (so substring matches map to
	// what's actually stored), plus a curated list of full English keywords for
	// people who don't know the UBC short forms.
	function populateTitleKeywords() {
		if (!titleKeywords) return;
		const keywords = new Set([
			// Common UBC subject keywords (real text in the dataset)
			"calculus", "calc", "differential", "integral", "linear", "algebra",
			"thermodynamics", "biology", "biochemistry", "chemistry", "physics",
			"economics", "macroeconomics", "microeconomics",
			"introduction", "intro", "advanced", "fundamentals",
			"engineering", "mechanics", "materials", "mathematics", "statistics",
			"computer", "software", "programming", "algorithms", "databases",
			"writing", "research", "rhetoric", "literature", "history",
			"theory", "theatre", "music", "design", "studio",
			"organic", "nuclear", "molecular", "cell", "ecology",
			"sociology", "psychology", "philosophy", "anthropology",
			"forest", "soil", "plant", "animal",
			"japanese", "spanish", "french", "german", "korean", "chinese",
			"clinical", "nursing", "medicine", "pharmacology",
			"real estate", "marketing", "finance", "accounting",
			"thesis", "seminar", "project", "directed study",
			"law", "ethics", "politics", "policy",
			"calc", "stats", "probability",
			"machine learning", "artificial intelligence", "data",
			// Abbreviated forms commonly seen in dataset titles
			"calc", "diff", "intr", "intr to", "soci", "techn", "comm",
			"appl", "fund", "anlys", "behaviour", "physlgy", "matls",
		]);
		// Sorted for stable rendering; the browser does the substring matching.
		const sorted = [...keywords].sort();
		titleKeywords.innerHTML = "";
		for (const k of sorted) {
			const opt = document.createElement("option");
			opt.value = k;
			titleKeywords.appendChild(opt);
		}
	}

	// -------------------------------------------------------------------------
	// Building autocomplete (rooms search).
	//
	// Buildings are dataset-dependent — different rooms uploads can describe
	// different campuses — so we lazy-fetch the (shortname, fullname) tuples
	// per dataset id and cache them. Used for both:
	//   - the building-options datalist on the Building code field
	//   - resolving the user's typed shortname to a tooltip-friendly fullname
	// -------------------------------------------------------------------------
	const buildingCache = new Map(); // dsId -> Promise<Map<shortname, fullname>>
	async function loadBuildings(dsId) {
		if (!dsId) return new Map();
		if (buildingCache.has(dsId)) return buildingCache.get(dsId);
		const query = {
			WHERE: {},
			OPTIONS: { COLUMNS: [`${dsId}_shortname`, `${dsId}_fullname`] },
			TRANSFORMATIONS: {
				GROUP: [`${dsId}_shortname`, `${dsId}_fullname`],
				APPLY: [],
			},
		};
		const promise = apiQuery(query)
			.then((rows) => {
				const map = new Map();
				for (const r of rows) {
					const sn = String(r[`${dsId}_shortname`] || "").trim();
					const fn = String(r[`${dsId}_fullname`] || "").trim();
					if (sn) map.set(sn, fn);
				}
				return map;
			})
			.catch(() => new Map());
		buildingCache.set(dsId, promise);
		return promise;
	}
	async function populateBuildingOptions() {
		if (!buildingOptions) return;
		// Pull the currently-selected rooms dataset id (from either the search
		// dropdown when in rooms mode, or the listed rooms datasets otherwise).
		const dsId = currentMode() === "rooms"
			? queryDataset.value
			: (allDatasets.find((d) => d.kind === "rooms") || {}).id;
		if (!dsId) {
			buildingOptions.innerHTML = "";
			return;
		}
		const map = await loadBuildings(dsId);
		// Sort by shortname for stable rendering.
		const entries = [...map.entries()].sort((a, b) => a[0].localeCompare(b[0]));
		buildingOptions.innerHTML = "";
		for (const [sn, fn] of entries) {
			const opt = document.createElement("option");
			opt.value = sn;
			// `label` is shown in some browsers (Safari/Firefox) as the
			// secondary line. Falls back gracefully when not supported.
			if (fn) opt.label = fn;
			buildingOptions.appendChild(opt);
		}
		// Refresh the input's tooltip in case the user has already typed a
		// known code while the list was empty.
		updateBuildingTooltip();
	}
	async function updateBuildingTooltip() {
		if (!qBuilding) return;
		const code = qBuilding.value.trim().toUpperCase();
		if (!code) { qBuilding.title = ""; return; }
		const dsId = queryDataset.value || (allDatasets.find((d) => d.kind === "rooms") || {}).id;
		if (!dsId) return;
		const map = await loadBuildings(dsId);
		qBuilding.title = map.get(code) || "";
	}

	// -------------------------------------------------------------------------
	// Course title dictionary — abbreviated UBC titles get expanded for the
	// search results table. Two-tier: explicit lookups + abbreviation passes.
	// -------------------------------------------------------------------------
	const COURSE_TITLES = {
		"aanb 504": "Research Methodology",
		"aanb 551": "Animal Welfare Research",
		"adhe 327": "Teaching Adults",
		"adhe 328": "Instruction in Adult Education",
		"adhe 329": "Developmental Workshop / Seminar",
		"adhe 330": "Community Adult Education",
		"adhe 412": "Adult Education",
		"anat 392": "Gross Anatomy of the Limbs",
		"anat 511": "Foundations of Body Design: Basic",
		"anat 512": "Functional Human Anatomy: Head and Neck",
		"anat 515": "Functional Human Anatomy: Musculoskeletal",
		"anth 210": "Eating Culture",
		"anth 213": "Sex, Gender, and Culture",
		"anth 215": "Japanese Popular Culture",
		"anth 217": "Culture & Communication",
		"anth 220": "First Nations of British Columbia",
		"anth 227": "Introduction to Medical Anthropology",
		"anth 241": "Introduction to Museology",
		"anth 301": "Ethnography of Eurasia",
		"anth 302": "Ethnography of South Asia",
		"anth 312": "Introduction to the Anthropology of Gender",
		"anth 315": "Japanese Culture & Society",
		"anth 332": "Oral Tradition",
		"anth 378": "Anthropology of Media",
		"anth 407": "Principles of Field Work",
		"anth 414": "Anthropology of Globalization",
		"anth 418": "Anthropological Statistics",
		"anth 428": "Medicine, Society, and Culture",
		"anth 451": "Conservation of Organic Materials",
		"anth 472": "Studies in Social Inequality",
		"anth 500": "History of Anthropological Thought",
		"anth 512": "Language & Culture",
		"anth 516": "Qualitative Methods",
		"anth 517": "Archaeological Methods",
		"anth 519": "Seminar in Medical Anthropology",
		"anth 528": "Advanced Quantitative Methods",
		"anth 541": "Advanced Seminar in Museum Anthropology",
		"apbi 200": "Introduction to Soil Science",
		"apbi 210": "Vascular Plants",
		"apbi 244": "Introduction to Biometeorology",
		"apbi 260": "Agroecology I",
		"apbi 265": "Sustainable Agriculture & Food Systems",
		"apbi 311": "Animal Physiology I",
		"apbi 312": "Animal Physiology II",
		"apbi 314": "Animals & Society",
		"apbi 315": "Animal Welfare & Ethics in Agriculture and Aquaculture",
		"apbi 316": "Equine Biology",
		"apbi 322": "Horticultural Techniques",
		"apbi 324": "Introduction to Seed Plant Taxonomy",
		"apbi 327": "Introduction to Entomology",
		"apbi 328": "Weed Science",
		"apbi 342": "Soil Biology",
		"apbi 351": "Plant Physiology",
		"apbi 360": "Agroecology II",
		"apbi 361": "Key Indicators of Agricultural Sustainability",
		"apbi 398": "Research in Applied Animal Biology",
		"apbi 401": "Soil Processes",
		"apbi 402": "Sustainable Soil Management",
		"apbi 403": "Laboratory in Soil Science",
		"apbi 410": "Animal Health & Physiology",
		"apbi 413": "Stress & Coping",
		"apbi 414": "Animals and Global Issues",
		"apbi 415": "Applied Animal Behaviour",
		"apbi 416": "Animal Welfare",
		"apbi 417": "Production & Postharvest of Vegetables",
		"apbi 418": "Intensive Fish Production",
		"apbi 419": "Fish Diseases",
		"apbi 426": "Plant-Microbe Interactions",
		"apbi 428": "Integrated Pest Management",
		"apbi 440": "Plant Genomics",
		"apbi 442": "Berry Crop Biology",
		"apbi 444": "Agroforestry",
		"apbi 460": "Advanced Agroecology",
		"apbi 490": "Topics in Applied Biology",
		"apbi 495": "Wildlife Management",
		"apbi 498": "Undergraduate Essay",
		"apbi 499": "Undergraduate Thesis",
		"appp 501": "Management & Leadership",
		"appp 502": "Sustainability & Leadership",
		"appp 503": "Organizational Leadership",
		"appp 505": "Analytics & Interpretation",
		"apsc 100": "Introduction to Engineering I",
		"apsc 101": "Introduction to Engineering II",
		"apsc 160": "Computer Engineering Design",
		"apsc 172": "Engineering Analysis I",
		"apsc 173": "Engineering Analysis II",
		"apsc 178": "Electromagnetic Waves",
		"apsc 182": "Matter & Energy I",
		"apsc 183": "Matter & Energy II",
		"apsc 201": "Technical Communication",
		"apsc 261": "Technology & Society I",
		"apsc 262": "Technology & Society II",
		"apsc 278": "Engineering Materials",
		"apsc 279": "Engineering Materials Laboratory",
		"apsc 377": "Weapons & Arms Control",
		"apsc 440": "Management Fundamentals for Technology",
		"apsc 450": "Professional Engineering Practice",
		"apsc 486": "New Venture Design",
		"apsc 541": "Technology Entrepreneurship for Engineers",
		"arbc 101": "Introductory Classical Arabic",
		"arbc 102": "Introductory Classical Arabic II",
		"arbc 201": "Intermediate Classical Arabic I",
		"arbc 202": "Intermediate Classical Arabic II",
		"arch 403": "Themes in Architecture",
		"arch 404": "Architectural History I",
		"arch 405": "Architectural History II",
		"arch 411": "Materials & Methods of Construction",
		"arch 437": "Geometric Modelling",
		"arch 500": "Architectural Design",
		"arch 501": "Architectural Design II",
		"arch 504": "Architectural History 1A",
		"arch 505": "Architectural History 1B",
		"arch 511": "Architectural Technology I",
		"arch 512": "Structures I",
		"arch 513": "Environmental Systems & Controls I",
		"arch 515": "Design Media I",
		"arch 517": "Design Media II",
		"arch 520": "Architectural Design III",
		"arch 521": "Architectural Design IV",
		"arch 523": "Contemporary Theories",
		"arch 531": "Architectural Technology II",
		"arch 532": "Architectural Structures II",
		"arch 533": "Environmental Systems & Controls II",
		"arch 539": "Architectural Design Abroad",
		"arch 540": "Architectural Design V",
		"arch 541": "Process & Practice in Architecture",
		"arch 543": "Contemporary Practice",
		"arch 548": "Project Report Preparation",
		"arch 549": "Graduate Design Project",
		"arch 561": "Topics in Architectural History & Theory",
		"arch 568": "Research Methods in Culture & Identity",
		"arch 598": "MASA Thesis",
		"arcl 103": "Introduction to Archaeology",
		"arcl 140": "Origins of Humanity",
		"arcl 203": "Archaeology Methods",
		"arcl 204": "Great Archaeological Discoveries",
		"arcl 228": "Forensic Anthropology",
		"arcl 232": "Ancient Latin America",
		"arcl 305": "Archaeological Interpretation",
		"arcl 309": "Archaeology of Collapse & Sustainability",
		"arcl 318": "Archaeology of Hunter-Gatherer-Foragers",
		"arcl 326": "Primatology",
		"arcl 405": "Archaeological & Anthropological Mapping",
		"arcl 419": "Archaeology of Death",
		"arcl 424": "Practicing Archaeology",
		"arst 500": "Information Technology & Archives",
		"arst 510": "Archival Diplomatics",
		"arst 515": "Arrangement & Description of Archives",
		"arst 516": "Management of Current Records",
		"arst 520": "Selection & Acquisition of Archival Documents",
		"arst 540": "Archival Public Services",
		"arst 545": "Advanced Archival Documents",
		"arst 550": "Audio & Non-Textual Archives",
		"arst 554": "Database Design",
		"arst 555": "Preservation of Digital Records",
		"arst 560": "Records & Information Governance",
		"arst 565": "FOIP & Privacy of Records",
		"arst 570": "Management of Information Organizations",
		"arst 573": "Archival Systems & the Profession",
		"arst 580": "Records & Archives Law",
		"arst 587": "Preservation",
		"arst 591": "Archival Research & Scholarship",
		"arst 600": "Advanced Seminar in Research Methods",
		"arst 620": "Advanced Studies in Minor Area",
		"arth 101": "Ways of Seeing",
		"arth 102": "Crisis & Contradiction",
		"arth 225": "Pre-1600 European Art",
		"arth 226": "Art from 1600 to Now",
		"arth 227": "Visual Environment: Modern & Postmodern",
		"arth 251": "Asian Art",
		"arth 300": "Art History Methods",
		"arth 312": "Medieval Art in the Monastery",
		"arth 322": "Art & Culture 1550-",
		"arth 323": "Art & Culture 1400-",
		"arth 338": "Visual Culture of the 18th Century",
		"arth 339": "19th Century Art",
		"arth 340": "Modernism",
		"arth 341": "Postmodern Art",
		"arth 343": "Photography in Canada",
		"arth 345": "History of Photography",
		"arth 346": "European Architecture",
		"arth 347": "European Architecture",
		"arth 361": "Modern/Postmodern Art in China",
		"arth 363": "Japanese: Problems in Painting",
		"arth 368": "Japanese: Print Media",
		"arth 376": "Northcoast Peoples",
		"arth 377": "Northcoast Peoples",
		"arth 432": "Art of the Middle Ages",
		"arth 436": "Early Modern Art",
		"arth 439": "18th & 19th Century Visual Culture",
		"arth 443": "Canadian Art",
		"arth 448": "North American Architecture",
		"arth 464": "Japanese Art",
		"arth 480": "Visual & Digital Media Theory",
		"arth 571": "Methods in Art History",
		"arth 599": "Master's Thesis",
		"asia 100": "Introduction to Traditional Asia",
		"asia 101": "Introduction to Modern Asia",
		"asia 200": "Cultural Foundations of East Asia",
		"asia 211": "Sex and Ethics in Asian Religions",
		"asia 250": "Introduction to Buddhism",
		"asia 254": "Japanese Sex & Gender in Film",
		"asia 300": "Writing & Culture in East Asia",
		"asia 304": "South & Southeast Asian Performing Arts",
		"asia 305": "Asian Horror Cinema",
		"asia 307": "Korean Language & Writing",
		"asia 308": "Myth, Ritual, & Epic",
		"asia 309": "South Asians Beyond",
		"asia 314": "Premodern Japan",
		"asia 315": "Japan from Feudal to Modern",
		"asia 317": "Rise of Korean Civilization",
		"asia 318": "Premodern India",
		"asia 325": "Hong Kong Cinema",
		"asia 326": "Manga & Anime",
		"asia 332": "Confucian China",
		"asia 337": "Korean People in Modern Times",
		"asia 338": "Modern India",
		"asia 340": "History of Late Imperial China",
		"asia 341": "Classical Chinese Literary Tradition",
		"asia 342": "Chinese Literature in Translation: Verse",
		"asia 347": "Traditional Korean Literature in Translation",
		"asia 348": "Great Literary Works of Classical India",
		"asia 351": "Modern Chinese Fiction in Translation",
		"asia 352": "Topics in Traditional Chinese Verse",
		"asia 354": "Introduction to Japanese Cinema",
		"asia 355": "Chinese Cinema",
		"asia 356": "Korean Cinema",
		"asia 357": "Modern Korean Fiction in Translation",
		"asia 363": "Taiwan Fiction & Film",
		"asia 365": "Punjabi Cinema",
		"asia 369": "Asian Folklore",
		"asia 370": "Sanskrit Cosmopolis",
		"asia 371": "Foundations of Chinese Thought",
		"asia 372": "Development of Traditional Chinese Thought",
		"asia 375": "Global Chinese Cinema",
		"asia 376": "The Sikhs",
		"asia 377": "History of Korean Thought",
		"asia 378": "Philosophical Wisdom of Early India",
		"asia 382": "Buddhism in China",
		"asia 385": "Chan/Zen Buddhism",
		"asia 386": "Chinese Grammar 1",
		"asia 387": "Japanese Religions",
		"asia 396": "Chinese Grammar 2",
		"asia 398": "Narrative Literature of Premodern India",
		"asia 410": "International Relations of Premodern East Asia",
		"asia 411": "Chinese Political Thought & Institutions",
		"asia 451": "Modern Chinese Authors",
		"asia 453": "Japanese Travel Literature",
		"asia 456": "Taiwan History & Culture",
		"asia 457": "Modern Korean Novel",
		"asia 475": "Documenting Punjabi Canadians",
		"asia 488": "Religion, Science & State in Medieval India",
		"asia 498": "Museum Imagination",
		"asic 200": "Issues in Arts & Sciences",
		"asic 220": "Introduction to Sustainability",
		"astr 101": "Introduction to Astronomy I",
		"astr 102": "Introduction to Stars & Galaxies",
		"astr 200": "Astronomical Frontiers",
		"astr 205": "Stars & Stellar Populations",
		"astr 300": "Galaxies",
		"astr 310": "Exploring the Universe I",
		"astr 311": "Exploring the Universe II",
		"astr 333": "Exoplanets & Astrobiology",
		"astr 403": "Cosmology",
		"astr 404": "Astronomical & Astrophysical Measurements",
		"astr 405": "Astronomical Laboratory",
		"astr 406": "High Energy Astrophysics",
		"astr 407": "Planetary Science",
		"astr 449": "Directed Research",
		"astr 502": "Astrodynamics",
		"astr 514": "Observational Astronomy",
		"astu 201": "Canadian, Japanese & Pacific Cultures",
		"astu 202": "Canadian, Japanese & Pacific Politics",
		"astu 210": "Introduction to Global Citizenship",
		"astu 211": "Community Service Learning",
		"astu 360": "Community-Based Research",
		"atsc 201": "Meteorology of Storms",
		"atsc 212": "Introduction to Computing Lab",
		"atsc 404": "Dynamic Meteorology",
		"atsc 405": "Cloud Physics & Chemistry",
		"atsc 406": "Operational Meteorology",
		"atsc 409": "Numerical Techniques for the Ocean, Atmosphere, and Earth",
		"atsc 500": "Boundary-Layer Meteorology",
		"audi 402": "Neuroanatomy of Audiology and Speech-Language Pathology",
		"audi 403": "Introduction to Neurolinguistics",
		"audi 513": "Acoustic & Articulatory Phonetics",
		"audi 515": "Hearing Science II",
		"audi 516": "Discourse Analysis",
		"audi 518": "Fundamental Audiology",
		"audi 522": "Communication Disorders",
		"audi 524": "Disorders of Speech Production",
		"audi 526": "Acquired Language Disorders",
		"audi 527": "Introduction to Dysphagia",
		"audi 528": "Aural Rehabilitation I",
		"audi 551": "Hearing and Noise",
		"audi 552": "Diagnostic Audiology I",
		"audi 553": "Diagnostic Audiology II",
		"audi 556": "Amplification I",
		"audi 557": "Amplification II",
		"audi 558": "Physiological Measures of Auditory Function",
		"audi 562": "Pediatric Audiology",
		"audi 563": "Cochlear Implants",
		"audi 567": "Audiology Advanced Practice I",
		"audi 568": "Audiology Advanced Practice II",
		"audi 569": "Hearing & Aging",
		"audi 570": "Phonological Intervention",
		"audi 571": "Developmental Language Disorders",
		"audi 572": "Cognitive Processing & Auditory Language Disorders",
		"audi 575": "Language Development & Disorders in School",
		"audi 576": "Topics in Fluency Disorders",
		"audi 577": "Assessment in Speech and Swallowing Disorders",
		"audi 580": "Speech Perception & Hearing",
		"audi 581": "Professional and Socio-Academic Issues",
		"audi 583": "Advanced Speech Science",
		"audi 585": "Language Development across the Life Span",
		"audi 586": "Acquired Language Disorders II",
		"audi 593": "Speech-Language Pathology Practice I",
		"ba 504": "Foundations of Integrative and Personal Development",
		"ba 507": "Integrative Personal Development Global",
		"ba 511": "Community Business Project",
		"ba 513": "Business Economics",
		"ba 541": "Consulting & Strategic Management",
		"ba 560": "Ethics & Sustainability",
		"ba 561": "Global Issues & Macroeconomics",
		"ba 562": "Creativity",
		"ba 563": "Decision Making",
		"ba 564": "Leadership Development",
		"baac 500": "Financial Reporting",
		"baac 501": "Financial Statement Analysis I",
		"baac 505": "Fundamental Accounting",
		"baac 510": "Cost Analysis for Decision Making",
		"baac 511": "Accounting for Performance Evaluation",
		"baac 550": "Foundations of Accounting",
		"babs 502": "Forecasting for Management",
		"babs 540": "Data Analysis & Utilization",
		"babs 550": "Applied Statistics for Management",
		"baen 502": "Managing New Venture Growth",
		"baen 505": "Venture Capital Finance & Investment",
		"baen 506": "Technology Entrepreneurship I",
		"baen 510": "Intrapreneurship",
		"baen 541": "Innovation & Entrepreneurship",
		"baen 550": "Fundamentals of Entrepreneurship",
		"bafi 500": "Introduction to Finance",
		"bafi 502": "Advanced Corporate Finance",
		"bafi 503": "Topics in Corporate Finance",
		"bafi 507": "Mergers & Acquisitions",
		"bafi 511": "Investment Theory",
		"bafi 513": "Interest Rate Risk Management",
		"bafi 516": "Financial Engineering",
		"bafi 520": "Empirical Finance",
		"bafi 530": "International Financial Environment",
		"bafi 532": "International Financial Management",
		"bafi 541": "Principles of Finance",
		"bahr 505": "Leadership",
		"bahr 507": "Two Party Negotiations",
		"bahr 508": "Managing Change",
		"bahr 520": "Managing Employee Relations",
		"bahr 550": "Organizational Behaviour",
		"bait 510": "Project Management for Business Solutions",
		"bait 511": "Managing Information Technology",
		"bait 513": "Managing E-Business",
		"bait 527": "Business Intelligence Management",
		"bait 550": "Information Technology Management",
		"bala 503": "Commercial Law",
		"bama 503": "Product Management Strategies",
		"bama 504": "Integrated Marketing Communications",
		"bama 506": "Consumer Behaviour",
		"bama 508": "Marketing Research",
		"bama 513": "Internet Marketing",
		"bama 514": "Brand Management",
		"bama 515": "Services Management",
		"bama 541": "Product and Service Management",
		"bama 550": "Marketing",
		"bams 500": "Applied Management Science I",
		"bams 501": "Applied Management Science II",
		"bams 502": "Stochastic Processes",
		"bams 503": "Simulation for Decision Making",
		"bams 504": "Visual Simulation",
		"bams 506": "Optimization Modelling",
		"bams 508": "Applied Discrete Optimization",
		"bams 517": "Decision Analysis",
		"bams 521": "Consulting Practice I",
		"bams 522": "Consulting Practice II",
		"bams 523": "Managerial Decisions",
		"bams 550": "Operations & Logistics",
		"bapa 501": "Government & Business",
		"bapa 550": "Foundations of Managerial Economics",
		"basc 500": "Introduction to Logistics & Operations",
		"basc 523": "Supply Chain Management",
		"basc 524": "Supply Chain Analysis",
		"basc 550": "Operations & Logistics",
		"basm 501": "Business Strategy",
		"basm 502": "Corporate Strategy",
		"basm 523": "Consulting & Decision",
		"basm 530": "International Trading Environment",
		"basm 531": "Multinational Enterprise",
		"basm 550": "Strategic Management",
		"baul 501": "Real Estate Investment",
		"bioc 202": "Introductory Medical Biochemistry",
		"bioc 203": "Fundamentals of Biochemistry",
		"bioc 301": "Biochemistry Laboratory",
		"bioc 302": "General Biochemistry",
		"bioc 303": "Molecular Biochemistry",
		"bioc 304": "Contemporary Biochemistry Research",
		"bioc 402": "Proteins",
		"bioc 403": "Enzymology",
		"bioc 404": "Biochemistry Methods",
		"bioc 410": "Nucleic Acids",
		"bioc 420": "Advanced Biochemistry Techniques",
		"bioc 421": "Recombinant DNA Technology",
		"bioc 440": "Molecular Biology Concepts",
		"bioc 450": "Membrane Biochemistry",
		"bioc 460": "Advanced Techniques in Biochemistry",
		"bioc 509": "Membrane Structure & Function",
		"bioc 514": "Advanced Topics in Protein Chemistry",
		"bioc 521": "Advanced Topics in Molecular Biology",
		"bioc 530": "Seminar",
		"biof 520": "Probability-Based Learning in Biology",
		"biof 540": "Statistics for High Dimensional Biology",
		"biol 111": "Introduction to Modern Biology",
		"biol 112": "Biology of the Cell",
		"biol 121": "Genetics, Ecology & Evolution",
		"biol 140": "Laboratory Investigations in Life Science",
		"biol 153": "Human Biology",
		"biol 155": "Human Biology",
		"biol 200": "Fundamentals of Cell Biology",
		"biol 201": "Introduction to Biochemistry",
		"biol 203": "Eukaryotic Microbiology",
		"biol 204": "Vertebrate Structure & Function",
		"biol 205": "Comparative Invertebrates",
		"biol 209": "Non-Vascular Plants",
		"biol 210": "Vascular Plants",
		"biol 230": "Fundamentals of Ecology",
		"biol 233": "Genetics in Life",
		"biol 234": "Fundamentals of Genetics",
		"biol 260": "Fundamentals of Physiology",
		"biol 300": "Fundamentals of Biostatistics",
		"biol 301": "Biomathematics",
		"biol 306": "Advanced Ecology",
		"biol 310": "Animal Behaviour",
		"biol 317": "Weed Science",
		"biol 320": "Survey of Algae",
		"biol 321": "Bryophyta",
		"biol 323": "Structure & Reproduction of Fungi",
		"biol 324": "Introduction to Seed Plants",
		"biol 325": "Introduction to Animal Mechanics",
		"biol 326": "Biology of Invertebrates",
		"biol 327": "Introduction to Entomology",
		"biol 328": "Introduction to Parasitology",
		"biol 331": "Developmental Biology",
		"biol 335": "Molecular Genetics",
		"biol 336": "Evolutionary Biology",
		"biol 337": "Introduction to Genetics Laboratory",
		"biol 340": "Introduction to Cell Biology Laboratory",
		"biol 341": "Introduction to Molecular Biology Laboratory",
		"biol 342": "Integrated Biology Laboratory",
		"biol 343": "Plants & Peoples",
		"biol 344": "Human Heredity and Evolution",
		"biol 345": "Human Ecology",
		"biol 346": "Microbes & Society",
		"biol 347": "Principles & Methods of Research I",
		"biol 351": "Plant Physiology 1: Nutrition",
		"biol 352": "Plant Physiology 2: Development",
		"biol 361": "Physiology of Sensory, Nervous and Muscular Systems",
		"biol 362": "Cellular Physiology",
		"biol 363": "Laboratory in Animal Physiology",
		"biol 364": "Animal Physiology",
		"biol 404": "Ecological Methodology",
		"biol 406": "Plant Ecology I",
		"biol 411": "Insect Ecology",
		"biol 412": "Phytogeography",
		"biol 413": "Zoogeography",
		"biol 415": "Evolutionary Processes in Plants",
		"biol 416": "Principles of Conservation Biology",
		"biol 417": "Phylogenetic Biology",
		"biol 418": "Evolutionary Ecology",
		"biol 420": "Ocean Conservation & Sustainability",
		"biol 421": "Plant-Microbe Interactions",
		"biol 425": "Biomechanics",
		"biol 427": "Ornithology & Herpetology",
		"biol 428": "Evolution and Morphology of Marine Invertebrates",
		"biol 430": "Evolutionary Genetics",
		"biol 431": "Advanced Cell Biology",
		"biol 432": "Strategies & Techniques in Cell Biology",
		"biol 433": "Plant Genetics",
		"biol 434": "Population Genetics",
		"biol 436": "Integrative Functional Genomics",
		"biol 437": "Animal Cell Molecular Biology",
		"biol 438": "Zoological Physics",
		"biol 440": "Plant Genomics",
		"biol 441": "Animal Cell Biology",
		"biol 445": "Darwin's Fishes",
		"biol 446": "History & Philosophy of Biology",
		"biol 447": "Methods in Biological Research II",
		"biol 449": "Biology Research",
		"biol 450": "Molecular Adaptation in Animals",
		"biol 454": "Comparative Physiology",
		"biol 455": "Comparative Neurobiology",
		"biol 456": "Comparative Endocrinology",
		"biol 457": "Comparative Environmental Physiology",
		"biol 458": "Developmental Neurobiology",
		"biol 459": "Neurobiology of Sensory and Motor Systems",
		"biol 462": "Ecological Plant Biochemistry",
		"biol 463": "Gene Regulation in Development",
		"biol 464": "Animal Developmental Genetics",
		"biol 465": "Diversity and Evolution of Fishes",
		"biol 501": "Quantitative Methods in Ecology & Evolution",
		"biol 509": "Population & Quantitative Genetics",
		"biol 530": "Biology of the Cell",
		"biol 535": "Teaching Life Sciences",
		"bmeg 410": "Biomedical Physiology & Anatomy",
		"bmeg 456": "Clinical & Industrial Bioengineering",
		"bmeg 500": "Clinical Orientation",
		"bmeg 501": "Medical Technology Project",
		"bmeg 510": "Anatomy & Physiology",
		"bmeg 550": "Biomedical Engineering Technology",
		"bmeg 556": "Clinical & Industrial Biomedical Engineering",
		"bmeg 597": "Master of Engineering Project",
		"bmeg 599": "M.A.Sc. Thesis",
		"bota 501": "Seminar in Botany",
		"bota 526": "Advanced Plant Communities",
		"bota 528": "Topics in Plant Biochemistry",
		"bota 544": "Plant Molecular Laboratory",
		"busi 100": "Microeconomic Foundations of Real Estate Economics",
		"busi 101": "Capital Markets & Real Estate",
		"busi 111": "BC Law & Ethics",
		"busi 112": "Real Property Law & Ethics",
		"busi 121": "Foundations of Real Estate Mathematics",
		"busi 221": "Real Estate Finance in a Canadian Context",
		"busi 291": "Applied Statistics in Business",
		"busi 293": "Introduction to Financial Accounting",
		"busi 294": "Introduction to Management Accounting",
		"busi 300": "Urban and Real Estate Economics",
		"busi 329": "Organizational Behaviour",
		"busi 330": "Foundations of Real Estate Appraisal",
		"busi 331": "Real Estate Investment Analysis",
		"busi 335": "Information Systems",
		"busi 344": "Statistical & Computer Applications in Valuation",
		"busi 353": "Intermediate Financial Accounting I",
		"busi 354": "Cost Accounting",
		"busi 355": "Introduction to Income Tax",
		"busi 370": "Business Finance",
		"busi 393": "Introduction to Business Law",
		"busi 398": "Residential Property Study",
		"busi 400": "Residential Property Analysis",
		"busi 401": "Commercial Property Analysis",
		"busi 433": "Real Estate Business",
		"busi 441": "Real Estate Management I",
		"busi 442": "Case Studies in Appraisal I",
		"busi 443": "Assessment Administration",
		"busi 444": "Computer Aided Mass Property Assessment",
		"busi 445": "Real Estate Development I",
		"busi 446": "Real Estate Development II",
		"busi 450": "Intermediate Financial Accounting II",
		"busi 451": "Real Estate Management II",
		"busi 452": "Case Studies in Appraisal II",
		"busi 453": "Advanced Accounting",
		"busi 455": "Principles of Auditing",
		"busi 460": "Critical Analysis and Forecasting in Real Estate",
		"busi 465": "Marketing Management",
		"busi 470": "Financial Management",
		"busi 493": "Strategic Management in Business",
		"busi 499": "Income Property Study",
		"caps 200": "Biomedical Research Skills",
		"caps 301": "Human Physiology",
		"caps 303": "Honours Human Physiology",
		"caps 390": "Introduction to Microscopic Human Anatomy",
		"caps 391": "Introduction to Gross Human Anatomy",
		"caps 421": "Advanced Cellular & Molecular Physiology",
		"caps 422": "Cardiovascular & Respiratory Physiology",
		"caps 423": "Renal & Gastrointestinal Physiology",
		"caps 424": "Mammalian Endocrinology",
		"caps 426": "Advanced Neurophysiology",
		"caps 430": "Advanced Laboratory in Physiology",
		"caps 449": "Graduating Essay",
		"ccst 500": "Seminar in Ideologies of the Museum",
		"ccst 501": "Seminar in Contemporary Context",
		"ccst 502": "Case Studies in the Museum",
		"ccst 503": "Graduate Practicum",
		"ceen 501": "Thermal Energy Systems",
		"ceen 503": "Sustainable Energy Systems",
		"ceen 523": "Energy & Environment",
		"ceen 596": "Project & Report",
		"cell 501": "Cell & Developmental Biology Literature",
		"cell 502": "Topics in Developmental Biology",
		"cell 503": "Topics in Cell Communication",
		"cell 504": "Topics in Cytoskeleton & Cell Motility",
		"cell 505": "Topics in Intracellular Trafficking",
		"cell 506": "Fluorescence Microscopy",
		"cell 507": "Techniques in Cell & Developmental Biology",
		"cell 508": "Molecular Genetic Analysis",
		"cell 509": "Cell Systems Biology",
		"cell 510": "Molecular Embryology",
		"cell 511": "Mechanisms of Human Disease",
		"cell 512": "Gene & Cell Therapy",
		"cens 201": "Controversies and Conflicts",
		"cens 202": "Great Works of Literature",
		"cens 307": "Witches: Myth and Reality",
		"cens 404": "Gender & Nation",
		"chbe 201": "Technical Communication",
		"chbe 220": "Founding Principles in Chemical and Biological Engineering I",
		"chbe 230": "Computational Methods",
		"chbe 241": "Mass and Energy Balances",
		"chbe 243": "Introduction to Chemical & Biological Engineering",
		"chbe 244": "Chemical & Biological Thermodynamics",
		"chbe 251": "Transport Phenomena I",
		"chbe 262": "Chemical Engineering Applications Laboratory",
		"chbe 344": "Unit Operations I",
		"chbe 345": "Unit Operations II",
		"chbe 346": "Applied Thermodynamics II",
		"chbe 351": "Transport Phenomena II",
		"chbe 356": "Process Dynamics & Control",
		"chbe 362": "Chemical Engineering Laboratory II",
		"chbe 364": "Environmental Chemical Laboratory",
		"chbe 365": "Biotechnology Laboratory",
		"chbe 366": "Process & Environmental Engineering Laboratory",
		"chbe 373": "Water Pollution Control",
		"chbe 376": "Computational Flowsheeting & Fluids",
		"chbe 381": "Bioprocess Engineering I",
		"chbe 402": "Chemical Pulping Technology",
		"chbe 419": "Industrial Biotechnology Laboratory",
		"chbe 452": "Environmental Process Design Project",
		"chbe 453": "Biological Process and Product Design",
		"chbe 454": "Chemical Process and Product Design",
		"chbe 455": "Kinetics and Reactor Design",
		"chbe 456": "Chemical and Biological Engineering",
		"chbe 457": "Process Synthesis",
		"chbe 459": "Chemical Economics",
		"chbe 464": "Chemical Engineering Laboratory IV",
		"chbe 474": "Process Control Engineering",
		"chbe 477": "Fuel Cell and Electrochemical Engineering",
		"chbe 481": "Bioprocess Engineering II",
		"chbe 483": "Energy Engineering",
		"chbe 484": "Green Engineering Processes",
		"chbe 485": "Air Pollution Prevention & Control",
		"chbe 486": "Waste Management and Resource Recovery",
		"chbe 491": "Thesis Proposal",
		"chbe 492": "Thesis",
		"chbe 493": "Thesis Proposal - Environmental Topic",
		"chbe 494": "Thesis: Environmental Topic",
		"chbe 495": "Thesis Proposal: Biotechnology",
		"chbe 496": "Thesis: Biotechnology Topic",
		"chbe 551": "Thermodynamics",
		"chbe 553": "Mathematical Operations",
		"chbe 554": "Momentum, Heat and Mass Transfer",
		"chbe 560": "Biological Engineering",
		"chbe 561": "Particle Technology",
		"chbe 563": "Applied Heterogeneous Catalysis",
		"chbe 564": "Industrial Biotechnology Laboratory",
		"chbe 573": "Environmental Engineering & Sustainability",
		"chbe 575": "Air Pollution Control",
		"chbe 577": "Electrochemical Science and Engineering Topics",
		"chbe 583": "Energy Engineering",
		"chbe 597": "MASc Thesis Development",
		"chbe 599": "MASc Thesis",
		"chem 111": "Principles of Chemistry I",
		"chem 121": "Structure and Bonding in Chemistry",
		"chem 123": "Thermodynamics, Kinetics and Organic Chemistry",
		"chem 154": "Chemistry for Engineering",
		"chem 203": "Introductory Organic Chemistry",
		"chem 205": "Physical Chemistry",
		"chem 208": "Coordination Chemistry",
		"chem 211": "Analytical Chemistry",
		"chem 213": "Organic Chemistry",
		"chem 218": "Fundamental Reactions in Inorganic Chemistry",
		"chem 233": "Organic Chemistry for the Biological Sciences",
		"chem 235": "Organic Chemistry Laboratory",
		"chem 245": "Intermediate Synthetic Chemistry Laboratory",
		"chem 250": "Inorganic Chemistry",
		"chem 251": "Physical Chemistry for Engineers",
		"chem 260": "Organic Chemistry for Engineers",
		"chem 300": "Communicating Chemistry",
		"chem 301": "The Aqueous Environment",
		"chem 302": "The Atmospheric Environment",
		"chem 304": "Fundamental Physical Chemistry",
		"chem 305": "Biophysical Chemistry",
		"chem 309": "s- and p-Block Chemistry & Applications",
		"chem 310": "d- and f-Block Chemistry & Applications",
		"chem 311": "Instrumental Analytical Chemistry",
		"chem 312": "Introduction to Quantum Mechanics",
		"chem 313": "Advanced Organic for Life Sciences",
		"chem 315": "Chemistry Integrated Laboratory I",
		"chem 325": "Integrated Chemistry Laboratory I",
		"chem 330": "Advanced Organic Chemistry",
		"chem 333": "Spectroscopic Techniques in Organic Chemistry",
		"chem 335": "Chemistry Integrated Laboratory 2",
		"chem 341": "Global Challenges",
		"chem 345": "Integrated Chemistry Laboratory 2",
		"chem 401": "Principles of Spectroscopy",
		"chem 402": "Diffraction Methods",
		"chem 403": "Surface Chemistry & Analysis",
		"chem 405": "Biophysical Chemistry",
		"chem 406": "Polymer Chemistry",
		"chem 407": "Statistical Mechanics in Chemistry",
		"chem 410": "Solid State Chemistry",
		"chem 411": "Synthesis & Chemistry of Natural Products",
		"chem 412": "Atoms & Molecules",
		"chem 413": "Bioorganic Chemistry",
		"chem 416": "Physical & Theoretical Organic Chemistry",
		"chem 417": "Nuclear Chemistry and Radiochemistry",
		"chem 418": "Organometallic Chemistry",
		"chem 427": "Chemistry of Materials",
		"chem 435": "Bio-Inorganic Chemistry",
		"chem 449": "Seminar & Thesis",
		"chem 460": "Organic Synthesis: A Mechanistic Approach",
		"chem 501": "Quantum Mechanics in Chemistry",
		"chem 502": "Advanced Physical Chemistry",
		"chem 503": "Statistical Mechanics in Chemistry",
		"chem 514": "Crystal Structure",
		"chem 524": "Organometallic Compounds",
		"chem 526": "Bioinorganic Chemistry",
		"chem 527": "Materials Chemistry",
		"chem 529": "Structural Methods in Inorganic Chemistry",
		"chem 533": "Bioanalytical Chemistry",
		"chem 534": "Principles of Chemical Separations",
		"chem 563": "Physical Organic Chemistry",
		"chem 566": "Organic Synthesis",
		"chem 569": "Advanced Bioorganic Chemistry",
		"chem 573": "Organic Structure Problems",
		"chil 599": "Children's Literature",
		"chin 101": "Basic Chinese I, Part 1",
		"chin 103": "Basic Chinese I, Part 2",
		"chin 104": "Intensive Basic Chinese I",
		"chin 105": "Basic Chinese II, Part 1",
		"chin 107": "Basic Chinese II, Part 2",
		"chin 108": "Intensive Basic Chinese II",
		"chin 111": "Basic Chinese I, Part 1",
		"chin 113": "Basic Chinese I, Part 2",
		"chin 115": "Basic Chinese II, Part 1",
		"chin 117": "Basic Chinese II, Part 2",
		"chin 201": "Intermediate Chinese I, Part 1",
		"chin 203": "Intermediate Chinese I, Part 2",
		"chin 204": "Intermediate Chinese I",
		"chin 205": "Intermediate Chinese II, Part 1",
		"chin 207": "Intermediate Chinese II, Part 2",
		"chin 208": "Intermediate Chinese II",
		"chin 211": "Intermediate Chinese I, Part 1",
		"chin 213": "Intermediate Chinese I, Part 2",
		"chin 214": "Intermediate Chinese I",
		"chin 215": "Intermediate Chinese II, Part 1",
		"chin 217": "Intermediate Chinese II, Part 2",
		"chin 218": "Intermediate Chinese II",
		"chin 301": "Advanced Chinese Reading & Writing I",
		"chin 303": "Advanced Chinese Reading & Writing II",
		"chin 305": "Chinese Speaking & Writing I",
		"chin 307": "Advanced Chinese Speaking & Writing II",
		"chin 311": "Advanced Chinese Reading & Writing I",
		"chin 313": "Advanced Chinese Reading & Writing II",
		"chin 315": "Chinese Speaking & Writing I",
		"chin 317": "Advanced Chinese Speaking & Writing II",
		"chin 321": "Business Chinese I",
		"chin 323": "Business Chinese II",
		"chin 411": "Intermediate Modern Chinese Literature 1",
		"chin 413": "Intermediate Modern Chinese Literature 2",
		"chin 431": "Classical Chinese: Early",
		"chin 433": "Classical Chinese: Later",
		"chin 461": "Classical Poetry: Han",
		"chin 463": "Classical Poetry: Tang",
		"chin 471": "Classical Poetry: Tang",
		"chin 473": "Late Classical Poetry",
		"chin 481": "Modern Chinese Literature 1",
		"chin 483": "Modern Chinese Literature 2",
		"chin 484": "Introduction to Modern Chinese Literary History",
		"cics 520": "Database Systems",
		"cics 530": "Advanced Software Project",
		"civl 200": "Engineering & Sustainable Development",
		"civl 201": "Civil Engineering I",
		"civl 202": "Civil Engineering II",
		"civl 210": "Soil Mechanics I",
		"civl 215": "Fluid Mechanics I",
		"civl 228": "Introduction to Structural Engineering",
		"civl 230": "Solid Mechanics I",
		"civl 231": "Solid Mechanics II",
		"civl 300": "Construction Engineering & Management",
		"civl 301": "Optimization & Decision Analysis in Civil Engineering",
		"civl 304": "Introduction to Environmental Engineering",
		"civl 305": "Environmental Impact Studies",
		"civl 311": "Soil Mechanics II",
		"civl 315": "Fluid Mechanics II",
		"civl 316": "Open Channel Hydraulics",
		"civl 320": "Civil Engineering Materials",
		"civl 331": "Steel & Timber Design",
		"civl 332": "Structural Analysis",
		"civl 340": "Transportation Engineering I",
		"civl 402": "Law & Contracts",
		"civl 403": "Engineering Economic Analysis",
		"civl 404": "Introduction to Solid Waste",
		"civl 406": "Water Treatment & Waste Management",
		"civl 407": "Environmental Laboratory Analysis",
		"civl 408": "Geo-Environmental Engineering",
		"civl 409": "Design of Water Supply & Wastewater Systems",
		"civl 410": "Foundation Engineering I",
		"civl 411": "Foundation Engineering II",
		"civl 413": "Earth Dams",
		"civl 415": "Water Resources Engineering",
		"civl 416": "Environmental Hydraulics",
		"civl 417": "Coastal Engineering",
		"civl 418": "Engineering Hydrology",
		"civl 420": "Concrete Technology",
		"civl 422": "Properties of Civil Engineering Materials",
		"civl 426": "Virtual Design & Construction",
		"civl 430": "Design of Concrete Structures",
		"civl 432": "Advanced Steel Design",
		"civl 433": "Advanced Concrete Design",
		"civl 435": "Advanced Structural Analysis",
		"civl 436": "Matrix Structural Analysis",
		"civl 437": "Introduction to Ship Structures",
		"civl 439": "Design of Timber Structures",
		"civl 440": "Transportation Engineering 2",
		"civl 441": "Transportation Systems Planning & Analysis",
		"civl 445": "Engineering Design & Analysis 1",
		"civl 446": "Design & Analysis 2",
		"civl 447": "Environmental Engineering Design",
		"civl 478": "Building Science",
		"civl 493": "Construction Methods",
		"civl 504": "Seismic & Seismic Design Parameters",
		"civl 505": "Seismic Response of Structures",
		"civl 507": "Dynamics of Structures 1",
		"civl 508": "Dynamics of Structures 2",
		"civl 509": "Nonlinear Structural Analysis",
		"civl 511": "Advanced Topics in Steel Structures",
		"civl 513": "Concrete Structures",
		"civl 516": "Behaviour of Timber Structures",
		"civl 517": "Advanced Topics in Timber Structures",
		"civl 518": "Reliability & Structural Safety",
		"civl 520": "Construction Planning and Control",
		"civl 521": "Construction Methods & Performance",
		"civl 522": "Project & Construction Economics",
		"civl 523": "Project Management in Engineering",
		"civl 524": "Legal Aspects of Construction Management",
		"civl 526": "Visual Design & Construction",
		"civl 529": "Infrastructure Assessment & Rehabilitation",
		"civl 537": "Computational Mechanics I",
		"civl 538": "Computational Mechanics II",
		"civl 540": "Advanced Coastal Engineering",
		"civl 555": "Optimization of Engineering Systems",
		"civl 556": "Modelling & Optimization",
		"civl 561": "Risk Management of Chemicals",
		"civl 562": "Environmental Contaminant Analysis",
		"civl 564": "Management of Solid Waste",
		"civl 565": "Physical-Chemical Treatment Processes",
		"civl 566": "Sources & Fate of Pollutants in Aquatic Systems",
		"civl 569": "Biological Wastewater Treatment",
		"civl 570": "Advanced Soil Mechanics",
		"civl 574": "Experimental Soil Mechanics",
		"civl 581": "Soil Dynamics and Design",
		"civl 582": "Transportation Engineering Impacts",
		"civl 583": "Urban Engineering Methods & Models",
		"civl 586": "Urban Transportation Systems",
		"clch 389": "Classical Chinese 1 (Non-Heritage)",
		"clch 399": "Classical Chinese 2 (Non-Heritage)",
		"clch 401": "Advanced Reading in Classical Chinese",
		"clst 105": "Greek & Roman Mythology",
		"clst 110": "Power & the Arts in Athens",
		"clst 111": "Power & the Arts in Imperial Rome",
		"clst 204": "Introduction to Classical Archaeology",
		"clst 211": "Greek Philosophy I",
		"clst 212": "Greek Philosophy II",
		"clst 231": "Ancient Greece",
		"clst 232": "Ancient Rome",
		"clst 260": "Greek and Roman Games",
		"clst 301": "Technical Terms in Medicine",
		"clst 307": "Greek Law",
		"clst 311": "Women in the Bronze Age",
		"clst 312": "Women in Roman Society",
		"clst 317": "Classical Tragedy",
		"clst 318": "Classical Comedy",
		"clst 319": "The Roman Army",
		"clst 320": "Slavery in Ancient Greece and Rome",
		"clst 331": "Ancient History",
		"clst 332": "Roman Art & Architecture",
		"clst 333": "Greek Religion",
		"clst 334": "Roman Religion",
		"clst 353": "Early Roman Empire",
		"clst 355": "Athens & Empire",
		"clst 356": "Alexander & Empire",
		"clst 502": "Topography & Monuments of Rome",
		"cnps 362": "Basic Interviewing Skills",
		"cnps 363": "Career Counselling",
		"cnps 364": "Family Education & Consultation",
		"cnps 365": "Introduction to Theories of Counselling",
		"cnps 426": "Role of the Teacher in Guidance",
		"cnps 427": "Guidance in Planning and Decision Making",
		"cnps 433": "Personal and Social Development of Adults",
		"cnps 504": "School Counselling",
		"cnps 514": "Counselling Adolescents",
		"cnps 524": "Counselling Adults",
		"cnps 535": "Adult Psychopathology",
		"cnps 545": "Family Counselling II",
		"cnps 564": "Group Counselling",
		"cnps 574": "Career Planning",
		"cnps 579": "Research in Counselling Psychology",
		"cnps 584": "Program Development in Counselling",
		"cnps 586": "Counselling Psychology",
		"cnps 594": "Cross-Cultural Counselling",
		"cnps 632": "Counselling Psychology",
		"cnrs 370": "Theories of Myth",
		"cnrs 449": "Honours Essay",
		"cnrs 500": "Seminar in Mediterranean Studies",
		"cnto 301": "Basic Cantonese 1",
		"cnto 303": "Basic Cantonese 2",
		"coec 126": "Data Description and Display",
		"coec 293": "Financial Accounting",
		"coec 298": "Introduction to Finance",
		"coec 371": "Investment Theory",
		"coec 394": "Government & Business",
		"cogs 200": "Introduction to Cognitive Systems",
		"cogs 300": "Designing Cognitive Systems",
		"cogs 303": "Research Methods in Cognitive Systems",
		"cogs 401": "Seminar in Cognitive Systems",
		"cogs 402": "Research in Cognitive Systems",
		"cohr 301": "Business & Management Values",
		"cohr 303": "Recruitment & Selection",
		"cohr 304": "Training & Development",
		"cohr 305": "Compensation",
		"cohr 307": "Introduction to Organizational Consulting",
		"cohr 401": "Organizational Change",
		"cohr 402": "Leadership",
		"cohr 404": "Power & Politics",
		"cohr 405": "Managing Family Business",
		"cohr 408": "Organizational Design",
		"cohr 411": "Managing & Building Teams",
		"cohr 433": "Employment Law",
		"comm 100": "Introduction to Business",
		"comm 101": "Business Fundamentals",
		"comm 120": "Business Immersion",
		"comm 202": "Career Fundamentals",
		"comm 203": "Employment Relations",
		"comm 204": "Logistics & Operations Management",
		"comm 205": "Introduction to Management Information Systems",
		"comm 280": "Entrepreneurship",
		"comm 290": "Introduction to Quantitative Decision Making",
		"comm 291": "Applied Statistics in Business",
		"comm 292": "Management & Organizational Behaviour",
		"comm 293": "Financial Accounting",
		"comm 294": "Managerial Accounting",
		"comm 295": "Managerial Economics",
		"comm 296": "Introduction to Marketing",
		"comm 298": "Introduction to Finance",
		"comm 306": "Urban Land Economics",
		"comm 307": "Real Estate Investment",
		"comm 311": "Research Theory",
		"comm 320": "Financial Accounting",
		"comm 321": "Organizational Behaviour",
		"comm 329": "Organizational Behaviour",
		"comm 335": "Information Systems Management",
		"comm 336": "Introduction to E-Business",
		"comm 353": "Financial Accounting-Intermediate I",
		"comm 354": "Cost Accounting",
		"comm 355": "Income Tax",
		"comm 362": "Buyer Behaviour",
		"comm 363": "Marketing Analysis",
		"comm 365": "Market Research",
		"comm 370": "Corporate Finance",
		"comm 371": "Investment Theory",
		"comm 374": "Applied Financial Markets",
		"comm 377": "International Financial Markets / Institutions",
		"comm 382": "Economics of Entrepreneurship & Innovation",
		"comm 387": "Entrepreneurial Finance",
		"comm 388": "Design of Statistical Practice",
		"comm 389": "Creativity in Business",
		"comm 390": "Business Writing",
		"comm 393": "Commercial Law",
		"comm 394": "Government & Business",
		"comm 395": "Business Communications",
		"comm 398": "Business Process & Operations",
		"comm 405": "Real Estate Finance",
		"comm 407": "Real Estate Economics",
		"comm 408": "Real Estate Development",
		"comm 412": "Negotiation",
		"comm 415": "Quantitative Policy Analysis",
		"comm 431": "Law of Business Associations",
		"comm 434": "Land Law",
		"comm 436": "Information Systems Analysis & Design",
		"comm 437": "Database Technology",
		"comm 438": "Information Systems Management",
		"comm 439": "Business Telecommunications",
		"comm 441": "Advanced Business Logistics",
		"comm 444": "Air Transport",
		"comm 445": "Shipping & International Logistics",
		"comm 446": "Transportation Economics",
		"comm 447": "Project Appraisal & Management",
		"comm 449": "Supply-Chain Management",
		"comm 450": "Financial Accounting-Intermediate II",
		"comm 452": "Income & Taxes",
		"comm 453": "Financial Accounting Advanced",
		"comm 454": "Accounting Management Control & Incentives",
		"comm 455": "Principles of Auditing",
		"comm 457": "Fundamentals of Financial Accounting",
		"comm 458": "Fundamentals of Managerial Accounting",
		"comm 459": "Financial Statement Analysis",
		"comm 460": "Social & Nonprofit Marketing",
		"comm 461": "Sales Management",
		"comm 462": "Integrated Marketing Communications",
		"comm 464": "E-Marketing",
		"comm 465": "Marketing Management",
		"comm 466": "New Venture Design",
		"comm 467": "Brand Management",
		"comm 468": "Marketing Applications",
		"comm 469": "International Marketing",
		"comm 471": "Financial Management",
		"comm 473": "Business Finance",
		"comm 474": "Fixed Income Markets",
		"comm 475": "Investment Policy",
		"comm 477": "Risk Management & Financial Engineering",
		"comm 482": "New Product Development",
		"comm 487": "Environmental Management",
		"comm 491": "Strategic Management",
		"comm 493": "Strategic Management in Business",
		"comm 495": "Business & Sustainable Development",
		"comm 497": "New Enterprise Development",
		"comm 498": "International Business Management",
		"comm 525": "Introduction to Organizational Research Methods",
		"comm 581": "Statistical Methodology I",
		"comm 634": "Empirical Research Methods",
		"comm 657": "Empirical Accounting Research",
		"comm 660": "Seminar in Marketing",
		"comm 662": "Buyer Behaviour",
		"comm 671": "Theory of Finance",
		"comm 672": "Advanced Topics in Theoretical Corporate Finance",
		"comm 693": "Research Methods 1",
		"comm 695": "Advanced Topics in Empirical Corporate Finance",
		"cons 101": "Introduction to Conservation",
		"cons 127": "Observing Earth",
		"cons 200": "Foundations of Conservation",
		"cons 210": "Visualizing Climate Change",
		"cons 302": "Genomics & the Environment",
		"cons 330": "Conservation Science & Sustainability",
		"cons 340": "Introduction to GIS for Forestry & Conservation",
		"cons 370": "Aboriginal Forestry",
		"cons 425": "Sustainable Energy",
		"cons 451": "Integrated Field School",
		"cons 452": "Global Perspectives Capstone",
		"cons 481": "Conservation Planning & Recreation",
		"cons 486": "Fisheries Conservation / Management",
		"cons 495": "Problem Wildlife",
		"cons 498": "Thesis or Special Project",
		"cpen 211": "Introduction to Microcomputers",
		"cpen 221": "Principles of Software Construction",
		"cpen 281": "Technical Communication",
		"cpen 311": "Digital Systems Design",
		"cpen 312": "Digital Systems & Microcomputers",
		"cpen 321": "Software Engineering",
		"cpen 331": "Operating Systems",
		"cpen 333": "System Software Engineering",
		"cpen 391": "Computer Systems Design Studio",
		"cpen 411": "Computer Architecture",
		"cpen 412": "Microcomputer Systems Design",
		"cpen 421": "Software Project Management",
		"cpen 422": "Software Testing & Analysis",
		"cpen 431": "Distributed Software Applications",
		"cpen 442": "Computer Security",
		"cpen 481": "Economic Analysis of Projects",
		"cpen 491": "Capstone Design Project",
		"cpen 492": "Software Engineering Project",
		"cpsc 110": "Computation, Programs, and Programming",
		"cpsc 121": "Models of Computation",
		"cpsc 210": "Software Construction",
		"cpsc 213": "Introduction to Computer Systems",
		"cpsc 221": "Basic Algorithms and Data Structures",
		"cpsc 259": "Data Structures & Algorithms for Electrical Engineering",
		"cpsc 261": "Basics of Computer Systems",
		"cpsc 301": "Computing in the Life Sciences",
		"cpsc 302": "Numerical Computation for Algebraic Problems",
		"cpsc 303": "Numerical Approximation & Discretization",
		"cpsc 304": "Introduction to Relational Databases",
		"cpsc 310": "Introduction to Software Engineering",
		"cpsc 311": "Programming Languages",
		"cpsc 312": "Functional and Logic Programming",
		"cpsc 313": "Computer Hardware and Operating Systems",
		"cpsc 314": "Computer Graphics",
		"cpsc 317": "Introduction to Computer Networking",
		"cpsc 319": "Software Engineering Project",
		"cpsc 320": "Intermediate Algorithm Design and Analysis",
		"cpsc 322": "Introduction to Artificial Intelligence",
		"cpsc 340": "Machine Learning and Data Mining",
		"cpsc 344": "Human-Computer Interaction",
		"cpsc 404": "Advanced Relational Databases",
		"cpsc 410": "Advanced Software Engineering",
		"cpsc 411": "Compiler Construction",
		"cpsc 415": "Advanced Operating Systems",
		"cpsc 416": "Distributed Systems",
		"cpsc 418": "Parallel Computation",
		"cpsc 420": "Advanced Algorithm Design & Analysis",
		"cpsc 421": "Theory of Computing",
		"cpsc 422": "Intelligent Systems",
		"cpsc 425": "Computer Vision",
		"cpsc 430": "Computers & Society",
		"cpsc 444": "Human-Computer Interaction",
		"cpsc 445": "Algorithms in Bioinformatics",
		"cpsc 449": "Honours Thesis",
		"cpsc 490": "Student Seminar",
		"cpsc 500": "Fundamentals of Algorithm Design & Analysis",
		"cpsc 501": "Theory of Automata",
		"cpsc 502": "Artificial Intelligence I",
		"cpsc 503": "Computational Linguistics I",
		"cpsc 507": "Software Engineering",
		"cpsc 509": "Programming Language Principles",
		"cpsc 513": "Integrated Systems Design",
		"cpsc 515": "Computational Robotics",
		"cpsc 521": "Parallel Algorithms & Architectures",
		"cpsc 522": "Artificial Intelligence II",
		"cpsc 527": "Computer Communication Protocols",
		"cpsc 540": "Machine Learning",
		"cpsc 543": "Physical User Interfaces",
		"cpsc 544": "Human-Computer Interaction",
		"cpsc 547": "Information Visualization",
		"cpsc 589": "M.Sc. Major Essay",
		"crwr 200": "Introduction to Creative Writing",
		"crwr 201": "Introduction to Writing Poetry",
		"crwr 203": "Children & Young Adult",
		"crwr 205": "Introduction to Creative Nonfiction",
		"crwr 206": "Introduction to Screenplay I",
		"crwr 208": "Introduction to Graphic Forms",
		"crwr 209": "Introduction to Writing Fiction",
		"crwr 213": "Introduction to Writing for New Media",
		"crwr 230": "Introduction to Writing Comedic Forms",
		"crwr 430": "Preparing for the Writing Career",
		"crwr 530": "Preparing for the Writing Career",
		"crwr 599": "Thesis",
		"dani 100": "Elementary Danish 1",
		"dani 110": "Elementary Danish 2",
		"dani 200": "Intermediate Danish 1",
		"dani 210": "Intermediate Danish 2",
		"dent 410": "Dentistry I",
		"dent 420": "Dentistry II",
		"dent 430": "Dentistry III",
		"dent 440": "Dentistry IV",
		"dent 504": "Endodontic Micro-Surgery",
		"dent 505": "Dental Traumatology",
		"dent 513": "Pediatric Patient I",
		"dent 516": "Pediatric Case Review I",
		"dent 517": "Pediatric Case Review II",
		"dent 524": "Craniofacial Growth & Development",
		"dent 525": "Prosthodontic Literature Review I",
		"dent 526": "Prosthodontic Literature Review II",
		"dent 527": "Prosthodontic Planning & Outcomes I",
		"dent 528": "Prosthodontic Planning & Outcomes II",
		"dent 529": "Prosthodontic Planning & Outcomes III",
		"dent 530": "Maxillofacial Prosthodontics",
		"dent 531": "Biomaterials",
		"dent 532": "Prosthodontics I",
		"dent 533": "Prosthodontics II",
		"dent 539": "Statistical Methods",
		"dent 540": "Research Methods & Seminar in Oral Biology",
		"dent 542": "Oral Cell Biology",
		"dent 543": "Advanced Occlusion & Articulation",
		"dent 544": "Advanced Topics in Oral Microbiology",
		"dent 555": "Oral Pathology",
		"dent 565": "Biomechanics of the Craniofacial Complex I",
		"dent 566": "Biomechanics of the Craniofacial Complex II",
		"dent 567": "Orthodontics & Craniofacial I",
		"dent 568": "Orthodontics & Craniofacial II",
		"dent 569": "Orthodontics & Craniofacial III",
		"dent 570": "Periodontal Case Management",
		"dent 572": "Literature Review in Periodontics I",
		"dent 573": "Literature Review in Periodontics II",
		"dent 574": "Periodontal Treatment Planning Seminar",
		"dent 575": "Implant Therapy",
		"dent 578": "Endodontic Literature Review I",
		"dent 584": "Endodontic Literature Review II",
		"dent 591": "Endodontic Case Management I",
		"dent 592": "Endodontic Case Management II",
		"dent 594": "Endodontic Treatment Planning I",
		"dent 595": "Endodontic Treatment Planning II",
		"dent 596": "Endodontic Treatment Planning III",
		"dent 599": "M.Sc. Thesis",
		"dent 721": "Clinical Endodontics Year 1",
		"dent 722": "Clinical Endodontics Year 2",
		"dent 724": "Clinical Endodontics Year 3",
		"dhyg 106": "Oral Microbiology",
		"dhyg 108": "Oral Health Sciences I",
		"dhyg 110": "Dental Hygiene Theory & Practice",
		"dhyg 206": "Head & Neck Anatomy",
		"dhyg 208": "Oral Health Sciences II",
		"dhyg 210": "Dental Hygiene Theory & Practice II",
		"dhyg 310": "Dental Hygiene Theory & Practice III",
		"dhyg 325": "Applied Pharmacology",
		"dhyg 400": "Current Issues in Oral Health",
		"dhyg 401": "Oral Epidemiology",
		"dhyg 402": "Dental Hygiene Practice I",
		"dhyg 405": "Oral Microbiology & Immunology",
		"dhyg 410": "Dental Hygiene Theory & Practice IV",
		"dhyg 412": "Trends & Topics",
		"dhyg 433": "Advanced Periodontics",
		"dhyg 435": "Oral Medicine & Pathology",
		"dhyg 461": "Literature Review I",
		"dhyg 462": "Literature Review II",
		"eced 400": "Introduction to Early Childhood Education & Care",
		"eced 401": "Supporting Young Children & Wellbeing in Early Childhood Education",
		"eced 406": "Early Curriculum in Preschool",
		"eced 416": "Kindergarten Curriculum",
		"eced 421": "Home/School/Community",
		"eced 438": "Observing & Documenting Early Childhood",
		"eced 439": "Assessment of Special Needs",
		"eced 440": "Supporting Communication for Special Needs",
		"eced 441": "Intervention with Children",
		"eced 442": "Supporting Indigenous Infants",
		"econ 101": "Principles of Microeconomics",
		"econ 102": "Principles of Macroeconomics",
		"econ 210": "Microeconomic Policy",
		"econ 211": "Macroeconomic Policy",
		"econ 221": "Introduction to Strategic Thinking",
		"econ 226": "Economic Data",
		"econ 234": "Wealth and Poverty of Nations",
		"econ 255": "Understanding Globalization",
		"econ 301": "Intermediate Microeconomic Analysis I",
		"econ 302": "Intermediate Macroeconomic Analysis",
		"econ 303": "Intermediate Microeconomics II",
		"econ 304": "Honours Intermediate Microeconomics",
		"econ 305": "Honours Intermediate Macroeconomics",
		"econ 306": "Intermediate Microeconomics II",
		"econ 307": "Macroeconomic Analysis II",
		"econ 308": "Intermediate Microeconomics",
		"econ 309": "Open Economy Macroeconomics",
		"econ 310": "Microeconomics",
		"econ 311": "Macroeconomics",
		"econ 317": "Poverty & Inequality",
		"econ 318": "History & Philosophy of Economics",
		"econ 319": "History & Philosophy of Economics",
		"econ 325": "Empirical Economics",
		"econ 326": "Methods of Empirical Research",
		"econ 327": "Introduction to Empirical Methods",
		"econ 328": "Methods of Empirical Research",
		"econ 334": "Economic History of Modern Europe",
		"econ 335": "Fertility, Family, and Human Migration",
		"econ 336": "Economic History of Canada",
		"econ 337": "Economic History of the United States",
		"econ 339": "Economics of Technological Changes",
		"econ 345": "Money & Banking",
		"econ 350": "Topics in Public Finance",
		"econ 351": "Women in the Economy",
		"econ 355": "Introduction to International Trade",
		"econ 356": "Introduction to International Finance",
		"econ 365": "Topics in Canadian Industry",
		"econ 367": "Economic Analysis of Law",
		"econ 370": "Benefit-Cost Analysis & Project Evaluation",
		"econ 371": "Economics of the Environment",
		"econ 374": "Land Economics",
		"econ 390": "Introduction to Economic Research",
		"econ 406": "Topics in Microeconomics",
		"econ 407": "Topics in Macroeconomics",
		"econ 421": "Introduction to Game Theory and Applications",
		"econ 425": "Econometrics",
		"econ 441": "Process of Economic Development",
		"econ 442": "Advanced Microeconomic Analysis",
		"econ 447": "Monetary Theory",
		"econ 451": "Public Expenditures",
		"econ 455": "International Trade",
		"econ 456": "International Macroeconomics & Finance",
		"econ 457": "International Relations",
		"econ 460": "Labour Markets",
		"econ 465": "Market Structure",
		"econ 466": "Economics of Government Regulation of Business",
		"econ 471": "Nonrenewable Resources",
		"econ 472": "Renewable Resources",
		"econ 480": "Transportation",
		"econ 482": "Consequences of Religion",
		"econ 490": "Applied Economics",
		"econ 495": "Honours Seminar",
		"econ 499": "Honours Essay",
		"econ 500": "Microeconomics",
		"econ 502": "Macroeconomics",
		"econ 514": "Information & Incentives",
		"econ 516": "Special Topics in Macroeconomics",
		"econ 523": "Behavioural Economics",
		"econ 526": "Mathematics for Economics",
		"econ 527": "Econometric Methods",
		"econ 531": "History of Modern Europe",
		"econ 541": "Economic Development I",
		"econ 544": "Political Economy & Business",
		"econ 546": "Monetary Theory and Policy",
		"econ 550": "Government Expenditures",
		"econ 556": "International Finance",
		"econ 557": "Empirical Topics in International Economics",
		"econ 560": "Labour Economics",
		"econ 561": "Industrial Relations",
		"econ 562": "Research Design & Policy Evaluation",
		"econ 565": "Market Structure",
		"econ 566": "Business Performance",
		"econ 567": "Organization Theory & Non-Allocation",
		"econ 573": "Environmental Economics",
		"econ 580": "Social & Economic Measurement",
		"econ 600": "Microeconomics I",
		"econ 601": "Microeconomics II",
		"econ 602": "Macroeconomics I",
		"econ 603": "Macroeconomics II",
		"econ 626": "Economic Theory I",
		"econ 627": "Economic Theory II",
		"econ 628": "Topics in Applied Economics I",
		"econ 640": "PhD Research Seminar",
		"edcp 210": "Music Education",
		"edcp 303": "Ceramics: Art Education",
		"edcp 304": "Textiles: Art Education",
		"edcp 305": "Digital Media: Introduction",
		"edcp 343": "Mathematics Problem Solving",
		"edcp 377": "Design Studies Technology II Secondary Curriculum & Pedagogy",
		"edcp 410": "Music & Movement Elementary Curriculum & Pedagogy",
		"edcp 473": "ICT in Education Ethics",
		"edcp 491": "Home Economics II Secondary Curriculum & Pedagogy",
		"edcp 492": "Home Economics: Textiles",
		"edcp 498": "Curriculum Inquiry in Home Economics",
		"edcp 508": "Review of Research in Curriculum & Pedagogy",
		"edcp 510": "Video Ethnography in Educational Research",
		"edcp 513": "Case Research & Analysis",
		"edcp 530": "Curriculum Innovation in Physical Education",
		"edcp 537": "Foundations of Home Economics Education",
		"edcp 539": "Narrativity",
		"edcp 551": "Mathematics Education: Current Issues",
		"edcp 553": "Mathematics Education: Beyond Early Years",
		"edcp 555": "Critical Analysis of Science Education",
		"edcp 556": "Theory & Research in Social Contexts",
		"edcp 559": "Research on Teaching & Learning Science",
		"edcp 562": "Curriculum Issues & Theory",
		"edcp 564": "Text, Policy & Identity in Curriculum Development",
		"edcp 566": "Curriculum Change & Implementation",
		"edcp 568": "Curriculum in Historical Context",
		"edst 501": "Research Traditions in Educational Administration",
		"edst 503": "Traditions in Adult Education",
		"edst 505": "First Nations & Educational Change",
		"edst 509": "Canadian Education in the Past",
		"edst 511": "Organization & Administration of Higher Education",
		"edst 514": "Adult Education Programs",
		"edst 515": "Survey Research Methods",
		"edst 518": "Theory and Reality in Adult Learning",
		"edst 520": "Adult Education Practice",
		"edst 521": "Foundations of Higher Education",
		"edst 527": "Higher Education Policy",
		"edst 532": "Leadership in Educational Organizations",
		"edst 535": "International Adult Education",
		"edst 541": "Adult Learning in Contemporary Perspectives",
		"edst 543": "Understanding Research",
		"edst 544": "Global/Local Learning",
		"edst 548": "Teacher Unions and Education",
		"edst 570": "Topics in the Sociology of Education",
		"edst 571": "Questions, Theories, Methods",
		"edst 575": "Work & Learning",
		"edst 577": "Contexts of Educational Policy",
		"edst 581": "Leadership and Administration in the Aims of Education",
		"edst 582": "Study of Educational Organizations",
		"edst 588": "Environmental Philosophy & Education",
		"edst 597": "Theories of Education",
		"educ 140": "Introduction to First Nations",
		"educ 172": "Language & Curriculum",
		"educ 210": "Introduction to Global Citizenship",
		"educ 211": "Community Service Learning",
		"educ 240": "Issues in First Nations",
		"educ 272": "Teaching Chemistry",
		"educ 275": "Global Education",
		"educ 276": "Teaching Mathematics 2",
		"educ 278": "Teaching Biology",
		"educ 500": "Research Methods in Education",
		"educ 504": "Education",
		"eece 509": "Advanced Microsystems Design",
		"eece 512": "Computer Security",
		"eece 513": "Error Resilient Systems",
		"eece 514": "Software Verification & Testing",
		"eece 518": "Human Interface Technology",
		"eece 527": "Advanced Computer Architecture",
		"eece 528": "Parallel & Reconfigurable Computing",
		"eece 531": "Nanoscale Modeling & Simulation",
		"eece 532": "Biomedical Microdevices",
		"eece 534": "Green Nanoelectronic Devices",
		"eece 535": "Advanced Biophotonics",
		"eece 541": "Multimedia Systems",
		"eece 544": "Medical Imaging",
		"eece 549": "Dynamic Modeling of Electric Machines",
		"eece 550": "Power Electronics Design",
		"eece 553": "Power System Analysis",
		"eece 554": "Power System Dynamics",
		"eece 560": "Network Analysis",
		"eece 562": "Statistical Signal Processing",
		"eece 563": "Wireless Communication Systems",
		"eece 564": "Detection & Estimation of Signals in Noise",
		"eece 565": "Communication Networks",
		"eece 566": "Communication & Information Theory",
		"eece 569": "Mobile Communication Networks",
		"eece 573": "Micro & Nano Fabrication Technology",
		"eece 574": "Self-Tuning Control",
		"eece 576": "Semiconductor Theory and Applications",
		"eece 579": "Advanced Topics in VLSI Design",
		"eece 580": "Electronic Materials & Devices",
		"eece 583": "CAD Algorithms I for Circuits",
		"eece 584": "Nanophotonic Fabrication",
		"eece 592": "Architecture of Learning Systems",
		"eece 595": "Circuits & Systems",
		"eece 597": "Engineering Report",
		"eece 599": "MASc Thesis",
		"elec 201": "Circuit Analysis 1",
		"elec 202": "Circuit Analysis 2",
		"elec 203": "Basic Circuit Analysis",
		"elec 204": "Linear Circuits",
		"elec 205": "Electronics Laboratory",
		"elec 211": "Engineering Electromagnetics",
		"elec 221": "Signals & Systems",
		"elec 271": "Topics in Biomedical Engineering",
		"elec 281": "Technical Communication",
		"elec 291": "EECE Design Studio",
		"elec 292": "Biomedical Design Studio",
		"elec 301": "Electric Circuits",
		"elec 302": "Circuits and Electromechanics",
		"elec 311": "Electromagnetic Fields & Waves",
		"elec 315": "Electrical Materials & Devices",
		"elec 321": "Stochastic Signals and Systems",
		"elec 331": "Computer Communications",
		"elec 341": "Systems & Control",
		"elec 342": "Electromechanical Energy",
		"elec 343": "Electromechanics",
		"elec 344": "Applied Electronics & Electromechanics",
		"elec 352": "Electrical Energy Systems",
		"elec 371": "Biomedical Instrumentation",
		"elec 391": "Electrical Engineering Studio",
		"elec 401": "Analog CMOS Design",
		"elec 402": "Introduction to VLSI Systems",
		"elec 403": "Advanced Digital VLSI Systems",
		"elec 411": "Antennas & Propagation",
		"elec 412": "Optical Waveguides & Photonics",
		"elec 413": "Semiconductor Lasers",
		"elec 415": "Semiconductor Devices",
		"elec 421": "Digital Signal & Image Processing",
		"elec 422": "Biosignals & Systems",
		"elec 431": "Communication Systems",
		"elec 432": "Digital Communications",
		"elec 441": "Control Systems",
		"elec 451": "Power Electronics",
		"elec 453": "Power Systems Analysis",
		"elec 454": "Power System Analysis II",
		"elec 455": "Power System Protection",
		"elec 456": "Methods of Power System Operation",
		"elec 457": "Optimization of Power Systems",
		"elec 461": "Nanotechnology Electronics",
		"elec 462": "Sensor & Actuator Microsystems",
		"elec 463": "Micro/Nano Instrumentation Laboratory",
		"elec 465": "Microsystems Design",
		"elec 471": "Medical Imaging",
		"elec 473": "Biological MEMS",
		"elec 474": "Biophotonics",
		"elec 481": "Economic Analysis of Projects",
		"elec 491": "Capstone Design Project",
		"elec 492": "Electrical Energy Systems Design",
		"elec 493": "Nanotechnology & Microsystems",
		"elec 494": "Biomedical Capstone Design",
		"ends 221": "Sustainability by Design",
		"ends 281": "Architectural Context & Culture",
		"ends 301": "Environmental Design 1",
		"ends 302": "Environmental Design 2",
		"ends 320": "Design, Media & Representation",
		"ends 401": "Environmental Design 3",
		"ends 402": "ENDS Design 4",
		"ends 420": "Technology & Technique",
		"ends 440": "Environment & Urban Form",
		"engl 100": "Reading and Writing about Language and Literatures",
		"engl 110": "Approaches to Literature and Culture",
		"engl 111": "Introduction to Nonfiction",
		"engl 112": "Strategies for University Writing",
		"engl 140": "Challenging Language Myths",
		"engl 210": "Introduction to English Honours",
		"engl 211": "Honours Seminar",
		"engl 220": "Literature in English to the 18th Century",
		"engl 221": "Literature in Britain 18th Century and After",
		"engl 222": "Literature of Canada",
		"engl 223": "Literature in the United States",
		"engl 224": "World Literature in English",
		"engl 225": "Poetry",
		"engl 227": "Prose",
		"engl 231": "Indigenous Literatures",
		"engl 232": "Approaches to Media Studies",
		"engl 301": "Technical Writing",
		"engl 309": "Scientific & Medical Rhetoric",
		"engl 310": "Rhetoric Theory 1",
		"engl 311": "Rhetoric Theory 2",
		"engl 318": "English: Early History",
		"engl 319": "English: Later History",
		"engl 321": "Traditional Grammar",
		"engl 328": "Metaphor & Thought",
		"engl 331": "Structure of Sentences",
		"engl 340": "Introduction to Old English",
		"engl 343": "Old English Literature",
		"engl 358": "18th Century Genre",
		"engl 362": "Studies in 19th Century Genre",
		"engl 480": "Transnational Studies",
		"engl 489": "Major Seminar in Language",
		"engl 490": "Major Seminar in Literature",
		"enph 259": "Experimental Techniques",
		"enph 352": "Physics Laboratory Techniques",
		"enph 459": "Engineering Physics Project I",
		"enph 479": "Engineering Physics Project II",
		"enph 481": "Entrepreneurial Project I",
		"envr 200": "Introduction to Environmental Science",
		"envr 300": "Introduction to Research in Environmental Science",
		"envr 400": "Community Project in Environmental Science",
		"envr 410": "Energy, Environment & Society",
		"envr 420": "Ecohydrology of Water",
		"envr 430": "Ecological Dimensions of Sustainability",
		"envr 449": "Honours Thesis",
		"eosc 110": "The Solid Earth",
		"eosc 111": "Laboratory Exploration of the Earth",
		"eosc 112": "The Fluid Earth",
		"eosc 114": "Catastrophic Events and the Earth",
		"eosc 116": "The Mesozoic Earth",
		"eosc 118": "Gold & Gems",
		"eosc 210": "Earth Science for Engineers",
		"eosc 211": "Computers in Earth Science",
		"eosc 212": "Earth & Planetary Science",
		"eosc 220": "Introductory Mineralogy",
		"eosc 221": "Introductory Petrology",
		"eosc 222": "Geologic Time & Stratigraphy",
		"eosc 223": "Field Techniques",
		"eosc 240": "Site Investigation",
		"eosc 250": "Fields and Fluxes",
		"eosc 270": "Marine Ecosystems",
		"eosc 310": "Earth & Solar System",
		"eosc 311": "Earth & Its Resources",
		"eosc 314": "Ocean Environment",
		"eosc 315": "Ocean Ecosystems",
		"eosc 320": "Sedimentology",
		"eosc 321": "Igneous Petrology",
		"eosc 322": "Metamorphic Petrology",
		"eosc 323": "Structural Geology I",
		"eosc 326": "Earth & Life Through Time",
		"eosc 328": "Field Geology",
		"eosc 329": "Groundwater Hydrology",
		"eosc 330": "Principles of Geomorphology",
		"eosc 331": "Introduction to Mineral Deposits",
		"eosc 332": "Geological Evolution of North America",
		"eosc 333": "Elemental & Isotope Geochemistry",
		"eosc 340": "Global Climate Change",
		"eosc 350": "Environmental Geotechnics I",
		"eosc 352": "Geophysical Continuum Dynamics",
		"eosc 353": "Seismology",
		"eosc 354": "Analysis of Time Series",
		"eosc 372": "Circulation & Plankton",
		"eosc 373": "Climate & Ecosystems",
		"eosc 420": "Volcanology",
		"eosc 422": "Structural Geology II",
		"eosc 424": "Advanced Mineral Deposits",
		"eosc 425": "Paleontology",
		"eosc 428": "Field Techniques in Groundwater Hydrology",
		"eosc 429": "Groundwater Contamination",
		"eosc 430": "Aqueous Geochemistry",
		"eosc 432": "Fossil Fuels",
		"eosc 433": "Geotechnical Engineering Practice",
		"eosc 434": "Geological Engineering in Soil & Rock",
		"eosc 442": "Climate Measurement & Analysis",
		"eosc 445": "Engineering Design Project",
		"eosc 449": "Thesis",
		"eosc 450": "Field Methods in Earth Science",
		"eosc 453": "Physics of the Earth & Planets",
		"eosc 454": "Applied Geophysics",
		"eosc 470": "Biological Oceanography",
		"eosc 472": "Marine Chemistry and Geochemistry",
		"eosc 473": "Methods in Oceanography",
		"eosc 474": "Marine Pollution",
		"eosc 475": "Marine Microbiology",
		"eosc 478": "Introduction to Fisheries Science",
		"eosc 510": "Data Analysis in Atmosphere, Earth & Ocean Sciences",
		"eosc 511": "Numerical Techniques in Ocean, Atmosphere & Earth Sciences",
		"eosc 512": "Advanced Geophysical Fluid Dynamics",
		"eosc 513": "Wavelets",
		"eosc 514": "Geological Fluid Mechanics",
		"eosc 520": "Advanced Mineralogy",
		"eosc 522": "Methods & Models in Petrology & Geochemistry",
		"eosc 526": "Mechanics of Natural Deformation",
		"eosc 529": "Advanced Geotechnics",
		"eosc 531": "Exploration Methodology",
		"eosc 532": "Field and Laboratory Groundwater Hydrology",
		"eosc 533": "Advanced Groundwater Hydrology",
		"eosc 534": "Geological Engineering: Soil & Rock",
		"eosc 535": "Transport in Porous Media",
		"eosc 536": "Advanced Rock Engineering",
		"eosc 538": "Diamond Exploration",
		"eosc 540": "Advanced Ground Geochemistry",
		"eosc 542": "Advanced Volcanology",
		"eosc 543": "Solid Earth Sciences",
		"eosc 546": "Advanced Field Earth Science",
		"eosc 547": "Tunnel & Underground Engineering",
		"eosc 550": "Linear Inverse Theory",
		"eosc 561": "Methods in Seismic Interpretation",
		"eosc 562": "Mechanics of Earthquakes",
		"eosc 573": "Methods in Oceanography",
		"eosc 575": "Biology & Ecology of Zooplankton",
		"eosc 578": "Biological Oceanography Seminar",
		"eosc 579": "Dynamic Oceanography",
		"eosc 598": "Master of Engineering Graduate Paper",
		"epse 171": "Education in the Adolescent Years",
		"epse 303": "Teaching the Highly Able",
		"epse 312": "Introduction to Exceptional Children",
		"epse 316": "Learning Disabilities",
		"epse 320": "Inclusion of the Blind and Visually Impaired",
		"epse 348": "Family Practice for Children with Special Needs",
		"epse 403": "Educational Studies in Developmental Disabilities and Inclusion",
		"epse 406": "Typical and Atypical Infants and Children",
		"epse 408": "Educational Programs for the Highly Able",
		"epse 411": "Augmentative & Alternative Communication",
		"epse 415": "Technology for the Visually Impaired",
		"epse 421": "Assessment of Learning Difficulties",
		"epse 431": "Programming for Children with Special Learning Needs",
		"epse 432": "Classroom Management",
		"epse 436": "Survey of Behaviour Disorders in Children",
		"epse 437": "Intervention with Children & Adolescents with Behaviour Disorders",
		"epse 449": "Educational Studies in Autism",
		"epse 481": "Introduction to Research in Education",
		"epse 482": "Introduction to Statistics for Research in Education",
		"epse 501": "Human Development, Learning, and Culture",
		"epse 502": "Cognitive and Language Processes in Education",
		"epse 503": "Cultural Learning and Development",
		"epse 505": "Human Development: Infancy to Adulthood",
		"epse 507": "Child & Adolescent Psychopathology",
		"epse 512": "Critical Issues in Special Education",
		"epse 516": "The Able & Creative Learner",
		"epse 519": "Development of Early Skills in the Deaf and Hard of Hearing",
		"epse 520": "Curriculum Development for the Deaf and Hard of Hearing",
		"epse 525": "Studies in Sign Language",
		"epse 526": "Specific Learning Disabilities",
		"epse 528": "Basic Principles of Measurement",
		"epse 529": "Development of Scales & Measures",
		"epse 531": "Curriculum-Based Assessment & Intervention",
		"epse 534": "Academic Assessment in Schools",
		"epse 535": "Social & Emotional Assessment",
		"epse 536": "Educational Studies in Visual Impairment",
		"epse 545": "Independence Skills for the Visually Impaired",
		"epse 549": "Seminar in Autism",
		"epse 550": "Professional, Ethical & Legal Issues",
		"epse 553": "Theory of Cognitive Assessment",
		"epse 568": "Developmental Neuropsychology",
		"epse 569": "Socio-Psychological Foundations",
		"epse 574": "Principles of Behaviour Analysis",
		"epse 575": "Instructional Methods for Challenging Behaviours",
		"epse 576": "Assessment & Behaviour Support",
		"epse 577": "Assessment & Behaviour Support 2",
		"epse 584": "Motivation in Education",
		"epse 586": "Discourse & Talk",
		"epse 591": "Theory & Practice of Program Evaluation",
		"epse 592": "Experimental Design and Analysis in Education",
		"epse 593": "Design & Analysis of Sample Surveys",
		"epse 594": "Meta-Analysis of Quantitative Research Syntheses",
		"epse 595": "Qualitative Research Methods",
		"epse 596": "Core Designs in Educational Research",
		"epse 606": "College & University Teaching",
		"epse 682": "Multivariate Design and Analysis in Research",
		"epse 683": "Hierarchical Linear Modeling",
		"epse 684": "Item Response Theory",
		"etec 500": "Research Methodology in Education",
		"etec 510": "Design of Technology",
		"etec 511": "Foundations of Educational Technology",
		"etec 512": "Applications of Learning Theories",
		"etec 520": "Planning and Managing Learning",
		"etec 521": "Indigeneity, Technology & Education",
		"etec 522": "Ventures in Learning Technology",
		"etec 530": "Constructivist Strategies",
		"etec 531": "Curriculum Issues",
		"etec 532": "Technology in the Arts and Humanities",
		"etec 533": "Technology in Mathematics and Science",
		"etec 540": "Text Technologies",
		"fhis 333": "Short Fiction and Romance Literature",
		"fipr 101": "Introduction to the History of Film Production",
		"fipr 131": "Introduction to Screen Acting",
		"fipr 230": "Introduction to Motion Picture Directing",
		"fipr 233": "Video Production I",
		"fipr 234": "Planning & Professional Practice",
		"fipr 330": "Intermediate Directing",
		"fipr 333": "Motion Picture Production I",
		"fipr 337": "Cinematography & Lighting I",
		"fipr 338": "Sound Recording for Film & Video",
		"fipr 339": "Post-Production Techniques I",
		"fipr 433": "Motion Picture Production II",
		"fipr 434": "Producing Film & Television",
		"fipr 437": "Cinematography II",
		"fipr 536": "Advanced Documentary Development & Production",
		"fish 500": "Fisheries Management",
		"fish 504": "Quantitative Analysis in Fisheries I",
		"fish 508": "Fisheries Economics & Management",
		"fish 510": "Bayesian Decision Analysis",
		"fish 520": "Conservation, Governance, Evaluation",
		"fist 100": "Introduction to Film Studies",
		"fist 200": "Introduction to Canadian Cinema",
		"fist 210": "Silent Cinema",
		"fist 220": "Hollywood Cinema",
		"fist 230": "Introduction to Asian Cinema",
		"fist 240": "Media Industries",
		"fist 300": "Cult Cinema",
		"fist 331": "Studies in Film Theory",
		"fist 332": "Studies in Genre/Period",
		"fist 338": "Asian & Australian Cinema",
		"fist 436": "American Cinema 1960",
		"fist 445": "Major & Honours Seminar",
		"fmst 210": "Family and Human Development",
		"fmst 238": "Family Resource Management",
		"fmst 312": "Parent-Child Relationships",
		"fmst 314": "Relationship Development",
		"fmst 316": "Human Sexuality",
		"fmst 440": "Family Economic Issues",
		"fmst 442": "Families & Work",
		"fnel 101": "Introductory Salish I",
		"fnel 102": "Introductory Salish II",
		"fnel 180": "Introduction to Endangered Languages",
		"fnel 201": "Intermediate Salish I",
		"fnel 202": "Intermediate Salish II",
		"fnel 281": "Conservation & Revitalization",
		"fnel 282": "Structure of Endangered Languages",
		"fnel 380": "Technology and Endangered Languages",
		"fnel 489": "Topics in First Nations and Endangered Languages",
		"fnh 200": "Exploring Our Food",
		"fnh 250": "Nutrition Concepts & Controversies",
		"fnh 300": "Principles of Food Engineering",
		"fnh 301": "Food Chemistry I",
		"fnh 302": "Food Analysis",
		"fnh 303": "Food Product Development",
		"fnh 309": "Food Processing Science",
		"fnh 313": "Microorganisms in Food",
		"fnh 325": "Food Science Laboratory I",
		"fnh 326": "Food Science Laboratory II",
		"fnh 330": "Introduction to Wine Science",
		"fnh 335": "Introduction to Wine Science 2",
		"fnh 340": "Food Theory",
		"fnh 341": "Food Theory Applications",
		"fnh 342": "Consumer Food Practices",
		"fnh 350": "Fundamentals of Nutrition",
		"fnh 351": "Vitamins, Minerals & Health",
		"fnh 355": "World Problems in Nutrition",
		"fnh 370": "Nutritional Assessment",
		"fnh 398": "Research Methods in Human Nutrition",
		"fnh 402": "Functional Foods & Nutraceuticals",
		"fnh 403": "Food Law, Regulations and Quality",
		"fnh 413": "Food Safety",
		"fnh 415": "Food, Nutrition and Health Business Concepts",
		"fnh 425": "Food Science Laboratory III",
		"fnh 430": "Enology & Wine Biotechnology",
		"fnh 440": "Food Service Systems Management",
		"fnh 451": "Nutrient Metabolism and Implications for Health",
		"fnh 455": "Applied International Nutrition",
		"fnh 460": "International Nutrition Field Study",
		"fnh 470": "Clinical Dietetics I",
		"fnh 471": "Human Nutrition Across the Life Span",
		"fnh 473": "Nutrition Education in the Community",
		"fnh 474": "Sport Nutrition",
		"fnh 475": "Clinical Dietetics II",
		"fnh 477": "Nutrition & Disease Prevention",
		"fnh 490": "Topics in Food, Nutrition and Health",
		"fnh 499": "Undergraduate Thesis",
		"fnis 100": "Indigenous Foundations",
		"fnis 210": "Politics & Self-Determination",
		"fnis 220": "Representation & Cultural Politics",
		"fnis 310": "Theory Seminar",
		"fnis 320": "Methods Seminar",
		"fnis 400": "Practicum / Advanced Research",
		"fnis 451": "Indigenous Feminisms",
		"fnis 452": "Indigenous Social Movements",
		"food 510": "Advances in Food Science",
		"food 512": "Hazard Analysis in Food",
		"food 515": "Foundations of Agri-Food Business",
		"food 520": "Advanced Food Analysis",
		"food 521": "Advanced Food Biotechnology",
		"food 522": "Advanced Food Chemistry",
		"food 523": "Advanced Food Microbiology",
		"food 524": "Advanced Food Processing",
		"food 525": "Advanced Food Toxicology",
		"food 528": "International Food Law & Regulations",
		"food 529": "Sensory Evaluation Laboratory Methods",
		"fopr 261": "Basic Geomatics for Natural Resources",
		"fopr 262": "Forest Operations I",
		"fopr 264": "Geomatics for Forestry & Transportation",
		"fopr 362": "Harvesting Systems and Forest Access",
		"fopr 388": "Analytical Methods in Forest Hydrology",
		"fopr 459": "Economics, Contracts, Finance",
		"fopr 464": "Forest Transportation Systems",
		"fre 295": "Managerial Economics",
		"fre 302": "Small Business Management in Agriculture",
		"fre 306": "Introduction to Global Food Markets",
		"fre 340": "International Agricultural Development",
		"fre 374": "Land Resource Economics",
		"fre 385": "Quantitative Business and Resource Management",
		"fre 420": "Economics of International Trade & Environment",
		"fre 460": "Economics of Food Consumption",
		"fre 490": "Food & Resource Economics",
		"fre 501": "Commodity Markets & Prices",
		"fre 502": "Food Market Analysis",
		"fre 503": "Policy Analysis in Food and Resource Economics",
		"fre 515": "Agribusiness Management",
		"fre 516": "Financial Marketing of Food",
		"fre 525": "Environmental Economics & Policy",
		"fre 528": "Applied Econometrics",
		"fre 547": "Graduate Project",
		"fre 585": "Quantitative Methods in Resources",
		"fren 101": "Beginners' French I",
		"fren 102": "Beginners' French II",
		"fren 111": "Beginners' French III",
		"fren 112": "Beginners' French IV",
		"fren 122": "French Language & Literature I",
		"fren 123": "French Language and Literature II",
		"fren 215": "Oral French Practice",
		"fren 220": "French Literature and Textual Analysis",
		"fren 221": "Modern Literature and Textual Analysis",
		"fren 222": "French Language and Style I",
		"fren 223": "French Language and Style II",
		"fren 224": "Introduction to Applied French I",
		"fren 225": "Introduction to Applied French II",
		"fren 329": "European French Literature",
		"fren 330": "Quebecois Literature",
		"fren 334": "French Civilization II",
		"fren 342": "French Practice for Non-Specialists I",
		"fren 343": "French Practice for Non-Specialists II",
		"fren 348": "French Literature in Translation I",
		"fren 349": "French Literature in Translation II",
		"fren 353": "French Grammar",
		"fren 355": "Advanced Composition",
		"fren 357": "Translation I",
		"fren 360": "Introduction to Old French",
		"fren 370": "Introduction to French Linguistics",
		"fren 371": "Introduction to Literary Theory and Method",
		"fren 457": "Translation II",
		"fren 499": "Honours Essay",
		"frst 100": "Sustainable Forests",
		"frst 200": "Forest Plant Biology I",
		"frst 201": "Forest Ecology",
		"frst 202": "Forest Ecology",
		"frst 210": "Forest Plant Biology II",
		"frst 211": "Forest Classification and Silvics",
		"frst 231": "Introduction to Biometrics",
		"frst 232": "Computer Applications in Forestry",
		"frst 239": "Tree Stand Level Measurements",
		"frst 270": "Community Forests and Forestry",
		"frst 302": "Forest Genetics",
		"frst 303": "Principles of Forest Science",
		"frst 304": "Scientific Forest Issues",
		"frst 305": "Silviculture 1",
		"frst 307": "Biotic Disturbances",
		"frst 308": "Forest Entomology",
		"frst 309": "Forest Pathology",
		"frst 310": "Soil Biology",
		"frst 311": "Plant Physiology I",
		"frst 318": "Forest and Conservation Economics",
		"frst 319": "Principles of Forest Economics",
		"frst 320": "Abiotic Disturbances",
		"frst 339": "Forest Measurements and Production",
		"frst 351": "Forest Field School",
		"frst 385": "Watershed Hydrology",
		"frst 386": "Aquatic Ecosystems and Fisheries",
		"frst 395": "Forest Wildlife Ecology",
		"frst 399": "Introduction to Research Methods",
		"frst 408": "Forest Entomology",
		"frst 411": "Complex Adaptive Systems",
		"frst 413": "Ecological Plant Biochemistry",
		"frst 415": "Sustainable Forest Policy",
		"frst 421": "Integrated Resource Management I",
		"frst 424": "Sustainable Forest Management",
		"frst 430": "Advanced Biometrics",
		"frst 432": "Molecular Ecology",
		"frst 436": "Growth and Yield",
		"frst 439": "International Forestry",
		"frst 443": "Remote Sensing",
		"frst 444": "Agroforestry",
		"frst 452": "Coastal Field School",
		"frst 490": "Visual Resource Management",
		"frst 495": "Biodiversity and Forest Management",
		"frst 497": "Graduating Essay",
		"frst 498": "BSc Thesis",
		"frst 503": "Plant Molecular Biology",
		"frst 508": "Forest Insect Ecology",
		"frst 512": "Belowground Forest Ecosystems",
		"frst 516": "Tree Physiology",
		"frst 519": "Forests and Society",
		"frst 522": "Indigenous Peoples and Forest Lands",
		"frst 523": "Forest and Environmental Policy",
		"frst 524": "Environmental Perception",
		"frst 529": "Ecological Economics",
		"frst 530": "Multiple Regression Methods",
		"frst 534": "Natural Resource Economics",
		"frst 543": "Developing Forest Institutions",
		"frst 544": "Technical Communication Skills",
		"frst 545": "Technical Communication Skills II",
		"frst 546": "Research Methods",
		"frst 547": "Forestry in B.C.",
		"frst 551": "Sustainable Landscape Planning",
		"frst 553": "Forest Governance",
		"frst 556": "Land Information Acquisition and Analysis",
		"frst 557": "Site-Level Land Management",
		"frst 558": "Landscape Land Management",
		"frst 559": "Natural Resource Planning",
		"frst 560": "Forest Business Enterprise",
		"frst 562": "Directed Studies in International Forestry",
		"frst 576": "Advanced Wood Mechanics",
		"frst 588": "Headwater Systems",
		"frst 590": "Statistical Methods in Hydrology",
		"gbpr 500": "Building Blocks",
		"gbpr 501": "Biomass Fractionation",
		"geob 102": "Changing Environment",
		"geob 103": "Changing Environment: Water and Land",
		"geob 200": "Atmospheric Environments",
		"geob 204": "Introduction to Biometeorology",
		"geob 206": "Geomorphological Processes and Hazards",
		"geob 207": "Introduction to Biogeography",
		"geob 270": "Geographic Information Science",
		"geob 300": "Microscale Weather and Climate",
		"geob 305": "Introduction to Hydrology",
		"geob 307": "Global Biogeography",
		"geob 308": "Quaternary and Applied Geomorphology",
		"geob 309": "Biogeoscience Field Course",
		"geob 370": "Advanced GIS",
		"geob 372": "Cartography",
		"geob 373": "Introduction to Remote Sensing",
		"geob 401": "Urban Meteorology",
		"geob 402": "Air Pollution Meteorology",
		"geob 406": "Watershed Geomorphology",
		"geob 407": "Vegetation Dynamics",
		"geob 409": "Self-Directed Field Study",
		"geob 472": "Research Cartography",
		"geob 500": "Contemporary Research Trends in Physical Geography",
		"geob 501": "Geomorphological Processes",
		"geog 121": "Geography of the Modern Globe I",
		"geog 122": "Geography of the Modern Globe II",
		"geog 211": "State of the Earth",
		"geog 220": "Geopolitics",
		"geog 250": "Cities",
		"geog 281": "Geography of the Pacific Rim",
		"geog 290": "Introduction to the Geography of Canada",
		"geog 310": "Environment and Resources",
		"geog 311": "Urban Environment",
		"geog 312": "Global Climate System",
		"geog 316": "Geography of Natural Hazards",
		"geog 318": "Environmental Change and Quality",
		"geog 319": "Environmental Impact Assessment",
		"geog 321": "Historical Geography of Urbanization",
		"geog 327": "History of Canada I",
		"geog 328": "History of Canada II",
		"geog 329": "Introduction to Political Geography",
		"geog 345": "Theory and Practice of Human Geography",
		"geog 350": "Urban Geography",
		"geog 352": "Urbanization in the Global South",
		"geog 353": "Geography of Migration and Settlement",
		"geog 357": "Introduction to Social Geography",
		"geog 361": "Introduction to Economic Geography",
		"geog 362": "Geography of Economic Development",
		"geog 364": "Global, City, Region",
		"geog 371": "Research Strategies in Human Geography",
		"geog 374": "Statistics in Geography",
		"geog 380": "Geography of Asia",
		"geog 391": "Geography of Europe",
		"geog 395": "Changing Landscapes of Latin America",
		"geog 410": "Environment and Society",
		"geog 412": "Water Management",
		"geog 419": "Research in Environmental Geography",
		"geog 423": "Development of Environmental Thought",
		"geog 424": "Feminist Geography",
		"geog 426": "Historical Geography of BC",
		"geog 429": "Research in Historical Geography",
		"geog 446": "Topics in Geography",
		"geog 450": "Urban Research",
		"geog 457": "Social Geography",
		"geog 485": "Geography of China",
		"geog 495": "Social Movements in the Americas",
		"geog 497": "The Arctic",
		"geog 520": "Themes and Interdisciplinary Issues in Modern Geography",
		"geog 525": "Cultural and Natural Capital Ecology",
		"geog 535": "International Migration and Settlement",
		"geog 599": "Masters Thesis",
		"germ 100": "Beginning German I",
		"germ 110": "Beginning German 2",
		"germ 200": "Intermediate German I",
		"germ 210": "Intermediate German II",
		"germ 300": "Intermediate German III",
		"germ 301": "German Literature 1900-45",
		"germ 302": "German Literature Post 1945",
		"germ 303": "German Literature Before 1900",
		"germ 304": "German Cinema in English",
		"germ 310": "Intermediate German IV",
		"germ 313": "Conversational German II",
		"germ 314": "Business German",
		"germ 325": "German Translation",
		"germ 360": "Heaven and Earth",
		"germ 380": "Tradition and Change",
		"germ 400": "Advanced German",
		"germ 402": "Word and Music in German Literature",
		"germ 410": "Advanced German II",
		"germ 411": "Controversies in German Culture",
		"germ 433": "German Reading Knowledge 1",
		"germ 434": "German Reading Knowledge 2",
		"germ 521": "Cultural Studies",
		"gpp 501": "Microeconomic Analysis",
		"gpp 502": "International Macroeconomics",
		"gpp 503": "Measurement and Data Analysis",
		"gpp 504": "Policy Analysis and Evaluation",
		"gpp 505": "Domestic and Global Policy",
		"gpp 506": "Public Management",
		"gpp 507": "Environmental Law and Policy",
		"gpp 508": "Philosophical and Ethical Foundations of Policy",
		"gpp 509": "Communicating Policy",
		"gpp 591": "Topics in Public Policy",
		"grek 101": "First-Year Ancient Greek I",
		"grek 102": "First-Year Ancient Greek II",
		"grek 201": "Second-Year Ancient Greek I",
		"grek 202": "Second-Year Ancient Greek II",
		"grek 351": "Intermediate Ancient Greek Prose",
		"grek 352": "Intermediate Ancient Greek Verse",
		"grsj 101": "Gender, Race, Sex, and Power",
		"grsj 102": "Decolonial and Feminist Perspectives",
		"grsj 230": "Gender, Race, Sexuality, and Representation in Modern Asia",
		"grsj 235": "Gender, Race, Sexuality, and Social Structures in Asia",
		"grsj 300": "Thinking Gender",
		"grsj 301": "Gender and Indigeneity in Canada",
		"grsj 303": "Gender, Law, and Society",
		"grsj 305": "Issues in Community and International Organizations",
		"grsj 306": "Globalization and Social Justice",
		"grsj 307": "Gender, Race, Sexuality, and Popular Culture",
		"grsj 310": "Issues in Gender and Health",
		"grsj 311": "Black Women in the Americas",
		"grsj 320": "Feminist Anti-Racist Pedagogy",
		"grsj 325": "Decolonial Qualitative Methods",
		"grsj 326": "Politics of Gender",
		"grsj 327": "Feminist Theory",
		"grsj 328": "Feminist Subjectivity",
		"grsj 401": "Body, Gender, Society",
		"grsj 422": "Advanced Research Seminar in Women's Studies",
		"grsj 500": "Intersectional Issues",
		"grsj 501": "Decolonial and Feminist Methods",
		"grsj 502": "Gender, Sexuality, and Critical Race",
		"gsat 501": "Intensive Lab Course",
		"gsat 502": "Advanced GSAT Concepts",
		"gsat 540": "Statistics for High Dimensional Biology",
		"hebr 101": "Elementary Biblical Hebrew I",
		"hebr 102": "Elementary Biblical Hebrew II",
		"hebr 201": "Intermediate Biblical Hebrew 1",
		"hebr 202": "Intermediate Biblical Hebrew 2",
		"hgse 350": "Haida Gwaii Case Study",
		"hgse 351": "History of Resource Management",
		"hgse 352": "First Nations Resources",
		"hgse 353": "Rainforest Ecology",
		"hgse 354": "Resource-Dependent Communities",
		"hgse 355": "Coastal Terrestrial Ecosystems",
		"hgse 356": "Biological Dynamics of Marine-Terrestrial Systems",
		"hgse 357": "Island Wildlife Management",
		"hgse 358": "Applied Ecological Knowledge",
		"hgse 359": "Ecosystem-Based Management",
		"hinu 102": "Introduction to Hindi-Urdu",
		"hist 101": "History to Ocean Contact",
		"hist 102": "World History from 1500 to the Twentieth Century",
		"hist 103": "World History Since 1900",
		"hist 104": "Topics in World History",
		"hist 105": "Contemporary Global Issues",
		"hist 106": "Global Environmental History",
		"hist 235": "History of Canada",
		"hist 236": "Public History of Canada",
		"hist 256": "History of Africa",
		"hist 259": "Medieval Technology",
		"hist 260": "History",
		"hist 273": "History of India",
		"hist 280": "Islamic World History",
		"hist 302": "Indigenous Peoples of North America",
		"hist 305": "British Columbia",
		"hist 310": "British Empire to 1850",
		"hist 311": "British Empire since 1850",
		"hist 313": "Africa from Imperialism to Independence",
		"hist 315": "Britain 1750 - 1850",
		"hist 317": "Britain 1850-1918",
		"hist 318": "Early 20th Century Britain",
		"hist 319": "Britain 1946 - Present",
		"hist 323": "Atlantic Revolutions",
		"hist 324": "Inventing Canada",
		"hist 325": "Canada 1896-1945",
		"hist 326": "Canada since 1945",
		"hist 327": "American Colonial",
		"hist 328": "American Revolution and Formation of the United States",
		"hist 338": "United States 1896 - 1945",
		"hist 339": "United States 1945 - Present",
		"hist 350": "The Soviet Union",
		"hist 356": "20th Century Germany",
		"hist 358": "State and Society in 20th Century Cuba",
		"hist 363": "Europe in the Early Middle Ages",
		"hist 364": "Europe in the Late Middle Ages",
		"hist 365": "Renaissance Europe",
		"hist 367": "European Enlightenment",
		"hist 368": "Europe in the 19th Century",
		"hist 369": "Europe 1900-50",
		"hist 370": "Europe since 1950",
		"hist 376": "Japan since 1800",
		"hist 378": "History of Early China",
		"hist 379": "Late Imperial China",
		"hist 382": "Post-Colonial Southeast Asia",
		"hist 391": "Human Rights",
		"hist 392": "Scientific Revolution",
		"hist 393": "History and Philosophy of Science",
		"hist 394": "Darwin and Evolution",
		"hist 405": "Middle East 1914 Onwards",
		"hist 408": "United States Foreign Relations",
		"hist 409": "United States Foreign Policy 1945+",
		"hist 418": "The 1960s in Global Perspective",
		"hist 419": "Canadian Crime & Punishment",
		"hist 425": "Modern War & Society",
		"hist 432": "International Relations of the Great Powers",
		"hist 433": "Fourth Year Honours Seminar",
		"hist 441": "History of the Holocaust",
		"hist 449": "Honours Essay",
		"hist 455": "Gender & Sexuality in Latin America",
		"hist 464": "First Contact in the Pacific",
		"hist 476": "Medieval Legal History",
		"hist 483": "Asian Migration to the Americas",
		"hist 485": "Asian Migration to Vancouver",
		"hist 549": "Master's Thesis",
		"hist 560": "Chinese History Readings",
		"hist 561": "Chinese History Readings",
		"hist 596": "Oral History",
		"hist 599": "MA Research Seminar",
		"hist 699": "PhD Research Seminar",
		"hunu 500": "Research Methods in Human Nutrition",
		"hunu 505": "Current Issues in Applied Nutrition",
		"iar 520": "Master's Thesis",
		"igen 201": "Integrated Technical Communication",
		"igen 230": "Introduction to Engineering Design",
		"igen 330": "Intermediate Engineering Design",
		"igen 340": "Technology Entrepreneurship",
		"igen 430": "Advanced Engineering Design",
		"igen 450": "Pipeline Engineering",
		"igen 451": "Pipeline Systems",
		"igen 452": "Pipeline Design",
		"info 250": "Networks, Crowds, and Communications",
		"isci 311": "The Size of Things",
		"isci 320": "Interdisciplinary Science Field",
		"isci 350": "Darwinian Medicine",
		"isci 360": "Systems Approaches to Regional Sustainability",
		"isci 422": "Models in Science",
		"isci 433": "Ethical Issues in Science",
		"ital 101": "First Year Italian I",
		"ital 102": "First Year Italian II",
		"ital 201": "Second-Year Italian I",
		"ital 202": "Second-Year Italian II",
		"ital 301": "Third Year Italian I",
		"ital 302": "Third Year Italian II",
		"ital 303": "Italian Literature and Culture",
		"ital 401": "Advanced Italian I",
		"ital 402": "Advanced Italian II",
		"ital 403": "Dante's Divine Comedy",
		"ital 404": "Literature of the Middle Ages",
		"ital 405": "Literature: Renaissance",
		"ital 408": "Topics in 19th Century Italian Literature",
		"ital 409": "Topics in Modern Italian Literature",
		"ital 430": "Italian Cinema and Culture",
		"itst 110": "Introduction to Literature & Culture",
		"itst 231": "Introduction to Italian Culture I",
		"itst 234": "Introduction to Italian Cinema",
		"itst 333": "The Novella in Literature",
		"itst 345": "Italian Fascism",
		"itst 385": "Cinema: Neorealism",
		"itst 413": "The Divine Comedy in Translation",
		"itst 415": "Italian Literature and Culture of the Renaissance",
		"itst 419": "Italian Literature and Culture",
		"iwme 503": "Industrial Water Treatment",
		"japn 100": "Beginning Japanese IA",
		"japn 101": "Beginning Japanese IB",
		"japn 102": "Beginning Japanese II",
		"japn 103": "Beginning Japanese II",
		"japn 150": "Intensive Beginning Japanese I",
		"japn 151": "Intensive Beginning Japanese II",
		"japn 200": "Beginning Japanese IIA",
		"japn 201": "Beginning Japanese IIB",
		"japn 210": "Intermediate Japanese I A",
		"japn 211": "Intermediate Japanese I B",
		"japn 212": "Intermediate Japanese IIA",
		"japn 213": "Intermediate Japanese IIB",
		"japn 250": "Intensive Intermediate Japanese 1",
		"japn 251": "Intensive Intermediate Japanese 2",
		"japn 300": "Advanced Reading & Writing I",
		"japn 301": "Advanced Reading & Writing II",
		"japn 302": "Advanced Conversation & Composition I",
		"japn 303": "Advanced Conversation & Composition II",
		"japn 311": "Classical Japanese I (A)",
		"japn 312": "Classical Japanese I (B)",
		"japn 314": "Japanese for Professional Life I",
		"japn 315": "Japanese for Professional Life II",
		"japn 406": "Readings in Modern Japanese Essays",
		"japn 408": "Readings in Modern Japanese Literature",
		"japn 410": "Advanced Oral Communication",
		"japn 416": "Newspaper Japanese",
		"jrnl 533": "Ethics & the Law",
		"jrnl 534": "Media Law",
		"jrnl 535": "Press & Society",
		"kin 103": "Active Health",
		"kin 151": "Biomechanics I",
		"kin 161": "Leisure and Sport Sciences",
		"kin 190": "Anatomy & Physiology I",
		"kin 191": "Anatomy & Physiology II",
		"kin 230": "Human Motor Behaviour I",
		"kin 231": "Sport & Exercise Psychology",
		"kin 261": "Health Policy & Society",
		"kin 275": "Exercise Physiology I",
		"kin 284": "Physical Growth & Motor Development",
		"kin 303": "High Performance Conditioning",
		"kin 330": "Human Motor Behaviour II",
		"kin 343": "Biology of Athletic Performance",
		"kin 351": "Biomechanics II",
		"kin 360": "Sport, Peace, and Conflict",
		"kin 361": "Introduction to Athletic Training",
		"kin 362": "Adapted Physical Activity",
		"kin 365": "Foundations of Coaching",
		"kin 366": "Movement Experiences for Young Children",
		"kin 367": "Leisure & Disabled Persons",
		"kin 369": "Instructional Analysis & Design",
		"kin 371": "Introduction to Statistics in Kinesiology",
		"kin 373": "Research Methods in Kinesiology",
		"kin 375": "Exercise Physiology II",
		"kin 381": "Leisure, Sport & Culture",
		"kin 382": "Meaning & Values",
		"kin 383": "Modern Olympics",
		"kin 389": "Neuromuscular Integration of Human Movement",
		"kin 400": "Planning Physical Education, Sport & Exercise Programs",
		"kin 415": "Conceptual Game Education",
		"kin 461": "Prevention of Sports Injuries I",
		"kin 462": "Skeletal Muscle Physiology",
		"kin 464": "Health Promotion and Physical Activity",
		"kin 465": "Intercultural Health & Physical Activity",
		"kin 469": "Exercise Prescription",
		"kin 471": "Prevention of Sports Injuries II",
		"kin 473": "Neuroanatomy of Human Movement",
		"kin 475": "Pulmonary Physiology and Exercise",
		"kin 481": "Sport Marketing & Communication",
		"kin 499": "Kinesiology Project",
		"kin 500": "Special Topics in Kinesiology",
		"kin 515": "Gap Analysis",
		"kin 562": "Bioenergetics of Physical Activity",
		"kin 564": "Psycho-Social Aspects of Physical Activity",
		"kin 565": "Physiological Aspects of Physical Activity",
		"kin 567": "Human Motor Performance",
		"kin 568": "Seminar in Human Motor Performance",
		"kin 570": "Research Methods in Kinesiology",
		"kin 571": "Qualitative Methods in Sport",
		"kin 585": "Coaching Science I",
		"kin 586": "Coaching Science II",
		"kin 595": "Graduating Paper",
		"kin 598": "Directed Field Studies in Sport & Physical Activity",
		"korn 101": "Basic Korean 2",
		"korn 102": "Basic Korean",
		"korn 200": "Intermediate Korean",
		"korn 301": "Readings in Korean Topics 1",
		"korn 302": "Readings in Korean Topics 2",
		"lais 607": "Doctoral Proseminar",
		"larc 316": "Trees, Shrubs, and Landscapes",
		"larc 431": "Landscape Technology I",
		"larc 440": "Site Analysis 2",
		"larc 501": "Design Studio I: Introduction",
		"larc 502": "Design Studio II: Domestic",
		"larc 503": "Design Studio III: Development",
		"larc 504": "Design Studio IV: Urban & Regional",
		"larc 505": "Landscape Architecture Design Studio V",
		"larc 511": "Introductory Workshop",
		"larc 522": "Landscape Architecture History",
		"larc 523": "Landscape Architecture Theory",
		"larc 525": "Design-Research Methods",
		"larc 531": "Landscape Technology I: Site",
		"larc 532": "Landscape Technology II: Structures",
		"larc 540": "Site Analysis and Planning 2",
		"larc 541": "Landscape Planning & Management",
		"larc 542": "Aesthetics & Sustainability",
		"larc 551": "Professional Practice in Landscape Architecture",
		"larc 595": "Graduate Project I",
		"laso 204": "Introduction to Law & Society",
		"last 100": "Introduction to Latin American Studies",
		"last 201": "Popular Culture in Latin America",
		"latn 101": "First Year Latin I",
		"latn 102": "First Year Latin II",
		"latn 201": "Second Year Latin I",
		"latn 202": "Second Year Latin II",
		"latn 350": "Latin Literature: Classical Prose",
		"latn 351": "Latin Literature: Classical Verse",
		"law 201": "Canadian Constitutional Law",
		"law 211": "Contracts",
		"law 221": "Criminal Law & Procedure",
		"law 231": "Property Law",
		"law 241": "Torts",
		"law 251": "Public Law",
		"law 261": "Transnational Law",
		"law 281": "Legal Research & Writing",
		"law 300": "Jurisprudence & Critical Perspectives",
		"law 303": "Western Idea of Law",
		"law 305": "Law, Society & State",
		"law 316": "International Law",
		"law 325": "Conflict of Laws",
		"law 334": "Introduction to Asian Legal Systems",
		"law 336": "Chinese Law",
		"law 340": "Comparative Law",
		"law 352": "Aboriginal & Canadian Law",
		"law 353": "Aboriginal & Treaty Rights",
		"law 356": "First Nations & the Economy",
		"law 359": "Family Law",
		"law 372": "Administrative Law",
		"law 374": "Municipal Law",
		"law 377": "Immigration Law",
		"law 382": "Law & Medicine",
		"law 386": "Sustainable Development",
		"law 387": "Environmental Law",
		"law 394": "Mining Law",
		"law 395": "Forest Law",
		"law 397": "Oil & Gas Law",
		"law 400": "Advanced Criminal Procedure",
		"law 404": "Homicide Law",
		"law 407": "Taxation",
		"law 408": "Taxation of Corporations & Shareholders",
		"law 409": "Taxation of Partnerships",
		"law 410": "International Taxation",
		"law 412": "Taxation of Trusts & Estates",
		"law 416": "Labour Law",
		"law 422": "Intellectual Property",
		"law 430": "Advanced Legal Research",
		"law 436": "Restitution",
		"law 437": "Commercial Transactions",
		"law 438": "Secured Transactions",
		"law 439": "Construction Law",
		"law 440": "Insurance",
		"law 443": "Creditors' Remedies",
		"law 444": "Insolvency Law",
		"law 448": "Sports Law",
		"law 449": "Media/Entertainment Law",
		"law 451": "Trusts",
		"law 452": "Succession",
		"law 453": "Equitable Remedies",
		"law 455": "Real Estate Transactions",
		"law 457": "Real Estate Development",
		"law 459": "Business Organizations",
		"law 460": "Advanced Corporate Law",
		"law 461": "Corporate Transactions",
		"law 462": "Closely Held Corporations",
		"law 463": "Securities Regulation",
		"law 464": "Competition Policy",
		"law 465": "Introduction to Corporate Finance",
		"law 466": "Business Law Capstone",
		"law 468": "Ethics & Professionalism",
		"law 469": "Civil Procedure",
		"law 470": "Innocence Project",
		"law 473": "Appellate Advocacy",
		"law 476": "Evidence",
		"law 477": "Negotiation & Dispute Resolution",
		"law 489": "Clinical Term Paper",
		"law 504": "Property Law",
		"law 505": "Canadian Public Law",
		"law 506": "Taxation",
		"law 507": "Evidence",
		"law 509": "Administrative Law",
		"law 525": "Canadian Criminal Law & Procedure",
		"law 530": "Advanced Legal Research & Writing",
		"law 549": "Thesis",
		"law 560": "Topics in Common Law",
		"law 562": "Corporate & Shareholder Tax",
		"law 563": "Partnership Tax",
		"law 564": "Trust & Estate Tax",
		"law 565": "International Tax",
		"law 566": "Tax Policy",
		"law 567": "Tax Administration & Disputes",
		"lfs 100": "Introduction to Land, Food, and Community",
		"lfs 150": "Scholarly Writing & Argumentation",
		"lfs 250": "Land, Food & Community I",
		"lfs 252": "Land, Food & Community",
		"lfs 340": "Health & Traditional Plants",
		"lfs 350": "Land, Food and Community 2",
		"lfs 400": "Digital Communications & Topics in Agriculture",
		"lfs 450": "Land, Food and Community 3",
		"lfs 501": "Integrated Knowledge",
		"libe 461": "Administration of School Library Resource Centres",
		"libe 463": "Selection of Library Resources",
		"libe 465": "Organization of Learning Resources",
		"libe 467": "Information Services I",
		"libr 504": "Information Organization and Management",
		"libr 505": "Research Methods",
		"libr 506": "Human-Information Interaction",
		"libr 507": "Methods of Research",
		"libr 508": "Information Practices",
		"libr 509": "Resource Description and Knowledge Organization",
		"libr 511": "Cataloguing & Classification",
		"libr 512": "Indexing",
		"libr 516": "Information Asset Management",
		"libr 520": "Children's Literature",
		"libr 521": "Contemporary Children's Literature",
		"libr 523": "Canadian Children's Literature",
		"libr 527": "Services for Children",
		"libr 528": "Young Adult Services",
		"libr 529": "Family Services & Literacy",
		"libr 531": "Client-Centred Services",
		"libr 532": "Science/Technology Services",
		"libr 533": "Legal Information Services",
		"libr 534": "Health Information Services",
		"libr 535": "Instructional Role",
		"libr 551": "Automation & Systems",
		"libr 554": "Database Design",
		"libr 555": "Information Design I - Systems",
		"libr 557": "Information Retrieval Systems",
		"libr 573": "Financial Management",
		"libr 574": "Project Management",
		"libr 575": "Academic Libraries",
		"libr 580": "Collection Management",
		"libr 581": "Digital Libraries",
		"libr 582": "Digital Images & Text",
		"libr 587": "Preservation",
		"libr 594": "Directed Study",
		"libr 597": "Research Collaboration",
		"ling 100": "Introduction to Language & Linguistics",
		"ling 101": "Languages of the World",
		"ling 140": "Challenging Language Myths",
		"ling 200": "Linguistic Theory & Analysis I",
		"ling 201": "Linguistic Theory and Analysis II",
		"ling 209": "Topics in Speech, Language, and Hearing",
		"ling 222": "Language Acquisition",
		"ling 300": "Study of Grammar",
		"ling 311": "Study of Phonology",
		"ling 313": "Introduction to Speech Science",
		"ling 314": "Instrumental Phonetics",
		"ling 319": "Comparative & Historical Linguistics",
		"ling 327": "Introduction to Semantics",
		"ling 333": "Research Methods in Linguistics",
		"ling 345": "Pragmatics",
		"ling 405": "Morphology",
		"ling 431": "Field Methods I",
		"ling 432": "Field Methods II",
		"ling 433": "Native Languages of the Americas",
		"ling 445": "Sociolinguistics",
		"ling 449": "Honours Essay",
		"ling 451": "Acquisition of Phonology",
		"ling 452": "Acquisition of Syntax",
		"ling 508": "Phonetic Theory",
		"ling 510": "Phonological Theory & Analysis",
		"ling 518": "Advanced Research Seminar",
		"ling 520": "Syntactic Theory and Analysis",
		"ling 525": "Semantic Theory",
		"ling 531": "Field Methods in Linguistics I",
		"ling 532": "Field Methods in Linguistics II",
		"lled 200": "Introduction to Academic and Professional Writing",
		"lled 201": "Critical Reading and Writing",
		"lled 210": "Images in Texts",
		"lled 211": "Social Processes of Inclusion/Exclusion",
		"lled 212": "Language Communities",
		"lled 213": "Intercultural Communication",
		"lled 220": "Translation in Global Society",
		"lled 221": "Language Maintenance",
		"lled 222": "Language Practices",
		"lled 223": "World Englishes",
		"lled 391": "Theory & Practice of Reading Instruction",
		"lled 441": "Introduction to Teaching Children's Literature",
		"lled 446": "Teaching Illustrated Materials",
		"lled 450": "Teaching & Learning in Kindergarten & Primary",
		"lled 452": "Literature for Contemporary Intermediate-Secondary",
		"lled 459": "Trends and Issues in Reading Instruction",
		"lled 462": "School Library Resource Centre Programs",
		"lled 469": "Resource-Based Teaching",
		"lled 479": "Education of Immigrant Students",
		"lled 501": "Discourse & Talk",
		"lled 526": "Second Language Assessment: Classroom & External Approaches",
		"lled 552": "Theoretical Foundations of Reading",
		"lled 557": "Family Literacy",
		"lled 570": "Theory and Research in English Education",
		"lled 577": "Culture & Politics of Second Language",
		"lled 601": "Theory of Language & Literacy Research",
		"lled 602": "Critical Analysis of Issues & Methods",
		"math 100": "Differential Calculus with Applications",
		"math 101": "Integral Calculus with Applications",
		"math 102": "Differential Calculus for Life Sciences",
		"math 103": "Integral Calculus for Life Sciences",
		"math 104": "Differential Calculus for Commerce and Social Sciences",
		"math 105": "Integral Calculus for Commerce and Social Sciences",
		"math 110": "Differential Calculus",
		"math 120": "Differential Calculus",
		"math 121": "Integral Calculus",
		"math 152": "Linear Systems",
		"math 180": "Differential Calculus with Physical Applications",
		"math 184": "Differential Calculus for Social Sciences and Commerce",
		"math 190": "Calculus Survey",
		"math 200": "Calculus III",
		"math 210": "Introduction to Mathematical Computing",
		"math 215": "Elementary Differential Equations I",
		"math 217": "Multivariable & Vector Calculus",
		"math 220": "Mathematical Proof",
		"math 221": "Matrix Algebra",
		"math 223": "Linear Algebra I",
		"math 226": "Advanced Calculus I",
		"math 227": "Advanced Calculus II",
		"math 253": "Multivariable Calculus",
		"math 255": "Ordinary Differential Equations",
		"math 256": "Differential Equations",
		"math 257": "Partial Differential Equations",
		"math 264": "Vector Calculus for Electrical Engineering",
		"math 300": "Introduction to Complex Variables",
		"math 301": "Applied Analysis",
		"math 302": "Introduction to Probability",
		"math 303": "Introduction to Stochastic Processes",
		"math 305": "Applied Complex Analysis",
		"math 307": "Applied Linear Algebra",
		"math 308": "Euclidean Geometry",
		"math 310": "Abstract Linear Algebra",
		"math 312": "Introduction to Number Theory",
		"math 313": "Topics in Number Theory",
		"math 316": "Elementary Differential Equations II",
		"math 317": "Calculus IV",
		"math 318": "Probability with Physical Applications",
		"math 320": "Real Variables I",
		"math 321": "Real Variables II",
		"math 322": "Introduction to Algebra",
		"math 323": "Introduction to Rings & Modules",
		"math 335": "Introduction to Mathematics",
		"math 340": "Introduction to Linear Programming",
		"math 342": "Algebra, Coding, and Cryptography",
		"math 345": "Applied Nonlinear Dynamics & Chaos",
		"math 360": "Mathematical Modelling in Science",
		"math 400": "Applied Partial Differential Equations",
		"math 401": "Green's Functions & Variational Methods",
		"math 405": "Numerical Methods for Differential Equations",
		"math 406": "Variational & Approximation Methods",
		"math 414": "Mathematical Demonstrations",
		"math 418": "Probability",
		"math 419": "Stochastic Processes",
		"math 420": "Real Analysis I",
		"math 421": "Real Analysis II",
		"math 422": "Groups & Fields",
		"math 423": "Topics in Algebra",
		"math 425": "Introduction to Modern Differential Geometry",
		"math 427": "Topics in Topology",
		"math 437": "Number Theory",
		"math 440": "Complex Analysis",
		"math 441": "Modern Discrete Optimization Problems",
		"math 442": "Optimization in Graphs & Networks",
		"math 444": "Mathematical Research & Writing",
		"math 450": "Asymptotic & Perturbation Methods",
		"math 501": "Algebra I",
		"math 502": "Algebra II",
		"math 503": "Discrete Mathematics",
		"math 507": "Measure Theory & Integration",
		"math 508": "Complex Analysis",
		"math 510": "Functional Analysis",
		"math 515": "Partial Differential Equations of Fluids",
		"math 516": "Partial Differential Equations I",
		"math 521": "Numerical Analysis of Partial Differential Equations",
		"math 523": "Combinatorial Optimization",
		"math 525": "Differential Geometry I",
		"math 527": "Algebraic Topology I",
		"math 532": "Algebraic Geometry I",
		"math 534": "Lie Theory I",
		"math 537": "Elementary Number Theory",
		"math 539": "Analytic Number Theory",
		"math 541": "Harmonic Analysis I",
		"math 544": "Probability I",
		"math 545": "Probability II",
		"math 546": "Continuous Time Stochastics",
		"math 550": "Methods of Asymptotic Analysis",
		"math 551": "Perturbation Differential Equations",
		"math 552": "Introduction to Dynamical Systems",
		"math 559": "Complex Fluids",
		"math 562": "Mathematical Electrophysiology",
		"math 589": "MSc Major Essay",
		"mdvl 210": "Introduction to Medieval Studies",
		"mdvl 301": "European Literature 5th-14th Century",
		"mech 220": "Technical Skills Practicum",
		"mech 221": "Engineering Science I",
		"mech 222": "Engineering Science II",
		"mech 223": "Mechanical Design",
		"mech 224": "Engineering Concepts I",
		"mech 225": "Engineering Concepts II",
		"mech 226": "Technical Communication",
		"mech 260": "Mechanics of Materials",
		"mech 280": "Fluid Mechanics",
		"mech 305": "Data Analysis & Mechanical Engineering",
		"mech 306": "Data Analysis Mechanical Lab",
		"mech 325": "Mechanical Design I",
		"mech 326": "Mechanical Design II",
		"mech 327": "Thermal Systems Design",
		"mech 328": "Mechanical Engineering Project",
		"mech 329": "Materials and Mechanical Design",
		"mech 358": "Engineering Analysis",
		"mech 360": "Mechanics of Materials",
		"mech 366": "Mechatronic Systems",
		"mech 368": "Measurements & Instrumentation",
		"mech 375": "Heat Transfer I",
		"mech 380": "Fluid Dynamics",
		"mech 386": "Industrial Fluid Mechanics",
		"mech 392": "Manufacturing Processes",
		"mech 405": "Acoustics & Noise Control",
		"mech 420": "Sensors & Actuators",
		"mech 421": "Mechatronic Systems Instrumentation",
		"mech 423": "Biomechatronics",
		"mech 431": "Engineering Economics",
		"mech 433": "Biofluids",
		"mech 435": "Orthopaedic Biomechanics",
		"mech 436": "Fundamentals of Injury Biomechanics",
		"mech 439": "Biomechanics Research",
		"mech 445": "Fuel Cell Systems",
		"mech 454": "Thermofluids Capstone",
		"mech 457": "Design Project",
		"mech 458": "Mechatronics Design Project",
		"mech 459": "Biomedical Design Project",
		"mech 460": "Mechanics of Materials",
		"mech 462": "Finite Element Analysis",
		"mech 463": "Mechanical Vibrations",
		"mech 464": "Industrial Robotics",
		"mech 466": "Automatic Control",
		"mech 467": "Computer Control of Mechanical Systems",
		"mech 468": "Modern Control Engineering",
		"mech 469": "Dynamic Systems Modelling",
		"mech 470": "Energy Conversion Systems",
		"mech 473": "Heating, Ventilation, and Air Conditioning",
		"mech 478": "Internal Combustion Engines",
		"mech 479": "Computational Fluid Dynamics",
		"mech 481": "Aerodynamics of Aircraft I",
		"mech 484": "Aircraft Design: Aerodynamics",
		"mech 485": "Aircraft Design: Structures",
		"mech 488": "Introduction to Ship Hydrodynamics",
		"mech 489": "Experimental Thermofluids",
		"mech 491": "Computer Aided Manufacturing",
		"mech 493": "Integrated Aircraft Research",
		"mech 495": "Industrial Engineering",
		"mech 502": "Fluid Mechanics",
		"mech 505": "Industrial Acoustics & Vibrations",
		"mech 506": "Linear Vibrations",
		"mech 510": "Transport Phenomena I",
		"mech 514": "Linear Finite Element Analysis: Solids & Heat",
		"mech 520": "Control Sensors & Actuators",
		"mech 522": "Foundations of Control Engineering",
		"mech 529": "Modelling of Dynamic Systems",
		"mech 533": "Biofluids",
		"mech 535": "Orthopaedic Biomechanics",
		"mech 536": "Fundamentals of Injury Biomechanics",
		"mech 543": "Acoustics & Control",
		"mech 545": "Fuel Cell Systems",
		"mech 552": "Electromechanical Systems Design Project",
		"mech 555": "Microelectromechanical Systems",
		"mech 563": "Robotics: Kinematics & Dynamics",
		"mech 572": "Convective Heat Transfer",
		"mech 576": "Combustion",
		"mech 578": "Internal Combustion Engines",
		"mech 582": "Experimental Fluid Mechanics",
		"mech 584": "Advanced Engineering Acoustics",
		"mech 589": "Multi-Axis Machining",
		"mech 592": "Machine Tool Structures & Vibrations",
		"mech 596": "CAD/CAM Principles & Practice",
		"mech 597": "Project in Mechanical Studies",
		"mech 598": "Research Seminar",
		"mech 698": "Seminar",
		"medg 410": "Immunogenetics",
		"medg 419": "Human Cytogenetics",
		"medg 420": "Human Biochemical Genetics",
		"medg 421": "Genetic & Cellular Biology of Cancer",
		"medg 505": "Genome Analysis",
		"medg 520": "Advanced Human Molecular Genetics",
		"medg 521": "Biology of Cancer",
		"medg 530": "Advanced Human Genetics",
		"medg 535": "Genetics & Ethics",
		"medg 545": "Topics in Medical Genetics Research",
		"medg 550": "Concepts in Clinical Genetics",
		"medg 570": "Introduction to Clinical Laboratory Rotation",
		"medg 575": "Advanced Clinical Rotation",
		"medi 501": "Molecular & Cell Biology",
		"medi 502": "Experimental Medicine Methods",
		"medi 530": "Gastroenterology",
		"medi 535": "Research Seminar",
		"medi 549": "M.Sc. Thesis",
		"medi 560": "Pulmonary Pathophysiology",
		"medi 570": "Cardiology",
		"medi 590": "Molecular Regulation of Cell Growth",
		"micb 201": "Introductory Environmental Microbiology",
		"micb 202": "Medical Microbiology & Immunology",
		"micb 203": "Basic Microbiology Laboratory",
		"micb 301": "Microbial Ecophysiology",
		"micb 302": "Immunology",
		"micb 306": "Molecular Virology",
		"micb 308": "Paradigms of Bacterial Pathogenesis",
		"micb 322": "Molecular Microbiology Laboratory",
		"micb 323": "Molecular Immunology & Virology Laboratory",
		"micb 325": "Microbial Genetics",
		"micb 353": "Food Microbiology Laboratory",
		"micb 401": "Environmental Microbiology Laboratory",
		"micb 402": "Advanced Immunology",
		"micb 404": "Topics in Molecular Bacterial Pathogenesis",
		"micb 405": "Bioinformatics",
		"micb 406": "Topics in Molecular Virology",
		"micb 407": "Viral Infections in Humans",
		"micb 408": "Advanced Bacterial Pathogens",
		"micb 412": "Topics in Immunology Research",
		"micb 418": "Microbiology & Biotechnology",
		"micb 421": "Experimental Microbiology",
		"micb 424": "Cellular Dynamics of Bacteria",
		"micb 425": "Microbial Ecological Genomics",
		"micb 447": "Experimental Research",
		"micb 449": "Research Problem",
		"micb 502": "Advanced Immunogenetics",
		"micb 507": "Topics in Molecular Pathogenesis & Immunity",
		"midw 101": "Counselling for Maternity Care Providers",
		"midw 102": "Birth Meanings",
		"midw 103": "Applied Health Services",
		"midw 104": "Lactation Consultation",
		"midw 105": "Theory & Practice",
		"midw 110": "Critical Appraisal of Literature",
		"midw 125": "Pharmacology",
		"midw 205": "Primary Care Theory",
		"midw 215": "Ethics in Maternity Care",
		"midw 221": "Clinical Skills",
		"midw 305": "Theory of Variations in Primary Care",
		"midw 310": "Senior Research Project",
		"midw 405": "Advanced Topics",
		"midw 430": "Comprehensive Theory & Practice",
		"mine 224": "Mineralogy for Mining Engineering",
		"mine 291": "Introduction to Mining",
		"mine 292": "Introduction to Mineral Processing",
		"mine 302": "Underground Mine Design",
		"mine 303": "Rock Mechanics Fundamentals",
		"mine 304": "Rock Fragmentation",
		"mine 310": "Surface Mine Design",
		"mine 331": "Physical Mineral Processing",
		"mine 333": "Flotation",
		"mine 350": "Modelling & Simulation",
		"mine 393": "Mining Seminar",
		"mine 396": "Engineering Economics",
		"mine 402": "Ventilation & Occupational Health",
		"mine 403": "Rock Mechanics",
		"mine 404": "Mine Management",
		"mine 432": "Industrial Automation and Robotics",
		"mine 434": "Process Pre-Metallurgy",
		"mine 438": "Advanced Process Mineralogy",
		"mine 462": "Coal Preparation Technology",
		"mine 480": "Mine Waste Management",
		"mine 482": "Maintenance Engineering",
		"mine 485": "Cave Mining Systems: Design & Practice",
		"mine 486": "Mining & the Environment",
		"mine 488": "Heavy Oil Sand Mining",
		"mine 491": "Mineral Plant Feasibility",
		"mine 493": "Seminar",
		"mine 506": "Mining Methods",
		"mine 515": "Mining in the Future",
		"mine 520": "Advanced Coal Preparation",
		"mine 524": "Process Pre-Metallurgy of Ore",
		"mine 541": "Environmental Technical Issues",
		"mine 544": "Mining Environmental Cases",
		"mine 552": "Mining Geostatistics",
		"mine 553": "Management Sciences Methods",
		"mine 554": "Mineral Economics and Finance",
		"mine 555": "Mining & Society",
		"mine 556": "Rock Slope",
		"mine 582": "Maintenance Engineering",
		"mine 597": "Engineering Project",
		"mine 598": "Seminar",
		"mine 698": "Seminar",
		"mrne 415": "Structure & Function of Marine Animals",
		"mrne 425": "Ecology and Adaptation of Seaweeds",
		"mrne 437": "Population & Community Ecology of Marine Organisms",
		"mrne 480": "Seminars & Papers in Marine Science",
		"mtrl 201": "Technical Communication",
		"mtrl 250": "Metallurgical Thermodynamics I",
		"mtrl 252": "Pyrometallurgy",
		"mtrl 263": "Transport Phenomena I",
		"mtrl 264": "Heat Transport",
		"mtrl 280": "Materials in Design",
		"mtrl 340": "Manufacturing",
		"mtrl 350": "Metallurgical Thermodynamics II",
		"mtrl 358": "Hydrometallurgy I",
		"mtrl 359": "Hydrometallurgy I Laboratory",
		"mtrl 361": "Modelling of Materials Processing",
		"mtrl 363": "Mass Transport",
		"mtrl 365": "Mechanical Behaviour of Materials",
		"mtrl 378": "Phase Transformations",
		"mtrl 381": "Structure & Properties Laboratory",
		"mtrl 382": "Ceramics",
		"mtrl 392": "Engineering Technical Communication",
		"mtrl 394": "Polymer & Polymer Matrix Composites",
		"mtrl 442": "Coatings & Surface Modification",
		"mtrl 451": "Microstructural Analysis",
		"mtrl 455": "Economic Aspects",
		"mtrl 456": "Environmental Degradation of Materials",
		"mtrl 458": "Hydrometallurgy II",
		"mtrl 460": "Monitoring & Optimization",
		"mtrl 466": "Engineering Project I",
		"mtrl 467": "Engineering Project II",
		"mtrl 471": "Nanofibre Technology",
		"mtrl 472": "Welding & Joining of Materials",
		"mtrl 475": "Microstructure Engineering",
		"mtrl 478": "Electronic Materials",
		"mtrl 485": "Failure of Materials",
		"mtrl 486": "Nondestructive Evaluation",
		"mtrl 489": "Seminar III",
		"mtrl 494": "Composite Materials",
		"mtrl 495": "Biomaterials",
		"mtrl 515": "Materials Manufacturing",
		"mtrl 557": "Separation Science in Aqueous Metal Processing",
		"mtrl 559": "Advanced Hydrometallurgy",
		"mtrl 562": "Finite Element Heat Transfer",
		"mtrl 564": "Hydrometallurgical Reactor Design",
		"mtrl 571": "Advanced Nanofibre Technology",
		"mtrl 578": "Microstructural Evolution in Deformed Metals",
		"mtrl 579": "Physical Microfabrication",
		"mtrl 582": "Advanced Ceramics",
		"mtrl 585": "Topics in Fracture Mechanics",
		"mtrl 594": "Advanced Composite Materials",
		"mtrl 595": "Advanced Biomaterials",
		"mtrl 599": "Master's Thesis",
		"musc 100": "Principles of Musical Form",
		"musc 101": "Diatonic Harmony & Voice Leading",
		"musc 103": "Introduction to Music Theory",
		"musc 104": "Introduction to Diatonic",
		"musc 112": "Classical Brass & Percussion",
		"musc 119": "Introduction to Music Technology",
		"musc 120": "History of Music I",
		"musc 121": "History of Music II",
		"musc 122": "Classical Woodwinds",
		"musc 131": "Classical Voice",
		"musc 135": "Opera Repertoire I",
		"musc 141": "Classical Piano I",
		"musc 149": "Collaborative Piano I",
		"musc 163": "Contemporary Players",
		"musc 164": "Jazz Ensemble",
		"musc 167": "Piano Chamber",
		"musc 170": "Lyric Diction",
		"musc 200": "Chromatic Harmony & Voice Leading",
		"musc 201": "Musical Forms",
		"musc 220": "History of Music III",
		"musc 221": "History of Music IV",
		"musc 235": "Opera Repertoire 2",
		"musc 241": "Classical Piano II",
		"musc 249": "Collaborative Piano II",
		"musc 300": "Composition & Analysis Approaches to Post-Tonal",
		"musc 305": "Readings in Orchestral Repertoire",
		"musc 309": "Instrumentation",
		"musc 310": "Orchestration",
		"musc 311": "Conducting",
		"musc 312": "Instrumental Conducting",
		"musc 313": "Choral Conducting",
		"musc 320": "Computer Music",
		"musc 323": "History of Popular Music",
		"musc 336": "Opera Theatre Technique 1",
		"musc 349": "Keyboard Harmony & Transposition",
		"musc 354": "Baroque Music",
		"musc 358": "History of Jazz",
		"musc 410": "Introduction to Schenkerian Analysis",
		"musc 414": "Counterpoint",
		"musc 415": "Imaging Musical Performance",
		"musc 436": "Opera Theatre Technique 2",
		"musc 440": "Piano Pedagogy II: Applied",
		"musc 441": "Vocal Techniques",
		"musc 454": "History of Opera I",
		"musc 465": "Song Repertoire II",
		"musc 506": "Orchestral Repertoire",
		"musc 529": "Introduction to Ethnomusicology",
		"musc 535": "Art Song Interpretation and Performance",
		"musc 553": "UBC Singers",
		"musc 557": "Early Music Ensemble",
		"musc 559": "UBC Chamber Strings",
		"musc 563": "Contemporary Players",
		"name 501": "Advanced Ship Structures",
		"name 502": "Advanced Ship Hydrodynamics",
		"name 522": "Ship Production Industrial Engineering",
		"name 524": "Shipbuilding Project Management",
		"name 566": "Ship Dynamics and Control",
		"name 578": "Marine Engineering",
		"name 591": "Computer Ship Design",
		"nest 101": "Near Eastern & Egyptian Archaeology",
		"nest 301": "Ancient Near East",
		"nest 303": "History of Ancient Egypt",
		"nest 304": "Art & Archaeology of Egypt",
		"nest 318": "Egyptomania",
		"nest 401": "Ancient Egyptian Literature",
		"nest 505": "Ancient Egyptian Literature",
		"nrsc 500": "Neuroscience I",
		"nrsc 501": "Neuroscience II",
		"nrsc 549": "Master's Thesis",
		"nurs 302": "Foundations of Nursing Practice",
		"nurs 303": "Adults & Families",
		"nurs 304": "Relational Practice",
		"nurs 305": "Critical Inquiry & Research",
		"nurs 306": "Leadership, Ethics",
		"nurs 333": "Childbearing Women",
		"nurs 334": "Infants, Children, and Youth",
		"nurs 335": "Adult Mental Illness",
		"nurs 336": "Community & Population",
		"nurs 337": "Adults & Families",
		"nurs 338": "Relational Diversity in Health Experience",
		"nurs 339": "Critical Inquiry & Research Practice",
		"nurs 341": "Practice Praxis",
		"nurs 343": "Leadership, Ethics, and Policy",
		"nurs 344": "Synthesis Project",
		"nurs 420": "Adult Acute Conditions",
		"nurs 422": "Childbearing Families",
		"nurs 423": "Children & Families",
		"nurs 424": "Mental Health Concerns",
		"nurs 425": "Community & Population Health",
		"nurs 502": "Ethical & Political Issues in Nursing",
		"nurs 504": "Research Evidence",
		"nurs 505": "Statistical Literacy in Nursing",
		"nurs 506": "Health Promotion Practice",
		"nurs 507": "Pharmacology in Primary Care",
		"nurs 508": "Pathophysiological Processes",
		"nurs 509": "Clinical Procedures in Primary Care",
		"nurs 510": "Advanced Health Assessment",
		"nurs 511": "Foundations of Nursing Practice",
		"nurs 512": "Leadership in Nursing",
		"nurs 520": "Administrative Leadership in Nursing",
		"nurs 530": "Advanced Practice Nursing",
		"nurs 540": "Educational Practice in Nursing",
		"nurs 542": "Social Epidemiology",
		"nurs 549": "Quantitative Methods & Analysis",
		"nurs 552": "Methods in Nursing Science",
		"nurs 554": "Advanced Quantitative Design",
		"nurs 570": "Primary Care I",
		"nurs 571": "Primary Care II",
		"nurs 572": "Primary Care III",
		"nurs 578": "Family Nursing Practice",
		"nurs 580": "Philosophy of Evidence",
		"nurs 591": "Ethical & Professional Issues",
		"nurs 595": "MSN Major Essay",
		"nurs 596": "Primary Care Project",
		"nurs 599": "Master's Thesis",
		"obst 501": "Reproductive Endocrinology I",
		"obst 502": "Physiology of Mother, Fetus, and Newborn",
		"obst 503": "Fetal & Perinatal Metabolism",
		"obst 504": "Reproductive Endocrinology II",
		"obst 506": "Seminar in Reproductive Biology",
		"obst 507": "Perinatal Epidemiology",
		"obst 549": "M.Sc. Thesis",
		"onco 502": "Concepts in Oncology",
		"path 300": "Background to Medical Laboratory",
		"path 301": "Biochemistry for Medical Laboratory",
		"path 303": "Cytogenetics",
		"path 304": "Human Histology",
		"path 305": "Modern Microscopy",
		"path 306": "Medical Laboratory Safety",
		"path 327": "Bacteriology, Mycology, Virology & Parasitology",
		"path 375": "Introduction to Human Pathology",
		"path 402": "Haematology",
		"path 404": "Histochemistry",
		"path 405": "Seminar in Current Topics",
		"path 406": "Clinical Chemistry",
		"path 407": "Medical Laboratory Toxicology",
		"path 408": "Laboratory Administration",
		"path 415": "Immunopathology",
		"path 427": "Infection Control",
		"path 437": "Viral Infections",
		"path 451": "Clerkship in Laboratory Medicine",
		"path 467": "Microbial Infection Control",
		"path 477": "Epidemiology of Infection Control",
		"path 501": "Foundations of Human Histopathology",
		"path 502": "Topics in Pathology Research",
		"path 531": "Biology of Cancer",
		"path 535": "Seminar",
		"path 547": "Techniques in Molecular Biology & Experimentation",
		"path 549": "MSc Thesis",
		"path 635": "Seminar",
		"pcth 201": "Drugs & Society",
		"pcth 300": "Introduction to Pharmacology",
		"pcth 302": "Introduction to Pharmacology",
		"pcth 305": "Human Pharmacology",
		"pcth 325": "Renal Basis of Drug Therapy",
		"pcth 400": "Systematic Pharmacology",
		"pcth 402": "Systematic Pharmacology Laboratory",
		"pcth 404": "Drug Assay & Pharmacology",
		"pcth 502": "Drugs & Intercellular Communication",
		"pcth 512": "Design & Bioassay",
		"pcth 513": "Pharmacology of Anaesthesia",
		"pcth 549": "MS Thesis",
		"pers 100": "Basic Persian 1",
		"pers 101": "Basic Persian 2",
		"pers 104": "Persian Writing & Reading",
		"pers 200": "Intermediate Persian 1",
		"pers 201": "Intermediate Persian 2",
		"pers 300": "Advanced Persian 1",
		"phar 303": "Pharmacy II",
		"phar 315": "Pharmacokinetics",
		"phar 321": "Biophysical Pharmacy I",
		"phar 323": "Biophysical Pharmacy II",
		"phar 330": "Bio Pharmaceutical Chemistry I",
		"phar 341": "Pharmacology I",
		"phar 342": "Pharmacology II",
		"phar 351": "Therapeutics I",
		"phar 352": "Therapeutics II",
		"phar 361": "Non-Prescription Drugs 1",
		"phar 362": "Non-Prescription Drugs 2",
		"phar 371": "Pathophysiology I",
		"phar 399": "Cases in Pharmacy II",
		"phar 400": "Pharmacy Management",
		"phar 401": "Pharmacy Skills III",
		"phar 403": "Administration of Injections",
		"phar 404": "Peer Teaching 2",
		"phar 406": "Drug Safety",
		"phar 408": "Clinical Pharmacokinetics",
		"phar 409": "Renal Pharmacotherapeutics",
		"phar 430": "Pharmaceutical Chemistry II",
		"phar 435": "Pharmaceutical Chemistry III",
		"phar 440": "Pain Research & Therapy",
		"phar 441": "Pharmacology III",
		"phar 442": "Pharmacology IV",
		"phar 448": "Environmental & Cellular Toxicology",
		"phar 451": "Therapeutics III",
		"phar 452": "Therapeutics IV",
		"phar 454": "Pediatric and Geriatric Drug Therapy",
		"phar 456": "Pharmacoeconomics & Technology Assessment",
		"phar 457": "Pharmaceutical Care for Aboriginal Peoples",
		"phar 458": "Oncology Pharmacotherapy",
		"phar 460": "Natural Health Products",
		"phar 461": "Non-Prescription Drugs 3",
		"phar 462": "Non-Prescription Drugs 4",
		"phar 471": "Pathophysiology II",
		"phar 472": "Pathophysiology III",
		"phar 498": "Pharmaceutical Sciences III",
		"phar 499": "Cases in Pharmaceutical Sciences IV",
		"phar 501": "Advanced Pharmacotherapy",
		"phar 502": "Advanced Concepts in Pharmaceutics",
		"phar 506": "Critical Appraisal of Literature",
		"phar 508": "Advanced Applied Clinical Pharmacy",
		"phar 515": "Nanomedicines",
		"phar 518": "Diagnostic Imaging & Radiopharmacy",
		"phar 525": "Pharmaceutical Research Techniques I",
		"phar 526": "Pharmaceutical Research Techniques II",
		"phar 543": "Advanced Laboratory in Pharmaceutics",
		"phar 548": "Seminar",
		"phar 554": "Advanced Hospital Pharmacy Management",
		"phar 590": "Pharmaceutical Research: Principles & Methods",
		"phil 100": "Introduction to Philosophy",
		"phil 101": "Introduction to Philosophy",
		"phil 102": "Introduction to Philosophy II",
		"phil 120": "Logic and Critical Thinking",
		"phil 125": "Scientific Reasoning",
		"phil 150": "Minds & Machines",
		"phil 316": "Philosophy after 1800",
		"phil 334": "Sex, Gender, and Philosophy",
		"phil 364": "Darwin, Evolution",
		"phil 371": "Foundations of Chinese Thought",
		"phil 378": "Philosophy & Wisdom in Early India",
		"phil 388": "Buddhist-Brahmanical-Jain Interactions",
		"phil 464": "Philosophy of Biology",
		"phil 485": "Directed Reading",
		"phil 487": "Directed Reading",
		"phil 585": "Directed Reading",
		"phrm 100": "Foundations of Pharmacy",
		"phrm 111": "Medication Management 1",
		"phrm 131": "Study Design & Interpretation 1",
		"phrm 141": "Pharmacy in Practice 1",
		"phrm 161": "Technology in Healthcare",
		"phth 511": "Pathology for Physical Therapy 1",
		"phth 514": "Clinical Practice I",
		"phth 516": "Clinical Decision Making I",
		"phth 517": "Exercise and Movement I",
		"phth 521": "Pathology for Physical Therapy 2",
		"phth 524": "Clinical Practice II",
		"phth 526": "Clinical Decision Making II",
		"phth 527": "Exercise and Movement II",
		"phth 528": "Case Integration I",
		"phth 531": "Pathology for Physical Therapy 3",
		"phth 544": "Clinical Practice IVa",
		"phth 545": "Clinical Practice IVb",
		"phth 548": "Case Integration III",
		"phth 564": "Clinical Practice VI A",
		"phth 565": "Clinical Practice VI B",
		"phth 566": "Clinical Decision Making IV",
		"phys 100": "Introductory Physics",
		"phys 101": "Energy and Waves",
		"phys 102": "Electricity, Light and Radiation",
		"phys 107": "Enriched Physics 1",
		"phys 108": "Enriched Physics 2",
		"phys 109": "Enriched Experimental Physics",
		"phys 117": "Dynamics and Waves",
		"phys 118": "Electricity, Light & Radiation",
		"phys 119": "Experimental Physics Laboratory",
		"phys 153": "Elements of Physics",
		"phys 157": "Introductory Physics for Engineers I",
		"phys 158": "Introductory Physics for Engineers II",
		"phys 159": "Introductory Physics Laboratory",
		"phys 170": "Mechanics I",
		"phys 200": "Relativity and Quanta",
		"phys 203": "Thermal Physics I",
		"phys 210": "Introduction to Computational Physics",
		"phys 216": "Intermediate Mechanics",
		"phys 219": "Intermediate Experimental Physics 1",
		"phys 229": "Intermediate Experimental Physics 2",
		"phys 250": "Introduction to Modern Physics",
		"phys 301": "Electricity & Magnetism",
		"phys 304": "Introduction to Quantum Mechanics",
		"phys 305": "Introduction to Biophysics",
		"phys 306": "Mechanics",
		"phys 309": "Honours Electrical Laboratory",
		"phys 312": "Introduction to Mathematical Physics",
		"phys 314": "Fluids",
		"phys 318": "Experimental Acoustics",
		"phys 319": "Electrical Laboratory",
		"phys 333": "Energy & Climate",
		"phys 341": "Physics of Music",
		"phys 348": "Frontiers in Physics & Astronomy",
		"phys 349": "Directed Research Project",
		"phys 350": "Applied Classical Mechanics",
		"phys 400": "Introduction to Elementary Particles",
		"phys 401": "Electromagnetic Theory",
		"phys 402": "Applications of Quantum Mechanics",
		"phys 403": "Statistical Mechanics",
		"phys 404": "Introduction to Medical Physics",
		"phys 405": "Radiation Biophysics",
		"phys 407": "Introduction to General Relativity",
		"phys 408": "Optics",
		"phys 410": "Computational Physics",
		"phys 438": "Zoological Physics",
		"phys 449": "Honours Thesis",
		"phys 473": "Applied Nuclear Physics",
		"phys 474": "Solid State Physics",
		"phys 500": "Quantum Mechanics I",
		"phys 501": "Quantum Mechanics II",
		"phys 502": "Condensed Matter I",
		"phys 503": "Condensed Matter II",
		"phys 504": "Special Relativity & Electromagnetism",
		"phys 505": "Nuclear Physics",
		"phys 506": "Elementary Particle Physics",
		"phys 508": "Quantum Field Theory",
		"phys 516": "Statistical Mechanics",
		"phys 526": "Quantum Electrodynamics",
		"phys 534": "Radiotherapy Physics I",
		"phys 535": "Radiotherapy Physics II",
		"phys 536": "Advanced Radiation Biophysics",
		"phys 539": "Radiation Dosimetry",
		"phys 540": "Radiological Imaging",
		"phys 541": "Nuclear Medicine",
		"phys 543": "Biomedical Optics",
		"phys 545": "Anatomy, Physiology, and Statistics",
		"phys 560": "Particle Accelerators",
		"phys 565": "Radioisotope Science & Medicine",
		"phys 571": "Physical Cosmology",
		"phys 572": "Experimental Methods in Quantum Matter",
		"plan 425": "Urban Planning Concepts",
		"plan 508": "Planning Theory & History",
		"plan 509": "Urbanism and Global Life",
		"plan 510": "Environment & Sustainability Concepts",
		"plan 517": "Urban Design Theory & Methods",
		"plan 521": "Quantitative Skills",
		"plan 522": "Qualitative Data",
		"plan 524": "Legal Concepts",
		"plan 525": "Planning Practice Methods",
		"plan 542": "City Planning Craft",
		"plan 561": "Seminar in Real Property Development & Planning",
		"plan 580": "Urban Transportation",
		"plan 592": "Urban Restructuring",
		"plan 595": "Natural Resource Management",
		"plan 602": "Planning Theory Advanced Seminar",
		"plan 603": "PhD Colloquium",
		"poli 100": "Introduction to Politics",
		"poli 101": "The Government of Canada",
		"poli 110": "Investigating Politics",
		"poli 220": "Introduction to Comparative Politics",
		"poli 240": "Currents of Political Thought",
		"poli 260": "Introduction to Global Politics",
		"poli 303": "Federalism in Canada",
		"poli 304": "BC Government & Politics",
		"poli 309": "Canadian Perspectives on Human Rights",
		"poli 310": "Parliament & Party",
		"poli 327": "European Integration",
		"poli 332": "Politics",
		"poli 334": "Democratization",
		"poli 345": "Politics",
		"poli 351": "Environmental Politics & Policy",
		"poli 366": "International Political Economy",
		"poli 373": "Ethics in World Politics",
		"poli 377": "Nuclear Weapons Control",
		"poli 380": "Quantitative Methods in Political Science",
		"poli 390": "Honours Seminar",
		"poli 461": "Peace & Conflict",
		"poli 492": "Honours Thesis",
		"pols 300": "Intermediate Polish",
		"pols 424": "Literature & Film in Translation",
		"port 101": "First-Year Portuguese I",
		"port 102": "First-Year Portuguese II",
		"port 110": "Elementary Portuguese",
		"port 201": "Second-Year Portuguese I",
		"port 202": "Second-Year Portuguese II",
		"port 210": "Intermediate Portuguese",
		"port 301": "Advanced Portuguese",
		"port 308": "Portuguese for Business",
		"psyc 101": "Introduction to Biological and Cognitive Psychology",
		"psyc 102": "Introduction to Developmental, Social, Personality, and Clinical Psychology",
		"psyc 207": "Biological & Cognitive Psychology",
		"psyc 208": "Social, Developmental, and Clinical Psychology",
		"psyc 217": "Research Methods",
		"psyc 218": "Analysis of Behavioural Data",
		"psyc 260": "Experimental Psychology & Laboratory",
		"psyc 301": "Brain Dysfunction & Recovery",
		"psyc 302": "Infancy",
		"psyc 304": "Brain & Behaviour",
		"psyc 307": "Cultural Psychology",
		"psyc 311": "Psychology of Sport",
		"psyc 314": "Health Psychology",
		"psyc 315": "Childhood & Adolescence",
		"psyc 319": "Applied Developmental Psychology",
		"psyc 320": "Psychology of Gender",
		"psyc 321": "Environmental Psychology",
		"psyc 325": "Social Issues: Media Content",
		"psyc 331": "Forensic Psychology",
		"psyc 333": "Memory I",
		"psyc 335": "Gambling & Decision Making",
		"psyc 336": "Psychology of Language I",
		"psyc 349": "Honours Seminar",
		"psyc 358": "Evolutionary Psychology",
		"psyc 359": "Advanced Research in Behavioural Sciences",
		"psyc 360": "Biopsychology",
		"psyc 361": "Motivation",
		"psyc 363": "Learning",
		"psyc 365": "Cognitive Neuroscience",
		"psyc 366": "Methods in Research",
		"psyc 367": "Sensation & Perception",
		"psyc 368": "Sensation & Perception",
		"psyc 401": "Clinical Psychology",
		"psyc 404": "Psychology of Religion",
		"psyc 409": "Cognitive Neuropsychology",
		"psyc 449": "Honours Essay",
		"psyc 460": "Hormones & Behaviour",
		"psyc 461": "Hormones & Behaviour",
		"psyc 462": "Drugs & Behavioural Neuroscience",
		"psyc 501": "Health Psychology",
		"psyc 508": "Teaching of Psychology",
		"psyc 523": "Experimental Neuropsychology & Animal Models",
		"psyc 530": "Assessment and Intervention Techniques",
		"psyc 531": "Behavioural Assessment",
		"psyc 536": "Psychopathology of Childhood",
		"psyc 537": "Ethics & Professional Issues in Clinical Psychology",
		"psyc 541": "Introduction to Psychotherapy",
		"psyc 542": "Cognitive/Behavioural Interventions",
		"psyc 549": "Master's Thesis",
		"psyc 560": "Clinical Research Design",
		"psyc 591": "Survey of Social Psychology II",
		"psyc 594": "Psychoneuroendocrinology",
		"punj 100": "Introductory Punjabi 1",
		"punj 102": "Introductory Punjabi",
		"punj 200": "Intermediate Punjabi",
		"punj 300": "Advanced Punjabi",
		"punj 401": "Devotional Literature",
		"relg 101": "Introduction to Abrahamic Religions",
		"relg 201": "Near Eastern & Biblical Mythology",
		"relg 203": "Scriptures of the Near East",
		"relg 206": "Introduction to Judaism",
		"relg 209": "Introduction to the Hebrew Bible",
		"relg 305": "Prophecy & Kingship",
		"relg 306": "Archaeology and the Bible",
		"relg 308": "Midrash & Rabbinic Imagination",
		"relg 309": "Jews & Christians",
		"relg 312": "Jews & Judaism in Canada",
		"relg 316": "Origins of Christian Literature",
		"relg 317": "Origins of Christian Society",
		"relg 321": "Classical Christian Tradition",
		"relg 414": "Gospels & the Historical Jesus",
		"relg 415": "Paul of Tarsus",
		"rgla 371": "Seminar in Religion & Literature",
		"rhsc 420": "Neuroanatomy/Physiology",
		"rhsc 500": "Advanced Concepts in Rehabilitation Research",
		"rhsc 501": "Evaluating Sources of Evidence",
		"rhsc 502": "Rehabilitation Theory",
		"rhsc 503": "Reasoning & Decision-Making",
		"rhsc 505": "Measurement in Practice",
		"rhsc 507": "Developing Rehabilitation Programs",
		"rhsc 509": "Rehabilitation Learning",
		"rhsc 587": "Major Project Part 1",
		"rmes 501": "Development of Environmental Thought",
		"rmes 502": "Seminar in Resources & Environment",
		"rmes 505": "Qualitative Methods in Interdisciplinary Studies",
		"rmes 507": "Human Technology Systems",
		"rmes 510": "Social Ecological Systems",
		"rmes 515": "Watershed Management",
		"rmes 516": "Urban Watersheds",
		"rmes 517": "Watershed Management",
		"rmes 518": "Water and International Development",
		"rmes 520": "Climate Change",
		"rmes 530": "Risk and Resource Management",
		"rmes 550": "Environmental Analysis",
		"rmes 599": "Master's Thesis",
		"rmst 222": "Literature & Culture of the Romance World II",
		"rmst 234": "Introduction to Romance Language Cinema",
		"rsot 511": "Theory & Practice",
		"rsot 513": "Health & Occupation I",
		"rsot 515": "Practical Skills I",
		"rsot 519": "Professional Practice I",
		"rsot 525": "Practical Skills II",
		"rsot 527": "Evidence and Practice I",
		"rsot 545": "Theory and Practical Skills",
		"rsot 547": "Practical Project",
		"rsot 549": "Professional Practice II",
		"rsot 551": "Social Environment",
		"rsot 553": "Developing Effective Practice",
		"russ 101": "Basic Russian I",
		"russ 102": "Basic Russian II",
		"russ 200": "Second-Year Russian",
		"russ 206": "19th-Century Russian Writers",
		"russ 207": "20th-Century Russian Writers",
		"russ 300": "Third-Year Russian",
		"russ 316": "Russia through Film",
		"russ 400": "Fourth-Year Russian",
		"russ 412": "Dostoevsky in Translation",
		"sans 100": "Introductory Sanskrit 1",
		"sans 102": "Introductory Sanskrit",
		"sans 200": "Intermediate Sanskrit",
		"scan 333": "Major Scandinavian Literature",
		"scan 335": "Vikings & Myth",
		"scan 336": "Crime Fiction",
		"scan 414": "Topics in Danish & Northern European Studies",
		"scie 113": "Science Seminar",
		"scie 300": "Communicating Science",
		"soci 100": "Fundamentals of Sociology",
		"soci 200": "Sociology of the Family",
		"soci 220": "Quantitative Methods in Sociology",
		"soci 285": "Citizenship & Identity",
		"soci 324": "Sociology of the Life Course",
		"soci 328": "Social Statistics I",
		"soci 342": "Consumers & Consumption",
		"soci 364": "Built Environment",
		"soci 380": "Sociological Methods of Survey Research",
		"soci 382": "Sociological Methods of Research",
		"soci 423": "Sociology of Food",
		"soci 444": "Sociology of Aging",
		"soci 476": "Interpersonal Dynamics",
		"soci 490": "Contemporary Chinese Society",
		"soci 500": "Social Thought",
		"soci 501": "Contemporary Theory",
		"soci 502": "Research Design & Techniques: Quantitative",
		"soci 503": "Research Design & Techniques: Qualitative",
		"soci 514": "Analyzing Quantitative Data",
		"soci 515": "Qualitative Data Analysis",
		"soil 501": "Advanced Soil Processes",
		"soil 502": "Advanced Soil Management",
		"soil 503": "Advanced Soil Science, Agriculture, and Diagnostics",
		"soil 510": "Land and Water Seminar",
		"soil 515": "Integrated Watershed Management",
		"soil 516": "Urban Watershed Management",
		"soil 518": "Water in International Development",
		"soil 520": "Agricultural Watershed Management",
		"soil 550": "Professional Communication Strategies",
		"sowk 200": "Introduction to Social Welfare",
		"sowk 201": "Introduction to Social Work",
		"sowk 305": "Social Work Practice I",
		"sowk 310": "Interviewing Skills",
		"sowk 316": "Integrative Seminar in Social Work Theory",
		"sowk 320": "Introduction to Social Work Research",
		"sowk 335": "Social Analysis in Social Work",
		"sowk 337": "Culture & Race in Social Work",
		"sowk 400": "Canadian Social Policy",
		"sowk 405": "Social Work Practice II",
		"sowk 416": "Advanced Integrative Seminar in Social Work Theory",
		"sowk 425": "First Nations Social Issues",
		"sowk 450": "Community Mental Health Practice",
		"sowk 451": "Health Care Team",
		"sowk 453": "Disability and Justice",
		"sowk 501": "Advanced Canadian Social Policy",
		"sowk 502": "Social Work Practice",
		"sowk 503": "Communication Skills",
		"sowk 505": "Social Analysis",
		"sowk 510": "First Nations Social Issues",
		"sowk 516": "Foundation MSW Seminar",
		"sowk 521": "Social Work Practice in Addictions",
		"sowk 522": "Family Mediation & Conflict Resolution",
		"sowk 525": "Practice in Mental Health",
		"sowk 531": "Social Work Practice in the Field of Aging",
		"sowk 550": "Social Work & Justice",
		"sowk 551": "Health & Social Care",
		"sowk 559": "Advanced Integrative Seminar",
		"sowk 570": "Directed Study",
		"sowk 571": "International Social Development",
		"sowk 601": "Social Work Doctoral Seminar",
		"sowk 621": "Social Theory, Identity & Ethics",
		"sowk 654": "Advanced Qualitative Inquiry",
		"span 101": "Beginner Spanish I",
		"span 102": "Beginner Spanish II",
		"span 201": "Intermediate Spanish I",
		"span 202": "Intermediate Spanish II",
		"span 206": "Conversational Spanish I",
		"span 207": "Conversational Spanish II",
		"span 221": "Introduction to Literary Analysis",
		"span 222": "Analysis of Hispanic Texts",
		"span 280": "Latin American Revolutions",
		"span 301": "Advanced Spanish I",
		"span 302": "Advanced Spanish II",
		"span 357": "Peninsular Literature to 1700",
		"span 358": "Peninsular Literature from 1700",
		"span 364": "Spanish-American Literature to 1820",
		"span 365": "Spanish-American Literature after 1820",
		"span 402": "Advanced Spanish III",
		"span 410": "Medieval Literature",
		"span 495": "Research Seminar in Literature & Culture",
		"span 504": "Studies in Hispanic Cinema",
		"span 549": "Master's Thesis",
		"spha 501": "Basic Finance",
		"spha 502": "Managerial Accounting",
		"spha 503": "Financial Reporting",
		"spha 510": "Canadian Health Policy",
		"spha 511": "Government, Business & Health Care",
		"spha 521": "Organizational Behaviour",
		"spha 522": "Strategic Human Resource Management",
		"spha 531": "Economic Evaluation",
		"spha 532": "Health Economics",
		"spha 542": "Operations & Logistics",
		"spha 543": "Information Technology Management",
		"spha 551": "Design & Measurement 1",
		"spha 552": "Design & Measurement 2",
		"spha 553": "Program Planning & Evaluation",
		"spha 554": "Applied Statistics in Management",
		"spha 555": "Biostatistics",
		"spha 556": "Social Determinants of Health",
		"spha 557": "Quality in Health Care",
		"spha 562": "Health Care Law",
		"spha 563": "Ethics in Health Care",
		"spph 200": "Sociocultural Determinants",
		"spph 300": "Work and International Health",
		"spph 302": "Topics in Health Informatics",
		"spph 400": "Statistics for Health Sciences",
		"spph 406": "Aging",
		"spph 410": "Improving Public Health",
		"spph 411": "Violence Across the Lifespan",
		"spph 500": "Analytic Methods in Epidemiologic Research",
		"spph 502": "Epidemiologic Methods 1",
		"spph 503": "Epidemiologic Methods 2",
		"spph 504": "Applied Epidemiologic Methods",
		"spph 505": "Scientific Epidemiologic Thinking",
		"spph 506": "Quantitative Research Methods",
		"spph 510": "Measurement in Health Care",
		"spph 511": "Cancer Epidemiology",
		"spph 512": "Design of Clinical Trials",
		"spph 513": "Clinical Epidemiology",
		"spph 514": "Health Care Decision Analysis",
		"spph 515": "Surveillance & Monitoring",
		"spph 516": "Systematic Overviews",
		"spph 517": "Research in Surgical Practice",
		"spph 518": "Mathematical Modelling of Communicable Diseases",
		"spph 519": "Qualitative Methods and Research Design",
		"spph 520": "Control of Communicable Diseases",
		"spph 521": "Approaches to Enquiry",
		"spph 522": "Topics in Environmental Health",
		"spph 523": "Health & Human Security",
		"spph 524": "Biology for Public Health Practice",
		"spph 525": "Issues in Public Health",
		"spph 526": "Leadership in Public Health",
		"spph 527": "Social Determinants of Health",
		"spph 530": "Occupational & Environmental Health",
		"spph 531": "Health Care Systems Analysis",
		"spph 533": "Occupational & Environmental Toxicology",
		"spph 534": "Occupational Health and Illness Processes",
		"spph 535": "Occupational & Environmental Hygiene",
		"spph 536": "Aboriginal Public Health",
		"spph 537": "Perinatal Epidemiology",
		"spph 540": "Health Services Research I",
		"spph 541": "Health Services Research",
		"spph 542": "Seminar in Canadian Health Policy",
		"spph 543": "Outcome Evaluation",
		"spph 544": "Social Determinants of Population Health",
		"spph 545": "Community Health Promotion",
		"spph 547": "Priority Setting",
		"spph 550": "Substance Use and Addiction",
		"spph 555": "Injury Prevention",
		"spph 562": "Chemical & Biological Hazard Measurement",
		"spph 563": "Chemical & Biological Hazard Control",
		"spph 565": "Ergonomics",
		"spph 567": "Quantitative Methods for Experimental Data",
		"stat 200": "Elementary Statistics for Applications",
		"stat 203": "Statistical Methods",
		"stat 241": "Introduction to Probability & Statistics",
		"stat 251": "Elementary Statistics",
		"stat 300": "Intermediate Statistics for Applications",
		"stat 302": "Introduction to Probability",
		"stat 305": "Introduction to Statistical Inference",
		"stat 306": "Relationships in Data",
		"stat 344": "Sample Surveys",
		"stat 357": "Stochastic Signals & Systems",
		"stat 404": "Design & Analysis of Experiments",
		"stat 406": "Methods for Statistical Learning",
		"stat 443": "Time Series and Forecasting",
		"stat 450": "Case Studies",
		"stat 460": "Statistical Inference I",
		"stat 461": "Statistical Inference II",
		"stat 540": "Statistical Methods for High-Dimensional Biology",
		"stat 550": "Techniques of Statistical Consulting",
		"stat 560": "Statistics",
		"stat 561": "Statistics",
		"stat 589": "Master's Thesis",
		"sts 501": "STS Proseminar",
		"sts 502": "STS Core Seminar",
		"sts 597": "STS Master's Colloquium",
		"surg 500": "Surgical Research",
		"surg 510": "Surgery and International Health",
		"surg 512": "Global Disability",
		"surg 514": "Surgical Disaster Response",
		"swed 100": "Elementary Swedish 1",
		"swed 110": "Elementary Swedish 2",
		"swed 200": "Intermediate Swedish 1",
		"swed 210": "Intermediate Swedish 2",
		"thtr 120": "Introduction to Theatre",
		"thtr 130": "Introduction to Acting",
		"thtr 150": "Introduction to Technical Theatre",
		"thtr 210": "Drama Ideas I",
		"thtr 211": "Drama Ideas II",
		"thtr 245": "Play Interpretation & Production",
		"thtr 250": "Technical Production",
		"thtr 271": "Beginning BFA Acting I",
		"thtr 272": "Beginning BFA Acting II",
		"thtr 273": "Beginning Voice & Movement",
		"thtr 274": "Beginning Voice / Movement II",
		"thtr 306": "Costume Design I",
		"thtr 308": "Sound Design",
		"thtr 310": "Drama in Performance",
		"thtr 317": "Introduction to Directing",
		"thtr 320": "History of Theatre I",
		"thtr 323": "History and Theory of Directing",
		"thtr 330": "Performance Study II",
		"thtr 350": "Scenery Production I",
		"thtr 352": "Scene Painting I",
		"thtr 354": "Stage Management",
		"thtr 356": "Costume Construction",
		"thtr 371": "Intermediate BFA Acting I",
		"thtr 372": "Intermediate BFA Acting II",
		"thtr 373": "Intermediate Voice & Movement I",
		"thtr 374": "Intermediate Voice & Movement II",
		"thtr 405": "Scenery Design II",
		"thtr 406": "Costume Design II",
		"thtr 407": "Lighting Design II",
		"thtr 410": "Dramaturgy",
		"thtr 420": "History of Theatre II",
		"thtr 445": "Majors & Honours Seminar",
		"thtr 450": "Scenery Production II",
		"thtr 452": "Scene Painting II",
		"thtr 456": "Costume Construction II",
		"thtr 471": "Advanced BFA Acting I",
		"thtr 472": "Advanced BFA Acting II",
		"thtr 473": "Advanced Speech & Movement I",
		"thtr 474": "Advanced Speech & Movement II",
		"thtr 500": "Bibliography & Research",
		"thtr 505": "Scenery Design Studio I",
		"thtr 506": "Costume Design Studio I",
		"thtr 520": "Direction & Production",
		"udes 501": "Studio in Ecological Regions",
		"udes 502": "Studio in Sustainable Neighbourhoods",
		"udes 504": "History & Theory of Design",
		"udes 505": "Policymaking",
		"ufor 100": "Greening the City",
		"ufor 200": "Urban Forests and Well-Being",
		"ufor 403": "Ecological Restoration",
		"urst 200": "Cities",
		"urst 400": "Seminar in Urban Studies",
		"ursy 510": "Urban Systems & Society",
		"ursy 520": "Urban Systems Planning",
		"vant 148": "Vantage College Project",
		"vant 150": "Sustainability & Engineering Design",
		"visa 110": "Foundations of Computational Visual Arts",
		"visa 180": "Introduction to Studio One",
		"visa 183": "Studio Two",
		"visa 210": "Digital Arts",
		"visa 220": "Drawing",
		"visa 230": "Painting",
		"visa 240": "Introduction to Photography",
		"visa 241": "Introduction to Digital Photography",
		"visa 250": "Introduction to Print Media",
		"visa 260": "Basic Sculpture",
		"visa 310": "Digital Arts I",
		"visa 311": "Digital Arts II",
		"visa 320": "Intermediate Drawing I",
		"visa 321": "Intermediate Drawing II",
		"visa 330": "Intermediate Painting I",
		"visa 331": "Intermediate Painting II",
		"visa 340": "Intermediate Photography I",
		"visa 341": "Intermediate Photography II",
		"visa 351": "Intermediate Print Media II",
		"visa 352": "Intermediate Print Media 3",
		"visa 360": "Intermediate Sculpture I",
		"visa 370": "Special Study I",
		"visa 380": "Studio Theory I",
		"visa 381": "Studio Theory II",
		"visa 480": "Advanced Seminar I",
		"visa 481": "Advanced Seminar II",
		"visa 581": "Studio V",
		"visa 582": "Studio VI",
		"wood 120": "Introduction to Wood Products and Forest Management",
		"wood 225": "Communication Strategies",
		"wood 241": "Programming for Wood Products Applications",
		"wood 244": "Quantitative Methods in Wood",
		"wood 249": "Contemporary Topics",
		"wood 276": "Mechanics of Wood Products",
		"wood 280": "Wood Anatomy and Identification",
		"wood 282": "Wood Physics and Drying",
		"wood 290": "Secondary Wood Products Manufacturing",
		"wood 292": "2-D & Solid Computer Graphics",
		"wood 330": "Industrial Engineering",
		"wood 356": "Machine Components",
		"wood 373": "Wood Adhesives & Coatings",
		"wood 384": "Wood Sawmilling and Drying",
		"wood 386": "Applied Mechanics of Materials",
		"wood 440": "Job Costing & Engineering Economics",
		"wood 461": "Globalization & Sustainability",
		"wood 464": "Wood Finishing",
		"wood 465": "Wood Industry Management",
		"wood 474": "Wood Properties & Products Manufacturing",
		"wood 475": "Properties, Identification & Uses",
		"wood 476": "Wood Structural Design",
		"wood 482": "CAD/CAM",
		"wood 485": "Furniture Construction",
		"wood 487": "Glued Wood Products",
		"wood 491": "Environmental Facility Design",
		"wood 492": "Model Decision Support",
		"wood 493": "Project Programming Major",
		"wood 494": "Principles of Wood Cutting & Tooling",
		"wood 499": "Wood Products Capstone",
		"wrds 150": "Research and Writing in the Humanities",
		"zool 503": "Comparative Animal Physiology",
		"zool 549": "Master's Thesis",
	};
	const ABBREVIATION_MAP = [
		["int calc ap c&ss", "Integral Calculus for Commerce & Social Sciences"],
		["int calc ap ph s", "Integral Calculus with Physical Applications"],
		["dif calc phys ap", "Differential Calculus with Physical Applications"],
		["dif calc commerce", "Differential Calculus for Commerce"],
		["calc socsci comm", "Calculus for Social Sciences & Commerce"],
		["calc soc sci", "Calculus for Social Sciences"],
		["mech beh matls", "Mechanical Behaviour of Materials"],
		["org chem biol sc", "Organic Chemistry for Biological Sciences"],
		["intr complex var", "Introduction to Complex Variables"],
		["fndtns rl es mth", "Foundations of Real Estate Math"],
		["urb&rl es econ", "Urban & Real Estate Economics"],
		["urb rl es econ", "Urban & Real Estate Economics"],
		["rl es manage", "Real Estate Management"],
		["re crit analysis", "Real Estate Critical Analysis"],
		["intr biometrics", "Introduction to Biometrics"],
		["intro acad writ", "Introduction to Academic Writing"],
		["crit read&writ", "Critical Reading & Writing"],
		["crit read writ", "Critical Reading & Writing"],
		["harvest syst&ops", "Harvesting Systems & Operations"],
		["math proof", "Mathematical Proof"],
		["chem integ lab", "Chemistry Integrated Laboratory"],
		["plant physlgy", "Plant Physiology"],
		["adv org chem", "Advanced Organic Chemistry"],
		["nuclear chemisty", "Nuclear Chemistry"],
		["nuclear chemistry", "Nuclear Chemistry"],
		["electrochem eng", "Electrochemical Engineering"],
		["phse transformtn", "Phase Transformations"],
		["phase transformtn", "Phase Transformations"],
		["transport phenom", "Transport Phenomena"],
		["structural chem", "Structural Chemistry"],
		["begin japn", "Beginning Japanese"],
		["cell biology", "Cell Biology"],
		["intro acad", "Introduction to Academic"],
		// Newly added catches surfaced in real query results
		["technical commun", "Technical Communication"],
		["integral tech commun", "Integrated Technical Communication"],
		["res mthd in educ", "Research Methods in Education"],
		["curr inq home ec", "Curriculum Inquiry in Home Economics"],
		["cinematograph ii", "Cinematography II"],
		["cinmtgry&light", "Cinematography & Lighting"],
		["cinmtgry & light", "Cinematography & Lighting"],
		["soc life course", "Sociology of the Life Course"],
		["soci meth survey", "Sociological Methods of Survey Research"],
		["soci of family", "Sociology of the Family"],
		["mo pict prod", "Motion Picture Production"],
		["log & critical think", "Logic and Critical Thinking"],
		["log&critical think", "Logic and Critical Thinking"],
		["mass&enrgy balnc", "Mass & Energy Balances"],
		["eng mtls lab", "Engineering Materials Laboratory"],
		["eng concepts", "Engineering Concepts"],
		["mechanical of material", "Mechanics of Materials"],
		["intro to politic", "Introduction to Politics"],
		["intro to musc thry", "Introduction to Music Theory"],
		["intro to modern asia", "Introduction to Modern Asia"],
		["catastroph earth", "Catastrophic Events and the Earth"],
		["found re apprai", "Foundations of Real Estate Appraisal"],
		["mic fnd real estate ec", "Microeconomic Foundations of Real Estate"],
		["bc law & ethics", "BC Law and Ethics"],
		["mngl econ", "Managerial Economics"],
		["resdnt prp study", "Residential Property Study"],
		["incom prop study", "Income Property Study"],
		["real est inv an", "Real Estate Investment Analysis"],
		["real est dev", "Real Estate Development"],
		["real est fnc ca ctt", "Real Estate Finance & Capital Markets"],
		["mgmt sciences meth", "Management Sciences Methods"],
		["foundat'n eng", "Foundation Engineering"],
		["engr econ anlys", "Engineering Economics Analysis"],
		["analys behaviour data", "Analysis of Behavioural Data"],
		["analys behavior data", "Analysis of Behavioral Data"],
		["algb topology", "Algebraic Topology"],
		["quantm mechanical", "Quantum Mechanics"],
		["artif intell", "Artificial Intelligence"],
		["mach learn", "Machine Learning"],
		["computl ling", "Computational Linguistics"],
	];
	const WORD_EXPANSIONS = {
		intr: "Introduction to", introd: "Introductory", intro: "Introduction to",
		calc: "Calculus", dif: "Differential", diff: "Differential", int: "Integral",
		phys: "Physics", physlgy: "Physiology", phse: "Phase",
		chem: "Chemistry", chemisty: "Chemistry", chemistry: "Chemistry",
		math: "Mathematics", matls: "Materials", mech: "Mechanical", beh: "Behaviour",
		org: "Organic", adv: "Advanced", biol: "Biological", sc: "Sciences",
		ap: "Applications", comm: "Commerce", socsci: "Social Sciences",
		crit: "Critical", read: "Reading", writ: "Writing", japn: "Japanese",
		begin: "Beginning", harvest: "Harvesting", syst: "Systems", ops: "Operations",
		transformtn: "Transformations", phenom: "Phenomena",
		electrochem: "Electrochemistry", fndtns: "Foundations", mth: "Mathematics",
		rl: "Real", es: "Estate", urb: "Urban", manage: "Management",
		acad: "Academic", biometrics: "Biometrics",
		// Newly added — common UBC roster abbreviations
		commun: "Communication", communs: "Communications",
		soci: "Sociology", soc: "Social",
		ling: "Linguistics", thry: "Theory", thy: "Theory",
		integ: "Integrated", "integral": "Integrated",
		eng: "Engineering", engr: "Engineering",
		mtls: "Materials", econ: "Economics", econs: "Economics",
		mgmt: "Management", inq: "Inquiry",
		nrs: "Nursing", nurs: "Nursing", prim: "Primary",
		clin: "Clinical", lrn: "Learning", lrng: "Learning",
		curr: "Curriculum", currc: "Curriculum",
		analys: "Analysis", anlys: "Analysis", anal: "Analysis",
		mass: "Mass", enrgy: "Energy", balnc: "Balances",
		fnc: "Finance", fin: "Finance",
		ldrshp: "Leadership", ethics: "Ethics",
		methds: "Methods", mthd: "Method", mthds: "Methods", meth: "Methods",
		qnt: "Quantitative", qual: "Qualitative",
		mngl: "Managerial", mgrl: "Managerial",
		artif: "Artificial", intell: "Intelligence",
		mach: "Machine", learn: "Learning", lrning: "Learning",
		ling: "Linguistics", computl: "Computational",
		wkshp: "Workshop", sem: "Seminar", smnr: "Seminar",
		introduction: "Introduction", techmthds: "Technical Methods",
		algb: "Algebraic",
		// Single-letter helpers
		i: "I", ii: "II", iii: "III", iv: "IV", v: "V",
	};
	// We want WORD_EXPANSIONS["i"]=>"I" only when the token is exactly "i" — the
	// titleCase fallback already handles other cases, so this is intentional.
	function expandCourseTitle(dept, courseId, rawTitle) {
		if (!rawTitle) return "—";
		const key = `${String(dept).toLowerCase()} ${String(courseId).toLowerCase()}`;
		if (Object.prototype.hasOwnProperty.call(COURSE_TITLES, key)) return COURSE_TITLES[key];
		let t = String(rawTitle).trim();
		// Phrase-level: substitute the matched abbreviation in place, so trailing
		// tokens like "I"/"II" or wrapping words like "Introduction to" survive.
		const lc = t.toLowerCase();
		for (const [abbrev, full] of ABBREVIATION_MAP) {
			const idx = lc.indexOf(abbrev);
			if (idx === -1) continue;
			if (idx === 0 && abbrev.length === lc.length) return full;
			t = t.slice(0, idx) + full + t.slice(idx + abbrev.length);
			break;
		}
		// Word-level expansion. Connector words stay lowercase except when they
		// begin the title (rule of style: "Introduction to" not "Introduction To").
		const CONNECTORS = new Set(["to", "of", "the", "and", "for", "in", "with", "on", "at", "an", "a", "or"]);
		t = t.split(/\s+/).map((tok, i) => {
			const m = tok.match(/^([A-Za-z&]+)([^A-Za-z&].*)?$/);
			if (!m) return tok;
			const word = m[1].toLowerCase();
			const tail = m[2] || "";
			const exp = WORD_EXPANSIONS[word];
			if (exp) return exp + tail;
			if (i > 0 && CONNECTORS.has(word)) return word + tail;
			return titleCase(word) + tail;
		}).join(" ");
		t = t.replace(/\bIntroduction to to\b/g, "Introduction to");
		return t;
	}
	function titleCase(s) {
		if (!s) return s;
		return s.charAt(0).toUpperCase() + s.slice(1);
	}

	// -------------------------------------------------------------------------
	// Title-search synonyms.
	//
	// The dataset stores titles in their abbreviated form ("Artif Intell"), but
	// users naturally type the full English phrase ("artificial intelligence").
	// To bridge the two, when the user's query contains a known full phrase we
	// also OR-in any abbreviation(s) we know about, so a search for
	// "artificial intelligence" surfaces both "Introduction to Artificial
	// Intelligence" AND "Artif Intell 1/2" without forcing the user to know the
	// roster shorthand.
	//
	// Each entry: { keyword: phrase users type, variants: [strings to also IS-match] }
	// All comparisons are lowercase, all matched substrings are wrapped in *...*.
	// -------------------------------------------------------------------------
	const TITLE_SYNONYMS = [
		{ keyword: "artificial intelligence", variants: ["artif intell", "artificial intel"] },
		{ keyword: "machine learning",        variants: ["mach learn", "machn lrning"] },
		{ keyword: "computational linguistics", variants: ["computl ling"] },
		{ keyword: "calculus",                variants: ["calc"] },
		{ keyword: "differential calculus",   variants: ["diff calc", "dif calc"] },
		{ keyword: "integral calculus",       variants: ["int calc"] },
		{ keyword: "communication",           variants: ["commun"] },
		{ keyword: "communications",          variants: ["commun"] },
		{ keyword: "sociology",               variants: ["soci", "soc"] },
		{ keyword: "introduction",            variants: ["intr", "intro"] },
		{ keyword: "advanced",                variants: ["adv"] },
		{ keyword: "fundamentals",            variants: ["fund", "fndmtl", "fnd"] },
		{ keyword: "engineering",             variants: ["eng", "engr"] },
		{ keyword: "mechanics",               variants: ["mech"] },
		{ keyword: "mathematics",             variants: ["math", "mth"] },
		{ keyword: "mathematical",            variants: ["math"] },
		{ keyword: "analysis",                variants: ["analys", "anlys", "anal"] },
		{ keyword: "research",                variants: ["res", "rsrch"] },
		{ keyword: "research methods",        variants: ["res mthd", "res meth"] },
		{ keyword: "curriculum",              variants: ["curr", "currc"] },
		{ keyword: "writing",                 variants: ["writ"] },
		{ keyword: "reading",                 variants: ["read"] },
		{ keyword: "physiology",              variants: ["physlgy"] },
		{ keyword: "phase",                   variants: ["phse"] },
		{ keyword: "transformations",         variants: ["transformtn"] },
		{ keyword: "behaviour",               variants: ["beh"] },
		{ keyword: "topology",                variants: ["topol"] },
		{ keyword: "algebraic",               variants: ["algb"] },
		{ keyword: "quantum",                 variants: ["quantm", "quant"] },
		{ keyword: "probability",             variants: ["prob"] },
		{ keyword: "biology",                 variants: ["biol"] },
		{ keyword: "biological",              variants: ["biol"] },
		{ keyword: "biochemistry",            variants: ["biochem"] },
		{ keyword: "biometrics",              variants: ["biometrics"] },
		{ keyword: "chemistry",               variants: ["chem"] },
		{ keyword: "physics",                 variants: ["phys"] },
		{ keyword: "psychology",              variants: ["psyc"] },
		{ keyword: "real estate",             variants: ["rl es", "real est"] },
		{ keyword: "management",              variants: ["mgmt", "manage"] },
		{ keyword: "managerial",              variants: ["mngl", "mgrl"] },
		{ keyword: "thermodynamics",          variants: ["thermo", "thermodynam"] },
		{ keyword: "electrochemistry",        variants: ["electrochem"] },
		{ keyword: "electrochemical",         variants: ["electrochem"] },
		{ keyword: "harvest",                 variants: ["harvest"] },
		{ keyword: "harvesting",              variants: ["harvest"] },
		{ keyword: "japanese",                variants: ["japn"] },
		{ keyword: "german",                  variants: ["germ"] },
		{ keyword: "korean",                  variants: ["korn"] },
		{ keyword: "professional",            variants: ["prof"] },
		{ keyword: "ethics",                  variants: ["eth"] },
		{ keyword: "issues",                  variants: ["issu", "iss"] },
		{ keyword: "leadership",              variants: ["ldrshp"] },
		{ keyword: "neuropsychology",         variants: ["neuropsych"] },
		{ keyword: "neuroscience",            variants: ["neur", "nrsc"] },
		{ keyword: "computer",                variants: ["comp"] },
		{ keyword: "history",                 variants: ["hist"] },
		{ keyword: "social",                  variants: ["soc"] },
		{ keyword: "social sciences",         variants: ["socsci", "soc sci"] },
		{ keyword: "design",                  variants: ["des"] },
		{ keyword: "differential",            variants: ["dif", "diff"] },
		{ keyword: "applications",            variants: ["ap", "appl"] },
		{ keyword: "energy",                  variants: ["enrgy"] },
		{ keyword: "linear",                  variants: ["lin"] },
		{ keyword: "statistics",              variants: ["stat", "stats"] },
		{ keyword: "statistical",             variants: ["stat"] },
	];

	// Build the IS-list for a title-contains query. Returns either:
	//   one IS object (single match)
	// or
	//   { OR: [IS, IS, ...] } if synonyms expand to multiple variants.
	function buildTitleFilter(dsId, raw) {
		const term = raw.trim().toLowerCase();
		if (!term) return null;
		const wrappedSelf = `*${term}*`;
		const variants = new Set([wrappedSelf]);
		for (const entry of TITLE_SYNONYMS) {
			if (term.includes(entry.keyword)) {
				for (const v of entry.variants) variants.add(`*${v}*`);
			}
		}
		const list = [...variants].map((p) => ({ IS: { [`${dsId}_title`]: p } }));
		if (list.length === 1) return list[0];
		return { OR: list };
	}

	// -------------------------------------------------------------------------
	// Professor name formatting.
	// UBC roster format is "last, first[ middle]" lowercase, with multiple
	// instructors joined by ";". Our job: flip to "First[ Middle] Last",
	// title-case with care for Mc/Mac/O', join multiple profs with " · ".
	// -------------------------------------------------------------------------
	const NAME_LOWERCASE = new Set(["de", "del", "den", "der", "di", "du", "la", "le", "van", "von"]);
	function smartCase(part, isFirstWord) {
		if (!part) return part;
		const lower = part.toLowerCase();
		if (!isFirstWord && NAME_LOWERCASE.has(lower)) return lower;
		// Mc/Mac (Mcdonald → McDonald, Macdonald → MacDonald) — only when followed by ≥2 letters
		if (/^mc[a-z]{2,}$/.test(lower)) return "Mc" + lower.charAt(2).toUpperCase() + lower.slice(3);
		if (/^mac[a-z]{2,}$/.test(lower)) return "Mac" + lower.charAt(3).toUpperCase() + lower.slice(4);
		// O'connor → O'Connor
		if (/^o'[a-z]+$/.test(lower)) return "O'" + lower.charAt(2).toUpperCase() + lower.slice(3);
		// Hyphenated parts
		if (lower.includes("-")) {
			return lower.split("-").map((p, i) => smartCase(p, i === 0)).join("-");
		}
		// Apostrophes inside (e.g., d'arcy)
		if (lower.includes("'")) {
			return lower.split("'").map((p, i) => smartCase(p, i === 0)).join("'");
		}
		return lower.charAt(0).toUpperCase() + lower.slice(1);
	}
	function formatOnePerson(s) {
		const trimmed = String(s || "").trim();
		if (!trimmed) return "";
		// "last, first" → "First Last". If no comma, just title-case as-is.
		if (trimmed.includes(",")) {
			const [last, ...rest] = trimmed.split(",");
			const first = rest.join(",").trim();
			const lastWords = last.trim().split(/\s+/).map((w, i) => smartCase(w, i === 0)).join(" ");
			const firstWords = first.split(/\s+/).map((w, i) => smartCase(w, i === 0)).join(" ");
			return (firstWords + " " + lastWords).trim();
		}
		return trimmed.split(/\s+/).map((w, i) => smartCase(w, i === 0)).join(" ");
	}
	function formatInstructors(raw) {
		if (raw === undefined || raw === null) return "";
		const str = String(raw).trim();
		if (!str) return "—";
		const parts = str.split(";").map((p) => formatOnePerson(p)).filter(Boolean);
		return parts.length === 0 ? "—" : parts.join(" · ");
	}

	// =========================================================================
	// Element handles
	// =========================================================================
	const $ = (id) => document.getElementById(id);
	const form = $("add-form"), idInput = $("dataset-id"), fileInput = $("zip-file");
	const dropzone = $("dropzone"), dropzoneText = $("dropzone-text");
	const submitBtn = $("submit-btn"), messageBox = $("message");
	const grid = $("dataset-grid"), emptyState = $("empty-state"), refreshBtn = $("refresh-btn");

	// Search
	const searchModeRadios = document.querySelectorAll('input[name="search-mode"]');
	const queryDataset = $("query-dataset"), queryDatasetHelp = $("query-dataset-help");
	const sectionsControls = $("sections-controls"), roomsControls = $("rooms-controls");
	const qProfessor = $("q-professor"), qGradeOp = $("q-grade-op"), qGradeVal = $("q-grade-val");
	const qDept = $("q-dept"), qCourse = $("q-course"), qTitle = $("q-title"), qYear = $("q-year");
	const qMinSeats = $("q-min-seats"), qBuilding = $("q-building");
	const qRoomType = $("q-room-type");
	const qFurnitureSelect = $("q-furniture");
	const qFurnitureCustom = $("q-furniture-custom");
	const deptOptions = $("dept-options");
	const titleKeywords = $("title-keywords");
	const buildingOptions = $("building-options");
	const resultsFoot = $("results-foot"), resultsHint = $("results-hint");
	const resultsMoreBtn = $("results-more"), resultsAllBtn = $("results-all");
	const qRaw = $("q-raw"), advToggle = $("adv-toggle"), advPanel = $("adv-panel");
	const qIncludeRollups = $("q-include-rollups");
	const presets = $("presets");
	const runBtn = $("run-query"), clearBtn = $("clear-query"), queryMessage = $("query-message");
	const results = $("results"), resultsMeta = $("results-meta"), resultsTable = $("results-table");

	// Pulse
	const pulseForm = $("pulse-form");
	const pulseDataset = $("pulse-dataset"), pulseDatasetHelp = $("pulse-dataset-help");
	const pulseDept = $("pulse-dept"), pulseCourse = $("pulse-course");
	const pulseMinYear = $("pulse-min-year"), pulseRunBtn = $("pulse-run");
	const pulseMessage = $("pulse-message");
	const pulseChips = $("pulse-chips");
	const pulseEmpty = $("pulse-empty"), pulseResult = $("pulse-result");
	const pulseChip = $("pulse-chip"), pulseTitle = $("pulse-title"), pulseSubtitle = $("pulse-subtitle");
	const pulseSparkline = $("pulse-sparkline");
	const kpiSections = $("pulse-kpi-sections");
	const kpiAvg = $("pulse-kpi-avg");
	const kpiYears = $("pulse-kpi-years");
	const kpiDelta = $("pulse-kpi-delta");
	const pulseChartSvg = $("pulse-chart");
	const pulseInstructorsSvg = $("pulse-instructors");
	const pulseStrip = $("pulse-strip");

	// Nav
	const navLinks = document.querySelectorAll(".nav__links a[data-section]");

	// =========================================================================
	// State
	// =========================================================================
	let allDatasets = [];

	// =========================================================================
	// API helpers
	// =========================================================================
	async function readJson(res) {
		try { return await res.json(); } catch { return {}; }
	}
	async function apiListDatasets() {
		const res = await fetch("/datasets");
		const data = await readJson(res);
		if (!res.ok) throw new Error(data.error || "Failed to load datasets.");
		return Array.isArray(data.result) ? data.result : [];
	}
	async function apiAddDataset(id, kind, file) {
		const res = await fetch(`/dataset/${encodeURIComponent(id)}/${encodeURIComponent(kind)}`, {
			method: "PUT",
			headers: { "Content-Type": "application/x-zip-compressed" },
			body: file,
		});
		const data = await readJson(res);
		if (!res.ok) throw new Error(data.error || `Request failed (${res.status}).`);
		return data.result;
	}
	async function apiRemoveDataset(id) {
		const res = await fetch(`/dataset/${encodeURIComponent(id)}`, { method: "DELETE" });
		const data = await readJson(res);
		if (!res.ok) throw new Error(data.error || `Request failed (${res.status}).`);
		return data.result;
	}
	async function apiQuery(query) {
		const res = await fetch("/query", {
			method: "POST",
			headers: { "Content-Type": "application/json" },
			body: JSON.stringify(query),
		});
		const data = await readJson(res);
		if (!res.ok) throw new Error(data.error || `Query failed (${res.status}).`);
		return Array.isArray(data.result) ? data.result : [];
	}
	async function apiCoursePulse(payload) {
		const res = await fetch("/insights/course-pulse", {
			method: "POST",
			headers: { "Content-Type": "application/json" },
			body: JSON.stringify(payload),
		});
		const data = await readJson(res);
		if (!res.ok) throw new Error(data.error || `Request failed (${res.status}).`);
		return data;
	}

	// =========================================================================
	// Validation
	// =========================================================================
	function validateIdClient(id) {
		if (id.includes("_")) return "Invalid id: contains underscore";
		if (id.trim().length === 0) return "Invalid id: only whitespace or empty";
		return null;
	}

	// =========================================================================
	// Small UI helpers
	// =========================================================================
	function showMessage(box, text, type) {
		box.textContent = text;
		box.className = "message message--" + type;
		box.hidden = false;
	}
	function hideMessage(box) {
		box.hidden = true;
		box.textContent = "";
	}
	function setBusy(btn, busy, busyLabel) {
		const labelEl = btn.querySelector(".btn__label");
		if (busy) {
			btn.classList.add("is-loading");
			btn.disabled = true;
			if (labelEl && busyLabel) {
				if (!btn.dataset.label) btn.dataset.label = labelEl.textContent || "";
				labelEl.textContent = busyLabel;
			}
		} else {
			btn.classList.remove("is-loading");
			btn.disabled = false;
			if (labelEl && btn.dataset.label) {
				labelEl.textContent = btn.dataset.label;
				delete btn.dataset.label;
			}
		}
	}
	function setFile(file) {
		if (file) {
			dropzone.classList.add("has-file");
			dropzoneText.textContent = file.name;
		} else {
			dropzone.classList.remove("has-file");
			dropzoneText.innerHTML = DEFAULT_DROPZONE_HTML;
		}
	}
	function escapeHtml(s) {
		return String(s).replace(/&/g, "&amp;").replace(/</g, "&lt;").replace(/>/g, "&gt;")
			.replace(/"/g, "&quot;").replace(/'/g, "&#39;");
	}

	// =========================================================================
	// Datasets — render as a ledger (US1)
	// =========================================================================
	function buildLedgerRow(ds, index) {
		const row = document.createElement("article");
		row.className = "ledger__row";
		row.dataset.kind = ds.kind;
		row.style.animationDelay = (index * 45) + "ms";

		const num = document.createElement("span");
		num.className = "ledger__num";
		num.textContent = String(index + 1).padStart(2, "0");
		row.appendChild(num);

		// Identity = id (big serif) over a tiny kind tag.
		const identity = document.createElement("div");
		identity.className = "ledger__identity";
		const id = document.createElement("h3");
		id.className = "ledger__id";
		id.textContent = ds.id;
		identity.appendChild(id);
		const kind = document.createElement("span");
		kind.className = "ledger__kind";
		kind.textContent = ds.kind;
		identity.appendChild(kind);
		row.appendChild(identity);

		// Metadata column = formatted row count, with hidden Retire underneath.
		const meta = document.createElement("div");
		meta.className = "ledger__meta";
		const rows = document.createElement("div");
		rows.className = "ledger__rows";
		const n = typeof ds.numRows === "number" ? ds.numRows.toLocaleString() : ds.numRows;
		rows.innerHTML = `${n}<small>rows on disk</small>`;
		meta.appendChild(rows);
		const remove = document.createElement("button");
		remove.className = "ledger__remove";
		remove.type = "button";
		remove.textContent = "Retire";
		remove.title = `Remove dataset "${ds.id}"`;
		remove.addEventListener("click", () => onRemove(ds.id, remove));
		meta.appendChild(remove);
		row.appendChild(meta);

		return row;
	}

	function renderDatasets(list) {
		allDatasets = list || [];
		grid.innerHTML = "";
		if (!list || list.length === 0) {
			emptyState.hidden = false;
		} else {
			emptyState.hidden = true;
			const sorted = list.slice().sort((a, b) => String(a.id).localeCompare(String(b.id)));
			sorted.forEach((ds, i) => grid.appendChild(buildLedgerRow(ds, i)));
		}
		populateQueryDatasets();
		populatePulseDatasets();
		populateBuildingOptions();
	}

	function populateQueryDatasets() {
		const mode = currentMode();
		const matching = allDatasets.filter((d) => d.kind === mode);
		const previous = queryDataset.value;
		queryDataset.innerHTML = "";
		if (matching.length === 0) {
			const opt = document.createElement("option");
			opt.value = "";
			opt.textContent = `No ${mode} datasets yet`;
			queryDataset.appendChild(opt);
			queryDataset.disabled = true;
			queryDatasetHelp.innerHTML = `<strong>${mode}</strong> dataset required — add one above.`;
		} else {
			queryDataset.disabled = false;
			const unit = mode === "sections" ? "sections" : "rooms";
			queryDatasetHelp.innerHTML = `(<strong>${mode}</strong> kind)`;
			for (const d of matching.sort((a, b) => String(a.id).localeCompare(String(b.id)))) {
				const opt = document.createElement("option");
				opt.value = d.id;
				opt.textContent = `${d.id} — ${d.numRows.toLocaleString()} ${unit}`;
				queryDataset.appendChild(opt);
			}
			if (matching.some((d) => d.id === previous)) queryDataset.value = previous;
		}
		renderPresets(mode);
	}

	function populatePulseDatasets() {
		const sections = allDatasets.filter((d) => d.kind === "sections");
		const previous = pulseDataset.value;
		pulseDataset.innerHTML = "";
		if (sections.length === 0) {
			const opt = document.createElement("option");
			opt.value = "";
			opt.textContent = "No sections datasets yet";
			pulseDataset.appendChild(opt);
			pulseDataset.disabled = true;
			pulseDatasetHelp.innerHTML = `add a <strong>sections</strong> dataset above to read course pulses.`;
		} else {
			pulseDataset.disabled = false;
			pulseDatasetHelp.innerHTML = `<strong>sections</strong> kind`;
			for (const d of sections.sort((a, b) => String(a.id).localeCompare(String(b.id)))) {
				const opt = document.createElement("option");
				opt.value = d.id;
				opt.textContent = `${d.id} — ${d.numRows.toLocaleString()} sections`;
				pulseDataset.appendChild(opt);
			}
			if (sections.some((d) => d.id === previous)) pulseDataset.value = previous;
		}
	}

	async function loadDatasets() {
		try {
			renderDatasets(await apiListDatasets());
		} catch (err) {
			grid.innerHTML = "";
			emptyState.hidden = true;
			showMessage(messageBox, err.message || "Could not reach the server.", "error");
		}
	}

	async function onRemove(id, btn) {
		hideMessage(messageBox);
		btn.disabled = true;
		btn.textContent = "Retiring…";
		try {
			await apiRemoveDataset(id);
			showMessage(messageBox, `Retired “${id}”. It can no longer be queried.`, "success");
			await loadDatasets();
		} catch (err) {
			showMessage(messageBox, err.message || "Could not remove dataset.", "error");
			btn.disabled = false;
			btn.textContent = "Retire";
		}
	}

	// =========================================================================
	// Upload (US2)
	// =========================================================================
	async function onSubmit(event) {
		event.preventDefault();
		hideMessage(messageBox);
		idInput.classList.remove("is-invalid");

		const id = idInput.value;
		const kind = (form.querySelector('input[name="kind"]:checked') || {}).value || "sections";
		const file = fileInput.files[0];

		const idError = validateIdClient(id);
		if (idError) {
			idInput.classList.add("is-invalid");
			showMessage(messageBox, idError, "error");
			idInput.focus();
			return;
		}
		if (!file) {
			showMessage(messageBox, "Please choose a .zip archive to upload.", "error");
			return;
		}

		setBusy(submitBtn, true, "Filing…");
		try {
			const result = await apiAddDataset(id.trim(), kind, file);
			const count = Array.isArray(result) ? result.length : 0;
			showMessage(
				messageBox,
				`Filed “${id.trim()}”. You now have ${count} archive${count === 1 ? "" : "s"}.`,
				"success"
			);
			form.reset();
			setFile(null);
			await loadDatasets();
		} catch (err) {
			showMessage(messageBox, err.message || "Something went wrong.", "error");
		} finally {
			setBusy(submitBtn, false);
		}
	}

	// =========================================================================
	// Search (US3 + US4) — sections AND rooms
	// =========================================================================
	function currentMode() {
		const checked = document.querySelector('input[name="search-mode"]:checked');
		return checked ? checked.value : "sections";
	}

	function setMode(mode) {
		const radio = document.getElementById(`mode-${mode}`);
		if (radio) radio.checked = true;
		const incoming = mode === "sections" ? sectionsControls : roomsControls;
		const outgoing = mode === "sections" ? roomsControls : sectionsControls;

		// Instant swap. Cross-fading two rows that have a fade-in keyframe on
		// the .is-entering class created an animation-vs-transition race where
		// the leaving row's transitionend never fired and the wrong fields stayed
		// visible. The entering row still animates via the rowEnter keyframe.
		outgoing.classList.remove("is-entering");
		outgoing.hidden = true;
		incoming.hidden = false;
		incoming.classList.remove("is-entering");
		// Force a reflow so the keyframe restarts on every switch.
		void incoming.offsetWidth;
		incoming.classList.add("is-entering");
		populateQueryDatasets();
		// Refresh the building autocomplete when entering rooms mode — the
		// active dataset may have changed since the last time we looked.
		if (mode === "rooms") populateBuildingOptions();
	}

	// "Try: <a>find your favourite professor</a>, <a>spot GPA-risky courses</a>, or <a>browse high-average courses</a>."
	function renderPresets(mode) {
		presets.innerHTML = "";
		const lead = document.createElement("span");
		lead.className = "presets-prose__lead";
		lead.textContent = "Try:";
		presets.appendChild(lead);
		presets.appendChild(document.createTextNode(" "));

		const items = mode === "sections"
			? [
				{ key: "professor", label: "find your favourite professor" },
				{ key: "gpa", label: "spot GPA-risky courses" },
				{ key: "easy", label: "browse high-average courses" },
			]
			: [
				{ key: "lecture", label: "browse the big lecture halls" },
				{ key: "study", label: "find movable-table study rooms" },
			];

		items.forEach((it, i) => {
			const btn = document.createElement("button");
			btn.type = "button";
			btn.dataset.preset = it.key;
			btn.textContent = it.label;
			btn.addEventListener("click", () => applyPreset(it.key));
			presets.appendChild(btn);
			if (i < items.length - 2) presets.appendChild(document.createTextNode(", "));
			else if (i === items.length - 2) presets.appendChild(document.createTextNode(", or "));
			else presets.appendChild(document.createTextNode("."));
		});
	}

	function buildSectionsQuery(dsId, opts) {
		const filters = [];
		if (opts.professor) {
			const tokens = opts.professor.trim().toLowerCase().split(/\s+/).filter(Boolean);
			for (const t of tokens) {
				filters.push({ IS: { [`${dsId}_instructor`]: `*${t}*` } });
			}
		}
		if (opts.dept) {
			filters.push({ IS: { [`${dsId}_dept`]: opts.dept.trim().toLowerCase() } });
		}
		if (opts.course) {
			filters.push({ IS: { [`${dsId}_id`]: opts.course.trim() } });
		}
		if (opts.title) {
			const titleFilter = buildTitleFilter(dsId, opts.title);
			if (titleFilter) filters.push(titleFilter);
		}
		if (opts.year !== "" && !Number.isNaN(Number(opts.year))) {
			filters.push({ EQ: { [`${dsId}_year`]: Number(opts.year) } });
		}
		if (opts.gradeOp && opts.gradeVal !== "" && !Number.isNaN(Number(opts.gradeVal))) {
			const op = opts.gradeOp === "above" ? "GT" : opts.gradeOp === "equals" ? "EQ" : "LT";
			filters.push({ [op]: { [`${dsId}_avg`]: Number(opts.gradeVal) } });
		}
		// Default: drop the year-1900 "overall" sentinel rows. They are duplicates
		// of every real section with a blank instructor, and dilute every result
		// set. The user can opt back in via the checkbox.
		if (!opts.includeRollups) {
			filters.push({ NOT: { EQ: { [`${dsId}_year`]: 1900 } } });
		}
		const where = filters.length === 0 ? {} : filters.length === 1 ? filters[0] : { AND: filters };
		return {
			WHERE: where,
			OPTIONS: {
				COLUMNS: [
					`${dsId}_dept`, `${dsId}_id`, `${dsId}_title`,
					`${dsId}_instructor`, `${dsId}_avg`, `${dsId}_year`,
				],
				ORDER: { dir: "DOWN", keys: [`${dsId}_avg`] },
			},
		};
	}

	function resolvedFurniture() {
		if (!qFurnitureSelect) return "";
		const v = qFurnitureSelect.value;
		if (v === "__custom") return (qFurnitureCustom && qFurnitureCustom.value || "").trim();
		return v;
	}

	function buildRoomsQuery(dsId, opts) {
		const filters = [];
		if (opts.minSeats !== "" && !Number.isNaN(Number(opts.minSeats))) {
			filters.push({ GT: { [`${dsId}_seats`]: Math.max(0, Number(opts.minSeats) - 1) } });
		}
		if (opts.building && opts.building.trim().length > 0) {
			const bf = buildBuildingFilter(dsId, opts.building);
			if (bf) filters.push(bf);
		}
		if (opts.type && opts.type.trim().length > 0) {
			filters.push({ IS: { [`${dsId}_type`]: `*${opts.type.trim()}*` } });
		}
		if (opts.furniture && opts.furniture.trim().length > 0) {
			filters.push({ IS: { [`${dsId}_furniture`]: `*${opts.furniture.trim()}*` } });
		}
		const where = filters.length === 0 ? {} : filters.length === 1 ? filters[0] : { AND: filters };
		// `href` intentionally excluded — the dataset's links point at archived
		// pages that no longer resolve, so showing an "open ↗" column was a
		// promise we couldn't keep.
		return {
			WHERE: where,
			OPTIONS: {
				COLUMNS: [
					`${dsId}_shortname`, `${dsId}_number`, `${dsId}_fullname`,
					`${dsId}_seats`, `${dsId}_type`, `${dsId}_furniture`,
				],
				ORDER: { dir: "DOWN", keys: [`${dsId}_seats`] },
			},
		};
	}

	// -------------------------------------------------------------------------
	// Building search — substring match on BOTH shortname and fullname, plus a
	// small alias map for terms that won't substring-match anything in the
	// catalog directly. The same shape as buildTitleFilter for sections.
	//
	// Why this shape:
	//  - Exact-IS match on shortname (the previous behaviour) hard-broke on any
	//    partial typing — typing "BUC" would return zero rooms even though
	//    BUCH exists.
	//  - Single-column match on shortname missed building-by-name searches
	//    ("buchanan" found nothing).
	//  - Substring match against the FULLNAME alone caused MATH to surface
	//    when the user typed "ICS" because "Mathematics" contains "ics". To
	//    keep that case from surprising users, we still match shortname AND
	//    fullname, but include a small alias map for known colloquial names
	//    so e.g. "ICCS" resolves to LSK (whose fullname mentions "CSCI").
	// -------------------------------------------------------------------------
	const BUILDING_ALIASES = [
		// alias substring (lowercase) -> array of replacement substrings to OR-IN
		{ alias: "iccs",  variants: ["csci"] },                    // CS folks call LSK "ICICS/ICCS"
		{ alias: "icics", variants: ["csci"] },
		{ alias: "csci",  variants: ["csci"] },                    // already in LSK fullname
		{ alias: "klinck", variants: ["klinck", "lsk"] },
		{ alias: "irc",   variants: ["irc"] },                     // Woodward IRC fullname
		{ alias: "dempster", variants: ["dempster", "dmp"] },
		{ alias: "ponderosa", variants: ["ponderosa"] },
		{ alias: "law",   variants: ["law", "alrd"] },
		{ alias: "gym",   variants: ["gymnasium", "mgym"] },
		{ alias: "barber", variants: ["barber"] },
		{ alias: "iblc",  variants: ["barber", "iblc"] },
		{ alias: "pharm", variants: ["pharm"] },
		{ alias: "pharmacy", variants: ["pharm"] },
		{ alias: "ikb",   variants: ["barber"] },
		{ alias: "hennings", variants: ["henn"] },
		{ alias: "scarfe", variants: ["scarfe", "scrf"] },
		{ alias: "lasserre", variants: ["lasserre", "lasr"] },
		{ alias: "buchanan", variants: ["buchanan", "buch"] },
		{ alias: "wesbrook", variants: ["wesb", "wesbrook"] },
		{ alias: "osborne", variants: ["osborne", "osbo"] },
		{ alias: "iona", variants: ["iona"] },
		{ alias: "friedman", variants: ["friedman", "frdm"] },
		{ alias: "hugh dempster", variants: ["dempster", "dmp"] },
		{ alias: "social work", variants: ["social work", "sowk"] },
	];
	function buildBuildingFilter(dsId, raw) {
		const term = String(raw || "").trim().toLowerCase();
		if (!term) return null;
		// Always match the term itself against both columns. Wildcards on a
		// string field are EBNF-legal: IS *abc* / IS abc* / IS *abc / IS abc.
		const targets = new Set([term]);
		for (const a of BUILDING_ALIASES) {
			if (term.includes(a.alias)) {
				for (const v of a.variants) targets.add(v.toLowerCase());
			}
		}
		// Fold over both columns. Shortnames are stored uppercase but the IS
		// matcher is case-sensitive. To make typed terms match regardless of
		// the dataset's casing, we emit four variants per target:
		//   - shortname *AS-IS uppercase*  (matches BUCH, MATH, ...)
		//   - fullname  *lowercase*        (matches no current data, but harmless)
		//   - fullname  *Title Case*       (matches "Buchanan", "Mathematics", ...)
		//   - fullname  *UPPERCASE*        (matches embedded codes like "CSCI", "IRC")
		const isClauses = [];
		for (const t of targets) {
			const upper = t.toUpperCase();
			const titled = t.charAt(0).toUpperCase() + t.slice(1);
			isClauses.push({ IS: { [`${dsId}_shortname`]: `*${upper}*` } });
			isClauses.push({ IS: { [`${dsId}_fullname`]:  `*${t}*` } });
			if (titled !== t) {
				isClauses.push({ IS: { [`${dsId}_fullname`]: `*${titled}*` } });
			}
			if (upper !== t && upper !== titled) {
				isClauses.push({ IS: { [`${dsId}_fullname`]: `*${upper}*` } });
			}
		}
		// Deduplicate (lowercase term may collide with alias-derived variants).
		const seen = new Set();
		const dedup = isClauses.filter((c) => {
			const k = JSON.stringify(c);
			if (seen.has(k)) return false;
			seen.add(k);
			return true;
		});
		if (dedup.length === 1) return dedup[0];
		return { OR: dedup };
	}

	async function onRunQuery() {
		hideMessage(queryMessage);
		const raw = qRaw.value.trim();
		const useAdvanced = !advPanel.hidden && raw.length > 0;

		let query;
		if (useAdvanced) {
			try { query = JSON.parse(raw); }
			catch { return showQueryError("That isn't valid JSON. Fix the query and retry."); }
		} else {
			const dsId = queryDataset.value;
			if (!dsId) return showQueryError("Add a dataset of this kind first, then search.");
			const mode = currentMode();
			if (mode === "sections") {
				const opts = {
					professor: qProfessor.value.trim(),
					dept: qDept ? qDept.value.trim() : "",
					course: qCourse ? qCourse.value.trim() : "",
					title: qTitle ? qTitle.value.trim() : "",
					year: qYear ? qYear.value.trim() : "",
					gradeOp: qGradeOp.value,
					gradeVal: qGradeVal.value,
					includeRollups: !!(qIncludeRollups && qIncludeRollups.checked),
				};
				const empty = !opts.professor && !opts.dept && !opts.course &&
					!opts.title && !opts.year && !opts.gradeOp;
				if (empty) {
					return showQueryError("Add at least one filter — professor, dept, course, title, year, or grade.");
				}
				query = buildSectionsQuery(dsId, opts);
			} else {
				const opts = {
					minSeats: qMinSeats.value.trim(),
					building: qBuilding ? qBuilding.value.trim() : "",
					type: (qRoomType && qRoomType.value) || "",
					furniture: resolvedFurniture(),
				};
				if (!opts.minSeats && !opts.building && !opts.type && !opts.furniture) {
					return showQueryError("Pick a minimum seat count, building, type, or furniture to search.");
				}
				query = buildRoomsQuery(dsId, opts);
			}
		}

		setBusy(runBtn, true, "Searching…");
		try {
			renderResults(await apiQuery(query));
		} catch (err) {
			results.hidden = true;
			const m = (err.message || "").toLowerCase();
			if (m.includes("too many") || m.includes("max is") || m.includes("too large")) {
				showQueryError("That search matched too many results. Narrow it (add a filter or tighter range) and retry.");
			} else {
				showQueryError(`This query is invalid: ${err.message}. Please adjust and retry.`);
			}
		} finally {
			setBusy(runBtn, false);
		}
	}

	function showQueryError(text) { showMessage(queryMessage, text, "error"); }

	function labelFor(field) {
		if (FIELD_LABELS[field]) return FIELD_LABELS[field];
		return field.charAt(0).toUpperCase() + field.slice(1);
	}
	function fieldOf(key) {
		const i = key.indexOf("_");
		return i === -1 ? key : key.slice(i + 1);
	}
	function avgPill(value) {
		const span = document.createElement("span");
		const v = Number(value);
		let tier = "mid";
		if (v < 60) tier = "low";
		else if (v >= 80) tier = "high";
		span.className = "avg-pill avg-pill--" + tier;
		span.textContent = typeof value === "number" ? value.toFixed(2) : String(value);
		return span;
	}

	// Pagination state for the results table.
	const PAGE_SIZE = 50;
	let lastResultRows = [];
	let shownRowCount = 0;

	function renderResults(rows) {
		lastResultRows = rows || [];
		shownRowCount = Math.min(PAGE_SIZE, lastResultRows.length);
		paintResults(true);
	}

	function paintResults(reset) {
		resultsTable.innerHTML = "";
		const rows = lastResultRows;
		if (!rows || rows.length === 0) {
			resultsMeta.textContent = "No matching results. Try a different filter.";
			resultsFoot.hidden = true;
			results.hidden = false;
			return;
		}
		const keys = Object.keys(rows[0]);
		const fieldByKey = keys.map((k) => ({ key: k, field: fieldOf(k) }));
		const deptKey = keys.find((k) => fieldOf(k) === "dept");
		const idKey = keys.find((k) => fieldOf(k) === "id");

		const thead = document.createElement("thead");
		const headRow = document.createElement("tr");
		for (const { field } of fieldByKey) {
			const th = document.createElement("th");
			th.textContent = labelFor(field);
			if (NUMERIC_FIELDS.has(field)) th.className = "num";
			headRow.appendChild(th);
		}
		thead.appendChild(headRow);
		resultsTable.appendChild(thead);

		const tbody = document.createElement("tbody");
		const shown = Math.min(rows.length, shownRowCount);
		const pagePrev = reset ? 0 : (shownRowCount - PAGE_SIZE);
		for (let i = 0; i < shown; i++) {
			const tr = document.createElement("tr");
			// Stagger only the freshly-revealed page so a "show all" click on a
			// 5,000-row dataset doesn't ripple for minutes.
			if (reset) {
				tr.style.animationDelay = Math.min(i, 50) * 8 + "ms";
			} else if (i >= pagePrev) {
				tr.style.animationDelay = Math.min(i - pagePrev, 50) * 8 + "ms";
			} else {
				tr.style.animation = "none";
			}
			const row = rows[i];
			for (const { key, field } of fieldByKey) {
				const td = document.createElement("td");
				const value = row[key];
				if (field === "avg") {
					td.className = "num";
					td.appendChild(avgPill(value));
				} else if (field === "year") {
					td.className = "num year-cell";
					if (Number(value) === 1900) {
						td.classList.add("is-rollup");
						td.textContent = "n/a";
						td.title = "UBC stamps year 1900 on the “overall” summary row for a section.";
					} else {
						td.textContent = String(value);
					}
				} else if (NUMERIC_FIELDS.has(field)) {
					td.className = "num";
					td.textContent = String(value);
				} else if (field === "dept") {
					td.className = "dept-cell";
					td.textContent = String(value).toUpperCase();
					const full = deptName(value);
					if (full) td.title = full;
				} else if (field === "id" || field === "number" || field === "shortname") {
					td.className = "course";
					td.textContent = String(value);
				} else if (field === "title" && deptKey && idKey) {
					td.className = "title-cell";
					td.title = String(value);
					td.textContent = expandCourseTitle(row[deptKey], row[idKey], value);
				} else if (field === "instructor") {
					const formatted = formatInstructors(value);
					if (!value || String(value).trim() === "" || formatted === "—") {
						td.className = "instructor-cell is-empty";
						td.textContent = "unassigned";
						td.title = "No instructor recorded for this section.";
					} else {
						td.className = "instructor-cell";
						td.textContent = formatted;
						td.title = String(value);
					}
				} else if (field === "href") {
					td.className = "cell-empty";
					td.textContent = "n/a";
					td.title = "External room links from this archive are no longer reachable.";
				} else {
					if (value === undefined || value === null || String(value).trim() === "") {
						td.className = "cell-empty";
						td.textContent = "—";
					} else {
						td.textContent = String(value);
					}
				}
				tr.appendChild(td);
			}
			tbody.appendChild(tr);
		}
		resultsTable.appendChild(tbody);

		const total = rows.length.toLocaleString();
		const remaining = rows.length - shown;
		if (remaining > 0) {
			resultsMeta.textContent = `Found ${total} — showing ${shown.toLocaleString()}.`;
			resultsFoot.hidden = false;
			const nextPage = Math.min(PAGE_SIZE, remaining);
			resultsHint.innerHTML = `<b>${remaining.toLocaleString()}</b> more record${remaining === 1 ? "" : "s"} hidden.`;
			resultsMoreBtn.textContent = `Show ${nextPage} more`;
			resultsMoreBtn.disabled = false;
			resultsAllBtn.hidden = remaining <= PAGE_SIZE;
		} else if (rows.length > PAGE_SIZE) {
			resultsMeta.textContent = `Found ${total} record${rows.length === 1 ? "" : "s"}.`;
			resultsHint.textContent = "All records shown.";
			resultsFoot.hidden = false;
			resultsMoreBtn.disabled = true;
			resultsMoreBtn.textContent = "All shown";
			resultsAllBtn.hidden = true;
		} else {
			resultsMeta.textContent = `Found ${total} record${rows.length === 1 ? "" : "s"}.`;
			resultsFoot.hidden = true;
		}
		results.hidden = false;
	}

	function showMoreRows(allOfThem) {
		if (lastResultRows.length === 0) return;
		shownRowCount = allOfThem
			? lastResultRows.length
			: Math.min(lastResultRows.length, shownRowCount + PAGE_SIZE);
		paintResults(false);
	}

	function applyPreset(name) {
		hideMessage(queryMessage);
		if (advPanel.hidden === false) toggleAdvanced(false);
		qRaw.value = "";
		const mode = currentMode();
		if (mode === "sections") {
			qProfessor.value = ""; qGradeOp.value = ""; qGradeVal.value = "";
			if (qDept) qDept.value = "";
			if (qCourse) qCourse.value = "";
			if (qTitle) qTitle.value = "";
			if (qYear) qYear.value = "";
			if (name === "professor") { qProfessor.value = "Kerr"; }
			else if (name === "gpa") { qGradeOp.value = "below"; qGradeVal.value = "60"; }
			else if (name === "easy") { qGradeOp.value = "above"; qGradeVal.value = "90"; }
		} else {
			qMinSeats.value = "";
			if (qBuilding) qBuilding.value = "";
			if (qRoomType) qRoomType.value = "";
			if (qFurnitureSelect) qFurnitureSelect.value = "";
			if (qFurnitureCustom) { qFurnitureCustom.value = ""; qFurnitureCustom.hidden = true; }
			if (name === "lecture") {
				qMinSeats.value = "150";
				if (qRoomType) qRoomType.value = "Tiered Large Group";
			} else if (name === "study") {
				if (qFurnitureSelect) qFurnitureSelect.value = "Movable Tables";
			}
		}
		onRunQuery();
	}

	function toggleAdvanced(open) {
		const next = open === undefined ? advPanel.hidden : open;
		advPanel.hidden = !next;
		advToggle.setAttribute("aria-expanded", String(next));
	}

	function clearQuery() {
		hideMessage(queryMessage);
		qProfessor.value = ""; qGradeOp.value = ""; qGradeVal.value = "";
		if (qDept) qDept.value = "";
		if (qCourse) qCourse.value = "";
		if (qTitle) qTitle.value = "";
		if (qYear) qYear.value = "";
		qMinSeats.value = "";
		if (qBuilding) qBuilding.value = "";
		if (qRoomType) qRoomType.value = "";
		if (qFurnitureSelect) qFurnitureSelect.value = "";
		if (qFurnitureCustom) { qFurnitureCustom.value = ""; qFurnitureCustom.hidden = true; }
		qRaw.value = "";
		results.hidden = true;
		resultsTable.innerHTML = "";
		lastResultRows = [];
		shownRowCount = 0;
	}

	// =========================================================================
	// Course Pulse — custom feature
	// =========================================================================
	function colorForAvg(avg) {
		const stops = [
			{ at: 50, c: [30, 58, 138] },   // #1e3a8a
			{ at: 65, c: [167, 139, 250] }, // #a78bfa
			{ at: 80, c: [236, 72, 153] },  // #ec4899
			{ at: 90, c: [245, 158, 11] },  // #f59e0b
		];
		const v = Math.max(stops[0].at, Math.min(stops[stops.length - 1].at, avg));
		for (let i = 0; i < stops.length - 1; i++) {
			const a = stops[i], b = stops[i + 1];
			if (v >= a.at && v <= b.at) {
				const t = (v - a.at) / (b.at - a.at || 1);
				const r = Math.round(a.c[0] + (b.c[0] - a.c[0]) * t);
				const g = Math.round(a.c[1] + (b.c[1] - a.c[1]) * t);
				const bch = Math.round(a.c[2] + (b.c[2] - a.c[2]) * t);
				return [r, g, bch];
			}
		}
		const c = stops[stops.length - 1].c;
		return [c[0], c[1], c[2]];
	}

	// WCAG-style relative luminance from sRGB. Returns 0-1 where 0 = black.
	function relLuminance(r, g, b) {
		const lin = (v) => {
			const s = v / 255;
			return s <= 0.03928 ? s / 12.92 : Math.pow((s + 0.055) / 1.055, 2.4);
		};
		return 0.2126 * lin(r) + 0.7152 * lin(g) + 0.0722 * lin(b);
	}
	// Pick a foreground that contrasts with the given RGB background.
	function idealText(r, g, b) {
		// Threshold tuned to flip on the gold (#f59e0b ≈ 0.47 luminance) and
		// upper-pink end of the diverging palette where white text washes out.
		// 0.4 keeps the violet and indigo midtones (≈ 0.20 / 0.05) on white.
		return relLuminance(r, g, b) > 0.4 ? "#0f172a" : "#ffffff";
	}

	async function onPulseSubmit(event) {
		event.preventDefault();
		hideMessage(pulseMessage);
		const dsId = pulseDataset.value;
		const dept = pulseDept.value.trim().toLowerCase();
		const course = pulseCourse.value.trim();
		if (!dsId) return showMessage(pulseMessage, "Add a sections dataset first.", "error");
		if (!dept || !course) return showMessage(pulseMessage, "Enter a department and a course id.", "error");

		const payload = { id: dsId, dept, course };
		const my = pulseMinYear.value.trim();
		if (my && !Number.isNaN(Number(my))) payload.minYear = Number(my);

		setBusy(pulseRunBtn, true, "Reading…");
		try {
			const data = await apiCoursePulse(payload);
			renderPulse(data);
		} catch (err) {
			pulseResult.hidden = true;
			pulseEmpty.hidden = false;
			showMessage(pulseMessage, err.message || "Could not read pulse.", "error");
		} finally {
			setBusy(pulseRunBtn, false);
		}
	}

	function applyPulsePreset(value) {
		const [dept, course] = value.split(":");
		pulseDept.value = dept;
		pulseCourse.value = course;
		pulseForm.dispatchEvent(new Event("submit", { cancelable: true }));
	}

	// Animate a number counting up to its target. Honors prefers-reduced-motion.
	function countUp(el, finalValue, decimals, prefix) {
		const final = Number(finalValue);
		if (!Number.isFinite(final)) {
			el.textContent = String(finalValue);
			return;
		}
		const reduce = window.matchMedia && window.matchMedia("(prefers-reduced-motion: reduce)").matches;
		const fmt = (n) => {
			const v = decimals ? n.toFixed(decimals) : Math.round(n).toLocaleString();
			return (prefix && n >= 0 ? prefix : "") + v;
		};
		// Restart the css "fresh" tick.
		el.classList.remove("is-fresh");
		void el.offsetWidth;
		el.classList.add("is-fresh");

		if (reduce) { el.textContent = fmt(final); return; }
		const dur = 700;
		const start = performance.now();
		const from = 0;
		function tick(now) {
			const t = Math.min(1, (now - start) / dur);
			// easeOutCubic
			const e = 1 - Math.pow(1 - t, 3);
			el.textContent = fmt(from + (final - from) * e);
			if (t < 1) requestAnimationFrame(tick);
			else el.textContent = fmt(final);
		}
		requestAnimationFrame(tick);
	}

	function renderPulse(data) {
		pulseEmpty.hidden = true;
		pulseResult.hidden = false;

		const code = `${String(data.dept).toUpperCase()} ${data.course}`;
		pulseChip.textContent = code;
		const lookupKey = `${String(data.dept).toLowerCase()} ${String(data.course).toLowerCase()}`;
		pulseTitle.textContent = COURSE_TITLES[lookupKey] || "—";
		// Show the dept full name as a kicker beneath the title (uses our DEPT_NAMES dict).
		pulseSubtitle.textContent = deptName(data.dept) || "";

		kpiSections.classList.remove("is-fresh");
		kpiAvg.classList.remove("is-fresh");
		kpiYears.classList.remove("is-fresh");
		kpiDelta.classList.remove("is-fresh");
		countUp(kpiSections, data.totalSections || 0, 0);
		countUp(kpiAvg, data.overallAvg, 2);

		// vs Dept delta — weighted means over the union year span
		const deptByYear = new Map();
		for (const p of data.deptBaseline) deptByYear.set(p.year, p);
		let courseW = 0, courseSum = 0, deptW = 0, deptSum = 0;
		for (const p of data.trend) {
			courseSum += p.avg * p.sections; courseW += p.sections;
			const d = deptByYear.get(p.year);
			if (d) { deptSum += d.avg * d.sections; deptW += d.sections; }
		}
		const courseMean = courseW ? courseSum / courseW : data.overallAvg;
		const deptMean = deptW ? deptSum / deptW : courseMean;
		const delta = courseMean - deptMean;
		kpiDelta.className = (delta > 0.5 ? "is-good" : delta < -0.5 ? "is-bad" : "");
		countUp(kpiDelta, delta, 1, "+");

		const years = data.trend.map((p) => p.year).sort((a, b) => a - b);
		// Years is a range string, not a number — set directly with the fresh tick.
		kpiYears.textContent = years.length === 0 ? "—" : `${years[0]}–${years[years.length - 1]}`;
		void kpiYears.offsetWidth;
		kpiYears.classList.add("is-fresh");

		drawSparkline(pulseSparkline, data.trend);
		drawDualLine(pulseChartSvg, data.trend, data.deptBaseline);
		drawInstructorBars(pulseInstructorsSvg, data.topInstructors);
		drawYearStrip(pulseStrip, data.trend);

		// Animate the line drawing (dept first, course second)
		requestAnimationFrame(() => {
			const lineCourse = pulseChartSvg.querySelector(".line-course");
			const lineDept = pulseChartSvg.querySelector(".line-dept");
			[lineDept, lineCourse].forEach((el, idx) => {
				if (!el) return;
				const len = el.getTotalLength();
				el.style.strokeDasharray = String(len);
				el.style.strokeDashoffset = String(len);
				el.getBoundingClientRect();
				el.style.transition = `stroke-dashoffset 0.7s ease ${idx * 120}ms`;
				el.style.strokeDashoffset = "0";
			});
		});
	}

	function drawSparkline(svg, trend) {
		while (svg.firstChild) svg.removeChild(svg.firstChild);
		if (!trend || trend.length === 0) return;
		const W = 320, H = 64, P = 6;
		const xs = trend.map((p, i) => P + (i * (W - 2 * P)) / Math.max(1, trend.length - 1));
		const ys = trend.map((p) => {
			const a = Math.max(40, Math.min(100, p.avg));
			return H - P - ((a - 40) / 60) * (H - 2 * P);
		});
		const NS = "http://www.w3.org/2000/svg";
		const defs = document.createElementNS(NS, "defs");
		const grad = document.createElementNS(NS, "linearGradient");
		grad.setAttribute("id", "pulseGradSpark");
		grad.setAttribute("x1", "0"); grad.setAttribute("x2", "1");
		const s1 = document.createElementNS(NS, "stop"); s1.setAttribute("offset", "0"); s1.setAttribute("stop-color", "#6366f1");
		const s2 = document.createElementNS(NS, "stop"); s2.setAttribute("offset", "1"); s2.setAttribute("stop-color", "#a855f7");
		grad.appendChild(s1); grad.appendChild(s2); defs.appendChild(grad); svg.appendChild(defs);
		const path = document.createElementNS(NS, "path");
		let d = "";
		for (let i = 0; i < xs.length; i++) d += (i === 0 ? "M" : "L") + xs[i].toFixed(1) + " " + ys[i].toFixed(1) + " ";
		path.setAttribute("d", d.trim());
		path.setAttribute("fill", "none");
		path.setAttribute("stroke", "url(#pulseGradSpark)");
		path.setAttribute("stroke-width", "2");
		path.setAttribute("stroke-linecap", "round");
		path.setAttribute("stroke-linejoin", "round");
		svg.appendChild(path);
	}

	function drawDualLine(svg, course, dept) {
		const NS = "http://www.w3.org/2000/svg";
		[...svg.children].forEach((c) => { if (c.tagName !== "defs") svg.removeChild(c); });
		const W = 720, H = 280, PL = 44, PR = 16, PT = 22, PB = 36;
		const innerW = W - PL - PR, innerH = H - PT - PB;

		const allYears = new Set();
		course.forEach((p) => allYears.add(p.year));
		dept.forEach((p) => allYears.add(p.year));
		const years = [...allYears].sort((a, b) => a - b);
		if (years.length === 0) return;

		const yearMin = years[0], yearMax = years[years.length - 1];
		const yearSpan = Math.max(1, yearMax - yearMin);
		const xFor = (y) => PL + ((y - yearMin) / yearSpan) * innerW;

		const allAvgs = course.map((p) => p.avg).concat(dept.map((p) => p.avg));
		const lo = Math.max(40, Math.floor(Math.min(...allAvgs) - 5));
		const hi = Math.min(100, Math.ceil(Math.max(...allAvgs) + 5));
		const yFor = (a) => PT + (1 - (a - lo) / Math.max(1, hi - lo)) * innerH;

		const yStep = (hi - lo) <= 30 ? 5 : 10;
		for (let v = Math.ceil(lo / yStep) * yStep; v <= hi; v += yStep) {
			const ln = document.createElementNS(NS, "line");
			ln.setAttribute("class", "grid-line");
			ln.setAttribute("x1", String(PL)); ln.setAttribute("x2", String(W - PR));
			ln.setAttribute("y1", String(yFor(v))); ln.setAttribute("y2", String(yFor(v)));
			svg.appendChild(ln);
			const lbl = document.createElementNS(NS, "text");
			lbl.setAttribute("class", "axis-label");
			lbl.setAttribute("x", String(PL - 8)); lbl.setAttribute("y", String(yFor(v) + 3));
			lbl.setAttribute("text-anchor", "end");
			lbl.textContent = String(v);
			svg.appendChild(lbl);
		}
		const stride = years.length > 8 ? Math.ceil(years.length / 8) : 1;
		years.forEach((yr, i) => {
			if (i % stride !== 0 && i !== years.length - 1) return;
			const lbl = document.createElementNS(NS, "text");
			lbl.setAttribute("class", "axis-label");
			lbl.setAttribute("x", String(xFor(yr)));
			lbl.setAttribute("y", String(H - PB + 18));
			lbl.setAttribute("text-anchor", "middle");
			lbl.textContent = String(yr);
			svg.appendChild(lbl);
		});

		const cross = document.createElementNS(NS, "line");
		cross.setAttribute("class", "crosshair");
		cross.setAttribute("y1", String(PT)); cross.setAttribute("y2", String(H - PB));
		svg.appendChild(cross);

		if (dept.length > 0) {
			const path = document.createElementNS(NS, "path");
			let d = "";
			dept.forEach((p, i) => { d += (i === 0 ? "M" : "L") + xFor(p.year).toFixed(1) + " " + yFor(p.avg).toFixed(1) + " "; });
			path.setAttribute("d", d.trim());
			path.setAttribute("class", "line-dept");
			svg.appendChild(path);
			dept.forEach((p) => {
				const c = document.createElementNS(NS, "circle");
				c.setAttribute("class", "point-dept");
				c.setAttribute("cx", String(xFor(p.year))); c.setAttribute("cy", String(yFor(p.avg)));
				c.setAttribute("r", "3");
				svg.appendChild(c);
			});
		}

		if (course.length > 0) {
			const path = document.createElementNS(NS, "path");
			let d = "";
			course.forEach((p, i) => { d += (i === 0 ? "M" : "L") + xFor(p.year).toFixed(1) + " " + yFor(p.avg).toFixed(1) + " "; });
			path.setAttribute("d", d.trim());
			path.setAttribute("class", "line-course");
			svg.appendChild(path);

			// Build a year→dept map for rich tooltips.
			const deptByYear = new Map();
			for (const dp of dept) deptByYear.set(dp.year, dp);

			course.forEach((p, idx) => {
				const c = document.createElementNS(NS, "circle");
				c.setAttribute("class", "point-course" + (idx === course.length - 1 ? " point-course--latest" : ""));
				c.setAttribute("cx", String(xFor(p.year))); c.setAttribute("cy", String(yFor(p.avg)));
				c.setAttribute("r", idx === course.length - 1 ? "5.5" : "4");
				c.addEventListener("mouseenter", () => {
					cross.setAttribute("x1", String(xFor(p.year))); cross.setAttribute("x2", String(xFor(p.year)));
					cross.style.opacity = "1";
					showPulseTip(svg, p, deptByYear.get(p.year), xFor(p.year), yFor(p.avg), W, H);
				});
				c.addEventListener("mouseleave", () => { cross.style.opacity = "0"; hidePulseTip(); });
				svg.appendChild(c);

				if (idx === 0 || idx === course.length - 1) {
					const lbl = document.createElementNS(NS, "text");
					lbl.setAttribute("class", "value-label");
					lbl.setAttribute("x", String(xFor(p.year)));
					lbl.setAttribute("y", String(yFor(p.avg) - 10));
					lbl.setAttribute("text-anchor", "middle");
					lbl.textContent = p.avg.toFixed(1);
					svg.appendChild(lbl);
				}
			});
		}
	}

	// =========================================================================
	// Rich tooltip for Pulse chart points (DOM-rendered, anchored to SVG coords)
	// =========================================================================
	let pulseTipEl = null;
	function ensurePulseTip(parent) {
		if (pulseTipEl && pulseTipEl.parentElement === parent) return pulseTipEl;
		if (pulseTipEl && pulseTipEl.parentElement) pulseTipEl.parentElement.removeChild(pulseTipEl);
		pulseTipEl = document.createElement("div");
		pulseTipEl.className = "pulse-tip";
		parent.appendChild(pulseTipEl);
		return pulseTipEl;
	}
	function showPulseTip(svg, courseP, deptP, sx, sy, viewW, viewH) {
		const figure = svg.parentElement; // .pulse__chart figure
		const tip = ensurePulseTip(figure);
		const rect = svg.getBoundingClientRect();
		const figRect = figure.getBoundingClientRect();
		// Convert SVG coords → DOM coords inside the figure.
		const px = ((sx / viewW) * rect.width) + (rect.left - figRect.left);
		const py = ((sy / viewH) * rect.height) + (rect.top - figRect.top);

		const courseSec = courseP.sections;
		const courseSecLabel = `${courseSec} section${courseSec === 1 ? "" : "s"}`;
		let html = `<p class="pulse-tip__year">${courseP.year}<small>year</small></p>`;
		html += `<div class="pulse-tip__row">` +
			`<span class="pulse-tip__swatch pulse-tip__swatch--course"></span>` +
			`<span class="pulse-tip__label">Course · ${courseSecLabel}</span>` +
			`<span class="pulse-tip__value">${courseP.avg.toFixed(2)}</span>` +
			`</div>`;
		if (deptP) {
			html += `<div class="pulse-tip__row">` +
				`<span class="pulse-tip__swatch pulse-tip__swatch--dept"></span>` +
				`<span class="pulse-tip__label">Dept baseline · ${deptP.sections.toLocaleString()} sections</span>` +
				`<span class="pulse-tip__value">${deptP.avg.toFixed(2)}</span>` +
				`</div>`;
			const delta = courseP.avg - deptP.avg;
			const klass = delta > 0.5 ? "is-good" : delta < -0.5 ? "is-bad" : "";
			const sign = delta >= 0 ? "+" : "";
			html += `<p class="pulse-tip__delta">vs Dept <b class="${klass}">${sign}${delta.toFixed(2)}</b></p>`;
		}
		tip.innerHTML = html;
		// Place above the point; clamp to figure bounds.
		tip.style.left = px + "px";
		tip.style.top = py + "px";
		// Force layout so the transition catches.
		void tip.offsetWidth;
		tip.classList.add("is-visible");

		// Clamp horizontally after sizing is known.
		const tRect = tip.getBoundingClientRect();
		const overflowLeft = tRect.left - figRect.left;
		const overflowRight = (figRect.right) - tRect.right;
		if (overflowLeft < 0) tip.style.transform = `translate(calc(-50% + ${-overflowLeft + 8}px), -16px) scale(1)`;
		else if (overflowRight < 0) tip.style.transform = `translate(calc(-50% - ${-overflowRight + 8}px), -16px) scale(1)`;
	}
	function hidePulseTip() {
		if (!pulseTipEl) return;
		pulseTipEl.classList.remove("is-visible");
		pulseTipEl.style.transform = "translate(-50%, -12px) scale(0.96)";
	}

	function drawInstructorBars(container, instructors) {
		container.innerHTML = "";
		if (!instructors || instructors.length === 0) {
			const e = document.createElement("p");
			e.className = "instr-empty";
			e.textContent = "No instructors with attributable averages.";
			container.appendChild(e);
			return;
		}

		// Pin the bar's domain to the actual spread of values in this course
		// (with proportional headroom). A flat avg/100 scale would make a 70%
		// prof and a 95% prof look equally full.
		const avgs = instructors.map((p) => p.avg);
		const minAvg = Math.min(...avgs);
		const maxAvg = Math.max(...avgs);
		const span = maxAvg - minAvg;
		const pad = Math.max(2, span * 0.4);
		const lo = Math.max(0, Math.floor(minAvg - pad));
		const hi = Math.min(100, Math.ceil(maxAvg + pad));
		const pct = (v) => {
			if (hi <= lo) return 100;
			return Math.max(8, ((v - lo) / (hi - lo)) * 100);
		};

		instructors.forEach((p) => {
			const row = document.createElement("div");
			row.className = "instr-row";
			row.setAttribute("role", "listitem");
			const fullName = formatInstructors(p.instructor);
			row.title = `${fullName} · ${p.avg.toFixed(2)} avg over ${p.sections} section${p.sections === 1 ? "" : "s"}`;

			const w = pct(p.avg);
			const opacity = Math.max(0.3, Number(p.weight) || 0.3);
			row.innerHTML =
				`<span class="instr-row__name">${escapeHtml(fullName)}</span>` +
				`<span class="instr-row__meta">${p.sections} section${p.sections === 1 ? "" : "s"}</span>` +
				`<span class="instr-row__bar">` +
					`<span class="instr-row__fill" style="width:${w.toFixed(1)}%; opacity:${opacity}"></span>` +
				`</span>` +
				`<span class="instr-row__value">${p.avg.toFixed(1)}</span>`;
			container.appendChild(row);
		});
	}

	function drawYearStrip(container, trend) {
		container.innerHTML = "";
		if (!trend || trend.length === 0) {
			const e = document.createElement("p");
			e.textContent = "No yearly data.";
			e.style.color = "var(--ink-3)";
			e.style.fontSize = "13px";
			container.appendChild(e);
			return;
		}
		const maxSections = Math.max(...trend.map((p) => p.sections));
		trend.forEach((p, i) => {
			const tile = document.createElement("div");
			tile.className = "year-tile";
			tile.style.animationDelay = (i * 35) + "ms";
			// Tile structure: avg label (ink, on the card background) over a
			// colored chip (height = sections, color = avg) over the year
			// (muted ink). The labels live OUTSIDE the colored area so they
			// stay readable in light mode, dark mode, gold-tile, or indigo —
			// no per-tile contrast math needed.
			const [r, g, b] = colorForAvg(p.avg);
			const chipH = Math.round(8 + (p.sections / Math.max(1, maxSections)) * 22);
			tile.title = `${p.year} · ${p.avg.toFixed(2)} avg · ${p.sections} section${p.sections === 1 ? "" : "s"}`;
			tile.innerHTML =
				`<span class="year-tile__avg">${p.avg.toFixed(0)}</span>` +
				`<span class="year-tile__chip" style="background:rgb(${r},${g},${b});height:${chipH}px"></span>` +
				`<span class="year-tile__year">${p.year}</span>`;
			container.appendChild(tile);
		});
	}

	// =========================================================================
	// Active section highlighting in the nav
	// =========================================================================
	function setupActiveNav() {
		const ids = ["upload", "datasets", "search", "pulse"];
		const sections = ids
			.map((id) => ({ id, el: document.getElementById(id) }))
			.filter((s) => s.el);
		if (!sections.length || !navLinks.length) return;
		const linkBySection = {};
		navLinks.forEach((a) => { linkBySection[a.dataset.section] = a; });

		// Scroll-driven: pick the section whose top is just above an offset line
		// (35% down the viewport). This is more reliable than IntersectionObserver
		// for tall sections and fast scrolls — it always picks ONE active link.
		let lastId = null;
		function update() {
			// "Eye-line" — about a third down the viewport. Anything whose top has
			// crossed this line is being read; the last one to cross wins.
			const eyeLine = window.scrollY + window.innerHeight * 0.35;
			let active = sections[0].id;
			for (const s of sections) {
				const top = s.el.getBoundingClientRect().top + window.scrollY;
				if (top <= eyeLine) active = s.id;
			}
			// Edge case: at the very top, before reaching the first section, no link
			// should be active. Detect by checking if first section's top is below eye line.
			const firstTop = sections[0].el.getBoundingClientRect().top + window.scrollY;
			if (firstTop > eyeLine) {
				if (lastId !== null) {
					navLinks.forEach((a) => a.classList.remove("is-current"));
					lastId = null;
				}
				return;
			}
			if (active !== lastId) {
				navLinks.forEach((a) => a.classList.remove("is-current"));
				if (linkBySection[active]) linkBySection[active].classList.add("is-current");
				lastId = active;
			}
		}

		let pending = false;
		function schedule() {
			if (pending) return;
			pending = true;
			requestAnimationFrame(() => { update(); pending = false; });
		}
		window.addEventListener("scroll", schedule, { passive: true });
		window.addEventListener("resize", schedule);
		// Run after the DOM has actually laid out (fonts loaded, ledger rendered).
		setTimeout(update, 100);
	}

	// =========================================================================
	// Scroll progress + back-to-top
	// =========================================================================
	function setupScrollUI() {
		const fill = document.getElementById("scrollbar-fill");
		const back = document.getElementById("back-top");
		if (!fill || !back) return;

		function update() {
			const doc = document.documentElement;
			const max = (doc.scrollHeight - window.innerHeight) || 1;
			const ratio = Math.max(0, Math.min(1, window.scrollY / max));
			fill.style.width = (ratio * 100) + "%";
			if (window.scrollY > 600) {
				back.hidden = false;
				back.classList.add("is-visible");
			} else {
				back.classList.remove("is-visible");
				// keep hidden=true off after first show so the transition can play out
			}
		}
		// rAF-throttled scroll listener
		let pending = false;
		window.addEventListener("scroll", () => {
			if (pending) return;
			pending = true;
			requestAnimationFrame(() => { update(); pending = false; });
		}, { passive: true });
		window.addEventListener("resize", update);
		back.addEventListener("click", () => {
			window.scrollTo({ top: 0, behavior: "smooth" });
		});
		update();
	}

	// =========================================================================
	// Wiring
	// =========================================================================
	form.addEventListener("submit", onSubmit);
	refreshBtn.addEventListener("click", loadDatasets);
	idInput.addEventListener("input", () => idInput.classList.remove("is-invalid"));
	fileInput.addEventListener("change", () => setFile(fileInput.files[0] || null));

	dropzone.addEventListener("keydown", (e) => {
		if (e.key === "Enter" || e.key === " ") {
			e.preventDefault();
			fileInput.click();
		}
	});
	["dragenter", "dragover"].forEach((evt) =>
		dropzone.addEventListener(evt, (e) => {
			e.preventDefault();
			dropzone.classList.add("is-dragover");
		})
	);
	["dragleave", "drop"].forEach((evt) =>
		dropzone.addEventListener(evt, (e) => {
			e.preventDefault();
			dropzone.classList.remove("is-dragover");
		})
	);
	dropzone.addEventListener("drop", (e) => {
		const dropped = e.dataTransfer && e.dataTransfer.files && e.dataTransfer.files[0];
		if (dropped) {
			fileInput.files = e.dataTransfer.files;
			setFile(dropped);
		}
	});

	// Search wiring — radios are siblings inside .search__tabs now.
	searchModeRadios.forEach((r) => r.addEventListener("change", () => setMode(r.value)));
	runBtn.addEventListener("click", onRunQuery);
	clearBtn.addEventListener("click", clearQuery);
	advToggle.addEventListener("click", () => toggleAdvanced());
	[qProfessor, qGradeVal, qMinSeats, qFurnitureCustom, qDept, qCourse, qTitle, qYear, qBuilding].forEach((el) => {
		if (!el) return;
		el.addEventListener("keydown", (e) => { if (e.key === "Enter") onRunQuery(); });
	});

	// Pagination
	if (resultsMoreBtn) resultsMoreBtn.addEventListener("click", () => showMoreRows(false));
	if (resultsAllBtn) resultsAllBtn.addEventListener("click", () => showMoreRows(true));

	// Furniture select reveals a custom keyword input when the user picks "Custom".
	if (qFurnitureSelect && qFurnitureCustom) {
		qFurnitureSelect.addEventListener("change", () => {
			qFurnitureCustom.hidden = qFurnitureSelect.value !== "__custom";
			if (!qFurnitureCustom.hidden) qFurnitureCustom.focus();
		});
	}

	// Building autocomplete: refresh datalist when the rooms dataset changes,
	// and surface the resolved fullname as a tooltip on the input as the user types.
	if (queryDataset) {
		queryDataset.addEventListener("change", () => {
			if (currentMode() === "rooms") populateBuildingOptions();
		});
	}
	if (qBuilding) {
		qBuilding.addEventListener("input", updateBuildingTooltip);
	}

	// Pulse wiring
	pulseForm.addEventListener("submit", onPulseSubmit);
	pulseChips.addEventListener("click", (e) => {
		const btn = e.target.closest("[data-pulse-preset]");
		if (btn) applyPulsePreset(btn.dataset.pulsePreset);
	});
	[pulseDept, pulseCourse, pulseMinYear].forEach((el) => {
		el.addEventListener("keydown", (e) => {
			if (e.key === "Enter") {
				e.preventDefault();
				pulseForm.dispatchEvent(new Event("submit", { cancelable: true }));
			}
		});
	});

	// Initial state
	populateDeptOptions();
	populateTitleKeywords();
	setMode("sections");
	loadDatasets();
	setupActiveNav();
	setupScrollUI();
})();

