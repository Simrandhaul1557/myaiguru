import { z } from "zod";

export const idSchema = z.string().trim().min(1).max(64);

export const submissionSchema = z.object({
  submissionContent: z.string().trim().min(1).max(50000),
});

export const studySessionSchema = z.object({
  subject: z.string().trim().min(1).max(80),
  title: z.string().trim().min(2).max(160),
  startTime: z.coerce.date(),
  endTime: z.coerce.date(),
  completed: z.boolean().optional(),
}).refine((value) => value.endTime > value.startTime, {
  path: ["endTime"],
  message: "End time must be after start time.",
});

export const assignmentSchema = z.object({
  title: z.string().trim().min(2).max(160),
  description: z.string().trim().min(1).max(2000),
  instructions: z.string().trim().min(1).max(20000),
  batchId: idSchema,
  dueDate: z.coerce.date(),
  totalMarks: z.number().int().min(1).max(10000),
});

export const reviewSchema = z.object({
  marks: z.number().int().min(0),
  feedback: z.string().trim().max(10000),
});

export const attendanceSchema = z.object({
  batchId: idSchema,
  date: z.coerce.date(),
  records: z.array(z.object({
    studentId: idSchema,
    status: z.enum(["PRESENT", "ABSENT", "LATE", "EXCUSED"]),
  })).min(1).max(250),
});

export const lessonSchema = z.object({
  title: z.string().trim().min(2).max(160),
  description: z.string().trim().min(1).max(2000),
  content: z.string().trim().min(1).max(50000),
  courseId: idSchema,
  order: z.number().int().min(1),
  duration: z.number().int().min(1).max(1440),
});

export const courseSchema = z.object({
  title: z.string().trim().min(2).max(160),
  description: z.string().trim().min(1).max(2000),
  subject: z.string().trim().min(1).max(80),
  level: z.string().trim().min(1).max(80),
  duration: z.number().int().min(1).max(10000),
});

export const batchSchema = z.object({
  name: z.string().trim().min(2).max(120),
  description: z.string().trim().min(1).max(2000),
  courseId: idSchema,
  trainerId: idSchema,
  startDate: z.coerce.date(),
  endDate: z.coerce.date(),
  status: z.enum(["PLANNED", "ACTIVE", "COMPLETED", "ARCHIVED"]).optional(),
}).refine((value) => value.endDate > value.startDate, {
  path: ["endDate"],
  message: "End date must be after start date.",
});

export const userAdminSchema = z.object({
  fullName: z.string().trim().min(2).max(100),
  email: z.string().trim().email().max(254).transform((value) => value.toLowerCase()),
  role: z.enum(["STUDENT", "TRAINER", "ADMIN"]),
  password: z.string().min(10).max(128).optional(),
});
