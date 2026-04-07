const sqlite3 = require('sqlite3').verbose();
const path = require('path');

const DB_PATH = path.resolve(__dirname, 'archive.db');
const db = new sqlite3.Database(DB_PATH);

const mockArchive = {
    projects: [
        { id: 101, name: "Website Overhaul 2023", description: "Full migration of the main marketing site to a headless CMS.", status: "completed", startDate: "2023-01-15", endDate: "2023-06-20", companyName: "Internal Corp", categoryName: "Marketing" },
        { id: 102, name: "Mobile App Beta", description: "Initial phase for iOS and Android application development.", status: "completed", startDate: "2022-05-10", endDate: "2022-12-15", companyName: "Tech Client X", categoryName: "Development" },
        { id: 103, name: "Quarterly Audit Q4", description: "Yearly security and financial compliance audit.", status: "completed", startDate: "2023-10-01", endDate: "2023-11-15", companyName: "Compliance Ltd", categoryName: "Legal" },
    ],
    tasks: [
        { id: 301, projectId: 101, taskListId: 201, content: "Create moodboard", description: "Gather inspiration for color palette and typography.", status: "completed", priority: "medium", creatorId: 1, responsiblePartyId: 2, createdOn: "2023-01-16", completedOn: "2023-01-20" },
        { id: 302, projectId: 101, taskListId: 201, content: "Finalize logo", description: "Iterate based on stakeholder feedback.", status: "completed", priority: "high", creatorId: 1, responsiblePartyId: 2, createdOn: "2023-01-21", completedOn: "2023-02-05" },
        { id: 303, projectId: 101, taskListId: 202, content: "API Integration", description: "Connect frontend to the new GraphQL endpoint.", status: "completed", priority: "high", creatorId: 2, responsiblePartyId: 3, createdOn: "2023-03-10", completedOn: "2023-05-15" },
        { id: 304, projectId: 102, taskListId: 203, content: "Login Screen", description: "Standard OAuth implementation.", status: "completed", priority: "medium", creatorId: 1, responsiblePartyId: 3, createdOn: "2022-06-01", completedOn: "2022-06-15" },
    ],
    messages: [
        { id: 501, projectId: 101, title: "Initial Kickoff Notes", body: "We agreed on a 6-month timeline with monthly check-ins.", postedOn: "2023-01-15", authorId: 1 },
        { id: 502, projectId: 101, title: "Budget Update", body: "Additional resources allocated for the migration phase.", postedOn: "2023-03-22", authorId: 2 },
    ],
    milestones: [
        { id: 401, projectId: 101, title: "Design Sign-off", deadline: "2023-02-28", status: "completed" },
        { id: 402, projectId: 101, title: "Launch Date", deadline: "2023-06-30", status: "completed" },
    ]
};

db.serialize(() => {
    console.log("Seeding data...");

    const stmtProj = db.prepare("INSERT OR IGNORE INTO projects VALUES (?, ?, ?, ?, ?, ?, ?, ?)");
    mockArchive.projects.forEach(p => stmtProj.run(p.id, p.name, p.description, p.status, p.startDate, p.endDate, p.companyName, p.categoryName));
    stmtProj.finalize();

    const stmtTasks = db.prepare("INSERT OR IGNORE INTO tasks VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)");
    mockArchive.tasks.forEach(t => stmtTasks.run(t.id, t.projectId, t.taskListId, t.content, t.description, t.status, t.priority, t.creatorId, t.responsiblePartyId, t.completedOn, t.createdOn));
    stmtTasks.finalize();

    const stmtMsg = db.prepare("INSERT OR IGNORE INTO messages VALUES (?, ?, ?, ?, ?, ?)");
    mockArchive.messages.forEach(m => stmtMsg.run(m.id, m.projectId, m.title, m.body, m.postedOn, m.authorId));
    stmtMsg.finalize();

    const stmtMil = db.prepare("INSERT OR IGNORE INTO milestones VALUES (?, ?, ?, ?, ?)");
    mockArchive.milestones.forEach(m => stmtMil.run(m.id, m.projectId, m.title, m.deadline, m.status));
    stmtMil.finalize();

    console.log("Seeding complete!");
});

db.close();
