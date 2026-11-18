"use client";

import { AnimatePresence, motion } from "framer-motion";
import {
  Activity, ArrowDownRight, ArrowRight, ArrowUpRight, Bell, BookOpen, CalendarDays, Check,
  CheckCircle2, ChevronDown, ChevronLeft, ChevronRight, CircleHelp, Clock3, Download,
  FileText, Filter, Flame, GraduationCap, LayoutDashboard, LogOut, Menu, MessageCircle,
  MoreHorizontal, Pencil, Plus, Search, Send, Settings2, Sparkles, Target, Trash2, TrendingUp,
  Users, X, Zap,
} from "lucide-react";
import { usePathname, useRouter } from "next/navigation";
import { useCallback, useEffect, useMemo, useRef, useState } from "react";
import type { Dispatch, SetStateAction } from "react";
import { signOut } from "next-auth/react";
import {
  Area, AreaChart, CartesianGrid, Line, LineChart, Pie, PieChart, ResponsiveContainer,
  Tooltip, XAxis, YAxis, Cell,
} from "recharts";
import {
  activities, assignments as seedAssignments, batches, studentSubjects, students, type Role,
} from "@/frontend/lib/mock-data";

type Props = { role: string; section: string };
type StudySession = { id: string; title: string; subject: string; startTime: string; endTime: string; completed: boolean };
type ChatMessage = { id: string; role: "user" | "assistant"; text: string };
type StudentDashboardData = {
  metrics: { overallProgress: number; assignmentCompletion: number; attendance: number; studyHours: number; learningDays: number; quizAverage: number };
  courses: Array<{ id: string; name: string; title: string; teacher: string; batchId: string; progress: number; score: number; next: string; time: string | null; endDate: string }>;
  subjectPerformance: Array<{ subject: string; score: number; attempts: number }>;
  performanceTrend: Array<Record<string, string | number | null>>;
  studyBySubject: Array<{ subject: string; hours: number }>;
  studySessions: Array<{ id: string; title: string; subject: string; startTime: string; endTime: string; completed: boolean }>;
  assignments: Array<{ id: string; title: string; subject: string; dueDate: string; status: string; marks: number | null; feedback: string | null }>;
  quizResults: Array<{ id: string; title: string; subject: string; score: number; completedAt: string }>;
  notifications: Array<{ id: string; title: string; message: string; isRead: boolean; createdAt: string }>;
};
type TrainerDashboardData = {
  metrics: { learners: number; activeBatches: number; attendance: number; submissionRate: number; pendingReviews: number; averageAssessment: number };
  batches: Array<{ id: string; name: string; subject: string; learners: number; attendance: number; score: number; startDate: string; endDate: string }>;
  performanceTrend: Array<Record<string, string | number | null>>;
  learnerDistribution: { highPerformers: number; needsSupport: number; onTrack: number; total: number };
  learners: Array<{ studentId: string; name: string; batch: string; progress: number }>;
  recentSubmissions: Array<{ id: string; status: string; submittedAt: string; student: string; title: string; batch: string; subject: string }>;
};
type TrainerAssignmentData = {
  assignments: Array<{
    id: string;
    title: string;
    dueDate: string;
    totalMarks: number;
    batch: { id: string; name: string; course: { subject: string } };
    submissions: Array<{
      id: string;
      status: string;
      submittedAt: string;
      submissionContent: string;
      marks: number | null;
      feedback: string | null;
      student: { id: string; fullName: string; email: string };
    }>;
  }>;
};
type TrainerBatchesData = { batches: Array<{ id: string; name: string; course: { id: string; subject: string; title: string } }> };
type TrainerLessonsData = {
  lessons: Array<{ id: string; title: string; description: string; content: string; courseId: string; order: number; duration: number; course: { id: string; subject: string; title: string } }>;
};
type LessonDraft = { title: string; subject: string; topic: string; level: string; objectives: string; outline: string };
function readLessonDraft(lesson: TrainerLessonsData["lessons"][number]): LessonDraft {
  let content: { objectives?: string; outline?: string; level?: string } = {};
  try {
    const parsed: unknown = JSON.parse(lesson.content);
    if (parsed && typeof parsed === "object") {
      const value = parsed as Record<string, unknown>;
      content = {
        objectives: typeof value.objectives === "string" ? value.objectives : undefined,
        outline: typeof value.outline === "string" ? value.outline : undefined,
        level: typeof value.level === "string" ? value.level : undefined,
      };
    }
  } catch {
    content = { outline: lesson.content };
  }
  return {
    title: lesson.title,
    subject: lesson.course.subject,
    topic: lesson.description,
    level: content.level ?? "Intermediate",
    objectives: content.objectives ?? "",
    outline: content.outline ?? "",
  };
}
function readLessonMaterials(content: string): string[] {
  try {
    const parsed: unknown = JSON.parse(content);
    if (parsed && typeof parsed === "object" && Array.isArray((parsed as Record<string, unknown>).materials)) {
      return ((parsed as { materials: unknown[] }).materials).filter((item): item is string => typeof item === "string");
    }
  } catch {
    return [];
  }
  return [];
}
type TrainerStudentsData = {
  students: Array<{
    id: string;
    fullName: string;
    email: string;
    batch: string;
    course: { subject: string };
    attendance: number;
    progress: number;
    submissions: Array<{ status: string; marks: number | null }>;
  }>;
};
type StudentAssignmentsData = {
  assignments: Array<{
    id: string;
    title: string;
    description: string;
    instructions: string;
    dueDate: string;
    totalMarks: number;
    batch: { name: string; course: { subject: string } };
    submission: { id: string; submissionContent: string; status: string; marks: number | null; feedback: string | null; submittedAt: string } | null;
  }>;
};
type DashboardSubject = { id: string; name: string; teacher: string; progress: number; score: number; next: string; time: string; color: "mint" | "peach" | "yellow" | "coral" };

const studentNav = [
  { label: "Dashboard", section: "dashboard", icon: LayoutDashboard },
  { label: "Subjects", section: "subjects", icon: BookOpen },
  { label: "AI Insights", section: "assistant", icon: Sparkles },
  { label: "Study Planner", section: "planner", icon: CalendarDays },
  { label: "Reports", section: "reports", icon: Activity },
];
const trainerNav = [
  { label: "Dashboard", section: "dashboard", icon: LayoutDashboard },
  { label: "Batches", section: "batches", icon: Users },
  { label: "Students", section: "students", icon: GraduationCap },
  { label: "Assignments", section: "assignments", icon: FileText },
  { label: "Lesson Planner", section: "lessons", icon: CalendarDays },
  { label: "Reports", section: "reports", icon: Activity },
];
const colors = ["#e3c84f", "#e27668", "#6cbd58", "#e5a56d"];
const assistantPrompts = [
  "How do I solve a quadratic equation?",
  "Explain Newton's second law",
  "Help me plan my study week",
];

function cx(...values: (string | false | undefined)[]) { return values.filter(Boolean).join(" "); }
function initials(name: string) { return name.split(" ").map((part) => part[0]).slice(0, 2).join(""); }
function stored<T>(key: string, fallback: T): T {
  try { const value = localStorage.getItem(key); return value ? JSON.parse(value) as T : fallback; } catch { return fallback; }
}

function usePersistedState<T>(key: string, initial: T) {
  const [value, setValue] = useState(initial);
  const [ready, setReady] = useState(false);
  useEffect(() => { setValue(stored(key, initial)); setReady(true); }, [key]);
  useEffect(() => { if (ready) localStorage.setItem(key, JSON.stringify(value)); }, [key, ready, value]);
  return [value, setValue] as const;
}

