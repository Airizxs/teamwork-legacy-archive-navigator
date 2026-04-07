import React from 'react';
import { Project, Task, Message, Milestone, Attachment } from './types';
import {
  ArchiveIcon,
  ArrowLeftIcon,
  ArrowUpIcon,
  Building2Icon,
  CalendarDaysIcon,
  CheckCircleIcon,
  ChevronRightIcon,
  ClockIcon,
  FlagIcon,
  FolderIcon,
  LayoutDashboardIcon,
  MessageSquareIcon,
  SearchIcon,
  SparklesIcon,
  UserIcon
} from 'lucide-react';
import { getProjectSummary } from './services/geminiService';
import { BarChart, Bar, XAxis, YAxis, CartesianGrid, Tooltip, ResponsiveContainer } from 'recharts';

const API_BASE = 'http://localhost:3001/api';
const ATTACHMENT_HOST = import.meta.env.VITE_ATTACHMENT_HOST || 'https://uploads.teamwork.com/';

type ViewMode = 'dashboard' | 'projects' | 'project-detail';
type DetailPanel = 'timeline' | 'updates' | 'messages';

type TimelineEvent =
  | { id: string; type: 'task'; date: string; title: string; body: string; meta: string; badge: string; tone: string }
  | { id: string; type: 'message'; date: string; title: string; body: string; meta: string; badge: string; tone: string }
  | { id: string; type: 'milestone'; date: string; title: string; body: string; meta: string; badge: string; tone: string };

const formatDisplayDate = (value?: string) => {
  if (!value) return 'Date unavailable';
  const parsed = new Date(value);
  if (Number.isNaN(parsed.getTime())) return value;
  return new Intl.DateTimeFormat('en-US', {
    month: 'long',
    day: 'numeric',
    year: 'numeric'
  }).format(parsed);
};

const formatShortDate = (value?: string) => {
  if (!value) return 'No date';
  const parsed = new Date(value);
  if (Number.isNaN(parsed.getTime())) return value;
  return new Intl.DateTimeFormat('en-US', {
    month: 'short',
    day: 'numeric',
    year: 'numeric'
  }).format(parsed);
};

const compareDatesDesc = (a?: string, b?: string) => {
  const aTime = a ? new Date(a).getTime() : 0;
  const bTime = b ? new Date(b).getTime() : 0;
  return bTime - aTime;
};

const normalizeArchiveText = (value?: string) => {
  if (!value) return '';
  return value
    .replace(/<br\s*\/?>/gi, '\n')
    .replace(/<\/div>\s*<div>/gi, '\n')
    .replace(/<\/p>\s*<p>/gi, '\n\n')
    .replace(/<[^>]+>/g, '')
    .replace(/&nbsp;/g, ' ')
    .replace(/&amp;/g, '&')
    .replace(/&lt;/g, '<')
    .replace(/&gt;/g, '>')
    .replace(/\n{3,}/g, '\n\n')
    .trim();
};

const formatBytes = (value?: number) => {
  if (!value) return '0 KB';
  const kb = value / 1024;
  if (kb < 1024) return `${kb.toFixed(1)} KB`;
  return `${(kb / 1024).toFixed(1)} MB`;
};

const getAttachmentUrl = (path: string) => {
  try {
    return new URL(path, ATTACHMENT_HOST).href;
  } catch {
    return ATTACHMENT_HOST + path;
  }
};

const isAttachmentLikelyUnavailable = (attachment: Attachment) => {
  const status = (attachment.projectfileversionAmazonS3Status || '').toLowerCase();
  return status === 'moved and local deleted';
};


const getStatusTone = (status?: string) => {
  if (status === 'completed') return 'bg-emerald-100 text-emerald-800 border-emerald-200';
  if (status === 'in-progress' || status === 'active') return 'bg-amber-100 text-amber-800 border-amber-200';
  return 'bg-stone-200 text-stone-700 border-stone-300';
};

const getPriorityTone = (priority?: string) => {
  if (priority === 'high') return 'text-rose-700';
  if (priority === 'medium') return 'text-amber-700';
  return 'text-stone-500';
};

const buildTimeline = (tasks: Task[], messages: Message[], milestones: Milestone[]): TimelineEvent[] => {
  const taskEvents: TimelineEvent[] = tasks.map((task) => ({
    id: `task-${task.id}`,
    type: 'task',
    date: task.completedOn || task.createdOn,
    title: task.content || 'Untitled task',
    body: task.description || 'Task record preserved without additional notes.',
    meta: task.completedOn ? `Task closed on ${formatDisplayDate(task.completedOn)}` : `Task opened on ${formatDisplayDate(task.createdOn)}`,
    badge: task.status || 'task',
    tone: 'border-l-amber-500'
  }));

  const messageEvents: TimelineEvent[] = messages.map((message) => ({
    id: `message-${message.id}`,
    type: 'message',
    date: message.postedOn,
    title: message.title || 'Untitled message',
    body: message.body || 'Message record preserved without body text.',
    meta: `Message posted by user ${message.authorId}`,
    badge: 'message',
    tone: 'border-l-sky-500'
  }));

  const milestoneEvents: TimelineEvent[] = milestones.map((milestone) => ({
    id: `milestone-${milestone.id}`,
    type: 'milestone',
    date: milestone.deadline,
    title: milestone.title,
    body: milestone.status === 'completed' ? 'Milestone marked complete in the archive.' : 'Milestone scheduled in the archive timeline.',
    meta: `Milestone deadline ${formatDisplayDate(milestone.deadline)}`,
    badge: milestone.status,
    tone: 'border-l-emerald-500'
  }));

  return [...taskEvents, ...messageEvents, ...milestoneEvents].sort((a, b) => compareDatesDesc(a.date, b.date));
};

