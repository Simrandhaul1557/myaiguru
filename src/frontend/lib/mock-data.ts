export type Role = "student" | "trainer";

export const studentSubjects = [
  { id: "math", name: "Mathematics", teacher: "Daniel Kim", color: "mint", progress: 78, next: "Quadratic equations", time: "Today · 2:30 PM", score: 86 },
  { id: "english", name: "English", teacher: "Emily Carter", color: "peach", progress: 64, next: "Persuasive writing", time: "Tomorrow · 10:00 AM", score: 92 },
  { id: "physics", name: "Physics", teacher: "Alex Morgan", color: "yellow", progress: 52, next: "Forces & motion", time: "Wed · 1:15 PM", score: 74 },
  { id: "biology", name: "Biology", teacher: "Priya Shah", color: "coral", progress: 89, next: "Cellular energy", time: "Thu · 11:30 AM", score: 88 },
];

export const studentPerformance = [
  { name: "Week 1", English: 68, Mathematics: 55, Physics: 62 },
  { name: "Week 2", English: 72, Mathematics: 61, Physics: 60 },
  { name: "Week 3", English: 70, Mathematics: 59, Physics: 68 },
  { name: "Week 4", English: 78, Mathematics: 68, Physics: 65 },
  { name: "Week 5", English: 81, Mathematics: 73, Physics: 71 },
  { name: "Week 6", English: 86, Mathematics: 82, Physics: 77 },
];

export const activities = [
  { id: "a1", title: "Algebra practice set", type: "Assignment", subject: "Mathematics", time: "Today · 4:00 PM", done: false },
  { id: "a2", title: "Persuasive writing", type: "Lesson", subject: "English", time: "Tomorrow · 10:00 AM", done: false },
  { id: "a3", title: "Forces & motion quiz", type: "Quiz", subject: "Physics", time: "Wed · 9:00 AM", done: false },
  { id: "a4", title: "Read chapter 6", type: "Study reminder", subject: "Biology", time: "Thu · 5:30 PM", done: true },
];

export const batches = [
  { id: "b1", name: "Foundations · Batch A", learners: 28, attendance: 94, score: 82, next: "Today · 2:00 PM", color: "mint" },
  { id: "b2", name: "Intermediate · Batch B", learners: 24, attendance: 88, score: 76, next: "Today · 4:30 PM", color: "peach" },
  { id: "b3", name: "Advanced · Batch C", learners: 32, attendance: 79, score: 71, next: "Tomorrow · 10:00 AM", color: "yellow" },
  { id: "b4", name: "Foundations · Batch D", learners: 21, attendance: 91, score: 85, next: "Wed · 1:00 PM", color: "coral" },
];

export const students = [
  { id: "s1", name: "Olivia Parker", batch: "Batch A", attendance: 96, progress: 88, score: 91, status: "On track" },
  { id: "s2", name: "Ethan Brooks", batch: "Batch A", attendance: 82, progress: 61, score: 68, status: "Needs support" },
  { id: "s3", name: "Ava Thompson", batch: "Batch B", attendance: 98, progress: 94, score: 95, status: "On track" },
  { id: "s4", name: "Noah Williams", batch: "Batch C", attendance: 73, progress: 54, score: 62, status: "Needs support" },
  { id: "s5", name: "Mia Chen", batch: "Batch D", attendance: 91, progress: 78, score: 84, status: "On track" },
  { id: "s6", name: "Liam Patel", batch: "Batch B", attendance: 87, progress: 72, score: 78, status: "On track" },
];

export const trainerPerformance = [
  { name: "Week 1", "Batch A": 68, "Batch B": 62, "Batch C": 57, "Batch D": 72 },
  { name: "Week 2", "Batch A": 71, "Batch B": 65, "Batch C": 58, "Batch D": 75 },
  { name: "Week 3", "Batch A": 74, "Batch B": 69, "Batch C": 63, "Batch D": 76 },
  { name: "Week 4", "Batch A": 79, "Batch B": 70, "Batch C": 65, "Batch D": 81 },
  { name: "Week 5", "Batch A": 83, "Batch B": 75, "Batch C": 69, "Batch D": 83 },
  { name: "Week 6", "Batch A": 87, "Batch B": 79, "Batch C": 73, "Batch D": 88 },
];

export const assignments = [
  { id: "as1", title: "Algebra: practice set 04", subject: "Mathematics", batch: "Batch A", student: "Ethan Brooks", submitted: "Today, 9:42 AM", status: "Pending", marks: "", feedback: "" },
  { id: "as2", title: "A persuasive argument", subject: "English", batch: "Batch B", student: "Ava Thompson", submitted: "Today, 8:16 AM", status: "Pending", marks: "", feedback: "" },
  { id: "as3", title: "Motion lab report", subject: "Physics", batch: "Batch C", student: "Noah Williams", submitted: "Yesterday", status: "Pending", marks: "", feedback: "" },
  { id: "as4", title: "Cell structure worksheet", subject: "Biology", batch: "Batch D", student: "Mia Chen", submitted: "Yesterday", status: "Reviewed", marks: "18", feedback: "Clear observations. Add units to your diagrams." },
  { id: "as5", title: "Fractions challenge", subject: "Mathematics", batch: "Batch A", student: "Liam Patel", submitted: "Oct 12", status: "Reviewed", marks: "20", feedback: "Great work—excellent reasoning." },
];

export const notifications = [
  { title: "New assignment submitted", description: "Ava submitted A persuasive argument", when: "12 min ago", color: "#eaf1dd" },
  { title: "Your study streak is 8 days!", description: "You're building a lovely habit.", when: "1 hour ago", color: "#fff0e4" },
  { title: "Lesson starting soon", description: "Mathematics · Quadratic equations", when: "3 hours ago", color: "#fff6d8" },
];