function useApiResource<T>(path: string) {
  const [data, setData] = useState<T | null>(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState("");
  const [attempt, setAttempt] = useState(0);
  const refresh = useCallback(() => setAttempt((value) => value + 1), []);

  useEffect(() => {
    const controller = new AbortController();
    async function load() {
      setLoading(true);
      setError("");
      try {
        const response = await fetch(path, { cache: "no-store", signal: controller.signal });
        const result = await response.json();
        if (!response.ok) throw new Error(result.error?.message ?? "Could not load this information.");
        setData(result as T);
      } catch (reason) {
        if (!controller.signal.aborted) {
          setError(reason instanceof Error ? reason.message : "Could not load this information.");
        }
      } finally {
        if (!controller.signal.aborted) setLoading(false);
      }
    }
    void load();
    return () => controller.abort();
  }, [path, attempt]);

  return { data, loading, error, refresh };
}

function ApiState({ loading, error, onRetry }: { loading: boolean; error: string; onRetry: () => void }) {
  return <Card className="py-12 text-center">
    <p className="text-sm text-[#7c877e]">{loading ? "Loading your latest data…" : error}</p>
    {!loading && <Button className="mt-4" onClick={onRetry}>Try again</Button>}
  </Card>;
}

function Button({ children, onClick, className = "", variant = "soft", ...props }: React.ButtonHTMLAttributes<HTMLButtonElement> & { variant?: "soft" | "primary" }) {
  return <button className={cx(variant === "primary" ? "primary-button" : "soft-button", className)} onClick={onClick} {...props}>{children}</button>;
}

function Card({ children, className = "", ...props }: React.HTMLAttributes<HTMLDivElement>) {
  return <section className={cx("card p-5 sm:p-6", className)} {...props}>{children}</section>;
}

function Heading({ title, subtitle, action }: { title: string; subtitle?: string; action?: React.ReactNode }) {
  return <div className="mb-5 flex items-end justify-between gap-3"><div><h2 className="text-[17px] font-semibold tracking-[-.02em] text-[#24352a]">{title}</h2>{subtitle && <p className="mt-1 text-[13px] text-[#89928b]">{subtitle}</p>}</div>{action}</div>;
}

function ProgressRing({ value, size = 114, stroke = 9, color = "#76a37b" }: { value: number; size?: number; stroke?: number; color?: string }) {
  const radius = (size - stroke) / 2;
  const circumference = 2 * Math.PI * radius;
  return <div className="relative shrink-0" style={{ width: size, height: size }}><svg width={size} height={size} className="-rotate-90"><circle cx={size / 2} cy={size / 2} r={radius} fill="none" stroke="#edf0eb" strokeWidth={stroke}/><motion.circle initial={{strokeDashoffset:circumference}} animate={{strokeDashoffset:circumference*(1-value/100)}} transition={{duration:1,delay:.2,ease:"easeOut"}} cx={size / 2} cy={size / 2} r={radius} fill="none" stroke={color} strokeWidth={stroke} strokeLinecap="round" strokeDasharray={circumference}/></svg><div className="absolute inset-0 grid place-items-center"><div className="text-center"><div className="text-[23px] font-semibold tracking-tight">{value}%</div><div className="text-[10px] text-[#929a94]">complete</div></div></div></div>;
}

function Metric({ label, value, note, icon: Icon, tone = "mint" }: { label: string; value: string; note?: string; icon: typeof Clock3; tone?: string }) {
  const tones: Record<string, string> = { mint:"bg-[#eaf2e6] text-[#5b815b]", peach:"bg-[#fff0e5] text-[#bf805b]", yellow:"bg-[#fbf2d8] text-[#ab8c36]", coral:"bg-[#fbeae5] text-[#c67866]", blue:"bg-[#e9eff7] text-[#637da3]" };
  return <motion.div whileHover={{y:-3}} className="card p-5"><div className="flex items-start justify-between"><span className="text-[12px] font-medium text-[#89918b]">{label}</span><span className={cx("grid h-9 w-9 place-items-center rounded-xl",tones[tone]||tones.mint)}><Icon size={17}/></span></div><div className="mt-5 text-[30px] font-semibold tracking-[-.045em]">{value}</div>{note&&<div className="mt-1 flex items-center gap-1 text-[11px] text-[#7b9580]"><TrendingUp size={13}/>{note}</div>}</motion.div>;
}

function Selector({ items, value, onChange }: { items: string[]; value: string; onChange: (value: string) => void }) {
  return <div className="flex rounded-xl bg-[#f4f6f2] p-1">{items.map((item)=><button key={item} onClick={()=>onChange(item)} className={cx("pill",value===item&&"active")}>{item}</button>)}</div>;
}

function AppModal({ title, children, onClose, footer }: { title: string; children: React.ReactNode; onClose: () => void; footer?: React.ReactNode }) {
  return <AnimatePresence><motion.div className="fixed inset-0 z-[70] flex items-center justify-center bg-[#16241c]/35 p-4 backdrop-blur-[3px]" initial={{opacity:0}} animate={{opacity:1}} exit={{opacity:0}} onMouseDown={(e)=>e.target===e.currentTarget&&onClose()}><motion.div initial={{opacity:0,y:14,scale:.98}} animate={{opacity:1,y:0,scale:1}} exit={{opacity:0,y:8,scale:.98}} className="w-full max-w-[540px] rounded-[24px] bg-[#fff] p-6 shadow-2xl"><div className="mb-5 flex items-center justify-between"><h3 className="text-lg font-semibold">{title}</h3><button onClick={onClose} aria-label="Close dialog" className="rounded-full p-2 text-[#89918b] hover:bg-[#f1f3ef]"><X size={18}/></button></div><div>{children}</div>{footer&&<div className="mt-6 flex justify-end gap-2">{footer}</div>}</motion.div></motion.div></AnimatePresence>;
}

function TopNavigation({ role, section, user, onSwitchAccount, onLogout }: { role: Role; section: string; user: string; onSwitchAccount: () => void; onLogout: () => void }) {
  const router = useRouter();
  const nav = role === "student" ? studentNav : trainerNav;
  const [panel, setPanel] = useState<"profile"|"notifications"|"search"|null>(null);
  const [query, setQuery] = useState("");
  const [mobileOpen, setMobileOpen] = useState(false);
  const [notificationError,setNotificationError]=useState("");
  const {data:notificationData,refresh:refreshNotifications}=useApiResource<{notifications:Array<{id:string;title:string;message:string;isRead:boolean;createdAt:string}>}>("/api/me/notifications");
  const unreadCount=notificationData?.notifications.filter(item=>!item.isRead).length??0;
  const searchItems = role === "student"
    ? [...studentSubjects.map((s)=>s.name),...activities.map((item)=>item.title)]
    : [...batches.map((b)=>b.name),...students.map((s)=>s.name),...seedAssignments.map((a)=>a.title)];
  const results = searchItems.filter((label)=>label.toLowerCase().includes(query.toLowerCase())).slice(0,5);
  function navigate(target: string) { router.push(`/${role}/${target}`); setMobileOpen(false); setPanel(null); }
  function openSearchResult(label: string) {
    const subject = studentSubjects.find((item) => item.name === label);
    if (subject) localStorage.setItem("myaiguru-selected-subject", subject.id);
    const target = subject ? "subjects"
      : activities.some((item) => item.title === label) ? "planner"
      : batches.some((batch) => batch.name === label) ? "batches"
      : students.some((student) => student.name === label) ? "students"
      : "assignments";
    navigate(target);
    setQuery("");
  }
  async function markNotificationRead(id:string){
    setNotificationError("");
    try{
      const response=await fetch(`/api/me/notifications/${id}`,{method:"PATCH"});
      const result=await response.json();
      if(!response.ok)throw new Error(result.error?.message??"Could not update this notification.");
      refreshNotifications();
    }catch(error){setNotificationError(error instanceof Error?error.message:"Could not update this notification.");}
  }
  return <header className="sticky top-0 z-40 bg-[#f7f7f5]/90 backdrop-blur-xl">
    <div className="mx-auto max-w-[1480px] px-4 py-2.5 sm:px-7 lg:px-10">
      <div className="flex h-[54px] items-center justify-between gap-3">
      <button onClick={()=>navigate("dashboard")} className="group flex shrink-0 items-center gap-2.5 rounded-xl pr-1 text-[#253c2c] focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-[#9dbb91]"><span className="grid h-9 w-9 place-items-center rounded-[13px] bg-gradient-to-br from-[#eef5e5] to-[#dfead6] text-[#426844] shadow-[inset_0_0_0_1px_rgba(74,108,66,.08)] transition-transform group-hover:rotate-[-5deg]"><Sparkles size={17}/></span><span className="text-[13px] font-extrabold tracking-[.14em]">MYAIGURU</span><span className="mx-1 hidden h-7 w-px bg-[#eceee9] xl:block"/><span className="hidden text-[9px] font-semibold uppercase tracking-[.13em] text-[#92998f] xl:block">Learning space</span></button>
      <nav aria-label="Primary navigation" className="scrollbar-hide hidden max-w-[min(68vw,820px)] flex-nowrap items-center justify-center gap-1 overflow-x-auto md:flex">{nav.map(({label,section:target})=><button key={target} aria-current={section===target?"page":undefined} onClick={()=>navigate(target)} className={cx("shrink-0 whitespace-nowrap rounded-full px-3.5 py-2.5 text-[11px] font-medium transition-all duration-200 sm:px-4",section===target?"bg-[#151715] text-white shadow-sm":"text-[#666d68] hover:bg-white/80 hover:text-[#26352b]")}>{label}</button>)}</nav>
      <div className="flex items-center gap-1.5">
        <button title="Search" aria-label="Search" onClick={()=>setPanel(panel==="search"?null:"search")} className="grid h-9 w-9 place-items-center rounded-full text-[#737c74] transition hover:bg-[#f2f5ef] hover:text-[#31553b] focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-[#a5bd9b]"><Search size={17}/></button>
        <div className="relative">        <button title="Notifications" aria-label={`Notifications${unreadCount?`, ${unreadCount} unread`:""}`} onClick={()=>setPanel(panel==="notifications"?null:"notifications")} className={cx("relative grid h-9 w-9 place-items-center rounded-full text-[#737c74] transition hover:bg-[#f2f5ef] hover:text-[#31553b] focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-[#a5bd9b]",panel==="notifications"&&"bg-[#f2f5ef] text-[#31553b]")}><Bell size={17}/>{unreadCount>0&&<span className="absolute right-[8px] top-[7px] h-[7px] w-[7px] rounded-full bg-[#e78e71] ring-2 ring-white"/>}</button>
          <AnimatePresence>{panel==="notifications"&&<motion.div initial={{opacity:0,y:8}} animate={{opacity:1,y:0}} exit={{opacity:0,y:8}} className="absolute right-[-55px] top-12 w-[min(340px,calc(100vw-24px))] rounded-2xl border border-[#e8ece6] bg-white p-3 shadow-xl sm:right-0"><div className="flex items-center justify-between px-2 py-2"><p className="text-sm font-semibold">Notifications</p><span className="text-[11px] text-[#8b948d]">{unreadCount} unread</span></div>{notificationError&&<p role="alert" className="px-3 py-2 text-xs text-[#b97564]">{notificationError}</p>}{notificationData?.notifications.length?notificationData.notifications.map(item=><button key={item.id} onClick={()=>{if(!item.isRead)void markNotificationRead(item.id);}} className={cx("flex w-full gap-3 rounded-xl p-3 text-left hover:bg-[#f8f9f6]",!item.isRead&&"bg-[#f8faf6]")}><span className="mt-1 h-8 w-8 shrink-0 rounded-full bg-[#eaf2e6]"/><span><span className="block text-xs font-semibold">{item.title}</span><span className="mt-1 block text-[11px] text-[#838d85]">{item.message}</span><span className="mt-1.5 block text-[10px] text-[#a0a8a1]">{new Date(item.createdAt).toLocaleString()}</span></span></button>):<p className="px-3 py-6 text-center text-xs text-[#8b948d]">{notificationData?"No notifications yet.":"Loading notifications…"}</p>}</motion.div>}</AnimatePresence>
        </div>
        <div className="relative ml-1"><button aria-label={`Profile menu for ${user}`} onClick={()=>setPanel(panel==="profile"?null:"profile")} className={cx("grid h-9 w-9 place-items-center rounded-full transition hover:bg-white/80 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-[#a5bd9b]",panel==="profile"&&"bg-white/80")}><span className="relative grid h-8 w-8 place-items-center rounded-full bg-gradient-to-br from-[#edf2e4] to-[#dce8d3] text-[10px] font-bold text-[#4c7049] ring-1 ring-white">{initials(user)}<span className="absolute bottom-0 right-0 h-2 w-2 rounded-full border-2 border-white bg-[#86ad78]"/></span></button>
          <AnimatePresence>          {panel==="profile"&&<motion.div initial={{opacity:0,y:8}} animate={{opacity:1,y:0}} exit={{opacity:0,y:8}} className="absolute right-0 top-12 w-56 rounded-2xl border border-[#e8ece6] bg-white p-2 shadow-xl"><div className="border-b border-[#edf0eb] px-3 py-3"><p className="text-sm font-semibold">{user}</p><p className="mt-1 text-[11px] capitalize text-[#8b948d]">{role} account</p></div><button onClick={onSwitchAccount} className="flex w-full items-center gap-2 rounded-xl px-3 py-2.5 text-left text-xs text-[#59665d] hover:bg-[#f5f7f3]"><Users size={15}/>Switch account</button><button onClick={onLogout} className="flex w-full items-center gap-2 rounded-xl px-3 py-2.5 text-left text-xs text-[#ab6d5f] hover:bg-[#fff5f1]"><LogOut size={15}/>Sign out</button></motion.div>}</AnimatePresence>
        </div>
        <button aria-label="Open menu" onClick={()=>setMobileOpen(!mobileOpen)} className="grid h-9 w-9 place-items-center rounded-full text-[#68746b] hover:bg-[#f2f5ef] md:hidden">{mobileOpen?<X size={18}/>:<Menu size={18}/>}</button>
      </div>
      </div>
    </div>
    <AnimatePresence>{mobileOpen&&<motion.nav initial={{height:0,opacity:0}} animate={{height:"auto",opacity:1}} exit={{height:0,opacity:0}} className="overflow-hidden border-t border-[#e9ece6] bg-white px-4 md:hidden"><div className="grid grid-cols-2 gap-2 py-3">{nav.map(({label,section:target,icon:Icon})=><button key={target} onClick={()=>navigate(target)} className={cx("flex items-center gap-2 rounded-xl px-3 py-3 text-left text-sm",section===target?"bg-[#244b35] text-white":"bg-[#f7f8f4] text-[#68746b]")}><Icon size={16}/>{label}</button>)}</div></motion.nav>}</AnimatePresence>
    <AnimatePresence>{panel==="search"&&<motion.div initial={{opacity:0,y:-8}} animate={{opacity:1,y:0}} exit={{opacity:0,y:-8}} className="absolute left-0 right-0 top-full border-b border-[#e7ebe4] bg-white/95 p-4 shadow-lg"><div className="mx-auto max-w-2xl"><div className="flex items-center gap-3 rounded-xl border border-[#e7ebe4] px-4"><Search size={17} className="text-[#89938b]"/><input autoFocus value={query} onChange={(e)=>setQuery(e.target.value)} placeholder="Search subjects, students, assignments..." className="h-12 flex-1 bg-transparent text-sm outline-none"/><button onClick={()=>setPanel(null)} aria-label="Close search"><X size={17} className="text-[#89938b]"/></button></div>{query&&<div className="mt-2 rounded-xl bg-white p-2">{results.length?results.map((result)=><button key={result} className="block w-full rounded-lg px-3 py-2.5 text-left text-sm text-[#526056] hover:bg-[#f5f7f3]" onClick={()=>openSearchResult(result)}>{result}</button>):<p className="p-3 text-sm text-[#909a92]">No matches found.</p>}</div>}</div></motion.div>}</AnimatePresence>
  </header>;
}

function LearningGoalCard({user,progress,remainingDays,toast}:{user:string;progress:number;remainingDays:number;toast:(message:string)=>void}) {
  return <Card style={{background:"linear-gradient(135deg,#edf7e8 0%,#f1f7e8 55%,#f8f7e8 100%)"}} className="relative min-h-[352px] overflow-hidden border-0 p-6 sm:p-7">
    <div className="absolute -left-20 -top-20 h-56 w-56 rounded-full bg-white/60 blur-3xl"/>
    <div className="relative">
      <p className="text-center text-[11px] font-medium text-[#899187]">YOUR LEARNING JOURNEY</p>
      <h1 className="mt-2 text-center text-[25px] font-semibold tracking-[-.045em] sm:text-[28px]">Hello, {user.split(" ")[0]}</h1>
      <p className="mt-1 text-center text-[13px] text-[#747b72]">Your enrolled courses, at a glance</p>
      <div className="mt-4 flex justify-center"><span className="rounded-full bg-white/70 px-4 py-2 text-[11px] font-medium text-[#74816f]">Overall course progress</span></div>
      <div className="relative mt-5 h-[120px] overflow-hidden">
        <div className="absolute inset-x-0 bottom-2 h-[78px] rounded-[50%_50%_8px_8px/70%_75%_8px_8px] bg-gradient-to-r from-[#f5b5a2] via-[#f4d978] to-[#a5d781] opacity-90"/>
        <svg className="absolute inset-0 h-full w-full" viewBox="0 0 480 125" preserveAspectRatio="none" aria-label="Progress trend moving upward">
          <path d="M0 104 C70 99 100 87 160 83 C220 78 244 73 300 58 C360 43 400 28 480 16" fill="none" stroke="#fff" strokeWidth="2" strokeDasharray="2 3" opacity=".8"/>
          <path d="M0 106 C70 99 100 87 160 83 C220 78 244 73 300 58 C360 43 400 28 480 16 L480 120 L0 120Z" fill="url(#goalFill)" opacity=".55"/>
          <defs><linearGradient id="goalFill" x1="0" x2="1"><stop stopColor="#f29e91"/><stop offset=".52" stopColor="#efda72"/><stop offset="1" stopColor="#91cc6b"/></linearGradient></defs>
          <line x1="300" y1="55" x2="300" y2="116" stroke="#dc7867" strokeWidth="2"/><circle cx="300" cy="55" r="3" fill="#dc7867"/>
        </svg>
        <div className="absolute inset-x-0 bottom-0 flex justify-between text-[10px] text-[#6f766d]"><span>0</span><span>3.0</span><span>4.0</span><span>5.0</span></div>
      </div>
      <div className="mt-5 grid grid-cols-3 gap-2 text-center">
        {[[`${progress}%`,"Progress"],["100%","Course goal"],[`${remainingDays} days`,"Remaining"]].map(([value,label])=><div key={label}><p className="text-[22px] font-semibold tracking-[-.04em] sm:text-[24px]">{value}</p><p className="mt-1 text-[10px] text-[#81877e]">{label}</p></div>)}
      </div>
      <Button className="mt-4 w-full !border-white/80 !bg-white/65 !text-[#59624f] hover:!bg-white" onClick={()=>toast("Your learning goal is on track.")}><Target size={14}/> Keep your goal in sight</Button>
    </div>
  </Card>;
}

function WelcomeCard({role, user, progress, learnerCount, toast}: {role:Role;user:string;progress:number;learnerCount:number;toast:(message:string)=>void}) {
  return <Card className="relative min-h-[258px] overflow-hidden border-0 bg-gradient-to-br from-[#eef5e5] via-[#f2f4e8] to-[#f8eadd] p-6 sm:p-8">
    <div className="absolute -right-10 -top-20 h-56 w-56 rounded-full bg-[#fff]/40 blur-3xl"/><div className="relative grid h-full gap-6 md:grid-cols-[1fr_auto]">
      <div><p className="flex items-center gap-2 text-xs font-semibold text-[#6b8769]"><span className="h-2 w-2 rounded-full bg-[#79a978]"/> YOUR {role==="student"?"LEARNING":"TEACHING"} JOURNEY</p><h1 className="mt-4 text-[27px] font-semibold tracking-[-.04em] sm:text-[32px]">Good morning, {user.split(" ")[0]} <span className="text-[#86a56b]">✦</span></h1><p className="mt-2 max-w-[440px] text-[13px] leading-6 text-[#788579]">{role==="student"?"Every small step adds up. You're building a wonderful learning rhythm.":"A thoughtful look at your learners, progress, and what needs your attention today."}</p>
        <div className="mt-6 flex flex-wrap items-center gap-4"><Button variant="primary" onClick={()=>toast("Your teaching overview is up to date")}>View your progress <ArrowRight size={14}/></Button><div className="flex items-center gap-2 text-xs text-[#788579]"><Users size={15} className="text-[#d7915d]"/> {learnerCount} assigned learners</div></div>
      </div>
      <div className="relative flex items-center gap-5 md:pr-3"><div className="mt-6"><p className="text-[11px] font-medium text-[#7f8b7e]">Average assessment</p><div className="mt-2 text-[39px] font-semibold tracking-[-.06em]">{progress}<span className="text-[22px] text-[#74916b]">%</span></div><p className="mt-1 text-[11px] text-[#8b958c]">Across active batches</p><div className="mt-3 h-1.5 w-36 overflow-hidden rounded-full bg-white/70"><motion.div initial={{width:0}} animate={{width:`${progress}%`}} transition={{duration:.7}} className="h-full rounded-full bg-[#80a77a]"/></div></div><ProgressRing value={progress} size={104} stroke={8} color="#7ea478"/></div>
    </div>
  </Card>;
}

function InsightCard({role, onDetails, description, metric, loading=false}: {role:Role;onDetails:()=>void;description?:string;metric?:string;loading?:boolean}) {
  return <motion.div whileHover={{y:-3}} className="relative min-h-[170px] overflow-hidden rounded-[20px] border border-white/60 bg-gradient-to-r from-[#f18b83] via-[#edbd70] to-[#a6dc55] p-5 text-white">
    <div className="absolute -right-10 -top-12 h-36 w-36 rounded-full bg-white/30 blur-3xl"/><div className="relative flex h-full flex-col">
        <div className="flex items-center gap-2 text-[10px] font-semibold uppercase tracking-[.1em] text-white/90"><span className="grid h-7 w-7 place-items-center rounded-full bg-white/25"><Sparkles size={14}/></span>{role==="student"?"AI suggestions":"Trainer insights"}</div>
        <div className="mt-3 flex flex-1 items-end justify-between gap-1"><div className="min-w-0"><h3 className="text-[15px] font-semibold tracking-tight">Your next best step</h3><p className="mt-1 max-w-[190px] text-[10px] leading-4 text-white/90">{description??"Generate a personalized insight from your learning activity."}</p><button disabled={loading} onClick={onDetails} className="mt-3 flex shrink-0 items-center gap-1 whitespace-nowrap rounded-full bg-white/90 px-2.5 py-1.5 text-[9px] font-semibold text-[#60634f] hover:bg-white disabled:cursor-wait disabled:opacity-70">{loading?"Thinking…":metric?"Refresh insight":"Generate insight"} <ArrowRight size={11}/></button></div><div className="shrink-0 pb-2 text-right"><Sparkles size={22} className="ml-auto"/><p className="mt-1 text-[11px] font-semibold leading-none">{metric??"AI"}</p><p className="mt-1 text-[8px] text-white/85">personalized</p></div></div>
    </div>
  </motion.div>;
}

function SubjectCard({subject, onView}: {subject:DashboardSubject;onView:()=>void}) {
  const tone:Record<string,string>={mint:"bg-[#eaf2e6]",peach:"bg-[#fff0e5]",yellow:"bg-[#fbf2d8]",coral:"bg-[#fbeae5]"};
  return <motion.div whileHover={{y:-3}} className="card p-5"><div className="flex items-start justify-between"><div className={cx("grid h-10 w-10 place-items-center rounded-xl text-[#5d805a]",tone[subject.color])}><BookOpen size={18}/></div><button onClick={onView} className="rounded-lg p-1 text-[#a2aaa3] hover:bg-[#f3f5f1]" aria-label="Open subject"><MoreHorizontal size={18}/></button></div><h3 className="mt-4 text-[15px] font-semibold">{subject.name}</h3><p className="mt-1 text-xs text-[#8e9790]">with {subject.teacher}</p><div className="mt-5 flex items-center justify-between text-[11px] text-[#89918a]"><span>Course progress</span><span className="font-semibold text-[#526b54]">{subject.progress}%</span></div><div className="mt-2 h-1.5 overflow-hidden rounded-full bg-[#eef1ec]"><div className="h-full rounded-full bg-[#85a982]" style={{width:`${subject.progress}%`}}/></div><div className="mt-4 border-t border-[#eff1ed] pt-3"><p className="text-[10px] uppercase tracking-[.08em] text-[#a0a8a1]">Next lesson</p><p className="mt-1 text-xs font-medium text-[#566359]">{subject.next}</p><p className="mt-1 text-[10px] text-[#9aa19b]">{subject.time}</p></div><button onClick={onView} className="mt-4 flex w-full items-center justify-center gap-1 rounded-xl bg-[#f4f7f1] py-2.5 text-xs font-semibold text-[#49694b] hover:bg-[#eaf1e4]">View subject <ArrowRight size={13}/></button></motion.div>;
}

function PerformanceChart({role, data, seriesKeys, className=""}: {role:Role;data?:Array<Record<string,string|number|null>>;seriesKeys?:string[];className?:string}) {
  const [range,setRange]=useState("Monthly");
  const sourceData=data??[];
  const keys=seriesKeys??[];
  const chartData=sourceData.slice(range==="Weekly"?-3:0);
  return <Card className={className}><div className="mb-4 flex flex-wrap items-center justify-between gap-3"><div><h2 className="text-[16px] font-semibold">{role==="student"?"Subject performance breakdown":"Batch performance"}</h2><p className="mt-1 text-xs text-[#8b948d]">{role==="student"?"Your progress across subjects":"How your batches are progressing"}</p></div><Selector items={["Weekly","Monthly"]} value={range} onChange={setRange}/></div>
    <div className="mb-3 flex flex-wrap gap-x-4 gap-y-2">{keys.map((key,i)=><span key={key} className="flex items-center gap-1.5 text-[11px] text-[#79837b]"><span className="h-2 w-2 rounded-full" style={{background:colors[i]}}/>{key}</span>)}</div>
    <div className="h-[208px] w-full"><ResponsiveContainer width="100%" height="100%"><LineChart data={chartData} margin={{top:8,right:8,left:-20,bottom:0}}><CartesianGrid stroke="#f0f0ec" strokeDasharray="2 5" vertical={false}/><XAxis dataKey="name" axisLine={false} tickLine={false} tick={{fontSize:10,fill:"#9aa29b"}}/><YAxis domain={[0,100]} axisLine={false} tickLine={false} tick={{fontSize:10,fill:"#9aa29b"}}/><Tooltip contentStyle={{border:"1px solid #e8ece6",borderRadius:12,fontSize:12,boxShadow:"0 8px 22px #24372d12"}}/><defs>{keys.map((key,i)=><linearGradient key={key} id={`chart-${role}-${i}`} x1="0" y1="0" x2="0" y2="1"><stop offset="0%" stopColor={colors[i%colors.length]} stopOpacity={.15}/><stop offset="100%" stopColor={colors[i%colors.length]} stopOpacity={0}/></linearGradient>)}</defs>{keys.map((key,i)=><Line key={key} type="monotone" dataKey={key} stroke={colors[i%colors.length]} strokeWidth={2} dot={false} activeDot={{r:5,strokeWidth:0}} animationDuration={800}/>)}</LineChart></ResponsiveContainer></div>
  </Card>;
}

function StudyHistory({studyBySubject,studyHours,learningDays}:{studyBySubject:StudentDashboardData["studyBySubject"];studyHours:number;learningDays:number}) {
  const total=studyBySubject.reduce((sum,item)=>sum+item.hours,0);
  const colors=["#91cf6b","#efb57e","#f2d76c","#e58b79"];
  const data=studyBySubject.slice(0,4).map((item,index)=>({name:item.subject,value:total?Math.round(item.hours/total*100):0,color:colors[index]}));
  return <Card className="!p-4 sm:!p-5"><div className="mb-2 flex items-center justify-between"><div className="flex items-center gap-2"><span className="grid h-7 w-7 place-items-center rounded-full bg-[#a9e85e] text-[#4d7737]"><BookOpen size={14}/></span><h2 className="text-[13px] font-semibold">Study history</h2></div></div><div className="flex items-center gap-2"><div className="relative h-[102px] w-[102px] shrink-0"><ResponsiveContainer width="100%" height="100%"><PieChart><Pie data={data} dataKey="value" innerRadius={34} outerRadius={47} paddingAngle={3} stroke="none">{data.map((item,index)=><Cell key={index} fill={item.color}/>)}</Pie></PieChart></ResponsiveContainer><div className="absolute inset-0 grid place-items-center text-center"><div><p className="text-[15px] font-semibold">{studyHours}h</p><p className="text-[8px] text-[#8c948d]">this month</p></div></div></div><div className="min-w-0 flex-1"><p className="text-[10px] leading-4 text-[#89918a]">Study sessions across {learningDays} days this month.</p><div className="mt-3 space-y-2">{data.slice(0,2).map((item)=><div key={item.name}><div className="mb-1 flex justify-between text-[9px]"><span className="text-[#7e877f]">{item.name}</span><b>{item.value}%</b></div><div className="h-1.5 rounded-full bg-[#f0f1ed]"><div className="h-full rounded-full" style={{width:`${item.value}%`,background:item.color}}/></div></div>)}</div></div></div></Card>;
}

function SubjectReadingCard({studyBySubject}:{studyBySubject:StudentDashboardData["studyBySubject"]}) {
  const total=studyBySubject.reduce((sum,item)=>sum+item.hours,0);
  const colors=["#f19d8b","#f0cf69","#a6d86e"];
  const breakdown=studyBySubject.slice(0,3).map((item,index)=>({label:item.subject,hours:item.hours,value:total?Math.round(item.hours/total*100):0,color:colors[index]}));
  return <Card className="!p-5"><div><h2 className="text-[13px] font-semibold">Subject study history</h2><p className="mt-1 text-[10px] text-[#929991]">How your study time is distributed</p></div>{breakdown.length?<><div className="mt-5 grid grid-cols-3 gap-3">{breakdown.map(item=><div key={item.label}><p className="text-xl font-semibold tracking-tight">{item.value}%</p><p className="mt-1 truncate text-[9px] text-[#929991]">{item.label}</p><div className="mt-3 h-2 rounded-full bg-[#f0f1ed]"><div className="h-full rounded-full" style={{width:`${item.value}%`,background:item.color}}/></div></div>)}</div><div className="mt-5 flex h-2 overflow-hidden rounded-full bg-[#f0f1ed]">{breakdown.map(item=><span key={item.label} style={{width:`${item.value}%`,background:item.color}}/>)}</div></>:<p className="mt-5 text-xs text-[#929b94]">Complete a study session to see your subject breakdown.</p>}</Card>;
}

type DashboardActivity = {id:string;title:string;subject:string;type:string;time:string;done:boolean;sessionId?:string};
function ActivityList({items,onToggle,filter,setFilter}: {items:DashboardActivity[];onToggle:(item:DashboardActivity)=>void;filter:string;setFilter:(filter:string)=>void}) {
  const visible=items.filter((x)=>filter==="All"||(filter==="Upcoming"?!x.done:x.done));
  return <Card><div className="mb-4 flex flex-wrap items-center justify-between gap-3"><Heading title="Upcoming activities" subtitle="A gentle nudge for what’s next"/><Selector items={["All","Upcoming","Completed"]} value={filter} onChange={setFilter}/></div>
    <div className="divide-y divide-[#eff1ed]">{visible.map((item)=><div key={item.id} className="flex items-center gap-3 py-3.5"><button onClick={()=>onToggle(item)} aria-label={item.sessionId?(item.done?"Mark incomplete":"Mark complete"):"Open assignment"} className={cx("grid h-8 w-8 shrink-0 place-items-center rounded-xl",item.done?"bg-[#e9f2e5] text-[#5c815e]":"bg-[#f5f6f2] text-[#89948c] hover:bg-[#e9f1e4]")}>{item.sessionId?<Check size={15}/>:<FileText size={14}/>}</button><div className="min-w-0 flex-1"><p className={cx("truncate text-[13px] font-medium",item.done&&"text-[#939b94] line-through")}>{item.title}</p><p className="mt-1 text-[10px] text-[#9aa29b]">{item.subject} · {item.type}</p></div><span className="hidden text-right text-[10px] text-[#8c958e] sm:block">{item.time}</span></div>)}</div>
  </Card>;
}

function StudentDashboard({toast, user, onViewSubject, onViewAssignments}: {toast:(s:string)=>void;user:string;onViewSubject:(id:string)=>void;onViewAssignments:()=>void}) {
  const {data,error,loading,refresh}=useApiResource<StudentDashboardData>("/api/student/dashboard");
  const [filter,setFilter]=useState("All");
  const [aiInsight,setAiInsight]=useState("");
  const [insightLoading,setInsightLoading]=useState(false);
  if(loading||error||!data)return <ApiState loading={loading} error={error||"Dashboard data is not available."} onRetry={refresh}/>;
  async function generateInsight() {
    if(insightLoading)return;
    setInsightLoading(true);
    try {
      const response=await fetch("/api/student/ai-insights",{method:"POST",headers:{"Content-Type":"application/json"},body:JSON.stringify({task:"insight"})});
      const result=await response.json();
      if(!response.ok)throw new Error(result.error?.message??"Could not generate an AI insight.");
      setAiInsight(result.answer);
    } catch(reason) {
      toast(reason instanceof Error?reason.message:"Could not generate an AI insight.");
    } finally {
      setInsightLoading(false);
    }
  }
  const subjects:DashboardSubject[]=data.courses.map((course,index)=>({id:course.id,name:course.name,teacher:course.teacher,progress:course.progress,score:course.score,next:course.next,time:course.endDate?`Ends ${new Date(course.endDate).toLocaleDateString()}`:"",color:(["mint","peach","yellow","coral"] as const)[index%4]}));
  const remainingDays=Math.max(0,...data.courses.map(course=>Math.ceil((new Date(course.endDate).getTime()-Date.now())/86400000)));
  const activities:DashboardActivity[]=[
    ...data.studySessions.map(session=>({id:`session-${session.id}`,sessionId:session.id,title:session.title,subject:session.subject,type:"Study session",time:new Date(session.startTime).toLocaleString(),done:session.completed})),
    ...data.assignments.map(assignment=>({id:`assignment-${assignment.id}`,title:assignment.title,subject:assignment.subject,type:"Assignment",time:`Due ${new Date(assignment.dueDate).toLocaleDateString()}`,done:assignment.status!=="NOT_SUBMITTED"})),
  ].sort((a,b)=>a.done===b.done?a.time.localeCompare(b.time):a.done?1:-1);
  const toggle=async(item:DashboardActivity)=>{
    if(!item.sessionId){onViewAssignments();return;}
    try{const response=await fetch(`/api/student/sessions/${item.sessionId}`,{method:"PATCH",headers:{"Content-Type":"application/json"},body:JSON.stringify({completed:!item.done})});const result=await response.json();if(!response.ok)throw new Error(result.error?.message??"Could not update this study session.");toast("Study session updated.");refresh();}catch(reason){toast(reason instanceof Error?reason.message:"Could not update this study session.");}
  };
  return <div className="space-y-5"><div className="grid items-start gap-4 md:grid-cols-[.91fr_1.09fr]"><div className="space-y-4"><LearningGoalCard user={user} progress={data.metrics.overallProgress} remainingDays={remainingDays} toast={toast}/><SubjectReadingCard studyBySubject={data.studyBySubject}/></div><div className="space-y-4"><div className="grid gap-4 sm:grid-cols-2"><StudyHistory studyBySubject={data.studyBySubject} studyHours={data.metrics.studyHours} learningDays={data.metrics.learningDays}/><InsightCard role="student" onDetails={generateInsight} description={aiInsight||undefined} metric={aiInsight?"Ready":undefined} loading={insightLoading}/></div><PerformanceChart role="student" data={data.performanceTrend} seriesKeys={data.courses.map(course=>course.name)}/><div className="grid grid-cols-3 gap-3"><Metric label="Assignment completion" value={`${data.metrics.assignmentCompletion}%`} note="Reviewed work" icon={Target} tone="coral"/><Metric label="Attendance" value={`${data.metrics.attendance}%`} note="Present or on time" icon={Clock3}/><Metric label="Quiz average" value={`${data.metrics.quizAverage}%`} note="Completed assessments" icon={Zap} tone="yellow"/></div></div></div>
    <div><Heading title="My subjects" subtitle="Keep your momentum going"/><div className="grid gap-4 sm:grid-cols-2 xl:grid-cols-4">{subjects.length?subjects.map((subject)=><SubjectCard key={subject.id} subject={subject} onView={()=>onViewSubject(subject.id)}/>):<Card className="py-8 text-center text-sm text-[#8c958e]">You are not enrolled in a course yet.</Card>}</div></div>
    <ActivityList items={activities} onToggle={toggle} filter={filter} setFilter={setFilter}/>
  </div>;
}

function TrainerDashboard({toast, user, onViewBatch, onViewAssignments}: {toast:(s:string)=>void;user:string;onViewBatch:(id?:string)=>void;onViewAssignments:()=>void}) {
  const {data,error,loading,refresh}=useApiResource<TrainerDashboardData>("/api/trainer/dashboard");
  if(loading||error||!data)return <ApiState loading={loading} error={error||"Dashboard data is not available."} onRetry={refresh}/>;
  const distribution=data.learnerDistribution;
  const progressPercent=distribution.total?Math.round(distribution.onTrack/distribution.total*100):0;
  return <div className="space-y-5"><WelcomeCard role="trainer" user={user} progress={data.metrics.averageAssessment} learnerCount={data.metrics.learners} toast={toast}/>
    <div className="grid gap-4 sm:grid-cols-2 xl:grid-cols-4"><Metric label="Total learners" value={String(data.metrics.learners)} note={`Across ${data.metrics.activeBatches} active batches`} icon={Users}/><Metric label="Average attendance" value={`${data.metrics.attendance}%`} note="Present or on time" icon={CalendarDays} tone="peach"/><Metric label="Submission rate" value={`${data.metrics.submissionRate}%`} note="Reviewed submissions" icon={FileText} tone="yellow"/><Metric label="Reviews to complete" value={String(data.metrics.pendingReviews)} note="Submitted work awaiting review" icon={Clock3} tone="coral"/></div>
    <div className="grid gap-5 lg:grid-cols-[1.4fr_.8fr]"><PerformanceChart role="trainer" data={data.performanceTrend} seriesKeys={data.batches.map(batch=>batch.name)}/><Card><Heading title="Learner snapshot" subtitle="A quick read across your classes"/><div className="grid grid-cols-2 gap-3">{[["High performers",String(distribution.highPerformers),"bg-[#eaf2e6]"],["Need support",String(distribution.needsSupport),"bg-[#fff0e5]"],["Avg. assessment",`${data.metrics.averageAssessment}%`,"bg-[#fbf2d8]"],["On track",`${progressPercent}%`,"bg-[#eaf0f6]"]].map(([label,value,bg])=><div key={label} className={cx("rounded-2xl p-4",bg)}><p className="text-[11px] text-[#77827a]">{label}</p><p className="mt-2 text-2xl font-semibold">{value}</p></div>)}</div><div className="mt-5"><p className="mb-3 text-xs font-medium text-[#647068]">Progress distribution</p><div className="flex h-2.5 overflow-hidden rounded-full bg-[#f0f2ed]"><div className="bg-[#80a981]" style={{width:`${progressPercent}%`}}/><div className="bg-[#e5bf70]" style={{width:`${distribution.total?Math.round(distribution.needsSupport/distribution.total*100):0}%`}}/></div><div className="mt-2 flex justify-between text-[10px] text-[#929b94]"><span>On track · {progressPercent}%</span><span>Needs support · {distribution.total?Math.round(distribution.needsSupport/distribution.total*100):0}%</span></div></div></Card></div>
    <div className="grid gap-5 lg:grid-cols-[.8fr_1.2fr]"><InsightCard role="trainer" metric={String(distribution.needsSupport)} description={`${distribution.needsSupport} learners are below 60% progress and may benefit from additional support.`} onDetails={()=>onViewBatch()}/><Card><Heading title="Assignment reviews" subtitle="Recently submitted work" action={<Button onClick={onViewAssignments}>View all <ArrowRight size={13}/></Button>}/><div className="divide-y divide-[#eff1ed]">{data.recentSubmissions.length?data.recentSubmissions.slice(0,3).map((submission,index)=><div key={submission.id} className="flex items-center gap-3 py-3"><span className={cx("grid h-9 w-9 place-items-center rounded-xl",["bg-[#eaf2e6] text-[#61835f]","bg-[#fff0e5] text-[#b77d5f]","bg-[#fbf2d8] text-[#9b833e]"][index%3])}><FileText size={16}/></span><div className="min-w-0 flex-1"><p className="truncate text-xs font-semibold">{submission.title}</p><p className="mt-1 text-[10px] text-[#949d96]">{submission.student} · {submission.batch}</p></div><Button onClick={onViewAssignments}>Review</Button></div>):<p className="py-6 text-center text-xs text-[#929b94]">No submissions yet.</p>}</div></Card></div>
    <div><Heading title="Your batches" subtitle="A little overview of your learning communities"/><div className="grid gap-4 sm:grid-cols-2 xl:grid-cols-4">{data.batches.map((batch,index)=><motion.div key={batch.id} whileHover={{y:-3}} className="card p-5"><div className="flex items-start justify-between"><span className={cx("grid h-10 w-10 place-items-center rounded-xl",["bg-[#eaf2e6] text-[#61835f]","bg-[#fff0e5] text-[#b77d5f]","bg-[#fbf2d8] text-[#9b833e]","bg-[#fbeae5] text-[#b97565]"][index%4])}><Users size={17}/></span><span className="rounded-full bg-[#f4f6f2] px-2.5 py-1 text-[10px] text-[#7d887f]">{batch.learners} learners</span></div><h3 className="mt-4 text-sm font-semibold">{batch.name}</h3><p className="mt-1 text-[10px] text-[#909a92]">{batch.subject}</p><div className="mt-4 grid grid-cols-2 gap-3"><div><p className="text-[10px] text-[#9aa29b]">Attendance</p><p className="mt-1 text-lg font-semibold">{batch.attendance}%</p></div><div><p className="text-[10px] text-[#9aa29b]">Avg. score</p><p className="mt-1 text-lg font-semibold">{batch.score}%</p></div></div><p className="mt-4 border-t border-[#eff1ed] pt-3 text-[10px] text-[#8f9891]">Course end · {new Date(batch.endDate).toLocaleDateString()}</p><Button className="mt-3 w-full" onClick={()=>onViewBatch(batch.id)}>View batch <ArrowRight size={13}/></Button></motion.div>)}</div></div>
  </div>;
}

function SubjectsPage({toast}: {toast:(s:string)=>void}) {
  const {data,error,loading,refresh}=useApiResource<{courses:Array<{id:string;title:string;subject:string;lessons:Array<{id:string;title:string;duration:number;order:number}>;trainer:{fullName:string};progress:{completedLessons:number;totalLessons:number;progressPercentage:number}|null}>}>("/api/student/courses");
  const dashboard=useApiResource<StudentDashboardData>("/api/student/dashboard");
  const [selectedId,setSelectedId]=useState("");
  useEffect(()=>{const id=localStorage.getItem("myaiguru-selected-subject");if(id)setSelectedId(id);},[]);
  if(loading||error||!data)return <ApiState loading={loading} error={error||"Course data is not available."} onRetry={refresh}/>;
  const selected=data.courses.find(course=>course.id===selectedId)??data.courses[0];
  const courseProgress=selected?.progress?.progressPercentage??0;
  const completedLessons=selected?.progress?.completedLessons??0;
  const subjectScore=dashboard.data?.subjectPerformance.find(item=>item.subject===selected?.subject)?.score??0;
  const nextLesson=selected?.lessons.find(lesson=>lesson.order>completedLessons);
  return <div className="space-y-5"><div className="flex flex-wrap items-end justify-between gap-3"><div><p className="text-xs font-semibold uppercase tracking-[.12em] text-[#789073]">Your learning library</p><h1 className="mt-2 text-3xl font-semibold tracking-[-.04em]">My subjects</h1><p className="mt-2 text-sm text-[#87918a]">A clear view of what you’re learning and what’s next.</p></div><Button variant="primary" onClick={()=>toast("Your enrolled subjects are shown below.")}><BookOpen size={15}/> Enrolled subjects</Button></div>
    {!selected?<Card className="py-12 text-center text-sm text-[#909a92]">You are not enrolled in a course yet.</Card>:<><div className="grid gap-5 lg:grid-cols-[.85fr_1.15fr]"><div className="grid content-start gap-3 sm:grid-cols-2 lg:grid-cols-1">{data.courses.map(course=><button key={course.id} onClick={()=>{setSelectedId(course.id);localStorage.setItem("myaiguru-selected-subject",course.id);}} className={cx("card flex items-center gap-4 p-4 text-left transition-all",selected.id===course.id&&"border-[#a9c2a5] ring-2 ring-[#e3eee0]")}><span className="grid h-11 w-11 place-items-center rounded-xl bg-[#eaf2e6] text-[#60815c]"><BookOpen size={18}/></span><span className="min-w-0 flex-1"><span className="block text-sm font-semibold">{course.subject}</span><span className="mt-1 block text-xs text-[#929b94]">{course.trainer.fullName} · {course.progress?.progressPercentage??0}% complete</span></span><ChevronRight size={16} className="text-[#9ba49c]"/></button>)}</div>
      <Card><div className="flex items-start justify-between"><div><p className="text-xs text-[#8e9890]">SUBJECT OVERVIEW</p><h2 className="mt-2 text-2xl font-semibold">{selected.subject}</h2><p className="mt-1 text-sm text-[#929b94]">Instructor {selected.trainer.fullName}</p></div><ProgressRing value={courseProgress} size={82} stroke={7}/></div><div className="mt-6 grid grid-cols-2 gap-3"><div className="rounded-xl bg-[#f6f8f4] p-4"><p className="text-[11px] text-[#8d978f]">Assessment score</p><p className="mt-1 text-xl font-semibold">{subjectScore}%</p></div><div className="rounded-xl bg-[#f6f8f4] p-4"><p className="text-[11px] text-[#8d978f]">Next lesson</p><p className="mt-1 text-sm font-semibold">{nextLesson?.title??"All lessons completed"}</p></div></div><div className="mt-6"><Heading title="Lessons" subtitle="Your learning path, one step at a time"/><div className="divide-y divide-[#eff1ed]">{selected.lessons.map(lesson=>{const done=lesson.order<=completedLessons;const current=!done&&lesson===nextLesson;const status=done?"Completed":current?"In progress":"Upcoming";return <div key={lesson.id} className="flex items-center gap-3 py-3"><span className={cx("grid h-8 w-8 place-items-center rounded-full text-xs",done?"bg-[#eaf2e6] text-[#668864]":"bg-[#f3f5f1] text-[#9aa39b]")}>{done?<Check size={14}/>:String(lesson.order).padStart(2,"0")}</span><p className="flex-1 text-sm font-medium">{lesson.title}</p><span className={cx("rounded-full px-2.5 py-1 text-[10px]",done?"bg-[#edf4e9] text-[#63805f]":"bg-[#f5f5f1] text-[#919a92]")}>{status}</span></div>;})}</div></div></Card>
    </div><PerformanceChart role="student" data={dashboard.data?.performanceTrend} seriesKeys={data.courses.map(course=>course.subject)}/></>}
  </div>;
}

function AssistantPage({toast,history,setHistory}: {toast:(s:string)=>void;history:ChatMessage[][];setHistory:Dispatch<SetStateAction<ChatMessage[][]>>}) {
  const [active,setActive]=useState(0);
  const [input,setInput]=useState("");
  const [loading,setLoading]=useState(false);
  const current=history[active]||[];
  const endRef=useRef<HTMLDivElement>(null);
  useEffect(()=>{endRef.current?.scrollIntoView({behavior:"smooth"});},[current.length,loading]);
  async function send(text=input) {
    const prompt=text.trim();
    if(!prompt||loading)return;
    const conversationIndex=active;
    const user:ChatMessage={id:Date.now()+"",role:"user",text:prompt};
    const messages=[...(history[conversationIndex]||[]),user];
    setHistory((previous)=>{const copy=[...previous];copy[conversationIndex]=messages;return copy;});
    setInput("");
    setLoading(true);
    try {
      const response=await fetch("/api/student/ai-insights",{method:"POST",headers:{"Content-Type":"application/json"},body:JSON.stringify({task:"chat",messages:messages.slice(-12).map(({role,text})=>({role,content:text}))})});
      const result=await response.json();
      if(!response.ok)throw new Error(result.error?.message??"Could not get an AI response.");
      const answer:ChatMessage={id:`${Date.now()}-reply`,role:"assistant",text:result.answer};
      setHistory((previous)=>{const copy=[...previous];copy[conversationIndex]=[...(copy[conversationIndex]||[]),answer];return copy;});
    } catch(reason) {
      toast(reason instanceof Error?reason.message:"Could not get an AI response.");
    } finally {
      setLoading(false);
    }
  }
  return <div className="grid min-h-[calc(100vh-160px)] gap-5 lg:grid-cols-[250px_1fr]"><Card className="h-fit"><div className="flex items-center justify-between"><h2 className="text-sm font-semibold">Conversations</h2><button aria-label="New conversation" onClick={()=>{setHistory([[],...history]);setActive(0);}} className="grid h-8 w-8 place-items-center rounded-lg bg-[#edf3e9] text-[#587955]"><Plus size={16}/></button></div><div className="mt-4 space-y-1">{history.map((chat,i)=><button key={i} onClick={()=>setActive(i)} className={cx("w-full truncate rounded-xl px-3 py-3 text-left text-xs",active===i?"bg-[#f1f5ed] font-semibold text-[#44634a]":"text-[#758078] hover:bg-[#f8f9f6]")}>{chat.find(m=>m.role==="user")?.text||`New conversation ${history.length-i}`}</button>)}</div><div className="mt-5 rounded-xl bg-[#f7f8f4] p-3 text-[11px] leading-5 text-[#89938b]"><CircleHelp size={15} className="mb-2 text-[#7b9673]"/>Ask for a clear explanation, a worked example, or a study plan.</div></Card>
    <Card className="flex min-h-[590px] flex-col !p-0"><div className="flex items-center gap-3 border-b border-[#eff1ed] px-5 py-4"><span className="grid h-9 w-9 place-items-center rounded-xl bg-[#eaf2e6] text-[#5a8057]"><Sparkles size={17}/></span><div><p className="text-sm font-semibold">Learning assistant</p><p className="text-[10px] text-[#97a098]">Personalized learning support</p></div><span className="ml-auto rounded-full bg-[#f2f5ef] px-2.5 py-1 text-[10px] text-[#7d8c79]">AI-powered</span></div>
      <div className="flex-1 space-y-4 overflow-y-auto p-5">{!current.length&&<div className="flex min-h-[330px] flex-col items-center justify-center text-center"><span className="grid h-14 w-14 place-items-center rounded-2xl bg-gradient-to-br from-[#e7f1dc] to-[#f8e6d9] text-[#5f805c]"><Sparkles size={23}/></span><h2 className="mt-4 text-lg font-semibold">What are you curious about?</h2><p className="mt-2 max-w-sm text-xs leading-5 text-[#8c968e]">Get unstuck, understand a tricky idea, or make a plan that feels doable.</p><div className="mt-5 flex max-w-xl flex-wrap justify-center gap-2">{assistantPrompts.map(q=><button key={q} onClick={()=>void send(q)} className="rounded-full border border-[#e9ede6] bg-white px-3 py-2 text-[11px] text-[#657267] hover:bg-[#f4f7f1]">{q}</button>)}</div></div>}
        {current.map(m=><div key={m.id} className={cx("flex",m.role==="user"?"justify-end":"justify-start")}><div className={cx("max-w-[82%] rounded-2xl px-4 py-3 text-sm leading-6",m.role==="user"?"rounded-br-md bg-[#315c40] text-white":"rounded-bl-md bg-[#f3f6f0] text-[#48564b]")}>{m.text}</div></div>)}
        {loading&&<div className="flex gap-1 rounded-2xl bg-[#f3f6f0] px-4 py-4"><i className="h-2 w-2 animate-bounce rounded-full bg-[#87a481]"/><i className="h-2 w-2 animate-bounce rounded-full bg-[#87a481] [animation-delay:120ms]"/><i className="h-2 w-2 animate-bounce rounded-full bg-[#87a481] [animation-delay:240ms]"/></div>}<div ref={endRef}/></div>
      <div className="border-t border-[#eff1ed] p-4"><div className="flex items-center gap-2 rounded-2xl border border-[#e6ebe3] bg-white p-2"><input value={input} onChange={(e)=>setInput(e.target.value)} onKeyDown={(e)=>{if(e.key==="Enter")void send();}} placeholder="Ask a question to get started..." className="min-w-0 flex-1 bg-transparent px-2 text-sm outline-none"/><Button variant="primary" onClick={()=>void send()} className="!h-10 !w-10 !p-0" aria-label="Send message"><Send size={16}/></Button></div><p className="mt-2 text-center text-[10px] text-[#a2aaa3]">AI replies use your learning summary and are not a substitute for your instructor.</p></div>
    </Card></div>;
}

function PlannerPage({toast}: {toast:(s:string)=>void}) {
  const {data,error,loading,refresh}=useApiResource<{sessions:StudySession[]}>("/api/student/sessions");
  const [modal,setModal]=useState(false);
  const [editingId,setEditingId]=useState<string|null>(null);
  const [saving,setSaving]=useState(false);
  const [form,setForm]=useState({title:"",subject:"Mathematics",date:"",time:"09:00",duration:"30"});
  const [weekOffset,setWeekOffset]=useState(0);
  const days=["Monday","Tuesday","Wednesday","Thursday","Friday","Saturday","Sunday"];
  const weekDates=useMemo(()=>{const now=new Date();const monday=new Date(now);monday.setHours(0,0,0,0);monday.setDate(monday.getDate()-((monday.getDay()+6)%7)+weekOffset*7);return days.map((_,index)=>new Date(monday.getFullYear(),monday.getMonth(),monday.getDate()+index));},[weekOffset]);
  const sessions=data?.sessions??[];
  const weekEnd=new Date(weekDates[6]);weekEnd.setHours(23,59,59,999);
  const weekSessions=sessions.filter(session=>new Date(session.startTime)>=weekDates[0]&&new Date(session.startTime)<=weekEnd);
  const weekMinutes=weekSessions.reduce((total,session)=>total+(new Date(session.endTime).getTime()-new Date(session.startTime).getTime())/60000,0);
  const completedCount=weekSessions.filter(session=>session.completed).length;
  const weekLabel=`${weekDates[0].toLocaleDateString("en-US",{month:"short",day:"numeric"})} – ${weekDates[6].toLocaleDateString("en-US",{month:"short",day:"numeric",year:"numeric"})}`;
  const dateInputValue=(value:Date)=>`${value.getFullYear()}-${String(value.getMonth()+1).padStart(2,"0")}-${String(value.getDate()).padStart(2,"0")}`;
  function closeModal(){setModal(false);setEditingId(null);}
  async function saveSession(){
    if(form.title.trim().length<2){toast("Enter a session title with at least two characters.");return;}
    const startTime=new Date(`${form.date}T${form.time}`);
    const endTime=new Date(startTime.getTime()+Number(form.duration)*60000);
    if(!form.date||Number.isNaN(startTime.getTime())||!Number.isFinite(endTime.getTime())){toast("Choose a valid date and time.");return;}
    setSaving(true);
    try{
      const response=await fetch(editingId?`/api/student/sessions/${editingId}`:"/api/student/sessions",{method:editingId?"PATCH":"POST",headers:{"Content-Type":"application/json"},body:JSON.stringify({title:form.title,subject:form.subject,startTime:startTime.toISOString(),endTime:endTime.toISOString(),completed:editingId?sessions.find(session=>session.id===editingId)?.completed??false:false})});
      const result=await response.json();
      if(!response.ok)throw new Error(result.error?.message??"Could not save this study session.");
      toast(editingId?"Study session updated.":"Study session added to your planner.");
      closeModal();
      refresh();
    }catch(reason){toast(reason instanceof Error?reason.message:"Could not save this study session.");}
    finally{setSaving(false);}
  }
  function editSession(session:StudySession){
    const start=new Date(session.startTime);const duration=Math.max(15,Math.round((new Date(session.endTime).getTime()-start.getTime())/60000));
    setEditingId(session.id);setForm({title:session.title,subject:session.subject,date:dateInputValue(start),time:`${String(start.getHours()).padStart(2,"0")}:${String(start.getMinutes()).padStart(2,"0")}`,duration:String(duration)});setModal(true);
  }
  async function updateSession(id:string,method:"PATCH"|"DELETE",completed?:boolean){
    try{
      const response=await fetch(`/api/student/sessions/${id}`,{method,headers:method==="PATCH"?{"Content-Type":"application/json"}:undefined,body:method==="PATCH"?JSON.stringify({completed}):undefined});
      if(!response.ok){const result=await response.json();throw new Error(result.error?.message??"Could not update this study session.");}
      toast(method==="DELETE"?"Study session removed.":completed?"Nice work—session completed!":"Session marked as upcoming.");
      refresh();
    }catch(reason){toast(reason instanceof Error?reason.message:"Could not update this study session.");}
  }
  if(loading||error||!data)return <ApiState loading={loading} error={error||"Study sessions are not available."} onRetry={refresh}/>;
  return <div className="space-y-5"><div className="flex flex-wrap items-end justify-between gap-3"><div><p className="text-xs font-semibold uppercase tracking-[.12em] text-[#789073]">Make space for what matters</p><h1 className="mt-2 text-3xl font-semibold tracking-[-.04em]">Study planner</h1><p className="mt-2 text-sm text-[#87918a]">A flexible plan is a good plan. Make this week yours.</p></div><Button variant="primary" onClick={()=>{setForm({...form,date:dateInputValue(new Date())});setModal(true);}}><Plus size={15}/> Add study session</Button></div>
    <Card><div className="mb-5 flex items-center justify-between"><div><p className="text-sm font-semibold">This week</p><p className="mt-1 text-xs text-[#929b94]">{weekLabel}</p></div><div className="flex gap-2"><button aria-label="Previous week" onClick={()=>setWeekOffset(weekOffset-1)} className="soft-button !p-2"><ChevronLeft size={15}/></button><button aria-label="Next week" onClick={()=>setWeekOffset(weekOffset+1)} className="soft-button !p-2"><ChevronRight size={15}/></button></div></div><div className="grid grid-cols-7 gap-1 sm:gap-2">{days.map((day,index)=>{const sessionsThatDay=weekSessions.filter(session=>new Date(session.startTime).getDate()===weekDates[index].getDate());const today=dateInputValue(new Date())===dateInputValue(weekDates[index]);return <div key={day} className={cx("rounded-xl p-2 text-center sm:p-3",today?"bg-[#edf3e7]":"bg-[#fafbf8]")}><p className="text-[9px] text-[#9aa29b] sm:text-[11px]">{day.slice(0,3)}</p><p className={cx("mt-2 text-sm font-semibold",today?"text-[#456544]":"text-[#59645b]")}>{weekDates[index].getDate()}</p>{sessionsThatDay.length>0&&<div className="mx-auto mt-2 h-1 w-1 rounded-full bg-[#91ae7e]"/>}</div>;})}</div></Card>
    <div className="grid gap-5 lg:grid-cols-[1.15fr_.85fr]"><Card><Heading title="Your sessions" subtitle="A little structure, lots of room to breathe"/>{weekSessions.length?<div className="divide-y divide-[#eff1ed]">{weekSessions.map(session=>{const start=new Date(session.startTime);const duration=Math.round((new Date(session.endTime).getTime()-start.getTime())/60000);return <div key={session.id} className="flex items-center gap-3 py-4"><button onClick={()=>void updateSession(session.id,"PATCH",!session.completed)} className={cx("grid h-9 w-9 place-items-center rounded-xl",session.completed?"bg-[#eaf2e6] text-[#5f825e]":"bg-[#f4f5f1] text-[#89938b]")} aria-label={session.completed?"Mark session incomplete":"Mark session completed"}><Check size={16}/></button><div className="min-w-0 flex-1"><p className={cx("text-sm font-semibold",session.completed&&"text-[#9aa29b] line-through")}>{session.title}</p><p className="mt-1 text-xs text-[#919a93]">{session.subject} · {start.toLocaleDateString("en-US",{weekday:"long"})} · {start.toLocaleTimeString("en-US",{hour:"numeric",minute:"2-digit"})} · {duration} min</p></div><button aria-label="Edit study session" onClick={()=>editSession(session)} className="rounded-lg p-2 text-[#a1a9a2] hover:bg-[#f1f5ed] hover:text-[#5f805c]"><Pencil size={14}/></button><button aria-label="Delete study session" onClick={()=>void updateSession(session.id,"DELETE")} className="rounded-lg p-2 text-[#a1a9a2] hover:bg-[#fff1ec] hover:text-[#b87564]"><Trash2 size={15}/></button></div>;})}</div>:<p className="py-12 text-center text-sm text-[#909a92]">No sessions planned for this week. Add one to get started.</p>}</Card><Card><Heading title="A balanced week" subtitle="Small, steady steps go a long way"/><div className="space-y-4">{[["Planned study time",`${(weekMinutes/60).toFixed(1)} hours`,Math.min(100,Math.round(weekMinutes/360*100))],["Weekly goal","6 hours",75],["Sessions completed",`${completedCount} of ${weekSessions.length}`,weekSessions.length?Math.round(completedCount/weekSessions.length*100):0]].map(([label,value,percent])=><div key={String(label)}><div className="mb-2 flex justify-between text-xs"><span className="text-[#7e8981]">{label}</span><b>{value}</b></div><div className="h-2 rounded-full bg-[#f0f2ed]"><div className="h-full rounded-full bg-[#86a981]" style={{width:`${percent}%`}}/></div></div>)}</div><div className="mt-7 rounded-2xl bg-gradient-to-r from-[#edf4e5] to-[#fff2e5] p-4"><p className="text-xs font-semibold text-[#5a7258]">A gentle reminder</p><p className="mt-1 text-xs leading-5 text-[#7b8778]">Rest is part of learning, too. Leave a little breathing room between sessions.</p></div></Card></div>
    {modal&&<AppModal title={editingId?"Edit study session":"Add a study session"} onClose={closeModal} footer={<><Button onClick={closeModal}>Cancel</Button><Button variant="primary" disabled={saving} onClick={()=>void saveSession()}>{saving?"Saving…":editingId?"Save changes":"Save session"}</Button></>}><div className="space-y-3"><label className="block text-xs font-medium text-[#647068]">Session title<input value={form.title} onChange={event=>setForm({...form,title:event.target.value})} placeholder="e.g. Review chapter 4" className="field mt-1.5"/></label><div className="grid grid-cols-2 gap-3"><label className="text-xs font-medium text-[#647068]">Subject<select value={form.subject} onChange={event=>setForm({...form,subject:event.target.value})} className="field mt-1.5">{studentSubjects.map(subject=><option key={subject.id}>{subject.name}</option>)}</select></label><label className="text-xs font-medium text-[#647068]">Date<input type="date" value={form.date} onChange={event=>setForm({...form,date:event.target.value})} className="field mt-1.5"/></label></div><div className="grid grid-cols-2 gap-3"><label className="text-xs font-medium text-[#647068]">Time<input type="time" value={form.time} onChange={event=>setForm({...form,time:event.target.value})} className="field mt-1.5"/></label><label className="text-xs font-medium text-[#647068]">Duration<select value={form.duration} onChange={event=>setForm({...form,duration:event.target.value})} className="field mt-1.5">{[15,30,45,60,90].map(minutes=><option key={minutes} value={minutes}>{minutes>=60?`${minutes/60} hour${minutes>60?"s":""}`:`${minutes} min`}</option>)}</select></label></div></div></AppModal>}
  </div>;
}

function ReportsPage({role}: {role:Role}) {
  const {data,error,loading,refresh}=useApiResource<StudentDashboardData|TrainerDashboardData>(role==="student"?"/api/student/dashboard":"/api/trainer/dashboard");
  if(loading||error||!data)return <ApiState loading={loading} error={error||"Report data is not available."} onRetry={refresh}/>;
  const studentData="courses" in data?data:null;
  const trainerData="batches" in data?data:null;
  if(role==="student"&&!studentData||role==="trainer"&&!trainerData)return <ApiState loading={false} error="Report data did not match your account." onRetry={refresh}/>;
  const chartData=studentData
    ?studentData.studyBySubject.map(item=>({name:item.subject,hours:item.hours}))
    :(trainerData?.batches.map(batch=>({name:batch.name,hours:batch.score}))??[]);
  function exportCsv(){
    const rows=studentData
      ?[["Subject","Progress","Score","Instructor"],...studentData.courses.map(course=>[course.name,String(course.progress),String(course.score),course.teacher])]
      :[["Batch","Learners","Attendance","Average score"],...(trainerData?.batches??[]).map(batch=>[batch.name,String(batch.learners),String(batch.attendance),String(batch.score)])];
    const csv=rows.map(row=>row.map(cell=>`"${cell.replace(/"/g,'""')}"`).join(",")).join("\r\n");
    const link=document.createElement("a");link.href=URL.createObjectURL(new Blob([csv],{type:"text/csv;charset=utf-8"}));link.download=`myaiguru-${role}-report.csv`;link.click();URL.revokeObjectURL(link.href);
  }
  const progress=studentData?.metrics.overallProgress??(trainerData?.metrics.learners?Math.round((trainerData.learnerDistribution.onTrack/trainerData.learnerDistribution.total)*100):0);
  const learningTime=studentData?`${studentData.metrics.studyHours}h`:`${trainerData?.metrics.activeBatches??0} batches`;
  const completion=studentData?.metrics.assignmentCompletion??trainerData?.metrics.submissionRate??0;
  const consistency=studentData?`${studentData.metrics.learningDays} days`:`${trainerData?.metrics.attendance??0}%`;
  const performanceRows=studentData?.courses.map(course=>({id:course.id,name:course.name,score:course.score,progress:course.progress}))
    ??trainerData?.batches.map(batch=>({id:batch.id,name:batch.name,score:batch.score,progress:batch.attendance}))??[];
  return <div className="space-y-5"><div className="flex flex-wrap items-end justify-between gap-3"><div><p className="text-xs font-semibold uppercase tracking-[.12em] text-[#789073]">Your progress, at a glance</p><h1 className="mt-2 text-3xl font-semibold tracking-[-.04em]">{role==="student"?"Reports & progress":"Teaching reports"}</h1><p className="mt-2 text-sm text-[#87918a]">Notice the progress you’re making, one step at a time.</p></div><Button onClick={exportCsv}><Download size={14}/> Export CSV</Button></div>
    <div className="grid gap-4 sm:grid-cols-2 xl:grid-cols-4"><Metric label={role==="student"?"Overall progress":"Learner progress"} value={`${progress}%`} note="Calculated from current records" icon={TrendingUp}/><Metric label={role==="student"?"Study time":"Active batches"} value={learningTime} note={role==="student"?"This month":"Currently assigned"} icon={Clock3} tone="peach"/><Metric label="Assignments" value={`${completion}%`} note="Completion rate" icon={CheckCircle2} tone="yellow"/><Metric label={role==="student"?"Learning days":"Attendance"} value={consistency} note="Calculated from records" icon={CalendarDays} tone="coral"/></div>
    <PerformanceChart role={role} data={data.performanceTrend} seriesKeys={studentData?studentData.courses.map(course=>course.name):trainerData?.batches.map(batch=>batch.name)}/><div className="grid gap-5 lg:grid-cols-2"><Card><Heading title={role==="student"?"Subject performance":"Batch performance"} subtitle="Current assessment results"/><div className="space-y-4">{performanceRows.map((row,index)=><div key={row.id}><div className="mb-2 flex justify-between text-xs"><span className="font-medium">{row.name}</span><span className="text-[#87918a]">{role==="student"?`Score ${row.score}%`:`Attendance ${row.progress}% · Score ${row.score}%`}</span></div><div className="h-2 overflow-hidden rounded-full bg-[#f0f2ed]"><div className="h-full rounded-full" style={{width:`${row.score}%`,background:colors[index%colors.length]}}/></div></div>)}{!performanceRows.length&&<p className="py-6 text-center text-xs text-[#909a92]">No performance records available.</p>}</div></Card><Card><Heading title={role==="student"?"Study time":"Batch comparison"} subtitle={role==="student"?"Study hours by subject":"Average assessment score by batch"}/><div className="h-[210px]"><ResponsiveContainer width="100%" height="100%"><AreaChart data={chartData}><defs><linearGradient id="hours" x1="0" y1="0" x2="0" y2="1"><stop offset="0%" stopColor="#80a981" stopOpacity={.3}/><stop offset="100%" stopColor="#80a981" stopOpacity={0}/></linearGradient></defs><CartesianGrid stroke="#eff1ed" strokeDasharray="3 5" vertical={false}/><XAxis dataKey="name" axisLine={false} tickLine={false} tick={{fontSize:10,fill:"#9aa29b"}}/><YAxis axisLine={false} tickLine={false} tick={{fontSize:10,fill:"#9aa29b"}}/><Tooltip contentStyle={{borderRadius:12,border:"1px solid #e8ece6",fontSize:12}}/><Area type="monotone" dataKey="hours" stroke="#80a981" strokeWidth={2} fill="url(#hours)"/></AreaChart></ResponsiveContainer></div></Card></div>
  </div>;
}

function BatchesPage({toast}: {toast:(s:string)=>void}) {
  const {data,error,loading,refresh}=useApiResource<TrainerDashboardData>("/api/trainer/dashboard");
  const [selectedId,setSelectedId]=useState("");
  useEffect(()=>{const id=localStorage.getItem("myaiguru-selected-batch");if(id)setSelectedId(id);},[]);
  if(loading||error||!data)return <ApiState loading={loading} error={error||"Batch data is not available."} onRetry={refresh}/>;
  const selected=data.batches.find(batch=>batch.id===selectedId)??data.batches[0];
  const learners=selected?data.learners.filter(learner=>learner.batch===selected.name):[];
  return <div className="space-y-5"><div><p className="text-xs font-semibold uppercase tracking-[.12em] text-[#789073]">Your learning communities</p><h1 className="mt-2 text-3xl font-semibold tracking-[-.04em]">Batches</h1><p className="mt-2 text-sm text-[#87918a]">Stay close to each group’s progress and rhythm.</p></div><div className="grid gap-4 sm:grid-cols-2 xl:grid-cols-4">{data.batches.map((batch,index)=><button key={batch.id} onClick={()=>{setSelectedId(batch.id);localStorage.setItem("myaiguru-selected-batch",batch.id);}} className={cx("card p-5 text-left transition-all hover:-translate-y-1",selected?.id===batch.id&&"border-[#afc6ab] ring-2 ring-[#e5eee1]")}><span className={cx("grid h-10 w-10 place-items-center rounded-xl",["bg-[#eaf2e6] text-[#61835f]","bg-[#fff0e5] text-[#b77d5f]","bg-[#fbf2d8] text-[#9b833e]","bg-[#fbeae5] text-[#b97565"][index%4])}><Users size={17}/></span><p className="mt-4 text-sm font-semibold">{batch.name}</p><p className="mt-1 text-xs text-[#929b94]">{batch.learners} learners · {batch.subject}</p><div className="mt-4 flex justify-between text-xs"><span className="text-[#8f9891]">Attendance</span><b>{batch.attendance}%</b></div><div className="mt-2 h-1.5 rounded-full bg-[#f0f2ed]"><div className="h-full rounded-full bg-[#84a77b]" style={{width:`${batch.attendance}%`}}/></div></button>)}</div>
    {!selected?<Card className="py-12 text-center text-sm text-[#909a92]">No assigned batches found.</Card>:<div className="grid gap-5 lg:grid-cols-[.8fr_1.2fr]"><Card><Heading title={selected.name} subtitle={selected.subject}/><div className="grid grid-cols-2 gap-3"><div className="rounded-xl bg-[#f7f8f4] p-4"><p className="text-[10px] text-[#929b94]">Learners</p><p className="mt-1 text-2xl font-semibold">{selected.learners}</p></div><div className="rounded-xl bg-[#f7f8f4] p-4"><p className="text-[10px] text-[#929b94]">Avg. score</p><p className="mt-1 text-2xl font-semibold">{selected.score}%</p></div><div className="rounded-xl bg-[#f7f8f4] p-4"><p className="text-[10px] text-[#929b94]">Attendance</p><p className="mt-1 text-2xl font-semibold">{selected.attendance}%</p></div><div className="rounded-xl bg-[#f7f8f4] p-4"><p className="text-[10px] text-[#929b94]">Course end</p><p className="mt-1 text-sm font-semibold">{new Date(selected.endDate).toLocaleDateString()}</p></div></div><Button variant="primary" className="mt-5 w-full" onClick={()=>toast(`${selected.name} analytics are up to date.`)}>Batch overview <ArrowRight size={14}/></Button></Card><Card><Heading title="Learners" subtitle={`A quick look at ${selected.name}`}/><div className="max-h-[390px] divide-y divide-[#eff1ed] overflow-y-auto">{learners.map(learner=><div key={learner.studentId} className="flex items-center gap-3 py-3"><span className="grid h-8 w-8 place-items-center rounded-full bg-[#edf2e8] text-[10px] font-bold text-[#5a7653]">{initials(learner.name)}</span><span className="min-w-0 flex-1 truncate text-xs font-medium">{learner.name}</span><span className="text-xs text-[#7b877e]">{learner.progress}%</span></div>)}{!learners.length&&<p className="py-8 text-center text-xs text-[#909a92]">No learners enrolled in this batch.</p>}</div></Card></div>}<PerformanceChart role="trainer" data={data.performanceTrend} seriesKeys={data.batches.map(batch=>batch.name)}/></div>;
}

function StudentTable({data}: {data:typeof students}) {
  return <div className="overflow-x-auto"><table className="w-full min-w-[480px] text-left"><thead><tr className="border-b border-[#eff1ed] text-[10px] uppercase tracking-wide text-[#9aa29b]"><th className="pb-3 font-medium">Learner</th><th className="pb-3 font-medium">Progress</th><th className="pb-3 font-medium">Score</th><th className="pb-3 font-medium">Status</th></tr></thead><tbody>{data.length?data.map(s=><tr key={s.id} className="border-b border-[#f1f3ef] last:border-0"><td className="py-3"><div className="flex items-center gap-2"><span className="grid h-8 w-8 place-items-center rounded-full bg-[#edf2e8] text-[10px] font-bold text-[#5a7653]">{initials(s.name)}</span><span className="text-xs font-medium">{s.name}</span></div></td><td className="py-3 text-xs">{s.progress}%</td><td className="py-3 text-xs">{s.score}%</td><td className="py-3"><span className={cx("rounded-full px-2 py-1 text-[9px]",s.status==="On track"?"bg-[#edf4e9] text-[#63805f]":"bg-[#fff1e9] text-[#b77b5c]")}>{s.status}</span></td></tr>):<tr><td colSpan={4} className="py-8 text-center text-xs text-[#909a92]">No learners in this batch view.</td></tr>}</tbody></table></div>;
}

function StudentsPage() {
  const {data,error,loading,refresh}=useApiResource<TrainerStudentsData>("/api/trainer/students");
  const [query,setQuery]=useState("");
  const [batch,setBatch]=useState("All batches");
  const [selected,setSelected]=useState<TrainerStudentsData["students"][number]|null>(null);
  if(loading||error||!data)return <ApiState loading={loading} error={error||"Student data is not available."} onRetry={refresh}/>;
  const batchNames=[...new Set(data.students.map(student=>student.batch))];
  const list=data.students.filter(student=>(batch==="All batches"||student.batch===batch)&&student.fullName.toLowerCase().includes(query.toLowerCase()));
  const averageMarks=(student:TrainerStudentsData["students"][number])=>{const marked=student.submissions.filter(submission=>submission.marks!==null);return marked.length?Math.round(marked.reduce((sum,submission)=>sum+(submission.marks??0),0)/marked.length):0;};
  return <div className="space-y-5"><div><p className="text-xs font-semibold uppercase tracking-[.12em] text-[#789073]">Get to know your learners</p><h1 className="mt-2 text-3xl font-semibold tracking-[-.04em]">Students</h1><p className="mt-2 text-sm text-[#87918a]">Find a learner and get a clearer picture of their progress.</p></div><Card><div className="mb-5 flex flex-wrap gap-3"><div className="relative min-w-[210px] flex-1"><Search size={16} className="absolute left-3 top-3 text-[#9aa29b]"/><input value={query} onChange={e=>setQuery(e.target.value)} placeholder="Search students..." className="field !pl-9"/></div><select value={batch} onChange={e=>setBatch(e.target.value)} className="field !w-auto"><option>All batches</option>{batchNames.map(name=><option key={name}>{name}</option>)}</select><Button onClick={()=>{setQuery("");setBatch("All batches");}}>Clear filters <X size={14}/></Button></div><div className="overflow-x-auto"><table className="w-full min-w-[700px] text-left"><thead><tr className="border-b border-[#eff1ed] text-[10px] uppercase tracking-wide text-[#9aa29b]"><th className="pb-3 font-medium">Student</th><th className="pb-3 font-medium">Batch</th><th className="pb-3 font-medium">Attendance</th><th className="pb-3 font-medium">Progress</th><th className="pb-3 font-medium">Avg. marks</th><th className="pb-3 font-medium">Status</th></tr></thead><tbody>{list.map(student=>{const status=student.progress<60?"Needs support":"On track";return <tr key={student.id} onClick={()=>setSelected(student)} className="cursor-pointer border-b border-[#f1f3ef] last:border-0 hover:bg-[#fbfcfa]"><td className="py-4"><div className="flex items-center gap-3"><span className="grid h-9 w-9 place-items-center rounded-full bg-[#edf2e8] text-[10px] font-bold text-[#5a7653]">{initials(student.fullName)}</span><span className="text-xs font-semibold">{student.fullName}</span></div></td><td className="py-4 text-xs text-[#758078]">{student.batch}</td><td className="py-4 text-xs">{student.attendance}%</td><td className="py-4 text-xs">{student.progress}%</td><td className="py-4 text-xs">{averageMarks(student)||"—"}</td><td className="py-4"><span className={cx("rounded-full px-2.5 py-1 text-[10px]",status==="On track"?"bg-[#edf4e9] text-[#63805f]":"bg-[#fff1e9] text-[#b77b5c]")}>{status}</span></td></tr>;})}</tbody></table>{!list.length&&<p className="py-10 text-center text-sm text-[#909a92]">No students match those filters.</p>}</div></Card>
    {selected&&<AppModal title={selected.fullName} onClose={()=>setSelected(null)} footer={<Button variant="primary" onClick={()=>setSelected(null)}>Done</Button>}><p className="text-sm text-[#87918a]">{selected.email} · {selected.batch} · {selected.course.subject}</p><div className="mt-5 grid grid-cols-3 gap-2">{[["Progress",`${selected.progress}%`],["Attendance",`${selected.attendance}%`],["Avg. marks",averageMarks(selected)||"—"]].map(([label,value])=><div key={label} className="rounded-xl bg-[#f6f8f4] p-3"><p className="text-[10px] text-[#929b94]">{label}</p><p className="mt-1 text-lg font-semibold">{value}</p></div>)}</div><div className="mt-5 rounded-xl bg-[#f6f8f4] p-4"><p className="text-xs font-semibold">Assignment activity</p><p className="mt-2 text-[11px] text-[#87918a]">{selected.submissions.filter(submission=>submission.status==="REVIEWED").length} reviewed · {selected.submissions.filter(submission=>submission.status==="SUBMITTED").length} awaiting review</p><div className="mt-3 h-2 rounded-full bg-[#e8ece5]"><div className="h-full rounded-full bg-[#83a77c]" style={{width:`${selected.progress}%`}}/></div><p className="mt-2 text-[11px] text-[#87918a]">Course learning progress</p></div></AppModal>}
  </div>;
}

function AssignmentsPage({toast}: {toast:(s:string)=>void}) {
  const {data,error,loading,refresh}=useApiResource<TrainerAssignmentData>("/api/trainer/assignments");
  const {data:batchesData}=useApiResource<TrainerBatchesData>("/api/trainer/batches");
  const [filter,setFilter]=useState("All");
  const [selected,setSelected]=useState<(TrainerAssignmentData["assignments"][number]["submissions"][number]&{assignmentTitle:string;subject:string;batch:string;totalMarks:number})|null>(null);
  const [marks,setMarks]=useState("");
  const [feedback,setFeedback]=useState("");
  const [createOpen,setCreateOpen]=useState(false);
  const [saving,setSaving]=useState(false);
  const [newAssignment,setNewAssignment]=useState({title:"",description:"",instructions:"",batchId:"",dueDate:"",totalMarks:"20"});
  const rows=data?.assignments.flatMap(assignment=>assignment.submissions.map(submission=>({
    ...submission,assignmentTitle:assignment.title,subject:assignment.batch.course.subject,batch:assignment.batch.name,totalMarks:assignment.totalMarks,
  })))??[];
  const visible=rows.filter(row=>filter==="All"||(filter==="Pending"?row.status==="SUBMITTED":row.status==="REVIEWED"));
  const pending=rows.filter(row=>row.status==="SUBMITTED").length;
  const reviewed=rows.filter(row=>row.status==="REVIEWED").length;
  const weekStart=Date.now()-7*86400000;
  const thisWeek=rows.filter(row=>new Date(row.submittedAt).getTime()>=weekStart).length;
  function openReview(row:typeof rows[number]){setSelected(row);setMarks(row.marks===null?"":String(row.marks));setFeedback(row.feedback??"");}
  async function publishReview(){
    if(!selected)return;
    const markValue=Number(marks);
    if(!Number.isInteger(markValue)||markValue<0||markValue>selected.totalMarks){toast(`Enter a whole-number mark from 0 to ${selected.totalMarks}.`);return;}
    setSaving(true);
    try{
      const response=await fetch(`/api/trainer/submissions/${selected.id}/review`,{method:"POST",headers:{"Content-Type":"application/json"},body:JSON.stringify({marks:markValue,feedback})});
      const result=await response.json();
      if(!response.ok)throw new Error(result.error?.message??"Could not publish the review.");
      toast("Feedback published to the student.");
      setSelected(null);
      refresh();
    }catch(reason){toast(reason instanceof Error?reason.message:"Could not publish the review.");}
    finally{setSaving(false);}
  }
  async function createAssignment(){
    if(!newAssignment.batchId||!newAssignment.title.trim()||!newAssignment.description.trim()||!newAssignment.instructions.trim()||!newAssignment.dueDate){toast("Complete all assignment details before saving.");return;}
    setSaving(true);
    try{
      const response=await fetch("/api/trainer/assignments",{method:"POST",headers:{"Content-Type":"application/json"},body:JSON.stringify({...newAssignment,totalMarks:Number(newAssignment.totalMarks),dueDate:new Date(newAssignment.dueDate).toISOString()})});
      const result=await response.json();
      if(!response.ok)throw new Error(result.error?.message??"Could not create the assignment.");
      toast("Assignment created for the selected batch.");
      setCreateOpen(false);
      setNewAssignment({title:"",description:"",instructions:"",batchId:"",dueDate:"",totalMarks:"20"});
      refresh();
    }catch(reason){toast(reason instanceof Error?reason.message:"Could not create the assignment.");}
    finally{setSaving(false);}
  }
  if(loading||error||!data)return <ApiState loading={loading} error={error||"Assignment data is not available."} onRetry={refresh}/>;
  return <div className="space-y-5"><div className="flex flex-wrap items-end justify-between gap-3"><div><p className="text-xs font-semibold uppercase tracking-[.12em] text-[#789073]">Thoughtful feedback makes a difference</p><h1 className="mt-2 text-3xl font-semibold tracking-[-.04em]">Assignments</h1><p className="mt-2 text-sm text-[#87918a]">Review student work and share helpful next steps.</p></div><Button variant="primary" onClick={()=>setCreateOpen(true)}><Plus size={15}/> Create assignment</Button></div><div className="grid gap-4 sm:grid-cols-3"><Metric label="To review" value={String(pending)} icon={Clock3} tone="peach"/><Metric label="Reviewed" value={String(reviewed)} icon={CheckCircle2}/><Metric label="Submitted this week" value={String(thisWeek)} icon={FileText} tone="yellow"/></div><Card><div className="mb-5 flex flex-wrap items-center justify-between gap-3"><Heading title="Student submissions" subtitle="Your inbox for work to review"/><Selector items={["All","Pending","Reviewed"]} value={filter} onChange={setFilter}/></div><div className="overflow-x-auto"><table className="w-full min-w-[680px] text-left"><thead><tr className="border-b border-[#eff1ed] text-[10px] uppercase tracking-wide text-[#9aa29b]"><th className="pb-3 font-medium">Assignment</th><th className="pb-3 font-medium">Student</th><th className="pb-3 font-medium">Batch</th><th className="pb-3 font-medium">Submitted</th><th className="pb-3 font-medium">Status</th><th className="pb-3"/></tr></thead><tbody>{visible.map(row=><tr key={row.id} className="border-b border-[#f1f3ef] last:border-0"><td className="py-4"><p className="text-xs font-semibold">{row.assignmentTitle}</p><p className="mt-1 text-[10px] text-[#98a199]">{row.subject}</p></td><td className="py-4 text-xs">{row.student.fullName}</td><td className="py-4 text-xs text-[#758078]">{row.batch}</td><td className="py-4 text-xs text-[#87918a]">{new Date(row.submittedAt).toLocaleDateString()}</td><td className="py-4"><span className={cx("rounded-full px-2.5 py-1 text-[10px]",row.status==="SUBMITTED"?"bg-[#fff1e9] text-[#b77b5c]":"bg-[#edf4e9] text-[#63805f]")}>{row.status==="SUBMITTED"?"Pending":"Reviewed"}</span></td><td className="py-4"><Button onClick={()=>openReview(row)}>{row.status==="SUBMITTED"?"Review":"View"}</Button></td></tr>)}</tbody></table>{!visible.length&&<p className="py-10 text-center text-sm text-[#909a92]">No submissions match this filter.</p>}</div></Card>
    {selected&&<AppModal title="Review submission" onClose={()=>setSelected(null)} footer={<Button variant="primary" disabled={saving} onClick={()=>void publishReview()}>{saving?"Publishing…":"Publish feedback"}</Button>}><div className="rounded-xl bg-[#f6f8f4] p-4"><p className="text-sm font-semibold">{selected.assignmentTitle}</p><p className="mt-1 text-xs text-[#8b958d]">{selected.student.fullName} · {selected.batch} · {selected.subject}</p><p className="mt-1 text-[10px] text-[#8b958d]">Submitted {new Date(selected.submittedAt).toLocaleString()}</p><div className="mt-4 rounded-lg border border-[#eaeee7] bg-white p-3"><p className="text-[10px] font-semibold uppercase tracking-wide text-[#929b94]">Student submission</p><p className="mt-2 whitespace-pre-wrap text-xs leading-5 text-[#758078]">{selected.submissionContent}</p></div></div><div className="mt-4 grid grid-cols-[120px_1fr] items-center gap-3"><label htmlFor="marks" className="text-xs font-medium">Marks (out of {selected.totalMarks})</label><input id="marks" type="number" min="0" max={selected.totalMarks} step="1" value={marks} onChange={e=>setMarks(e.target.value)} placeholder="e.g. 18" className="field"/></div><label className="mt-4 block text-xs font-medium">Feedback<textarea value={feedback} onChange={e=>setFeedback(e.target.value)} rows={4} placeholder="Share a helpful comment..." className="field mt-1.5 resize-y"/></label></AppModal>}
    {createOpen&&<AppModal title="Create assignment" onClose={()=>setCreateOpen(false)} footer={<><Button onClick={()=>setCreateOpen(false)}>Cancel</Button><Button variant="primary" disabled={saving} onClick={()=>void createAssignment()}>{saving?"Saving…":"Create assignment"}</Button></>}><div className="space-y-3"><label className="block text-xs font-medium">Assignment title<input value={newAssignment.title} onChange={e=>setNewAssignment({...newAssignment,title:e.target.value})} className="field mt-1.5"/></label><label className="block text-xs font-medium">Batch<select value={newAssignment.batchId} onChange={e=>setNewAssignment({...newAssignment,batchId:e.target.value})} className="field mt-1.5"><option value="">Select a batch</option>{(batchesData?.batches??[]).map(batch=><option key={batch.id} value={batch.id}>{batch.name}</option>)}</select></label><label className="block text-xs font-medium">Description<textarea value={newAssignment.description} onChange={e=>setNewAssignment({...newAssignment,description:e.target.value})} rows={2} className="field mt-1.5"/></label><label className="block text-xs font-medium">Instructions<textarea value={newAssignment.instructions} onChange={e=>setNewAssignment({...newAssignment,instructions:e.target.value})} rows={3} className="field mt-1.5"/></label><div className="grid grid-cols-2 gap-3"><label className="text-xs font-medium">Due date<input type="datetime-local" value={newAssignment.dueDate} onChange={e=>setNewAssignment({...newAssignment,dueDate:e.target.value})} className="field mt-1.5"/></label><label className="text-xs font-medium">Total marks<input type="number" min="1" value={newAssignment.totalMarks} onChange={e=>setNewAssignment({...newAssignment,totalMarks:e.target.value})} className="field mt-1.5"/></label></div></div></AppModal>}
  </div>;
}

function StudentAssignmentsPage({toast}: {toast:(s:string)=>void}) {
  const {data,error,loading,refresh}=useApiResource<StudentAssignmentsData>("/api/student/assignments");
  const [selected,setSelected]=useState<StudentAssignmentsData["assignments"][number]|null>(null);
  const [submissionContent,setSubmissionContent]=useState("");
  const [saving,setSaving]=useState(false);
  function openAssignment(assignment:StudentAssignmentsData["assignments"][number]){
    setSelected(assignment);
    setSubmissionContent(assignment.submission?.submissionContent??"");
  }
  async function submitAssignment(){
    if(!selected||!submissionContent.trim()){toast("Add your work before submitting.");return;}
    setSaving(true);
    try{
      const response=await fetch(`/api/student/assignments/${selected.id}/submit`,{method:"POST",headers:{"Content-Type":"application/json"},body:JSON.stringify({submissionContent})});
      const result=await response.json();
      if(!response.ok)throw new Error(result.error?.message??"Could not submit this assignment.");
      toast("Assignment submitted successfully.");
      setSelected(null);
      refresh();
    }catch(reason){toast(reason instanceof Error?reason.message:"Could not submit this assignment.");}
    finally{setSaving(false);}
  }
  if(loading||error||!data)return <ApiState loading={loading} error={error||"Assignment data is not available."} onRetry={refresh}/>;
  return <div className="space-y-5"><div><p className="text-xs font-semibold uppercase tracking-[.12em] text-[#789073]">Your next steps</p><h1 className="mt-2 text-3xl font-semibold tracking-[-.04em]">Assignments</h1><p className="mt-2 text-sm text-[#87918a]">Review your work, due dates, and trainer feedback.</p></div><div className="grid gap-4 sm:grid-cols-3"><Metric label="To submit" value={String(data.assignments.filter(assignment=>!assignment.submission).length)} icon={Clock3} tone="peach"/><Metric label="Submitted" value={String(data.assignments.filter(assignment=>assignment.submission?.status==="SUBMITTED").length)} icon={FileText}/><Metric label="Reviewed" value={String(data.assignments.filter(assignment=>assignment.submission?.status==="REVIEWED").length)} icon={CheckCircle2} tone="yellow"/></div><div className="grid gap-4 md:grid-cols-2">{data.assignments.map(assignment=><Card key={assignment.id}><div className="flex items-start justify-between gap-3"><div><h2 className="text-sm font-semibold">{assignment.title}</h2><p className="mt-1 text-xs text-[#8b958d]">{assignment.batch.course.subject} · {assignment.batch.name}</p></div><span className={cx("rounded-full px-2.5 py-1 text-[10px]",assignment.submission?.status==="REVIEWED"?"bg-[#edf4e9] text-[#63805f]":assignment.submission?.status==="SUBMITTED"?"bg-[#eaf0f6] text-[#637da3]":"bg-[#fff1e9] text-[#b77b5c]")}>{assignment.submission?.status==="REVIEWED"?"Reviewed":assignment.submission?.status==="SUBMITTED"?"Submitted":"Not submitted"}</span></div><p className="mt-4 text-xs leading-5 text-[#77827e]">{assignment.description}</p><div className="mt-4 flex items-center justify-between border-t border-[#eff1ed] pt-3 text-[11px] text-[#89938b]"><span>Due {new Date(assignment.dueDate).toLocaleDateString()}</span><span>{assignment.totalMarks} marks</span></div>{assignment.submission?.status==="REVIEWED"&&<div className="mt-3 rounded-xl bg-[#f6f8f4] p-3"><p className="text-xs font-semibold">Result · {assignment.submission.marks}/{assignment.totalMarks}</p>{assignment.submission.feedback&&<p className="mt-1 text-xs leading-5 text-[#77827e]">{assignment.submission.feedback}</p>}</div>}<Button className="mt-4 w-full" onClick={()=>openAssignment(assignment)}>{assignment.submission?.status==="REVIEWED"?"View feedback":assignment.submission?"Edit submission":"View & submit"} <ArrowRight size={13}/></Button></Card>)}</div>{!data.assignments.length&&<Card className="py-12 text-center text-sm text-[#909a92]">No assignments have been shared with your enrolled batches.</Card>}
    {selected&&<AppModal title={selected.title} onClose={()=>setSelected(null)} footer={<><Button onClick={()=>setSelected(null)}>Close</Button>{selected.submission?.status!=="REVIEWED"&&<Button variant="primary" disabled={saving} onClick={()=>void submitAssignment()}>{saving?"Submitting…":selected.submission?"Update submission":"Submit assignment"}</Button>}</>}><p className="text-xs text-[#87918a]">{selected.batch.course.subject} · Due {new Date(selected.dueDate).toLocaleString()}</p><div className="mt-4 rounded-xl bg-[#f6f8f4] p-4"><p className="text-xs font-semibold">Instructions</p><p className="mt-2 whitespace-pre-wrap text-xs leading-5 text-[#77827e]">{selected.instructions}</p></div>{selected.submission?.status==="REVIEWED"&&<div className="mt-4 rounded-xl bg-[#edf4e9] p-4"><p className="text-xs font-semibold">Your result: {selected.submission.marks}/{selected.totalMarks}</p><p className="mt-2 whitespace-pre-wrap text-xs leading-5 text-[#77827e]">{selected.submission.feedback||"No additional feedback was provided."}</p></div>}<label className="mt-4 block text-xs font-medium">Your submission<textarea value={submissionContent} onChange={event=>setSubmissionContent(event.target.value)} disabled={selected.submission?.status==="REVIEWED"} rows={8} maxLength={50000} placeholder="Write or paste your work here…" className="field mt-1.5 resize-y"/></label></AppModal>}
  </div>;
}

function LessonsPage({toast}: {toast:(s:string)=>void}) {
  const {data:lessonData,refresh:refreshLessons}=useApiResource<TrainerLessonsData>("/api/trainer/lessons");
  const {data:batchData}=useApiResource<TrainerBatchesData>("/api/trainer/batches");
  const [draft,setDraft]=usePersistedState("myaiguru-lesson-draft",{
    title:"Understanding quadratic equations",subject:"Mathematics",topic:"Quadratic equations",level:"Intermediate",
    objectives:"Recognize quadratic expressions\nSolve equations by factoring\nCheck solutions by substitution",
    outline:"1. Warm-up: patterns in number sequences\n2. Introduce the standard form ax² + bx + c = 0\n3. Guided example: factoring and checking\n4. Independent practice and reflection",
  });
  const {title,subject,topic,level,objectives,outline}=draft;
  const [materials,setMaterials]=usePersistedState("myaiguru-lesson-materials",["Worked example sheet","Practice: factorising expressions","Exit ticket — one-minute reflection"]);
  const [saved,setSavedState]=useState(true);
  const [preview,setPreview]=useState(false);
  const [selectedLessonId,setSelectedLessonId]=useState("");
  const [saving,setSaving]=useState(false);
  useEffect(()=>{
    const lesson=lessonData?.lessons[0];
    if(!lesson||selectedLessonId)return;
    setSelectedLessonId(lesson.id);
    setDraft(readLessonDraft(lesson));
    setMaterials(readLessonMaterials(lesson.content));
  },[lessonData,selectedLessonId,setDraft,setMaterials]);
  async function saveLesson(){
    const course=batchData?.batches.find(batch=>batch.course.subject===draft.subject)?.course;
    if(!course){toast("No matching course is available in your assigned batches.");return;}
    setSaving(true);
    try{
      const current=lessonData?.lessons.find(lesson=>lesson.id===selectedLessonId);
      const existing=current?.title===draft.title?current:lessonData?.lessons.find(lesson=>lesson.title===draft.title&&lesson.courseId===course.id);
      const response=await fetch(existing?`/api/trainer/lessons/${existing.id}`:"/api/trainer/lessons",{
        method:existing?"PATCH":"POST",
        headers:{"Content-Type":"application/json"},
        body:JSON.stringify({
          title:draft.title,description:draft.topic||draft.title,
          content:JSON.stringify({objectives:draft.objectives,outline:draft.outline,materials,level:draft.level}),
          courseId:course.id,order:existing?.order??(lessonData?.lessons.filter(lesson=>lesson.courseId===course.id).length??0)+1,
          duration:existing?.duration??45,
        }),
      });
      const result=await response.json();
      if(!response.ok)throw new Error(result.error?.message??"Could not save this lesson.");
      setSelectedLessonId(result.lesson.id);
      setSavedState(true);
      refreshLessons();
      toast(existing?"Lesson updated.":"Lesson created.");
    }catch(error){toast(error instanceof Error?error.message:"Could not save this lesson.");}
    finally{setSaving(false);}
  }
  function setSaved(value:boolean){if(value)void saveLesson();else setSavedState(false);}
  function edit(field:"title"|"topic"|"objectives"|"outline"){return (e:React.ChangeEvent<HTMLInputElement|HTMLTextAreaElement>)=>{setDraft({...draft,[field]:e.target.value});setSaved(false);};}
  return <div className="space-y-5"><div className="flex flex-wrap items-end justify-between gap-3"><div><p className="text-xs font-semibold uppercase tracking-[.12em] text-[#789073]">Plan a thoughtful learning moment</p><h1 className="mt-2 text-3xl font-semibold tracking-[-.04em]">Lesson planner</h1><p className="mt-2 text-sm text-[#87918a]">Shape a lesson that meets your learners where they are.</p></div><div className="flex gap-2"><Button onClick={()=>setSaved(true)}>{saving?"Saving…":saved?<><Check size={14}/> Saved</>:<><FileText size={14}/> Save draft</>}</Button><Button variant="primary" onClick={()=>setPreview(true)}>Preview lesson <ArrowRight size={14}/></Button></div></div>
    <div className="grid gap-5 lg:grid-cols-[.85fr_1.15fr]"><div className="space-y-5"><Card><Heading title="Lesson details" subtitle="Start with the essentials"/><label className="mb-4 block text-xs font-medium">Lesson title<input value={title} onChange={edit("title")} className="field mt-1.5"/></label><div className="grid grid-cols-2 gap-3"><label className="text-xs font-medium">Subject<select value={subject} onChange={e=>{setDraft({...draft,subject:e.target.value});setSaved(false);}} className="field mt-1.5">{studentSubjects.map(s=><option key={s.id}>{s.name}</option>)}</select></label><label className="text-xs font-medium">Learner level<select value={level} onChange={e=>{setDraft({...draft,level:e.target.value});setSaved(false);}} className="field mt-1.5">{["Foundations","Intermediate","Advanced"].map(s=><option key={s}>{s}</option>)}</select></label></div><label className="mt-4 block text-xs font-medium">Topic<input value={topic} onChange={edit("topic")} className="field mt-1.5"/></label></Card><Card><Heading title="Learning objectives" subtitle="What will learners be able to do?"/><textarea rows={5} value={objectives} onChange={edit("objectives")} className="field resize-y leading-6"/></Card></div><div className="space-y-5"><Card><Heading title="Lesson outline" subtitle="Keep the flow clear and engaging"/><textarea rows={12} value={outline} onChange={edit("outline")} className="field resize-y leading-7"/></Card><Card><Heading title="Learning materials" subtitle="Helpful supporting resources"/>{materials.map((item,i)=><div key={item} className="flex items-center gap-3 border-b border-[#eff1ed] py-3 last:border-0"><span className={cx("grid h-8 w-8 place-items-center rounded-lg",i===0?"bg-[#eaf2e6] text-[#60815c]":"bg-[#fff0e5] text-[#b77d5f]")}><FileText size={15}/></span><span className="flex-1 text-xs font-medium">{item}</span><button aria-label={`Remove ${item}`} onClick={()=>{setMaterials(materials.filter(material=>material!==item));setSaved(false);}} className="text-[#a2aaa3] hover:text-[#b97565]"><X size={14}/></button></div>)}<Button className="mt-3 w-full" onClick={()=>{setMaterials([...materials,`New learning material ${materials.length+1}`]);setSaved(false);}}><Plus size={14}/> Add material</Button></Card></div></div>
    {preview&&<AppModal title="Lesson preview" onClose={()=>setPreview(false)} footer={<Button variant="primary" onClick={()=>setPreview(false)}>Looks good</Button>}><div className="rounded-2xl bg-gradient-to-br from-[#edf4e5] to-[#f7e9dc] p-5"><p className="text-[10px] font-semibold uppercase tracking-[.12em] text-[#71856a]">{subject} · {level}</p><h2 className="mt-2 text-xl font-semibold">{title}</h2><p className="mt-1 text-xs text-[#7f8a7c]">{topic}</p></div><h3 className="mt-5 text-sm font-semibold">Learning objectives</h3><p className="mt-2 whitespace-pre-line text-xs leading-6 text-[#758078]">{objectives}</p><h3 className="mt-4 text-sm font-semibold">Lesson outline</h3><p className="mt-2 whitespace-pre-line text-xs leading-6 text-[#758078]">{outline}</p></AppModal>}
  </div>;
}

function EmptyPage({section,role,toast}: {section:string;role:Role;toast:(s:string)=>void}) {
  return <div className="grid min-h-[55vh] place-items-center"><Card className="max-w-lg text-center"><span className="mx-auto grid h-12 w-12 place-items-center rounded-2xl bg-[#eaf2e6] text-[#60815c]"><Sparkles size={20}/></span><h1 className="mt-5 text-2xl font-semibold capitalize">{section.replaceAll("-"," ")} overview</h1><p className="mx-auto mt-2 max-w-sm text-sm leading-6 text-[#89938b]">Your {role} workspace is ready. This demo view brings the key information together in one place.</p><Button variant="primary" className="mt-5" onClick={()=>toast("This demo view is ready to explore.")}>Explore overview <ArrowRight size={14}/></Button></Card></div>;
}

export default function Platform({role:roleParam,section}:Props) {
  const router=useRouter();
  const [ready,setReady]=useState(false);
  const [role,setRole]=useState<Role>("student");
  const [user,setUser]=useState("Olivia Parker");
  const [loadError,setLoadError]=useState("");
  const [toastMessage,setToastMessage]=useState("");
  const [history,setHistory]=usePersistedState<ChatMessage[][]>("myaiguru-chat", [[],[]]);
  const path=usePathname();
  useEffect(()=>{
    let active=true;
    async function loadProfile(){
      try{
        const response=await fetch("/api/me",{cache:"no-store"});
        const result=await response.json();
        if(!active)return;
        if(response.status===401){router.replace("/login");setReady(true);return;}
        if(!response.ok)throw new Error(result.error?.message??"Could not verify your account.");
        const accountRole=result.user.role as string;
        if(accountRole!=="ADMIN"&&accountRole.toLowerCase()!==roleParam){router.replace(`/${accountRole.toLowerCase()}/dashboard`);return;}
        setRole(accountRole==="ADMIN"?(roleParam==="trainer"?"trainer":"student"):accountRole.toLowerCase() as Role);
        setUser(result.user.fullName);
        setReady(true);
      }catch(error){
        if(!active)return;
        setLoadError(error instanceof Error?error.message:"Could not verify your account.");
        setReady(true);
      }
    }
    void loadProfile();
    return ()=>{active=false;};
  },[roleParam,router]);
  const toast=(message:string)=>{setToastMessage(message);window.setTimeout(()=>setToastMessage(""),2800);};
  const viewSubject=(id:string)=>{localStorage.setItem("myaiguru-selected-subject",id);router.push("/student/subjects");};
  const navTo=(target:string)=>router.push(`/${role}/${target}`);
  if(!ready)return <main className="grid min-h-screen place-items-center text-sm text-[#849087]">Loading your workspace…</main>;
  if(loadError)return <main role="alert" className="grid min-h-screen place-items-center px-5 text-center text-sm text-[#849087]"><div><p>{loadError}</p><button className="mt-4 underline" onClick={()=>signOut({redirectTo:"/login"})}>Return to sign in</button></div></main>;
  if(roleParam!=="student"&&roleParam!=="trainer")return null;
  return <div className="min-h-screen"><TopNavigation role={role} section={section} user={user} onSwitchAccount={()=>{void signOut({redirectTo:"/login"});}} onLogout={()=>{void signOut({redirectTo:"/login"});}}/><main className="mx-auto max-w-[1440px] px-4 pb-14 pt-5 sm:px-7 lg:px-10"><AnimatePresence mode="wait"><motion.div key={path} initial={{opacity:0,y:8}} animate={{opacity:1,y:0}} exit={{opacity:0,y:-5}} transition={{duration:.22}}>{section==="dashboard"?(role==="student"?<StudentDashboard toast={toast} user={user} onViewSubject={viewSubject} onViewAssignments={()=>navTo("assignments")}/>:<TrainerDashboard toast={toast} user={user} onViewBatch={(id)=>{if(id)localStorage.setItem("myaiguru-selected-batch",id);navTo("batches");}} onViewAssignments={()=>navTo("assignments")}/>):null}{section==="subjects"&&role==="student"&&<SubjectsPage toast={toast}/ >}{section==="assistant"&&role==="student"&&<AssistantPage toast={toast} history={history} setHistory={setHistory}/ >}{section==="planner"&&role==="student"&&<PlannerPage toast={toast}/ >}{section==="reports"&&<ReportsPage role={role}/ >}{section==="batches"&&role==="trainer"&&<BatchesPage toast={toast}/ >}{section==="students"&&role==="trainer"&&<StudentsPage/>}{section==="assignments"&&role==="trainer"&&<AssignmentsPage toast={toast}/ >}{section==="assignments"&&role==="student"&&<StudentAssignmentsPage toast={toast}/ >}{section==="lessons"&&role==="trainer"&&<LessonsPage toast={toast}/ >}{!["dashboard","subjects","assistant","planner","reports","batches","students","assignments","lessons"].includes(section)&&<EmptyPage section={section} role={role} toast={toast}/ >}{role==="student"&&["batches","students","lessons"].includes(section)&&<EmptyPage section={section} role={role} toast={toast}/ >}{role==="trainer"&&["subjects","assistant","planner"].includes(section)&&<EmptyPage section={section} role={role} toast={toast}/ >}</motion.div></AnimatePresence></main><footer className="mx-auto max-w-[1440px] px-4 pb-7 text-center text-[10px] text-[#a2aaa3] sm:px-7 lg:px-10">MYAIGURU · A calmer way to learn and teach</footer><AnimatePresence>{toastMessage&&<motion.div initial={{opacity:0,y:12}} animate={{opacity:1,y:0}} exit={{opacity:0,y:8}} className="fixed bottom-5 left-1/2 z-[100] flex -translate-x-1/2 items-center gap-2 rounded-xl bg-[#20221f] px-4 py-3 text-xs font-medium text-white shadow-lg"><CheckCircle2 size={15}/>{toastMessage}</motion.div>}</AnimatePresence></div>;
}
