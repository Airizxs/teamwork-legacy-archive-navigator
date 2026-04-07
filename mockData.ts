
import { ArchiveData } from './types';

export const MOCK_ARCHIVE: ArchiveData = {
  users: [
    { id: 1, firstName: "Admin", lastName: "User", avatarUrl: "https://picsum.photos/seed/user1/100/100" },
    { id: 2, firstName: "Jane", lastName: "Doe", avatarUrl: "https://picsum.photos/seed/user2/100/100" },
    { id: 3, firstName: "John", lastName: "Smith", avatarUrl: "https://picsum.photos/seed/user3/100/100" },
  ],
  projects: [
    { id: 101, name: "Website Overhaul 2023", description: "Full migration of the main marketing site to a headless CMS.", status: "completed", startDate: "2023-01-15", endDate: "2023-06-20", companyName: "Internal Corp", categoryName: "Marketing" },
    { id: 102, name: "Mobile App Beta", description: "Initial phase for iOS and Android application development.", status: "completed", startDate: "2022-05-10", endDate: "2022-12-15", companyName: "Tech Client X", categoryName: "Development" },
    { id: 103, name: "Quarterly Audit Q4", description: "Yearly security and financial compliance audit.", status: "archived", startDate: "2023-10-01", endDate: "2023-11-15", companyName: "Compliance Ltd", categoryName: "Legal" },
  ],
  taskLists: [
    { id: 201, projectId: 101, name: "Design Phase" },
    { id: 202, projectId: 101, name: "Implementation" },
    { id: 203, projectId: 102, name: "UI/UX Components" },
  ],
  tasks: [
    { id: 301, projectId: 101, taskListId: 201, content: "Create moodboard", description: "Gather inspiration for color palette and typography.", status: "completed", priority: "medium", creatorId: 1, responsiblePartyId: 2, createdOn: "2023-01-16", completedOn: "2023-01-20" },
    { id: 302, projectId: 101, taskListId: 201, content: "Finalize logo", description: "Iterate based on stakeholder feedback.", status: "completed", priority: "high", creatorId: 1, responsiblePartyId: 2, createdOn: "2023-01-21", completedOn: "2023-02-05" },
    { id: 303, projectId: 101, taskListId: 202, content: "API Integration", description: "Connect frontend to the new GraphQL endpoint.", status: "completed", priority: "high", creatorId: 2, responsiblePartyId: 3, createdOn: "2023-03-10", completedOn: "2023-05-15" },
    { id: 304, projectId: 102, taskListId: 203, content: "Login Screen", description: "Standard OAuth implementation.", status: "completed", priority: "medium", creatorId: 1, responsiblePartyId: 3, createdOn: "2022-06-01", completedOn: "2022-06-15" },
  ],
  milestones: [
    { id: 401, projectId: 101, title: "Design Sign-off", deadline: "2023-02-28", status: "completed" },
    { id: 402, projectId: 101, title: "Launch Date", deadline: "2023-06-30", status: "completed" },
  ],
  messages: [
    { id: 501, projectId: 101, title: "Initial Kickoff Notes", body: "We agreed on a 6-month timeline with monthly check-ins.", postedOn: "2023-01-15", authorId: 1 },
    { id: 502, projectId: 101, title: "Budget Update", body: "Additional resources allocated for the migration phase.", postedOn: "2023-03-22", authorId: 2 },
  ]
};
