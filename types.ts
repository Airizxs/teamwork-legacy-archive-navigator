
export interface User {
  id: number;
  firstName: string;
  lastName: string;
  avatarUrl?: string;
}

export interface Project {
  id: number;
  name: string;
  description: string;
  status: 'active' | 'archived' | 'completed';
  startDate: string;
  endDate?: string;
  companyName: string;
  categoryName?: string;
}

export interface Task {
  id: number;
  projectId: number;
  taskListId: number;
  content: string;
  description: string;
  status: 'new' | 'completed' | 'in-progress';
  priority: 'low' | 'medium' | 'high';
  creatorId: number;
  responsiblePartyId?: number;
  completedOn?: string;
  createdOn: string;
}

export interface TaskList {
  id: number;
  projectId: number;
  name: string;
}

export interface Milestone {
  id: number;
  projectId: number;
  title: string;
  deadline: string;
  status: 'completed' | 'upcoming';
}

export interface Message {
  id: number;
  projectId: number;
  title: string;
  body: string;
  postedOn: string;
  authorId: number;
}

export interface Attachment {
  projectfileId: number;
  description: string;
  category?: string;
  projectFileVersionId: number;
  projectfileversionDisplayName: string;
  projectfileversionFileSize: number;
  projectfileversionFileType: string;
  projectfileversionUploadedToServer?: string;
  projectfileversionAmazonS3Status?: string;
  projectfileversionAmazonS3Path: string;
  projectfileversionUploadDateTime: string;
 }

export interface ArchiveData {
  projects: Project[];
  tasks: Task[];
  taskLists: TaskList[];
  users: User[];
  milestones: Milestone[];
  messages: Message[];
}