const App: React.FC = () => {
  const [view, setView] = React.useState<ViewMode>('dashboard');
  const [searchQuery, setSearchQuery] = React.useState('');
  const [aiSummary, setAiSummary] = React.useState<string | null>(null);
  const [isSummarizing, setIsSummarizing] = React.useState(false);
  const [projects, setProjects] = React.useState<Project[]>([]);
  const [selectedProject, setSelectedProject] = React.useState<Project | null>(null);
  const [projectTasks, setProjectTasks] = React.useState<Task[]>([]);
  const [projectMessages, setProjectMessages] = React.useState<Message[]>([]);
  const [projectMilestones, setProjectMilestones] = React.useState<Milestone[]>([]);
  const [projectAttachments, setProjectAttachments] = React.useState<Attachment[]>([]);
  const [dashboardStats, setDashboardStats] = React.useState<any>(null);
  const [isLoading, setIsLoading] = React.useState(true);
  const [error, setError] = React.useState<string | null>(null);
  const [detailPanel, setDetailPanel] = React.useState<DetailPanel>('timeline');
  const [selectedUpdateId, setSelectedUpdateId] = React.useState<string | null>(null);
  const [selectedMessageId, setSelectedMessageId] = React.useState<number | null>(null);
  const [expandedTaskId, setExpandedTaskId] = React.useState<number | null>(null);
  const [attachmentNotice, setAttachmentNotice] = React.useState<string | null>(null);
  const attachmentNoticeTimeoutRef = React.useRef<number | null>(null);

  React.useEffect(() => {
    const loadDashboard = async () => {
      setIsLoading(true);
      setError(null);

      try {
        const [projectsRes, statsRes] = await Promise.all([
          fetch(`${API_BASE}/projects`),
          fetch(`${API_BASE}/stats`)
        ]);

        if (!projectsRes.ok || !statsRes.ok) {
          throw new Error('Archive API unavailable');
        }

        const [projectsData, statsData] = await Promise.all([
          projectsRes.json(),
          statsRes.json()
        ]);

        setProjects(projectsData);
        setDashboardStats(statsData);
      } catch (err) {
        setError('Could not load the archive API. Start the local server and reload Chrome.');
      } finally {
        setIsLoading(false);
      }
    };

    loadDashboard();
  }, []);

  React.useEffect(() => {
    return () => {
      if (attachmentNoticeTimeoutRef.current) {
        clearTimeout(attachmentNoticeTimeoutRef.current);
      }
    };
  }, []);

  const filteredProjects = React.useMemo(() => {
    const query = searchQuery.toLowerCase();
    return [...projects]
      .filter((project) =>
        project.name.toLowerCase().includes(query) ||
        project.companyName.toLowerCase().includes(query) ||
        (project.description || '').toLowerCase().includes(query)
      )
      .sort((a, b) => compareDatesDesc(a.startDate, b.startDate));
  }, [projects, searchQuery]);

  const selectedTimeline = React.useMemo(
    () => buildTimeline(projectTasks, projectMessages, projectMilestones),
    [projectTasks, projectMessages, projectMilestones]
  );

  const updateEvents = React.useMemo(
    () => selectedTimeline.filter((event) => event.type !== 'message'),
    [selectedTimeline]
  );

  const recentMessages = React.useMemo(
    () => [...projectMessages].sort((a, b) => compareDatesDesc(a.postedOn, b.postedOn)),
    [projectMessages]
  );

  const selectedUpdate = React.useMemo(() => {
    if (!updateEvents.length) return null;
    return updateEvents.find((event) => event.id === selectedUpdateId) || updateEvents[0];
  }, [updateEvents, selectedUpdateId]);

  const selectedMessage = React.useMemo(() => {
    if (!recentMessages.length) return null;
    return recentMessages.find((message) => message.id === selectedMessageId) || recentMessages[0];
  }, [recentMessages, selectedMessageId]);

  const selectedTimelineEvent = React.useMemo(() => {
    if (!selectedTimeline.length) return null;
    const selectedMessageEventId = selectedMessage ? `message-${selectedMessage.id}` : null;
    return selectedTimeline.find((event) => event.id === selectedUpdateId || event.id === selectedMessageEventId) || selectedTimeline[0];
  }, [selectedMessage, selectedTimeline, selectedUpdateId]);

  const latestArchiveUpdates = React.useMemo(() => {
    return projects
      .map((project) => {
        const activity = [
          project.endDate,
          project.startDate
        ].filter(Boolean)[0];

        return {
          id: project.id,
          name: project.name,
          companyName: project.companyName,
          date: activity,
          status: project.status
        };
      })
      .sort((a, b) => compareDatesDesc(a.date, b.date))
      .slice(0, 4);
  }, [projects]);

  const ATTACHMENT_NOTICE_TIMEOUT_MS = 6000;

  const showAttachmentNotice = React.useCallback((message: string) => {
    setAttachmentNotice(message);
    if (attachmentNoticeTimeoutRef.current) {
      clearTimeout(attachmentNoticeTimeoutRef.current);
    }
    if (typeof window !== 'undefined') {
      attachmentNoticeTimeoutRef.current = window.setTimeout(() => {
        setAttachmentNotice(null);
      }, ATTACHMENT_NOTICE_TIMEOUT_MS);
    }
  }, []);

  const handleAttachmentLinkClick = React.useCallback(
    (url: string, label: string) => {
      showAttachmentNotice(
        `Opening “${label}” from uploads.teamwork.com. If Teamwork shows site-not-found, this legacy file is no longer hosted there.`
      );
      if (typeof window !== 'undefined') {
        window.open(url, '_blank', 'noopener,noreferrer');
      }
    },
    [showAttachmentNotice]
  );

  const handleCopyAttachmentLink = React.useCallback(
    async (url: string) => {
      if (typeof navigator === 'undefined' || !navigator.clipboard) {
        showAttachmentNotice('Clipboard unavailable; select and copy the link manually.');
        return;
      }

      try {
        await navigator.clipboard.writeText(url);
        showAttachmentNotice('Link copied to clipboard.');
      } catch {
        showAttachmentNotice('Copy failed; select and copy the link manually.');
      }
    },
    [showAttachmentNotice]
  );

  const handleProjectSelect = async (id: number) => {
    setView('project-detail');
    setAiSummary(null);
    setError(null);
    setIsLoading(true);
    setDetailPanel('timeline');
    setSelectedUpdateId(null);
    setSelectedMessageId(null);
    setExpandedTaskId(null);

    try {
      const [projectRes, tasksRes, messagesRes, milestonesRes] = await Promise.all([
        fetch(`${API_BASE}/projects/${id}`),
        fetch(`${API_BASE}/projects/${id}/tasks`),
        fetch(`${API_BASE}/projects/${id}/messages`),
        fetch(`${API_BASE}/projects/${id}/milestones`)
      ]);

      if (!projectRes.ok || !tasksRes.ok || !messagesRes.ok || !milestonesRes.ok) {
        throw new Error('Project archive fetch failed');
      }

      const [projectData, tasksData, messagesData, milestonesData] = await Promise.all([
        projectRes.json(),
        tasksRes.json(),
        messagesRes.json(),
        milestonesRes.json()
      ]);

      let attachmentsData: Attachment[] = [];
      try {
        const attachmentsRes = await fetch(`${API_BASE}/projects/${id}/files`);
        if (attachmentsRes.ok) {
          attachmentsData = await attachmentsRes.json();
        }
      } catch (innerErr) {
        console.warn('attachments fetch failed', innerErr);
      }

      setSelectedProject(projectData);
      setProjectTasks(tasksData.sort((a: Task, b: Task) => compareDatesDesc(a.completedOn || a.createdOn, b.completedOn || b.createdOn)));
      setProjectMessages(messagesData.sort((a: Message, b: Message) => compareDatesDesc(a.postedOn, b.postedOn)));
      setProjectMilestones(milestonesData.sort((a: Milestone, b: Milestone) => compareDatesDesc(a.deadline, b.deadline)));
      setProjectAttachments(attachmentsData);
    } catch (err) {
      setError('Could not open this project archive. Check the local API and try again.');
    } finally {
      setIsLoading(false);
    }
  };

  const handleSummarize = async () => {
    if (!selectedProject) return;
    setIsSummarizing(true);

    try {
      const summary = await getProjectSummary(selectedProject, projectTasks, projectMessages);
      setAiSummary(summary);
    } finally {
      setIsSummarizing(false);
    }
  };

  const activeYears = dashboardStats?.projectActivity?.length ?? 0;
  const totalUpdates = dashboardStats ? projectTasks.length + projectMessages.length + projectMilestones.length : 0;

  return (
    <div className="min-h-screen archive-shell text-stone-900">
      <header className="sticky top-0 z-50 border-b border-stone-300/80 bg-[rgba(247,242,231,0.88)] backdrop-blur-md">
        <div className="mx-auto flex max-w-7xl flex-col gap-4 px-4 py-4 md:px-8 lg:flex-row lg:items-center lg:justify-between">
          <div className="flex items-center gap-3">
            <div className="flex h-12 w-12 items-center justify-center rounded-2xl border border-stone-400/50 bg-stone-900 text-stone-100 shadow-[0_12px_30px_rgba(41,37,36,0.25)]">
              <ArchiveIcon className="h-5 w-5" />
            </div>
            <div>
              <p className="text-[11px] font-semibold uppercase tracking-[0.32em] text-stone-500">Legacy Records</p>
              <h1 className="font-serif text-2xl font-semibold tracking-tight text-stone-900">Teamwork Archive</h1>
            </div>
          </div>

          <div className="flex flex-1 flex-col gap-3 lg:mx-8 lg:max-w-2xl">
            <div className="relative">
              <SearchIcon className="pointer-events-none absolute left-4 top-1/2 h-4 w-4 -translate-y-1/2 text-stone-400" />
              <input
                type="text"
                placeholder="Search projects, clients, archived notes..."
                className="w-full rounded-full border border-stone-300 bg-white/80 py-3 pl-11 pr-4 text-sm text-stone-700 outline-none transition focus:border-stone-500 focus:bg-white"
                value={searchQuery}
                onChange={(e) => setSearchQuery(e.target.value)}
              />
            </div>
          </div>

          <nav className="flex gap-2 self-start rounded-full border border-stone-300 bg-white/70 p-1">
            <button
              onClick={() => setView('dashboard')}
              className={`flex items-center gap-2 rounded-full px-4 py-2 text-sm transition ${view === 'dashboard' ? 'bg-stone-900 text-stone-50' : 'text-stone-600 hover:bg-stone-200/70'}`}
            >
              <LayoutDashboardIcon className="h-4 w-4" />
              Dashboard
            </button>
            <button
              onClick={() => setView('projects')}
              className={`flex items-center gap-2 rounded-full px-4 py-2 text-sm transition ${view === 'projects' || view === 'project-detail' ? 'bg-stone-900 text-stone-50' : 'text-stone-600 hover:bg-stone-200/70'}`}
            >
              <FolderIcon className="h-4 w-4" />
              Projects
            </button>
          </nav>
        </div>
      </header>

      <main className="mx-auto max-w-7xl px-4 py-6 md:px-8 md:py-8">
        {isLoading ? (
          <div className="flex min-h-[50vh] items-center justify-center">
            <div className="h-14 w-14 animate-spin rounded-full border-2 border-stone-400 border-t-stone-900" />
          </div>
        ) : error ? (
          <div className="rounded-[2rem] border border-rose-200 bg-rose-50 p-8 text-rose-900 shadow-sm">
            <p className="text-sm font-semibold uppercase tracking-[0.22em]">Archive Error</p>
            <h2 className="mt-3 font-serif text-3xl">The viewer could not load its local records.</h2>
            <p className="mt-3 max-w-2xl text-sm leading-7 text-rose-800">{error}</p>
            <p className="mt-6 text-sm text-rose-700">Run `node server.cjs` and `npm run dev`, then open the Vite URL in Chrome.</p>
          </div>
        ) : (
          <>
            {view === 'dashboard' && dashboardStats && (
              <div className="space-y-8">
                <section className="grid gap-6 lg:grid-cols-[1.5fr_0.9fr]">
                  <div className="overflow-hidden rounded-[2rem] border border-stone-300 bg-[radial-gradient(circle_at_top_left,_rgba(180,151,90,0.26),_transparent_35%),linear-gradient(135deg,_#1c1917,_#44403c)] p-8 text-stone-100 shadow-[0_24px_80px_rgba(41,37,36,0.18)] md:p-10">
                    <p className="text-[11px] font-semibold uppercase tracking-[0.32em] text-stone-300">Archive Overview</p>
                    <h2 className="mt-4 max-w-2xl font-serif text-4xl leading-tight md:text-5xl">
                      A chronological reading room for legacy project history.
                    </h2>
                    <p className="mt-5 max-w-2xl text-sm leading-7 text-stone-300 md:text-base">
                      This archive is organized around what happened, when it happened, and what people said at the time. Open a project to review tasks, dated updates, and message threads as one continuous record.
                    </p>

                    <div className="mt-8 grid gap-4 sm:grid-cols-3">
                      <HeroStat label="Archived Projects" value={dashboardStats.totalProjects} />
                      <HeroStat label="Completed Tasks" value={dashboardStats.completedTasks} />
                      <HeroStat label="Recorded Years" value={activeYears} />
                    </div>
                  </div>

                  <div className="rounded-[2rem] border border-stone-300 bg-[#f4ede1] p-6 shadow-sm">
                    <p className="text-[11px] font-semibold uppercase tracking-[0.32em] text-stone-500">Recent Archive Updates</p>
                    <div className="mt-5 space-y-4">
                      {latestArchiveUpdates.map((item) => (
                        <button
                          key={item.id}
                          onClick={() => handleProjectSelect(item.id)}
                          className="flex w-full items-start justify-between rounded-2xl border border-stone-300 bg-white/80 p-4 text-left transition hover:-translate-y-0.5 hover:border-stone-500"
                        >
                          <div>
                            <p className="text-xs uppercase tracking-[0.2em] text-stone-400">{formatShortDate(item.date)}</p>
                            <h3 className="mt-2 font-serif text-xl text-stone-900">{item.name}</h3>
                            <p className="mt-1 text-sm text-stone-600">{item.companyName}</p>
                          </div>
                          <span className={`rounded-full border px-3 py-1 text-[10px] font-semibold uppercase tracking-[0.18em] ${getStatusTone(item.status)}`}>
                            {item.status}
                          </span>
                        </button>
                      ))}
                    </div>
                  </div>
                </section>

                <section className="grid gap-6 lg:grid-cols-[1.2fr_0.8fr]">
                  <div className="rounded-[2rem] border border-stone-300 bg-white/80 p-6 shadow-sm md:p-8">
                    <div className="flex items-center justify-between">
                      <div>
                        <p className="text-[11px] font-semibold uppercase tracking-[0.32em] text-stone-500">Projects by Year</p>
                        <h3 className="mt-2 font-serif text-3xl text-stone-900">Archive volume over time</h3>
                      </div>
                    </div>
                    <div className="mt-8 h-[320px] w-full">
                      <ResponsiveContainer width="100%" height="100%">
                        <BarChart data={dashboardStats.projectActivity}>
                          <CartesianGrid strokeDasharray="3 3" vertical={false} stroke="#e7e0d4" />
                          <XAxis dataKey="name" axisLine={false} tickLine={false} tick={{ fill: '#57534e', fontSize: 12 }} />
                          <YAxis axisLine={false} tickLine={false} tick={{ fill: '#57534e', fontSize: 12 }} />
                          <Tooltip
                            cursor={{ fill: '#f5efe4' }}
                            contentStyle={{
                              borderRadius: '16px',
                              border: '1px solid #d6d3d1',
                              background: '#fffdf8',
                              boxShadow: '0 12px 40px rgba(28,25,23,0.12)'
                            }}
                          />
                          <Bar dataKey="count" fill="#8b6f47" radius={[10, 10, 0, 0]} barSize={46} />
                        </BarChart>
                      </ResponsiveContainer>
                    </div>
                  </div>

                  <div className="rounded-[2rem] border border-stone-300 bg-[#fffdf8] p-6 shadow-sm md:p-8">
                    <p className="text-[11px] font-semibold uppercase tracking-[0.32em] text-stone-500">Reading Notes</p>
                    <div className="mt-5 space-y-4">
                      <InsightCard
                        icon={<CalendarDaysIcon className="h-4 w-4" />}
                        title="Date-first navigation"
                        text="Every screen now highlights event timing first so archived work reads like a historical record, not an active task board."
                      />
                      <InsightCard
                        icon={<MessageSquareIcon className="h-4 w-4" />}
                        title="Messages treated as evidence"
                        text="Discussion posts are surfaced as dated updates with authors and preserved text, making narrative context easier to follow."
                      />
                      <InsightCard
                        icon={<SparklesIcon className="h-4 w-4" />}
                        title="AI summary kept optional"
                        text="The project summary remains available, but the primary design now stands on the archive’s original dates, tasks, and messages."
                      />
                    </div>
                  </div>
                </section>

                <section className="grid gap-6 md:grid-cols-3">
                  <MetricCard label="Visible Projects" value={filteredProjects.length.toString()} note="Filtered by current search" icon={<FolderIcon className="h-5 w-5" />} />
                  <MetricCard label="Task Records" value={dashboardStats.completedTasks.toString()} note="Completed entries in the archive" icon={<CheckCircleIcon className="h-5 w-5" />} />
                  <MetricCard label="Archive Focus" value="Updates" note="Dates, milestones, and message history" icon={<MessageSquareIcon className="h-5 w-5" />} />
                </section>
              </div>
            )}

            {view === 'projects' && (
              <div className="space-y-6">
                <section className="rounded-[2rem] border border-stone-300 bg-white/75 p-6 shadow-sm md:p-8">
                  <p className="text-[11px] font-semibold uppercase tracking-[0.32em] text-stone-500">Project Dossiers</p>
                  <div className="mt-3 flex flex-col gap-2 md:flex-row md:items-end md:justify-between">
                    <div>
                      <h2 className="font-serif text-4xl text-stone-900">Archived project files</h2>
                      <p className="mt-2 text-sm text-stone-600">Open any record to see updates, event dates, milestones, and message history in one view.</p>
                    </div>
                    <p className="text-sm text-stone-500">{filteredProjects.length} result{filteredProjects.length === 1 ? '' : 's'}</p>
                  </div>
                </section>

                <div className="grid gap-5 md:grid-cols-2 xl:grid-cols-3">
                  {filteredProjects.map((project) => (
                    <button
                      key={project.id}
                      onClick={() => handleProjectSelect(project.id)}
                      className="group rounded-[1.8rem] border border-stone-300 bg-[linear-gradient(180deg,_rgba(255,253,248,0.96),_rgba(244,237,225,0.96))] p-6 text-left shadow-sm transition hover:-translate-y-1 hover:border-stone-500 hover:shadow-[0_18px_40px_rgba(41,37,36,0.12)]"
                    >
                      <div className="flex items-start justify-between gap-4">
                        <span className="rounded-full border border-stone-300 bg-stone-100 px-3 py-1 text-[10px] font-semibold uppercase tracking-[0.18em] text-stone-600">
                          {project.categoryName || 'General'}
                        </span>
                        <span className={`rounded-full border px-3 py-1 text-[10px] font-semibold uppercase tracking-[0.18em] ${getStatusTone(project.status)}`}>
                          {project.status}
                        </span>
                      </div>

                      <h3 className="mt-6 font-serif text-2xl leading-tight text-stone-900 transition group-hover:text-[#6b5230]">
                        {project.name}
                      </h3>
                      <p className="mt-3 line-clamp-3 text-sm leading-7 text-stone-600">
                        {project.description || 'No archived description available for this project.'}
                      </p>

                      <div className="mt-6 grid gap-3 rounded-2xl border border-stone-300/80 bg-white/70 p-4 text-sm text-stone-700">
                        <div className="flex items-center gap-3">
                          <Building2Icon className="h-4 w-4 text-stone-400" />
                          <span>{project.companyName}</span>
                        </div>
                        <div className="flex items-center gap-3">
                          <CalendarDaysIcon className="h-4 w-4 text-stone-400" />
                          <span>{formatDisplayDate(project.startDate)}{project.endDate ? ` to ${formatDisplayDate(project.endDate)}` : ''}</span>
                        </div>
                      </div>

                      <div className="mt-6 flex items-center justify-between text-sm text-stone-500">
                        <span>Open record</span>
                        <ChevronRightIcon className="h-4 w-4 transition group-hover:translate-x-1" />
                      </div>
                    </button>
                  ))}
                </div>
              </div>
            )}

            {view === 'project-detail' && selectedProject && (
              <div className="space-y-6">
                <button
                  onClick={() => setView('projects')}
                  className="inline-flex items-center gap-2 rounded-full border border-stone-300 bg-white/75 px-4 py-2 text-sm text-stone-700 transition hover:border-stone-500 hover:bg-white"
                >
                  <ArrowLeftIcon className="h-4 w-4" />
                  Back to Project Files
                </button>

                <section className="overflow-hidden rounded-[2rem] border border-stone-300 bg-[linear-gradient(135deg,_#fffaf0,_#efe4cf)] shadow-sm">
                  <div className="grid gap-8 p-6 md:p-8 lg:grid-cols-[1.25fr_0.75fr]">
                    <div>
                      <p className="text-[11px] font-semibold uppercase tracking-[0.32em] text-stone-500">Project Archive Record</p>
                      <h2 className="mt-4 break-words font-serif text-[clamp(2rem,4vw,3.6rem)] leading-tight text-stone-900">{selectedProject.name}</h2>
                      <p className="mt-4 max-w-3xl text-sm leading-7 text-stone-700 md:text-base">
                        {selectedProject.description || 'This archived project does not include a long-form description.'}
                      </p>

                      <div className="mt-8 grid gap-4 md:grid-cols-3">
                        <DetailStat label="Company" value={selectedProject.companyName} />
                        <DetailStat label="Opened" value={formatDisplayDate(selectedProject.startDate)} />
                        <DetailStat label="Closed" value={selectedProject.endDate ? formatDisplayDate(selectedProject.endDate) : 'Still open in record'} />
                      </div>
                    </div>

                    <div className="rounded-[1.8rem] border border-stone-300 bg-white/70 p-5">
                      <div className="flex items-center justify-between">
                        <p className="text-[11px] font-semibold uppercase tracking-[0.32em] text-stone-500">Archive Snapshot</p>
                        <span className={`rounded-full border px-3 py-1 text-[10px] font-semibold uppercase tracking-[0.18em] ${getStatusTone(selectedProject.status)}`}>
                          {selectedProject.status}
                        </span>
                      </div>
                      <div className="mt-5 space-y-4 text-sm text-stone-700">
                        <div className="flex items-center justify-between gap-4 rounded-2xl border border-stone-300 bg-[#fffdf8] px-4 py-3">
                          <span>Total updates</span>
                          <span className="font-semibold">{totalUpdates}</span>
                        </div>
                        <div className="flex items-center justify-between gap-4 rounded-2xl border border-stone-300 bg-[#fffdf8] px-4 py-3">
                          <span>Task records</span>
                          <span className="font-semibold">{projectTasks.length}</span>
                        </div>
                        <div className="flex items-center justify-between gap-4 rounded-2xl border border-stone-300 bg-[#fffdf8] px-4 py-3">
                          <span>Messages</span>
                          <span className="font-semibold">{projectMessages.length}</span>
                        </div>
                        <div className="flex items-center justify-between gap-4 rounded-2xl border border-stone-300 bg-[#fffdf8] px-4 py-3">
                          <span>Milestones</span>
                          <span className="font-semibold">{projectMilestones.length}</span>
                        </div>
                      </div>

                      <button
                        onClick={handleSummarize}
                        disabled={isSummarizing}
                        className="mt-6 flex w-full items-center justify-center gap-2 rounded-2xl bg-stone-900 px-4 py-3 text-sm font-semibold text-stone-50 transition hover:bg-stone-800 disabled:opacity-60"
                      >
                        <SparklesIcon className={`h-4 w-4 ${isSummarizing ? 'animate-spin' : ''}`} />
                        {isSummarizing ? 'Generating summary' : 'Generate AI Summary'}
                      </button>
                    </div>
                  </div>

                  {aiSummary && (
                    <div className="border-t border-stone-300 bg-[#fffdf8] p-6 md:p-8">
                      <p className="text-[11px] font-semibold uppercase tracking-[0.32em] text-stone-500">AI Historical Context</p>
                      <p className="mt-4 max-w-4xl whitespace-pre-line text-sm leading-8 text-stone-700 md:text-base">{aiSummary}</p>
                    </div>
                  )}
                </section>

                <section className="grid gap-6 2xl:grid-cols-[1.2fr_0.8fr]">
                  <div className="space-y-6">
                    <div className="rounded-[2rem] border border-stone-300 bg-white/80 p-6 shadow-sm md:p-8">
                      <div className="flex flex-col gap-4 md:flex-row md:items-center md:justify-between">
                        <div>
                          <p className="text-[11px] font-semibold uppercase tracking-[0.32em] text-stone-500">Unified Timeline</p>
                          <h3 className="mt-2 font-serif text-2xl text-stone-900 md:text-3xl">Comments and activities in one feed</h3>
                        </div>
                        <div className="flex rounded-full border border-stone-300 bg-stone-100 p-1">
                          <button
                            onClick={() => setDetailPanel('timeline')}
                            className={`rounded-full px-4 py-2 text-sm transition ${detailPanel === 'timeline' ? 'bg-stone-900 text-stone-50' : 'text-stone-600'}`}
                          >
                            Timeline
                          </button>
                          <button
                            onClick={() => setDetailPanel('updates')}
                            className={`rounded-full px-4 py-2 text-sm transition ${detailPanel === 'updates' ? 'bg-stone-900 text-stone-50' : 'text-stone-600'}`}
                          >
                            Updates
                          </button>
                          <button
                            onClick={() => setDetailPanel('messages')}
                            className={`rounded-full px-4 py-2 text-sm transition ${detailPanel === 'messages' ? 'bg-stone-900 text-stone-50' : 'text-stone-600'}`}
                          >
                            Messages
                          </button>
                        </div>
                      </div>

                      {detailPanel === 'timeline' ? (
                        selectedTimeline.length > 0 ? (
                          <div className="mt-8 grid gap-5 xl:grid-cols-[0.9fr_1.1fr]">
                            <div className="space-y-3">
                              {selectedTimeline.map((event) => (
                                <button
                                  key={event.id}
                                  onClick={() => {
                                    if (event.type === 'message') {
                                      setSelectedMessageId(Number(event.id.replace('message-', '')));
                                    } else {
                                      setSelectedUpdateId(event.id);
                                    }
                                  }}
                                  className={`w-full rounded-[1.4rem] border p-4 text-left transition ${
                                    selectedTimelineEvent?.id === event.id
                                      ? 'border-stone-700 bg-stone-900 text-stone-50'
                                      : 'border-stone-300 bg-[#fffdf8] text-stone-800 hover:border-stone-500'
                                  }`}
                                >
                                  <div className="flex items-start justify-between gap-3">
                                    <div className="min-w-0">
                                      <p className={`text-xs uppercase tracking-[0.18em] ${selectedTimelineEvent?.id === event.id ? 'text-stone-300' : 'text-stone-400'}`}>
                                        {formatShortDate(event.date)}
                                      </p>
                                      <h4 className="mt-2 break-words text-sm font-semibold md:text-base">{event.title}</h4>
                                    </div>
                                    <span className={`shrink-0 rounded-full border px-2.5 py-1 text-[10px] font-semibold uppercase tracking-[0.16em] ${
                                      selectedTimelineEvent?.id === event.id
                                        ? 'border-stone-600 bg-stone-800 text-stone-100'
                                        : event.type === 'message'
                                          ? 'border-sky-200 bg-sky-50 text-sky-700'
                                          : 'border-amber-200 bg-amber-50 text-amber-700'
                                    }`}>
                                      {event.type === 'message' ? 'comment' : 'activity'}
                                    </span>
                                  </div>
                                  <p className={`mt-2 line-clamp-2 text-sm ${selectedTimelineEvent?.id === event.id ? 'text-stone-300' : 'text-stone-500'}`}>
                                    {normalizeArchiveText(event.body) || 'No archived details.'}
                                  </p>
                                </button>
                              ))}
                            </div>

                            {selectedTimelineEvent && (
                              <article className={`rounded-[1.6rem] border border-stone-300 bg-[#fffdf8] p-6 shadow-sm ${selectedTimelineEvent.tone}`}>
                                <div className="flex flex-col gap-3 md:flex-row md:items-start md:justify-between">
                                  <div>
                                    <p className="text-xs font-semibold uppercase tracking-[0.18em] text-stone-400">{formatDisplayDate(selectedTimelineEvent.date)}</p>
                                    <h4 className="mt-2 break-words font-serif text-2xl text-stone-900 md:text-3xl">{selectedTimelineEvent.title}</h4>
                                  </div>
                                  <div className="flex gap-2">
                                    <span className={`rounded-full border px-3 py-1 text-[10px] font-semibold uppercase tracking-[0.18em] ${
                                      selectedTimelineEvent.type === 'message'
                                        ? 'border-sky-200 bg-sky-50 text-sky-700'
                                        : 'border-amber-200 bg-amber-50 text-amber-700'
                                    }`}>
                                      {selectedTimelineEvent.type === 'message' ? 'comment' : 'activity'}
                                    </span>
                                    <span className="rounded-full border border-stone-300 bg-stone-100 px-3 py-1 text-[10px] font-semibold uppercase tracking-[0.18em] text-stone-600">
                                      {selectedTimelineEvent.badge}
                                    </span>
                                  </div>
                                </div>
                                <p className="mt-5 break-words whitespace-pre-line text-sm leading-7 text-stone-700 md:text-[15px]">
                                  {normalizeArchiveText(selectedTimelineEvent.body)}
                                </p>
                                <p className="mt-5 text-xs uppercase tracking-[0.16em] text-stone-500">{selectedTimelineEvent.meta}</p>
                              </article>
                            )}
                          </div>
                        ) : (
                          <div className="mt-6 rounded-[1.6rem] border border-dashed border-stone-300 bg-[#fffdf8] p-8 text-sm text-stone-500">
                            No timeline activity was preserved for this project.
                          </div>
                        )
                      ) : detailPanel === 'updates' ? (
                        updateEvents.length > 0 ? (
                          <div className="mt-8 grid gap-5 xl:grid-cols-[0.85fr_1.15fr]">
                            <div className="space-y-3">
                              {updateEvents.map((event) => (
                                <button
                                  key={event.id}
                                  onClick={() => setSelectedUpdateId(event.id)}
                                  className={`w-full rounded-[1.4rem] border p-4 text-left transition ${
                                    selectedUpdate?.id === event.id
                                      ? 'border-stone-700 bg-stone-900 text-stone-50'
                                      : 'border-stone-300 bg-[#fffdf8] text-stone-800 hover:border-stone-500'
                                  }`}
                                >
                                  <p className={`text-xs uppercase tracking-[0.18em] ${selectedUpdate?.id === event.id ? 'text-stone-300' : 'text-stone-400'}`}>
                                    {formatShortDate(event.date)}
                                  </p>
                                  <h4 className="mt-2 break-words text-sm font-semibold md:text-base">{event.title}</h4>
                                  <p className={`mt-2 text-[11px] uppercase tracking-[0.16em] ${selectedUpdate?.id === event.id ? 'text-stone-300' : 'text-stone-500'}`}>
                                    {event.badge}
                                  </p>
                                </button>
                              ))}
                            </div>

                            {selectedUpdate && (
                              <article className={`rounded-[1.6rem] border border-stone-300 bg-[#fffdf8] p-6 shadow-sm ${selectedUpdate.tone}`}>
                                <div className="flex flex-col gap-3 md:flex-row md:items-start md:justify-between">
                                  <div>
                                    <p className="text-xs font-semibold uppercase tracking-[0.18em] text-stone-400">{formatDisplayDate(selectedUpdate.date)}</p>
                                    <h4 className="mt-2 break-words font-serif text-2xl text-stone-900 md:text-3xl">{selectedUpdate.title}</h4>
                                  </div>
                                  <span className="rounded-full border border-stone-300 bg-stone-100 px-3 py-1 text-[10px] font-semibold uppercase tracking-[0.18em] text-stone-600">
                                    {selectedUpdate.badge}
                                  </span>
                                </div>
                                <p className="mt-5 break-words whitespace-pre-line text-sm leading-7 text-stone-700 md:text-[15px]">
                                  {normalizeArchiveText(selectedUpdate.body)}
                                </p>
                                <p className="mt-5 text-xs uppercase tracking-[0.16em] text-stone-500">{selectedUpdate.meta}</p>
                              </article>
                            )}
                          </div>
                        ) : (
                          <div className="mt-6 rounded-[1.6rem] border border-dashed border-stone-300 bg-[#fffdf8] p-8 text-sm text-stone-500">
                            No dated updates were preserved for this project.
                          </div>
                        )
                      ) : recentMessages.length > 0 ? (
                        <div className="mt-8 grid gap-5 xl:grid-cols-[0.85fr_1.15fr]">
                          <div className="space-y-3">
                            {recentMessages.map((message) => (
                              <button
                                key={message.id}
                                onClick={() => setSelectedMessageId(message.id)}
                                className={`w-full rounded-[1.4rem] border p-4 text-left transition ${
                                  selectedMessage?.id === message.id
                                    ? 'border-stone-700 bg-stone-900 text-stone-50'
                                    : 'border-stone-300 bg-[#fffdf8] text-stone-800 hover:border-stone-500'
                                }`}
                              >
                                <p className={`text-xs uppercase tracking-[0.18em] ${selectedMessage?.id === message.id ? 'text-stone-300' : 'text-stone-400'}`}>
                                  {formatShortDate(message.postedOn)}
                                </p>
                                <h4 className="mt-2 break-words text-sm font-semibold md:text-base">{message.title || 'Untitled message'}</h4>
                                <p className={`mt-2 text-[11px] uppercase tracking-[0.16em] ${selectedMessage?.id === message.id ? 'text-stone-300' : 'text-stone-500'}`}>
                                  Author {message.authorId}
                                </p>
                              </button>
                            ))}
                          </div>

                          {selectedMessage && (
                            <article className="rounded-[1.6rem] border border-stone-300 bg-[#fffdf8] p-6 shadow-sm">
                              <p className="text-xs font-semibold uppercase tracking-[0.18em] text-stone-400">{formatDisplayDate(selectedMessage.postedOn)}</p>
                              <h4 className="mt-2 break-words font-serif text-2xl text-stone-900 md:text-3xl">{selectedMessage.title || 'Untitled message'}</h4>
                              <div className="mt-4 flex items-center gap-2 text-xs uppercase tracking-[0.16em] text-stone-500">
                                <UserIcon className="h-3.5 w-3.5" />
                                Archived author ID {selectedMessage.authorId}
                              </div>
                              <p className="mt-5 break-words whitespace-pre-line text-sm leading-7 text-stone-700 md:text-[15px]">
                                {normalizeArchiveText(selectedMessage.body) || 'No message body saved in the archive.'}
                              </p>
                            </article>
                          )}
                        </div>
                      ) : (
                        <div className="mt-6 rounded-[1.6rem] border border-dashed border-stone-300 bg-[#fffdf8] p-8 text-sm text-stone-500">
                          No archived messages were found.
                        </div>
                      )}
                    </div>

                    <div className="rounded-[2rem] border border-stone-300 bg-white/80 p-6 shadow-sm md:p-8">
                      <p className="text-[11px] font-semibold uppercase tracking-[0.32em] text-stone-500">Attachment Records</p>
                      <h3 className="mt-2 font-serif text-2xl text-stone-900 md:text-3xl">Files & assets</h3>

                      {projectAttachments.length > 0 ? (
                        <div className="mt-6 space-y-3">
                          {projectAttachments.map((attachment) => {
                            const label =
                              attachment.projectfileversionDisplayName ||
                              attachment.description ||
                              `File ${attachment.projectfileId}`;
                            const url = getAttachmentUrl(attachment.projectfileversionAmazonS3Path);
                            const isUnavailable = isAttachmentLikelyUnavailable(attachment);
                            const handleCardClick = (event: React.MouseEvent<HTMLAnchorElement>) => {
                              event.preventDefault();
                              if (isUnavailable) {
                                showAttachmentNotice(
                                  `“${label}” is marked moved and local deleted in Teamwork. The hosted file may no longer exist.`
                                );
                                return;
                              }
                              handleAttachmentLinkClick(url, label);
                            };
                            return (
                              <a
                                key={`${attachment.projectFileVersionId}-${attachment.projectfileId}`}
                                href={url}
                                onClick={handleCardClick}
                                target="_blank"
                                rel="noreferrer"
                                className={`flex flex-col gap-2 rounded-[1.5rem] border p-4 transition ${
                                  isUnavailable
                                    ? 'cursor-default border-amber-300 bg-amber-50/30 hover:border-amber-300'
                                    : 'border-stone-300 bg-[#fffdf8] hover:border-stone-500'
                                }`}
                              >
                                <div className="flex items-center justify-between gap-3">
                                  <div className="min-w-0">
                                    <p className="text-xs uppercase tracking-[0.18em] text-stone-400">
                                      {formatShortDate(attachment.projectfileversionUploadDateTime)}
                                    </p>
                                    <h4 className="mt-1 break-words text-sm font-semibold text-stone-900 md:text-base">{label}</h4>
                                  </div>
                                  <div className="flex items-center gap-2">
                                    <span className="text-xs text-stone-500">{attachment.category || 'File'}</span>
                                    {isUnavailable && (
                                      <span className="rounded-full border border-amber-300 bg-amber-100 px-2 py-0.5 text-[10px] font-semibold uppercase tracking-[0.14em] text-amber-800">
                                        Unavailable
                                      </span>
                                    )}
                                  </div>
                                </div>
                                <div className="flex flex-wrap items-center gap-3 text-xs uppercase tracking-[0.16em] text-stone-500">
                                  <span>{attachment.projectfileversionFileType}</span>
                                  <span>{formatBytes(attachment.projectfileversionFileSize)}</span>
                                  <button
                                    type="button"
                                    onClick={(event) => {
                                      event.stopPropagation();
                                      event.preventDefault();
                                      handleCopyAttachmentLink(url);
                                    }}
                                    className="cursor-pointer text-xs font-semibold uppercase tracking-[0.16em] text-stone-500 underline"
                                  >
                                    Copy link
                                  </button>
                                  {isUnavailable && (
                                    <button
                                      type="button"
                                      onClick={(event) => {
                                        event.stopPropagation();
                                        event.preventDefault();
                                        handleAttachmentLinkClick(url, label);
                                      }}
                                      className="cursor-pointer text-xs font-semibold uppercase tracking-[0.16em] text-amber-700 underline"
                                    >
                                      Try open anyway
                                    </button>
                                  )}
                                </div>
                                <p className="break-words truncate text-xs text-stone-500">{url}</p>
                              </a>
                            );
                          })}
                        </div>
                      ) : (
                        <div className="mt-6 rounded-[1.6rem] border border-dashed border-stone-300 bg-[#fffdf8] p-8 text-sm text-stone-500">
                          No attachments were stored with this project.
                        </div>
                      )}
                      <div className="mt-4 text-xs leading-relaxed text-stone-500">
                        <p>
                          Many legacy entries only preserve paths on <span className="font-semibold text-stone-600">uploads.teamwork.com</span>. Records
                          marked <span className="font-semibold text-amber-700">Unavailable</span> are flagged by Teamwork as moved and local deleted, so
                          the hosted file often no longer resolves.
                        </p>
                        {attachmentNotice && (
                          <p className="mt-2 rounded-2xl border border-amber-200 bg-amber-50 px-3 py-2 text-xs text-amber-800">
                            {attachmentNotice}
                          </p>
                        )}
                      </div>
                    </div>

                    <div className="rounded-[2rem] border border-stone-300 bg-white/80 p-6 shadow-sm md:p-8">
                      <div className="flex items-center justify-between gap-4">
                        <div>
                          <p className="text-[11px] font-semibold uppercase tracking-[0.32em] text-stone-500">Task Register</p>
                          <h3 className="mt-2 font-serif text-2xl text-stone-900 md:text-3xl">Recorded work items</h3>
                        </div>
                        <span className="text-sm text-stone-500">{projectTasks.length} task{projectTasks.length === 1 ? '' : 's'}</span>
                      </div>

                      {projectTasks.length > 0 ? (
                        <div className="mt-8 space-y-4">
                          {projectTasks.map((task) => (
                            <div key={task.id} className="rounded-[1.5rem] border border-stone-300 bg-[#fffdf8] p-5">
                              {(() => {
                                const isExpanded = expandedTaskId === task.id;
                                const descriptionPreview =
                                  normalizeArchiveText(task.description) || 'No task description was captured in the archive.';
                                const contentId = `task-detail-${task.id}`;

                                return (
                                  <>
                                    <button
                                      type="button"
                                      onClick={() => setExpandedTaskId((prev) => (prev === task.id ? null : task.id))}
                                      aria-expanded={isExpanded}
                                      aria-controls={contentId}
                                      className="group w-full text-left"
                                    >
                                      <div className="flex flex-col gap-3 md:flex-row md:items-start md:justify-between">
                                        <div className="min-w-0">
                                          <h4 className="break-words text-base font-semibold text-stone-900 md:text-lg">{task.content || 'Untitled task'}</h4>
                                          {!isExpanded && (
                                            <p className="mt-2 line-clamp-2 break-words text-sm leading-6 text-stone-600">{descriptionPreview}</p>
                                          )}
                                        </div>
                                        <div className="flex shrink-0 flex-wrap items-center gap-2">
                                          <span className={`rounded-full border px-3 py-1 text-[10px] font-semibold uppercase tracking-[0.18em] ${getStatusTone(task.status)}`}>
                                            {task.status || 'unknown'}
                                          </span>
                                          <span className={`inline-flex items-center gap-1 rounded-full border border-stone-300 bg-stone-100 px-3 py-1 text-[10px] font-semibold uppercase tracking-[0.18em] ${getPriorityTone(task.priority)}`}>
                                            <ArrowUpIcon className="h-3 w-3" />
                                            {task.priority || 'normal'}
                                          </span>
                                          <span className="inline-flex items-center gap-1 rounded-full border border-stone-300 bg-white px-3 py-1 text-[10px] font-semibold uppercase tracking-[0.18em] text-stone-600">
                                            <ChevronRightIcon className={`h-3.5 w-3.5 transition-transform ${isExpanded ? 'rotate-90' : ''}`} />
                                            {isExpanded ? 'Collapse' : 'Expand'}
                                          </span>
                                        </div>
                                      </div>
                                    </button>

                                    <div
                                      id={contentId}
                                      className={`grid transition-all duration-300 ease-out ${isExpanded ? 'mt-4 grid-rows-[1fr] opacity-100' : 'mt-0 grid-rows-[0fr] opacity-0'}`}
                                    >
                                      <div className="overflow-hidden">
                                        <p className="break-words whitespace-pre-line text-sm leading-7 text-stone-600">
                                          {descriptionPreview}
                                        </p>
                                      </div>
                                    </div>
                                  </>
                                );
                              })()}
                              <div className="mt-4 grid gap-3 text-xs uppercase tracking-[0.16em] text-stone-500 md:grid-cols-2">
                                <div className="rounded-2xl border border-stone-300/80 bg-white px-4 py-3">
                                  Created: {formatDisplayDate(task.createdOn)}
                                </div>
                                <div className="rounded-2xl border border-stone-300/80 bg-white px-4 py-3">
                                  Completed: {task.completedOn ? formatDisplayDate(task.completedOn) : 'Not completed'}
                                </div>
                              </div>
                            </div>
                          ))}
                        </div>
                      ) : (
                        <div className="mt-6 rounded-[1.6rem] border border-dashed border-stone-300 bg-[#fffdf8] p-8 text-sm text-stone-500">
                          No task records were found for this project.
                        </div>
                      )}
                    </div>
                  </div>

                  <div className="space-y-6">
                    <div className="rounded-[2rem] border border-stone-300 bg-white/80 p-6 shadow-sm md:p-8">
                      <p className="text-[11px] font-semibold uppercase tracking-[0.32em] text-stone-500">Message Ledger</p>
                      <h3 className="mt-2 font-serif text-2xl text-stone-900 md:text-3xl">Project messages</h3>

                      {recentMessages.length > 0 ? (
                        <div className="mt-8 space-y-4">
                          {recentMessages.map((message) => (
                            <article key={message.id} className="rounded-[1.5rem] border border-stone-300 bg-[#fffdf8] p-5">
                              <p className="text-xs uppercase tracking-[0.18em] text-stone-400">{formatDisplayDate(message.postedOn)}</p>
                              <h4 className="mt-2 break-words text-sm font-semibold text-stone-900 md:text-base">{message.title || 'Untitled message'}</h4>
                              <p className="mt-3 break-words whitespace-pre-line text-sm leading-7 text-stone-700">
                                {normalizeArchiveText(message.body) || 'No message body saved in the archive.'}
                              </p>
                              <div className="mt-4 flex items-center gap-2 text-xs uppercase tracking-[0.16em] text-stone-500">
                                <UserIcon className="h-3.5 w-3.5" />
                                Archived author ID {message.authorId}
                              </div>
                            </article>
                          ))}
                        </div>
                      ) : (
                        <div className="mt-6 rounded-[1.6rem] border border-dashed border-stone-300 bg-[#fffdf8] p-8 text-sm text-stone-500">
                          No archived messages were found.
                        </div>
                      )}
                    </div>

                    <div className="rounded-[2rem] border border-stone-300 bg-white/80 p-6 shadow-sm md:p-8">
                      <p className="text-[11px] font-semibold uppercase tracking-[0.32em] text-stone-500">Milestones</p>
                      <h3 className="mt-2 font-serif text-2xl text-stone-900 md:text-3xl">Deadline markers</h3>

                      {projectMilestones.length > 0 ? (
                        <div className="mt-8 space-y-4">
                          {projectMilestones.map((milestone) => (
                            <div key={milestone.id} className="rounded-[1.5rem] border border-stone-300 bg-[#fffdf8] p-5">
                              <div className="flex items-start justify-between gap-4">
                                <div className="flex items-start gap-3">
                                  <FlagIcon className={`mt-1 h-4 w-4 ${milestone.status === 'completed' ? 'text-emerald-600' : 'text-stone-400'}`} />
                                  <div>
                                    <h4 className="break-words font-semibold text-stone-900">{milestone.title}</h4>
                                    <p className="mt-2 text-xs uppercase tracking-[0.16em] text-stone-500">Due {formatDisplayDate(milestone.deadline)}</p>
                                  </div>
                                </div>
                                <span className={`rounded-full border px-3 py-1 text-[10px] font-semibold uppercase tracking-[0.18em] ${getStatusTone(milestone.status)}`}>
                                  {milestone.status}
                                </span>
                              </div>
                            </div>
                          ))}
                        </div>
                      ) : (
                        <div className="mt-6 rounded-[1.6rem] border border-dashed border-stone-300 bg-[#fffdf8] p-8 text-sm text-stone-500">
                          No milestone records were found.
                        </div>
                      )}
                    </div>

                    <div className="rounded-[2rem] border border-stone-300 bg-[linear-gradient(135deg,_#1c1917,_#44403c)] p-6 text-stone-100 shadow-sm md:p-8">
                      <p className="text-[11px] font-semibold uppercase tracking-[0.32em] text-stone-300">Project Notes</p>
                      <p className="mt-4 text-sm leading-7 text-stone-300">
                        The archive view now prioritizes preservation over productivity. Dates are surfaced first, message bodies are readable, and each project feels like a historical file instead of a live workspace.
                      </p>
                    </div>
                  </div>
                </section>
              </div>
            )}
          </>
        )}
      </main>

      <footer className="border-t border-stone-300 bg-[rgba(247,242,231,0.92)] px-4 py-4 text-center text-xs uppercase tracking-[0.22em] text-stone-500 md:px-8">
        Teamwork Legacy Archive • Optimized for local Chrome viewing
      </footer>
    </div>
  );
};

