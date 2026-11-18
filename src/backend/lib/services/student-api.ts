import { Prisma, SubmissionStatus } from "@prisma/client";
import { NextResponse } from "next/server";
import { requireUser } from "@/backend/lib/auth/access";
import { ApiError, errorResponse, readJson } from "@/backend/lib/api/errors";
import { prisma } from "@/backend/lib/db/prisma";
import { idSchema, studySessionSchema, submissionSchema } from "@/backend/lib/validations/education";

function routeParts(request: Request) {
  return new URL(request.url).pathname.split("/").filter(Boolean).slice(2);
}

function getCourseIds(batches: { courseId: string }[]) {
  return [...new Set(batches.map((batch) => batch.courseId))];
}

export async function handleStudentApi(request: Request) {
  try {
    const user = await requireUser(["STUDENT"]);
    const [resource, id, action] = routeParts(request);
    const { method } = request;

    if (resource === "dashboard" && method === "GET") {
      const [enrollments, sessions, results, notifications, attendanceCount, attendancePresent] = await Promise.all([
        prisma.enrollment.findMany({
          where: { studentId: user.id, status: "ACTIVE" },
          include: { batch: { include: { course: { include: { lessons: { orderBy: { order: "asc" } } } }, trainer: { select: { fullName: true } } } } },
        }),
        prisma.studySession.findMany({ where: { studentId: user.id }, orderBy: { startTime: "desc" }, take: 100 }),
        prisma.quizResult.findMany({
          where: { studentId: user.id },
          include: { quiz: { include: { course: { select: { id: true, subject: true } } } } },
          orderBy: { completedAt: "asc" },
        }),
        prisma.notification.findMany({ where: { userId: user.id }, orderBy: { createdAt: "desc" }, take: 10 }),
        prisma.attendance.count({ where: { studentId: user.id } }),
        prisma.attendance.count({ where: { studentId: user.id, status: { in: ["PRESENT", "LATE"] } } }),
      ]);
      const batchIds = enrollments.map(({ batch }) => batch.id);
      const [assignments, progress] = await Promise.all([
        prisma.assignment.findMany({
          where: { batchId: { in: batchIds } },
          include: { submissions: { where: { studentId: user.id }, select: { id: true, status: true, marks: true, feedback: true } }, batch: { select: { name: true, course: { select: { subject: true } } } } },
          orderBy: { dueDate: "asc" },
        }),
        prisma.learningProgress.findMany({ where: { studentId: user.id } }),
      ]);

      const courses = enrollments.map(({ batch }) => {
        const courseProgress = progress.find((item) => item.courseId === batch.courseId);
        const courseResults = results.filter((item) => item.quiz.course.id === batch.courseId);
        const score = courseResults.length
          ? Math.round(courseResults.reduce((total, item) => total + item.score, 0) / courseResults.length)
          : 0;
        const nextLesson = batch.course.lessons.find((lesson) => lesson.order > (courseProgress?.completedLessons ?? 0));
        return {
          id: batch.course.id,
          name: batch.course.subject,
          title: batch.course.title,
          teacher: batch.trainer.fullName,
          batchId: batch.id,
          endDate: batch.endDate,
          progress: courseProgress?.progressPercentage ?? 0,
          score,
          next: nextLesson?.title ?? "All lessons completed",
          time: null,
        };
      });

      const startOfMonth = new Date();
      startOfMonth.setDate(1);
      startOfMonth.setHours(0, 0, 0, 0);
      const studyThisMonth = sessions.filter((session) => session.startTime >= startOfMonth);
      const studyHours = studyThisMonth.reduce((sum, session) => sum + (session.endTime.getTime() - session.startTime.getTime()), 0) / 3600000;
      const scoreBySubject = new Map<string, number[]>();
      for (const result of results) {
        const current = scoreBySubject.get(result.quiz.course.subject) ?? [];
        current.push(result.score);
        scoreBySubject.set(result.quiz.course.subject, current);
      }
      const performanceTrend = Array.from({ length: 6 }, (_, index) => {
        const periodEnd = new Date();
        periodEnd.setDate(periodEnd.getDate() - (5 - index) * 7);
        const periodStart = new Date(periodEnd);
        periodStart.setDate(periodStart.getDate() - 7);
        const point: Record<string, string | number | null> = { name: `Week ${index + 1}` };
        for (const subject of scoreBySubject.keys()) {
          const scores = results.filter((result) =>
            result.quiz.course.subject === subject &&
            result.completedAt >= periodStart &&
            result.completedAt < periodEnd,
          );
          point[subject] = scores.length
            ? Math.round(scores.reduce((sum, result) => sum + result.score, 0) / scores.length)
            : null;
        }
        return point;
      });
      const studyBySubject = new Map<string, number>();
      for (const session of studyThisMonth) {
        const duration = (session.endTime.getTime() - session.startTime.getTime()) / 3600000;
        studyBySubject.set(session.subject, (studyBySubject.get(session.subject) ?? 0) + duration);
      }

      return NextResponse.json({
        user,
        metrics: {
          overallProgress: courses.length ? Math.round(courses.reduce((sum, course) => sum + course.progress, 0) / courses.length) : 0,
          assignmentCompletion: assignments.length ? Math.round((assignments.filter((item) => item.submissions[0]?.status === "REVIEWED").length / assignments.length) * 100) : 0,
          attendance: attendanceCount ? Math.round((attendancePresent / attendanceCount) * 100) : 0,
          studyHours: Math.round(studyHours * 10) / 10,
          learningDays: new Set(studyThisMonth.map((session) => session.startTime.toDateString())).size,
          quizAverage: results.length ? Math.round(results.reduce((sum, item) => sum + item.score, 0) / results.length) : 0,
        },
        courses,
        subjectPerformance: [...scoreBySubject.entries()].map(([subject, scores]) => ({
          subject,
          score: Math.round(scores.reduce((sum, score) => sum + score, 0) / scores.length),
          attempts: scores.length,
        })),
        performanceTrend,
        studyBySubject: [...studyBySubject.entries()].map(([subject, hours]) => ({ subject, hours: Math.round(hours * 10) / 10 })),
        studySessions: sessions,
        assignments: assignments.map((item) => ({
          id: item.id,
          title: item.title,
          subject: item.batch.course.subject,
          dueDate: item.dueDate,
          status: item.submissions[0]?.status ?? "NOT_SUBMITTED",
          marks: item.submissions[0]?.marks ?? null,
          feedback: item.submissions[0]?.feedback ?? null,
        })),
        quizResults: results.map((item) => ({ id: item.id, title: item.quiz.title, subject: item.quiz.course.subject, score: item.score, completedAt: item.completedAt })),
        notifications,
      });
    }

    if (resource === "courses" && method === "GET" && !id) {
      const enrollments = await prisma.enrollment.findMany({
        where: { studentId: user.id, status: "ACTIVE" },
        include: { batch: { include: { course: { include: { lessons: { orderBy: { order: "asc" } } } }, trainer: { select: { fullName: true } } } } },
      });
      const progress = await prisma.learningProgress.findMany({ where: { studentId: user.id } });
      return NextResponse.json({
        courses: enrollments.map(({ batch }) => ({
          ...batch.course,
          batchId: batch.id,
          trainer: batch.trainer,
          progress: progress.find((row) => row.courseId === batch.courseId) ?? null,
        })),
      });
    }

    if (resource === "courses" && id && method === "GET") {
      const courseId = idSchema.parse(id);
      const enrollment = await prisma.enrollment.findFirst({
        where: { studentId: user.id, status: "ACTIVE", batch: { courseId } },
        include: { batch: { include: { course: { include: { lessons: { orderBy: { order: "asc" } } } }, trainer: { select: { fullName: true } } } } },
      });
      if (!enrollment) throw new ApiError(404, "NOT_FOUND", "Course not found.");
      const progress = await prisma.learningProgress.findUnique({ where: { studentId_courseId: { studentId: user.id, courseId } } });
      return NextResponse.json({ course: enrollment.batch.course, batch: enrollment.batch, trainer: enrollment.batch.trainer, progress });
    }

    if (resource === "progress" && method === "GET") {
      const progress = await prisma.learningProgress.findMany({
        where: { studentId: user.id, courseId: { in: getCourseIds(await prisma.batch.findMany({ where: { enrollments: { some: { studentId: user.id, status: "ACTIVE" } }, status: "ACTIVE" }, select: { courseId: true } })) } },
        include: { course: { select: { id: true, title: true, subject: true } } },
        orderBy: { updatedAt: "desc" },
      });
      return NextResponse.json({ progress });
    }

    if (resource === "attendance" && method === "GET") {
      const records = await prisma.attendance.findMany({
        where: { studentId: user.id },
        include: { batch: { select: { name: true } } },
        orderBy: { date: "desc" },
        take: 180,
      });
      return NextResponse.json({ attendance: records });
    }

    if (resource === "assignments" && method === "GET" && !id) {
      const enrollments = await prisma.enrollment.findMany({ where: { studentId: user.id, status: "ACTIVE" }, select: { batchId: true } });
      const assignments = await prisma.assignment.findMany({
        where: { batchId: { in: enrollments.map((item) => item.batchId) } },
        include: { batch: { select: { name: true, course: { select: { subject: true } } } }, submissions: { where: { studentId: user.id } } },
        orderBy: { dueDate: "asc" },
      });
      return NextResponse.json({ assignments: assignments.map((item) => ({ ...item, submission: item.submissions[0] ?? null, submissions: undefined })) });
    }

    if (resource === "assignments" && id && !action && method === "GET") {
      const assignmentId = idSchema.parse(id);
      const assignment = await prisma.assignment.findFirst({
        where: { id: assignmentId, batch: { enrollments: { some: { studentId: user.id, status: "ACTIVE" } } } },
        include: { batch: { select: { name: true, course: { select: { subject: true } } } }, submissions: { where: { studentId: user.id } } },
      });
      if (!assignment) throw new ApiError(404, "NOT_FOUND", "Assignment not found.");
      return NextResponse.json({ assignment: { ...assignment, submission: assignment.submissions[0] ?? null, submissions: undefined } });
    }

    if (resource === "assignments" && id && action === "submit" && method === "POST") {
      const assignmentId = idSchema.parse(id);
      const data = await readJson(request, submissionSchema);
      const assignment = await prisma.assignment.findFirst({
        where: { id: assignmentId, batch: { enrollments: { some: { studentId: user.id, status: "ACTIVE" } } } },
        select: { id: true, dueDate: true },
      });
      if (!assignment) throw new ApiError(404, "NOT_FOUND", "Assignment not found.");
      const existing = await prisma.submission.findUnique({ where: { assignmentId_studentId: { assignmentId, studentId: user.id } } });
      if (existing?.status === SubmissionStatus.REVIEWED) throw new ApiError(409, "ALREADY_REVIEWED", "This assignment has already been reviewed.");
      const submission = await prisma.submission.upsert({
        where: { assignmentId_studentId: { assignmentId, studentId: user.id } },
        update: { submissionContent: data.submissionContent, submittedAt: new Date(), status: "SUBMITTED", marks: null, feedback: null, reviewedAt: null },
        create: { assignmentId, studentId: user.id, submissionContent: data.submissionContent },
      });
      return NextResponse.json({ submission }, { status: existing ? 200 : 201 });
    }

    if (resource === "quiz-results" && method === "GET") {
      const results = await prisma.quizResult.findMany({
        where: {
          studentId: user.id,
          quiz: {
            course: {
              batches: {
                some: { enrollments: { some: { studentId: user.id, status: "ACTIVE" } } },
              },
            },
          },
        },
        include: { quiz: { include: { course: { select: { id: true, title: true, subject: true } } } } },
        orderBy: { completedAt: "desc" },
      });
      return NextResponse.json({ results });
    }

    if (resource === "sessions" && method === "GET" && !id) {
      const sessions = await prisma.studySession.findMany({ where: { studentId: user.id }, orderBy: { startTime: "asc" } });
      return NextResponse.json({ sessions });
    }

    if (resource === "sessions" && method === "POST" && !id) {
      const data = await readJson(request, studySessionSchema);
      const session = await prisma.studySession.create({
        data: { ...data, studentId: user.id, completed: data.completed ?? false },
      });
      return NextResponse.json({ session }, { status: 201 });
    }

    if (resource === "sessions" && id && method === "PATCH") {
      const sessionId = idSchema.parse(id);
      const data = await readJson(request, studySessionSchema.partial().refine(
        (value) => value.startTime === undefined || value.endTime === undefined || value.endTime > value.startTime,
        { path: ["endTime"], message: "End time must be after start time." },
      ));
      const existing = await prisma.studySession.findFirst({ where: { id: sessionId, studentId: user.id }, select: { id: true, startTime: true, endTime: true } });
      if (!existing) throw new ApiError(404, "NOT_FOUND", "Study session not found.");
      const startTime = data.startTime ?? existing.startTime;
      const endTime = data.endTime ?? existing.endTime;
      if (endTime <= startTime) throw new ApiError(400, "INVALID_TIME_RANGE", "End time must be after start time.");
      const session = await prisma.studySession.update({ where: { id: sessionId }, data });
      return NextResponse.json({ session });
    }

    if (resource === "sessions" && id && method === "DELETE") {
      const sessionId = idSchema.parse(id);
      const deleted = await prisma.studySession.deleteMany({ where: { id: sessionId, studentId: user.id } });
      if (!deleted.count) throw new ApiError(404, "NOT_FOUND", "Study session not found.");
      return new NextResponse(null, { status: 204 });
    }

    if (resource === "notifications" && method === "GET") {
      const notifications = await prisma.notification.findMany({ where: { userId: user.id }, orderBy: { createdAt: "desc" }, take: 100 });
      return NextResponse.json({ notifications });
    }

    if (resource === "notifications" && id && action === "read" && method === "PATCH") {
      const notificationId = idSchema.parse(id);
      const updated = await prisma.notification.updateMany({ where: { id: notificationId, userId: user.id }, data: { isRead: true } });
      if (!updated.count) throw new ApiError(404, "NOT_FOUND", "Notification not found.");
      return NextResponse.json({ success: true });
    }

    throw new ApiError(404, "NOT_FOUND", "API endpoint not found.");
  } catch (error) {
    if (error instanceof Prisma.PrismaClientKnownRequestError && error.code === "P2025") {
      return errorResponse(new ApiError(404, "NOT_FOUND", "The requested resource was not found."));
    }
    return errorResponse(error);
  }
}
