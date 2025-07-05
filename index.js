require('dotenv').config();
const fs = require('fs');
const path = require('path');
const { Pool } = require('pg');

const pool = new Pool({
  connectionString: process.env.CONNECTION_STRING,
});

const PARAM = process.env.PARAM;
const TEMPLATE_PATH = path.join(__dirname, 'src', `template.Modelfile`);
const OUTPUT_PATH = path.join(__dirname, 'dist', 'Modelfile');

const tables = [
  'class',
  'comment',
  'criteria',
  'faculty',
  'lecturer',
  'point',
  'semester',
  'subject',
];

async function queryAndReplaceTemplate() {
  const client = await pool.connect();
  const resultObj = {};

  try {
    for (const table of tables) {
      const res = await client.query(`SELECT * FROM ${table} LIMIT 1`);
      resultObj[table] = res.rows[0] || {};
    }

    const rawTemplate = fs.readFileSync(TEMPLATE_PATH, 'utf8');

    let finalOutput = rawTemplate.replace(/<<\s*PARAM\s*>>/g, PARAM);

    for (const table of tables) {
      const schemaKey = new RegExp(`<<\\s*SCHEMA:${table}\\s*>>`, 'g');
      const value = JSON.stringify(resultObj[table], null, 2); // pretty-print
      finalOutput = finalOutput.replace(schemaKey, value);
    }

    fs.mkdirSync(path.dirname(OUTPUT_PATH), { recursive: true });

    fs.writeFileSync(OUTPUT_PATH, finalOutput, 'utf8');

    console.log('✅ Modelfile generated at:', OUTPUT_PATH);
  } catch (err) {
    console.error('❌ Error:', err);
  } finally {
    client.release();
    await pool.end();
  }
}

queryAndReplaceTemplate();