const HeroStat: React.FC<{ label: string; value: number }> = ({ label, value }) => (
  <div className="rounded-[1.4rem] border border-stone-600/70 bg-white/10 p-4 backdrop-blur-sm">
    <p className="text-[10px] font-semibold uppercase tracking-[0.22em] text-stone-300">{label}</p>
    <p className="mt-2 font-serif text-3xl text-white">{value}</p>
  </div>
);

const InsightCard: React.FC<{ icon: React.ReactNode; title: string; text: string }> = ({ icon, title, text }) => (
  <div className="rounded-[1.5rem] border border-stone-300 bg-white p-4">
    <div className="flex h-9 w-9 items-center justify-center rounded-full bg-stone-100 text-stone-700">{icon}</div>
    <h4 className="mt-4 font-semibold text-stone-900">{title}</h4>
    <p className="mt-2 text-sm leading-7 text-stone-600">{text}</p>
  </div>
);

const MetricCard: React.FC<{ label: string; value: string; note: string; icon: React.ReactNode }> = ({ label, value, note, icon }) => (
  <div className="rounded-[1.8rem] border border-stone-300 bg-white/80 p-6 shadow-sm">
    <div className="flex items-center justify-between">
      <p className="text-[11px] font-semibold uppercase tracking-[0.22em] text-stone-500">{label}</p>
      <div className="text-stone-500">{icon}</div>
    </div>
    <p className="mt-4 font-serif text-4xl text-stone-900">{value}</p>
    <p className="mt-2 text-sm text-stone-600">{note}</p>
  </div>
);

const DetailStat: React.FC<{ label: string; value: string }> = ({ label, value }) => (
  <div className="rounded-[1.4rem] border border-stone-300 bg-white/75 p-4">
    <p className="text-[10px] font-semibold uppercase tracking-[0.18em] text-stone-500">{label}</p>
    <p className="mt-2 text-sm font-semibold text-stone-900">{value}</p>
  </div>
);

export default App;
