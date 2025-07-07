// scripts/update-dataset.js

const { readFile, writeFile } = require("fs/promises");
const path = require("path");

async function main() {
	const inPath = path.join(__dirname, "data", "dataset.json");
	const outPath = path.join(__dirname, "data", "dataset-updated.json");

	// 1. Read and parse the input JSON
	const raw = await readFile(inPath, "utf-8");
	const items = JSON.parse(raw);

	// 2. Process each item
	const updated = items.map(({ text }) => {
		// a) Extract the PARAMETERS comment
		const paramMatch = text.match(/--\s*PARAMETERS:\s*(\[[^\]]*\])/i);
		if (!paramMatch) {
			// no parameters; leave text as‑is
			return { text };
		}

		// b) Parse the array literal
		let params;
        const paramListString = paramMatch[1].replaceAll('\\', '');
		try {
			params = JSON.parse(paramListString);
		} catch (err) {
			throw new Error(`Invalid PARAMETERS array in text: ${paramListString}`);
		}

		// c) For each parameter, build replacement value
		const replacements = params.map((p, idx) => {
			const placeholder = new RegExp(`\\$${idx + 1}\\b`, "g");
			let val;
			if (typeof p === "string") {
				// Escape any single quotes inside
				const esc = p.replace(/'/g, `\\'`);
				val = `'${esc}'`;
			} else if (typeof p === "number") {
				val = String(p);
			} else {
				// Fallback to JSON
				val = JSON.stringify(p);
			}
			return { placeholder, val };
		});

		// d) Remove the PARAMETERS comment, then apply all replacements
		let newText = text
			.replace(paramMatch[0], "")
			.trim();
		replacements.forEach(({ placeholder, val }) => {
			newText = newText.replace(placeholder, val);
		});

		return { text: newText };
	});

	// 3. Write the updated JSON back out
	await writeFile(outPath, JSON.stringify(updated, null, 2), "utf-8");
	console.log(`✅ Updated dataset written to ${outPath}`);
}

main().catch((err) => {
	console.error(err);
	process.exit(1);
});
