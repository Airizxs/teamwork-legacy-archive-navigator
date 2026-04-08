PRAGMA foreign_keys=OFF;
CREATE TABLE projects (
      id INTEGER PRIMARY KEY,
      name TEXT NOT NULL,
      description TEXT,
      status TEXT,
      startDate TEXT,
      endDate TEXT,
      companyName TEXT,
      categoryName TEXT
    );
INSERT INTO projects VALUES(101,'Website Overhaul 2023','Full migration of the main marketing site to a headless CMS.','completed','2023-01-15','2023-06-20','Internal Corp','Marketing');
INSERT INTO projects VALUES(102,'Mobile App Beta','Initial phase for iOS and Android application development.','completed','2022-05-10','2022-12-15','Tech Client X','Development');
INSERT INTO projects VALUES(103,'Quarterly Audit Q4','Yearly security and financial compliance audit.','completed','2023-10-01','2023-11-15','Compliance Ltd','Legal');
CREATE TABLE tasks (
      id INTEGER PRIMARY KEY,
      projectId INTEGER,
      taskListId INTEGER,
      content TEXT NOT NULL,
      description TEXT,
      status TEXT,
      priority TEXT,
      creatorId INTEGER,
      responsiblePartyId INTEGER,
      completedOn TEXT,
      createdOn TEXT,
      FOREIGN KEY(projectId) REFERENCES projects(id)
    );
INSERT INTO tasks VALUES(301,101,201,'Create moodboard','Gather inspiration for color palette and typography.','completed','medium',1,2,'2023-01-20','2023-01-16');
INSERT INTO tasks VALUES(302,101,201,'Finalize logo','Iterate based on stakeholder feedback.','completed','high',1,2,'2023-02-05','2023-01-21');
INSERT INTO tasks VALUES(303,101,202,'API Integration','Connect frontend to the new GraphQL endpoint.','completed','high',2,3,'2023-05-15','2023-03-10');
INSERT INTO tasks VALUES(304,102,203,'Login Screen','Standard OAuth implementation.','completed','medium',1,3,'2022-06-15','2022-06-01');
CREATE TABLE messages (
      id INTEGER PRIMARY KEY,
      projectId INTEGER,
      title TEXT,
      body TEXT,
      postedOn TEXT,
      authorId INTEGER,
      FOREIGN KEY(projectId) REFERENCES projects(id)
    );
INSERT INTO messages VALUES(501,101,'Initial Kickoff Notes','We agreed on a 6-month timeline with monthly check-ins.','2023-01-15',1);
INSERT INTO messages VALUES(502,101,'Budget Update','Additional resources allocated for the migration phase.','2023-03-22',2);
CREATE TABLE milestones (
      id INTEGER PRIMARY KEY,
      projectId INTEGER,
      title TEXT,
      deadline TEXT,
      status TEXT,
      FOREIGN KEY(projectId) REFERENCES projects(id)
    );
INSERT INTO milestones VALUES(401,101,'Design Sign-off','2023-02-28','completed');
INSERT INTO milestones VALUES(402,101,'Launch Date','2023-06-30','completed');
