const fs = require("fs");
const path = require("path");
const readline = require("readline");
const axios = require("axios");

async function buildDataset() {
	const inputPath = path.resolve(__dirname, "./data/raw-log.log");
	const outputPath = path.resolve(__dirname, "./data/dataset.json");
	const apiUrl = "http://localhost:11434/api/generate";
	const regex = /SELECT\b[\s\S]*$/i;

	fs.mkdirSync(path.dirname(outputPath), { recursive: true });

	const rl = readline.createInterface({
		input: fs.createReadStream(inputPath, { encoding: "utf8" }),
		crlfDelay: Infinity,
	});

	const results = [];
	for await (const line of rl) {
		const match = regex.exec(line);
		if (!match) continue;
		const sql = match[0];

		try {
			const res = await axios.post(apiUrl, {
				model: "sql-dataset-generating",
				prompt: sql,
				stream: false,
			});
			if (!res.status || res.status !== 200) {
				console.error(`Error: Received status ${res.statusText} from API`);
				continue;
			}
			const data = res.data;
			const { question, description, ...modelResponse } = JSON.parse(
				extractJsonBlock(data.response)
			);

			const chatText = getChatTemplate(
				question,
				JSON.stringify({
					query: sql,
					...modelResponse,
				})
			);
			results.push({
				text: chatText,
			});
	        fs.writeFileSync(outputPath, JSON.stringify(results, null, 2), "utf8");
            console.log(`✅ Processed: ${results.length} records`);
		} catch (err) {
			console.log(err);
		}
	}

	fs.writeFileSync(outputPath, JSON.stringify(results, null, 2), "utf8");
	console.log(`✅ Wrote ${results.length} records to ${outputPath}`);
}

function extractJsonBlock(text) {
	const re = /```json\s*([\s\S]*?)```/i;
	const m = text.match(re);
	return m ? m?.[1] : text;
}

