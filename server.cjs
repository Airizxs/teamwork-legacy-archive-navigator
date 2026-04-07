require('dotenv').config({ path: '.env.local' });
const express = require('express');
const mysql = require('mysql2/promise');
const cors = require('cors');

const app = express();
const PORT = Number(process.env.BACKEND_PORT || 3001);

app.use(cors());
app.use(express.json());

app.use((req, res, next) => {
  console.log(`${new Date().toISOString()} ${req.method} ${req.url}`);
  next();
});

const pool = mysql.createPool({
  host: process.env.DB_HOST || 'localhost',
  user: process.env.DB_USER || 'root',
  password: process.env.DB_PASSWORD || 'root',
  database: process.env.DB_NAME || 'teamwork_archive',
  port: Number(process.env.DB_PORT || 8889),
  waitForConnections: true,
  connectionLimit: 10
});

const formatProjectQuery = `
  SELECT
    p.projectId AS id,
    p.projectName AS name,
    p.projectDescription AS description,
    p.projectStatus AS status,
    p.projectStartDate AS startDate,
    p.projectEndDate AS endDate,
    c.companyName AS companyName,
    NULL AS categoryName
  FROM projects p
  LEFT JOIN companies c ON p.companyId = c.companyId
`;

app.get('/api/projects', async (req, res) => {
  try {
    const [rows] = await pool.query(`
      ${formatProjectQuery}
      ORDER BY p.projectStartDate DESC
    `);
    res.json(rows);
  } catch (err) {
    res.status(500).json({ error: err.message });
  }
});

app.get('/api/projects/:id', async (req, res) => {
  try {
    const [rows] = await pool.query(
      `
        ${formatProjectQuery}
        WHERE p.projectId = ?
      `,
      [req.params.id]
    );

    if (!rows.length) {
      res.status(404).json({ error: 'Project not found' });
      return;
    }

    res.json(rows[0]);
  } catch (err) {
    res.status(500).json({ error: err.message });
  }
});

app.get('/api/projects/:id/tasks', async (req, res) => {
  try {
    const [rows] = await pool.query(
      `
        SELECT
          t.taskId AS id,
          tl.projectId AS projectId,
          t.tasklistId AS taskListId,
          t.taskName AS content,
          t.taskDescription AS description,
          CASE
            WHEN t.taskStatus = 'newTaskDefaults' THEN 'new'
            ELSE t.taskStatus
          END AS status,
          CASE
            WHEN t.taskPriority IS NULL OR t.taskPriority = '' THEN 'low'
            ELSE LOWER(t.taskPriority)
          END AS priority,
          t.taskCreatedByUserId AS creatorId,
          NULLIF(t.taskAssignedToCompanyId, 0) AS responsiblePartyId,
          t.taskCompletedDate AS completedOn,
          t.taskCreatedDate AS createdOn
        FROM tasks t
        JOIN tasklists tl ON t.tasklistId = tl.tasklistId
        WHERE tl.projectId = ?
        ORDER BY COALESCE(t.taskCompletedDate, t.taskCreatedDate) DESC
      `,
      [req.params.id]
    );

    res.json(rows);
  } catch (err) {
    res.status(500).json({ error: err.message });
  }
});

app.get('/api/projects/:id/messages', async (req, res) => {
  try {
    const [rows] = await pool.query(
      `
        SELECT
          mp.projectmessagepostId AS id,
          pm.projectId AS projectId,
          pm.projectmessageSubject AS title,
          mp.projectmessagepostBody AS body,
          mp.projectmessagepostDateTime AS postedOn,
          mp.userId AS authorId
        FROM projectmessageposts mp
        JOIN projectmessages pm ON mp.projectmessageId = pm.projectmessageId
        WHERE pm.projectId = ?
          AND pm.projectMessageStatus <> 'deleted'
          AND mp.projectmessagepostStatus <> 'deleted'
        ORDER BY mp.projectmessagepostDateTime DESC
      `,
      [req.params.id]
    );

    res.json(rows);
  } catch (err) {
    res.status(500).json({ error: err.message });
  }
});

app.get('/api/projects/:id/files', async (req, res) => {
  try {
    const [rows] = await pool.query(
      `
        SELECT
          pf.projectfileId,
          pfc.projectfileCategory AS category,
          pf.projectfiledescription AS description,
          pfv.projectFileVersionId,
          pfv.projectfileversionDisplayName,
          pfv.projectfileversionFileSize,
          pfv.projectfileversionFileType,
          pfv.projectfileversionUploadedToServer,
          pfv.projectfileversionAmazonS3Status,
          pfv.projectfileversionAmazonS3Path,
          pfv.projectfileversionUploadDateTime
        FROM projectfiles pf
        JOIN projectfileversions pfv ON pf.projectfileId = pfv.projectfileId
        LEFT JOIN projectfilecategories pfc ON pf.projectfilecategoryId = pfc.projectfilecategoryId
        WHERE pf.projectId = ?
        ORDER BY pfv.projectfileversionUploadDateTime DESC
        LIMIT 40
      `,
      [req.params.id]
    );

    res.json(rows);
  } catch (err) {
    console.error('attachments fetch failed', err.message);
    res.json([]);
  }
});

app.get('/api/projects/:id/milestones', async (req, res) => {
  try {
    const [rows] = await pool.query(
      `
        SELECT
          milestoneId AS id,
          projectId,
          milestoneName AS title,
          milestoneDueDate AS deadline,
          CASE
            WHEN milestoneStatus = 'late' THEN 'upcoming'
            ELSE milestoneStatus
          END AS status
        FROM milestones
        WHERE projectId = ?
        ORDER BY milestoneDueDate DESC
      `,
      [req.params.id]
    );

    res.json(rows);
  } catch (err) {
    res.status(500).json({ error: err.message });
  }
});

app.get('/api/stats', async (req, res) => {
  try {
    const [[projectCountRows], [completedTaskRows], [activityRows]] = await Promise.all([
      pool.query('SELECT COUNT(*) AS count FROM projects'),
      pool.query(`SELECT COUNT(*) AS count FROM tasks WHERE taskStatus = 'completed'`),
      pool.query(`
        SELECT YEAR(projectStartDate) AS year, COUNT(*) AS count
        FROM projects
        GROUP BY YEAR(projectStartDate)
        ORDER BY YEAR(projectStartDate)
      `)
    ]);

    res.json({
      totalProjects: projectCountRows[0].count,
      completedTasks: completedTaskRows[0].count,
      projectActivity: activityRows.map((row) => ({
        name: row.year ? String(row.year) : 'Unknown',
        count: row.count
      }))
    });
  } catch (err) {
    res.status(500).json({ error: err.message });
  }
});

app.listen(PORT, async () => {
  try {
    const connection = await pool.getConnection();
    await connection.ping();
    connection.release();
    console.log(`Archive API running at http://localhost:${PORT}`);
    console.log('Connected to MySQL archive database');
  } catch (err) {
    console.error('MySQL connection failed:', err);
  }
});
