const JSON_HEADERS = {
  'content-type': 'application/json; charset=utf-8',
  'cache-control': 'no-store',
  'access-control-allow-origin': '*',
  'access-control-allow-methods': 'GET,OPTIONS',
  'access-control-allow-headers': 'content-type'
};

const makeJsonResponse = (payload, status = 200) =>
  new Response(JSON.stringify(payload), { status, headers: JSON_HEADERS });

const makeErrorResponse = (message, status = 500) => makeJsonResponse({ error: message }, status);

const normalizeProjectId = (value) => {
  const parsed = Number(value);
  return Number.isInteger(parsed) && parsed > 0 ? parsed : null;
};

const mapActivityYear = (row) => ({
  name: row.year ? String(row.year) : 'Unknown',
  count: row.count
});

async function queryAll(db, sql, params = []) {
  const statement = db.prepare(sql);
  return params.length ? (await statement.bind(...params).all()).results : (await statement.all()).results;
}

async function queryFirst(db, sql, params = []) {
  const statement = db.prepare(sql);
  return params.length ? await statement.bind(...params).first() : await statement.first();
}

async function handleApiRequest(request, env, url) {
  if (!env.DB) {
    return makeErrorResponse('D1 binding "DB" is missing in Wrangler config.', 500);
  }

  if (request.method === 'OPTIONS') {
    return new Response(null, { status: 204, headers: JSON_HEADERS });
  }

  if (request.method !== 'GET') {
    return makeErrorResponse('Method not allowed', 405);
  }

  if (url.pathname === '/api/projects') {
    const rows = await queryAll(
      env.DB,
      `
        SELECT
          id,
          name,
          description,
          status,
          startDate,
          endDate,
          companyName,
          categoryName
        FROM projects
        ORDER BY startDate DESC
      `
    );
    return makeJsonResponse(rows);
  }

  if (url.pathname === '/api/stats') {
    const [projects, completedTasks, projectActivity] = await Promise.all([
      queryFirst(env.DB, 'SELECT COUNT(*) AS count FROM projects'),
      queryFirst(env.DB, "SELECT COUNT(*) AS count FROM tasks WHERE lower(coalesce(status, '')) = 'completed'"),
      queryAll(
        env.DB,
        `
          SELECT
            CASE
              WHEN startDate IS NULL OR trim(startDate) = '' THEN NULL
              ELSE substr(startDate, 1, 4)
            END AS year,
            COUNT(*) AS count
          FROM projects
          GROUP BY year
          ORDER BY year
        `
      )
    ]);

    return makeJsonResponse({
      totalProjects: projects?.count ?? 0,
      completedTasks: completedTasks?.count ?? 0,
      projectActivity: projectActivity.map(mapActivityYear)
    });
  }

  const projectRoute = url.pathname.match(/^\/api\/projects\/(\d+)$/);
  if (projectRoute) {
    const projectId = normalizeProjectId(projectRoute[1]);
    if (!projectId) return makeErrorResponse('Invalid project id', 400);

    const row = await queryFirst(
      env.DB,
      `
        SELECT
          id,
          name,
          description,
          status,
          startDate,
          endDate,
          companyName,
          categoryName
        FROM projects
        WHERE id = ?
      `,
      [projectId]
    );

    if (!row) return makeErrorResponse('Project not found', 404);
    return makeJsonResponse(row);
  }

  const tasksRoute = url.pathname.match(/^\/api\/projects\/(\d+)\/tasks$/);
  if (tasksRoute) {
    const projectId = normalizeProjectId(tasksRoute[1]);
    if (!projectId) return makeErrorResponse('Invalid project id', 400);

    const rows = await queryAll(
      env.DB,
      `
        SELECT
          id,
          projectId,
          taskListId,
          content,
          description,
          status,
          priority,
          creatorId,
          responsiblePartyId,
          completedOn,
          createdOn
        FROM tasks
        WHERE projectId = ?
        ORDER BY COALESCE(completedOn, createdOn) DESC
      `,
      [projectId]
    );
    return makeJsonResponse(rows);
  }

  const messagesRoute = url.pathname.match(/^\/api\/projects\/(\d+)\/messages$/);
  if (messagesRoute) {
    const projectId = normalizeProjectId(messagesRoute[1]);
    if (!projectId) return makeErrorResponse('Invalid project id', 400);

    const rows = await queryAll(
      env.DB,
      `
        SELECT
          id,
          projectId,
          title,
          body,
          postedOn,
          authorId
        FROM messages
        WHERE projectId = ?
        ORDER BY postedOn DESC
      `,
      [projectId]
    );
    return makeJsonResponse(rows);
  }

  const milestonesRoute = url.pathname.match(/^\/api\/projects\/(\d+)\/milestones$/);
  if (milestonesRoute) {
    const projectId = normalizeProjectId(milestonesRoute[1]);
    if (!projectId) return makeErrorResponse('Invalid project id', 400);

    const rows = await queryAll(
      env.DB,
      `
        SELECT
          id,
          projectId,
          title,
          deadline,
          status
        FROM milestones
        WHERE projectId = ?
        ORDER BY deadline DESC
      `,
      [projectId]
    );
    return makeJsonResponse(rows);
  }

  const filesRoute = url.pathname.match(/^\/api\/projects\/(\d+)\/files$/);
  if (filesRoute) {
    return makeJsonResponse([]);
  }

  return makeErrorResponse('Not found', 404);
}

export default {
  async fetch(request, env) {
    const url = new URL(request.url);

    try {
      if (url.pathname.startsWith('/api/')) {
        return await handleApiRequest(request, env, url);
      }

      if (env.ASSETS) {
        return env.ASSETS.fetch(request);
      }

      return new Response('Static assets binding missing.', { status: 500 });
    } catch (error) {
      const message = error instanceof Error ? error.message : 'Unexpected error';
      return makeErrorResponse(message, 500);
    }
  }
};