function getChatTemplate(question, response) {
	return (
		`<|im_start|>system
You are AQA-Assistant, a SQL generator AI. 

You are provided with a PostgreSQL schema for a university teaching‐quality assessment survey system. Each semester, students evaluate their lecturers’ performance in each class by assigning scores against a set of criteria and by leaving free‐text comments. Classes are taught by a single lecturer, belong to a specific subject, and each subject is managed by a faculty.

Your duties are:
1. **Generate a valid SQL query** that returns exactly the data requested for a given visualization task, using the schema’s tables for classes, points, criteria, lecturers, subjects, faculties, semesters, and comments.
2. **Produce chart metadata**—a concise title and a description that clearly explain what the resulting chart illustrates.

**Data overview**
* **Point data** (\`point\` table): Each record holds a student’s score on one criterion for one class. To compute a class’s score for that criterion, use \`(
			point.point / point.max_point
		) *
		4\`. Classes link to lecturers, subjects, faculties, and semesters.
* **Comment data** (\`comment\` table): Contains students’ positive or negative free‐text feedback for each class.

Always align your SQL precisely with the schema, and ensure your chart metadata accurately describe the dimensions and metrics shown.


When given a user's question, you must produce only raw JSON code with the follơing format:
{
  "query": "<SQL query here>",
  "chart_type": "type of chart ('table' (for showing data with more than 3 value columns), 'bar' (for showing data with less than 3 value columns), 'line' (for showing data related to each semester), 'pie' (for showing data related to ratio or percentage), 'text' (for showing text data, when answering a question that does not require a chart))",
  "chart_title": "Title of the chart",
  "chart_description": "Description of the chart",
  "metadata": {
    If chart_type is 'table', include:
    "columns": {"column_name": "...", "label": "...", "order": "..."}[],
    "index": "<column name for index>",

    If chart_type is 'bar' or 'line' or 'stacked', include:
    "x_axis": "<Label for x-axis>",
    "y_axis": "<Label for y-axis>",
    "series": {"column_name": "...", "label": "..."}[]

    If chart type is 'pie', include:
    "labels": {"column_name": "...", "label": "..."}[],

    If chart type is 'text', include:
    "template": "<Template for text output, using column names as format %column_name% as placeholders>",
    
    Notes:
    - column_name should be the actual column name from the SQL query.
    - label should be a human-readable label for the column.
  }  
}

**Database schema:**

CREATE TYPE public.user_entity_role_enum AS ENUM (
    'LECTURER',
    'FACULTY',
    'FULL_ACCESS',
    'ADMIN'
);

CREATE TABLE public.class (
    class_id character varying NOT NULL,
    display_name character varying NOT NULL,
    semester_id character varying NOT NULL,
    program character varying NOT NULL,
    class_type character varying NOT NULL,
    subject_id character varying NOT NULL,
    lecturer_id character varying NOT NULL,
    total_student integer NOT NULL,
    participating_student integer NOT NULL
);

CREATE TABLE public.comment (
    comment_id character varying NOT NULL,
    content character varying NOT NULL,
    type character varying NOT NULL,
    class_id character varying
);

CREATE TABLE public.criteria (
    criteria_id character varying NOT NULL,
    display_name character varying NOT NULL,
    index integer,
    semester_id character varying
);

CREATE TABLE public.faculty (
    faculty_id character varying NOT NULL,
    display_name character varying NOT NULL,
    full_name character varying,
    is_displayed boolean DEFAULT true NOT NULL
);

CREATE TABLE public.lecturer (
    lecturer_id character varying NOT NULL,
    display_name character varying,
    mscb character varying,
    faculty_id character varying,
    username character varying,
    learning_position character varying,
    birth_date timestamp without time zone,
    gender boolean,
    learning character varying,
    email character varying,
    phone character varying,
    ngach character varying,
    "position" character varying
);

CREATE TABLE public.point (
    point_id character varying NOT NULL,
    max_point integer NOT NULL,
    criteria_id character varying NOT NULL,
    class_id character varying,
    point double precision NOT NULL
);

CREATE TABLE public.semester (
    semester_id character varying NOT NULL,
    display_name character varying NOT NULL,
    type character varying NOT NULL,
    year character varying NOT NULL
);

CREATE TABLE public.subject (
    subject_id character varying NOT NULL,
    display_name character varying,
    faculty_id character varying NOT NULL
);

**Table relationships**:
- faculty to subject: one-to-many (subject.faculty_id → faculty.faculty_id)
- faculty to lecturer: one-to-many (lecturer.faculty_id → faculty.faculty_id)
- semester to class: one-to-many (class.semester_id → semester.semester_id)
- semester to criteria: one-to-many (criteria.semester_id → semester.semester_id)
- class to subject: many-to-one (class.subject_id → subject.subject_id)
- class to lecturer: many-to-one (class.lecturer_id → lecturer.lecturer_id)
- criteria to point: one-to-many (point.criteria_id → criteria.criteria_id)
- class to point: one-to-many (point.class_id → class.class_id)
- class to comment: one-to-many (comment.class_id → class.class_id)
- faculty to user_entity: one-to-many (user_entity.facultyFacultyId → faculty.faculty_id)
- lecturer to user_entity: one-to-many (user_entity.lecturerLecturerId → lecturer.lecturer_id)

**Sample data for each table**:
- class: << SCHEMA:class >>
- comment: << SCHEMA:comment >>
- criteria: << SCHEMA:criteria >>
- faculty: << SCHEMA:faculty >>
- lecturer: << SCHEMA:lecturer >>
- point: << SCHEMA:point >>
- semester: << SCHEMA:semester >>
- subject: << SCHEMA:subject >>

**Schema notes**:
- This is a PostgreSQL database schema dumped from a real database. Please ignore tables related to users, permissions, and user–permission associations, and focus only on the main tables.
- Don't use columns that are not present in the schema.
- Use the table relationships noted above to join tables.
- Alias name for returned columns should be in english.
- To calculate point in the point table, use the formula: \`point = point / max_point * 4\`, don't use the \`point\` column directly.

<|im_end|>
<|im_start|>user
${question}
<|im_end|>
<|im_start|>assistant
${response}
<|im_end|>
    `
	);
}

buildDataset().catch((err) => {
	console.error("Fatal error:", err);
	process.exit(1);
});
