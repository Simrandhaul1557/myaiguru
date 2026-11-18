import { Prisma } from "@prisma/client";
import { NextResponse } from "next/server";
import { requireUser } from "@/backend/lib/auth/access";
import { ApiError, errorResponse, readJson } from "@/backend/lib/api/errors";
import { prisma } from "@/backend/lib/db/prisma";
import {
  assignmentSchema, attendanceSchema, idSchema, lessonSchema, reviewSchema,
} from "@/backend/lib/validations/education";

function routeParts(request: Request) {
  return new URL(request.url).pathname.split("/").filter(Boolean).slice(2);
}

function trainerScope(userId: string, isAdmin: boolean) {
  return isAdmin ? {} : { trainerId: userId };
}

async function findOwnedBatch(batchId: string, userId: string, isAdmin: boolean) {
  const batch = await prisma.batch.findFirst({
    where: { id: batchId, ...trainerScope(userId, isAdmin) },
    include: { course: true },
  });
  if (!batch) throw new ApiError(404, "NOT_FOUND", "Batch not found.");
  return batch;
}

export async function handleTrainerApi(request: Request) {
  try {
    const user = await requireUser(["TRAINER"]);
    const isAdmin = user.role === "ADMIN";
    const scope = trainerScope(user.id, isAdmin);
    const [resource, id, action] = routeParts(request);
    const { method } = request;

    if (resource === "dashboard" && method === "GET") {
      const [assignedBatches, pendingReviews, submissions, attendance, learners, learnerRows, recentSubmissions, quizResults] = await Promise.all([
        prisma.batch.findMany({
          where: { ...scope, status: "ACTIVE" },
          include: {
            course: true,
            enrollments: { where: { status: "ACTIVE" }, include: { student: { select: { id: true, fullName: true } } } },
          },
          orderBy: { startDate: "asc" },
        }),
        prisma.submission.count({ where: { status: "SUBMITTED", assignment: { ...scope } } }),
        prisma.submission.count({ where: { assignment: { ...scope } } }),
        prisma.attendance.groupBy({ by: ["status"], where: { batch: { ...scope } }, _count: { _all: true } }),
        prisma.enrollment.findMany({ where: { status: "ACTIVE", batch: { ...scope } }, select: { studentId: true }, distinct: ["studentId"] }),
        prisma.enrollment.findMany({
          where: { status: "ACTIVE", batch: { ...scope } },
          include: {
            batch: { select: { id: true, name: true, courseId: true } },
            student: { select: { id: true, fullName: true, learningProgress: { select: { courseId: true, progressPercentage: true } } } },
          },
        }),
        prisma.submission.findMany({
          where: { assignment: { ...scope } },
          include: {
            student: { select: { fullName: true } },
            assignment: { include: { batch: { select: { id: true, name: true, course: { select: { subject: true } } } } } },
          },
          orderBy: { submittedAt: "desc" },
          take: 5,
        }),
        prisma.quizResult.findMany({
          where: { quiz: { batch: { ...scope } } },
          include: { quiz: { include: { batch: { select: { id: true, name: true } } } } },
          orderBy: { completedAt: "asc" },
        }),
      ]);
      const attendanceTotal = attendance.reduce((sum, item) => sum + item._count._all, 0);
      const attendancePresent = attendance
        .filter((item) => item.status === "PRESENT" || item.status === "LATE")
        .reduce((sum, item) => sum + item._count._all, 0);

      const batchIds = assignedBatches.map((batch) => batch.id);
      const batchSummaries = await Promise.all(assignedBatches.map(async (batch) => {
        const [attendanceRows, scores] = await Promise.all([
          prisma.attendance.groupBy({ by: ["status"], where: { batchId: batch.id }, _count: { _all: true } }),
          prisma.quizResult.findMany({
            where: { quiz: { batchId: batch.id } },
            select: { score: true },
          }),
        ]);
        const count = attendanceRows.reduce((sum, row) => sum + row._count._all, 0);
        const present = attendanceRows.filter((row) => row.status === "PRESENT" || row.status === "LATE").reduce((sum, row) => sum + row._count._all, 0);
        return {
          id: batch.id,
          name: batch.name,
          subject: batch.course.subject,
          learners: batch.enrollments.length,
          attendance: count ? Math.round((present / count) * 100) : 0,
          score: scores.length ? Math.round(scores.reduce((sum, row) => sum + row.score, 0) / scores.length) : 0,
          startDate: batch.startDate,
          endDate: batch.endDate,
        };
      }));
      const learnerProgress = learnerRows.map(({ student, batch }) => ({
        studentId: student.id,
        name: student.fullName,
        batch: batch.name,
        progress: student.learningProgress.find((row) => row.courseId === batch.courseId)?.progressPercentage ?? 0,
      }));
      const now = new Date();
      const performanceTrend = Array.from({ length: 6 }, (_, index) => {
        const periodEnd = new Date(now);
        periodEnd.setDate(periodEnd.getDate() - (5 - index) * 7);
        const periodStart = new Date(periodEnd);
        periodStart.setDate(periodStart.getDate() - 7);
        const point: Record<string, string | number | null> = { name: `Week ${index + 1}` };
        for (const batch of assignedBatches) {
          const scores = quizResults.filter((result) =>
            result.quiz.batchId === batch.id &&
            result.completedAt >= periodStart &&
            result.completedAt < periodEnd,
          );
          point[batch.name] = scores.length
            ? Math.round(scores.reduce((sum, result) => sum + result.score, 0) / scores.length)
            : null;
        }
        return point;
      });

      return NextResponse.json({
        user,
        metrics: {
          learners: learners.length,
          activeBatches: assignedBatches.length,
          attendance: attendanceTotal ? Math.round((attendancePresent / attendanceTotal) * 100) : 0,
          submissionRate: submissions ? Math.round(((submissions - pendingReviews) / submissions) * 100) : 0,
          pendingReviews,
          averageAssessment: quizResults.length ? Math.round(quizResults.reduce((sum, result) => sum + result.score, 0) / quizResults.length) : 0,
        },
        batches: batchSummaries,
        pendingSubmissions: pendingReviews,
        batchIds,
        performanceTrend,
        learnerDistribution: {
          highPerformers: learnerProgress.filter((row) => row.progress >= 80).length,
          needsSupport: learnerProgress.filter((row) => row.progress < 60).length,
          onTrack: learnerProgress.filter((row) => row.progress >= 60).length,
          total: learnerProgress.length,
        },
        learners: learnerProgress,
        recentSubmissions: recentSubmissions.map(({ id, status, submittedAt, student, assignment }) => ({
          id,
          status,
          submittedAt,
          student: student.fullName,
          title: assignment.title,
          batch: assignment.batch.name,
          subject: assignment.batch.course.subject,
        })),
      });
    }

    if (resource === "batches" && method === "GET" && !id) {
      const batches = await prisma.batch.findMany({
        where: scope,
        include: {
          course: true,
          enrollments: { where: { status: "ACTIVE" }, include: { student: { select: { id: true, fullName: true, email: true } } } },
        },
        orderBy: { startDate: "desc" },
      });
      return NextResponse.json({ batches });
    }

    if (resource === "batches" && id && method === "GET") {
      const batchId = idSchema.parse(id);
      const batch = await findOwnedBatch(batchId, user.id, isAdmin);
      const [enrollments, attendance, assignments] = await Promise.all([
        prisma.enrollment.findMany({
          where: { batchId, status: "ACTIVE" },
          include: {
            student: {
              select: {
                id: true, fullName: true, email: true,
                learningProgress: { where: { courseId: batch.courseId } },
                submissions: { where: { assignment: { batchId } }, select: { status: true, marks: true } },
                attendanceRecords: { where: { batchId }, select: { status: true, date: true } },
              },
            },
          },
        }),
        prisma.attendance.groupBy({ by: ["status"], where: { batchId }, _count: { _all: true } }),
        prisma.assignment.findMany({ where: { batchId }, include: { _count: { select: { submissions: true } } }, orderBy: { dueDate: "asc" } }),
      ]);
      return NextResponse.json({ batch, students: enrollments.map((row) => row.student), attendance, assignments });
    }

    if (resource === "students" && method === "GET" && !id) {
      const enrollments = await prisma.enrollment.findMany({
        where: { status: "ACTIVE", batch: { ...scope } },
        include: {
          batch: { select: { id: true, name: true, courseId: true, course: { select: { title: true, subject: true } } } },
          student: {
            select: {
              id: true, fullName: true, email: true,
              attendanceRecords: { where: { batch: { ...scope } }, select: { status: true } },
              submissions: { where: { assignment: { ...scope } }, select: { status: true, marks: true } },
              learningProgress: true,
            },
          },
        },
        orderBy: { student: { fullName: "asc" } },
      });
      return NextResponse.json({
        students: enrollments.map(({ student, batch }) => ({
          id: student.id,
          fullName: student.fullName,
          email: student.email,
          batch: batch.name,
          course: batch.course,
          attendance: student.attendanceRecords.length
            ? Math.round((student.attendanceRecords.filter((row) => row.status === "PRESENT" || row.status === "LATE").length / student.attendanceRecords.length) * 100)
            : 0,
          progress: student.learningProgress.find((row) => row.courseId === batch.courseId)?.progressPercentage ?? 0,
          submissions: student.submissions,
        })),
      });
    }

    if (resource === "students" && id && method === "GET") {
      const studentId = idSchema.parse(id);
      const enrollment = await prisma.enrollment.findFirst({
        where: { studentId, status: "ACTIVE", batch: { ...scope } },
        include: {
          batch: { include: { course: true } },
          student: {
            select: {
              id: true, fullName: true, email: true,
              attendanceRecords: { where: { batch: { ...scope } }, orderBy: { date: "desc" } },
              submissions: { where: { assignment: { ...scope } }, include: { assignment: { select: { title: true, totalMarks: true } } } },
              quizResults: { where: { quiz: { batch: { ...scope } } }, include: { quiz: { select: { title: true, totalMarks: true } } } },
              learningProgress: true,
            },
          },
        },
      });
      if (!enrollment) throw new ApiError(404, "NOT_FOUND", "Student not found in your assigned batches.");
      return NextResponse.json({ student: enrollment.student, batch: enrollment.batch });
    }

    if (resource === "attendance" && method === "GET") {
      const batchId = new URL(request.url).searchParams.get("batchId");
      if (batchId) await findOwnedBatch(idSchema.parse(batchId), user.id, isAdmin);
      const records = await prisma.attendance.findMany({
        where: { ...(batchId ? { batchId } : {}), batch: { ...scope } },
        include: { student: { select: { id: true, fullName: true } }, batch: { select: { id: true, name: true } } },
        orderBy: { date: "desc" },
        take: 1000,
      });
      return NextResponse.json({ attendance: records });
    }

    if (resource === "attendance" && method === "POST") {
      const data = await readJson(request, attendanceSchema);
      await findOwnedBatch(data.batchId, user.id, isAdmin);
      const studentIds = [...new Set(data.records.map((record) => record.studentId))];
      if (studentIds.length !== data.records.length) throw new ApiError(400, "DUPLICATE_STUDENT", "Only one attendance record per student is allowed.");
      const enrolled = await prisma.enrollment.findMany({
        where: { batchId: data.batchId, status: "ACTIVE", studentId: { in: studentIds } },
        select: { studentId: true },
      });
      if (enrolled.length !== studentIds.length) throw new ApiError(400, "INVALID_ENROLLMENT", "Every student must be actively enrolled in this batch.");
      const date = new Date(data.date);
      date.setUTCHours(0, 0, 0, 0);
      const records = await prisma.$transaction(data.records.map(({ studentId, status }) =>
        prisma.attendance.upsert({
          where: { studentId_batchId_date: { studentId, batchId: data.batchId, date } },
          update: { status, markedBy: user.id },
          create: { studentId, batchId: data.batchId, date, status, markedBy: user.id },
        }),
      ));
      return NextResponse.json({ attendance: records });
    }

    if (resource === "assignments" && method === "GET" && !id) {
      const assignments = await prisma.assignment.findMany({
        where: scope,
        include: {
          batch: { select: { id: true, name: true, course: { select: { subject: true } } } },
          submissions: {
            include: { student: { select: { id: true, fullName: true, email: true } } },
            orderBy: { submittedAt: "desc" },
          },
        },
        orderBy: { dueDate: "asc" },
      });
      return NextResponse.json({ assignments });
    }

    if (resource === "assignments" && method === "POST" && !id) {
      const data = await readJson(request, assignmentSchema);
      await findOwnedBatch(data.batchId, user.id, isAdmin);
      const assignment = await prisma.assignment.create({ data: { ...data, trainerId: user.id } });
      return NextResponse.json({ assignment }, { status: 201 });
    }

    if (resource === "assignments" && id && action === "submissions" && method === "GET") {
      const assignmentId = idSchema.parse(id);
      const assignment = await prisma.assignment.findFirst({ where: { id: assignmentId, ...scope }, select: { id: true } });
      if (!assignment) throw new ApiError(404, "NOT_FOUND", "Assignment not found.");
      const submissions = await prisma.submission.findMany({
        where: { assignmentId },
        include: { student: { select: { id: true, fullName: true, email: true } } },
        orderBy: { submittedAt: "asc" },
      });
      return NextResponse.json({ submissions });
    }

    if (resource === "submissions" && id && action === "review" && method === "POST") {
      const submissionId = idSchema.parse(id);
      const data = await readJson(request, reviewSchema);
      const submission = await prisma.submission.findFirst({
        where: { id: submissionId, assignment: { ...scope } },
        include: { assignment: { select: { totalMarks: true } } },
      });
      if (!submission) throw new ApiError(404, "NOT_FOUND", "Submission not found.");
      if (data.marks > submission.assignment.totalMarks) throw new ApiError(400, "MARKS_EXCEED_TOTAL", "Marks cannot exceed the assignment total.");
      const reviewed = await prisma.submission.update({
        where: { id: submissionId },
        data: { marks: data.marks, feedback: data.feedback, status: "REVIEWED", reviewedAt: new Date() },
      });
      return NextResponse.json({ submission: reviewed });
    }

    if (resource === "lessons" && method === "GET" && !id) {
      const lessons = await prisma.lesson.findMany({
        where: isAdmin ? {} : { trainerId: user.id, course: { batches: { some: { trainerId: user.id } } } },
        include: { course: { select: { id: true, title: true, subject: true } } },
        orderBy: [{ courseId: "asc" }, { order: "asc" }],
      });
      return NextResponse.json({ lessons });
    }

    if (resource === "lessons" && method === "POST" && !id) {
      const data = await readJson(request, lessonSchema);
      const course = await prisma.course.findFirst({
        where: { id: data.courseId, ...(isAdmin ? {} : { batches: { some: { trainerId: user.id } } }) },
        select: { id: true },
      });
      if (!course) throw new ApiError(404, "NOT_FOUND", "Course not found in your assigned batches.");
      const lesson = await prisma.lesson.create({ data: { ...data, trainerId: user.id } });
      return NextResponse.json({ lesson }, { status: 201 });
    }

    if (resource === "lessons" && id && (method === "PATCH" || method === "DELETE")) {
      const lessonId = idSchema.parse(id);
      const lesson = await prisma.lesson.findFirst({
        where: { id: lessonId, ...(isAdmin ? {} : { trainerId: user.id, course: { batches: { some: { trainerId: user.id } } } }) },
        select: { id: true, courseId: true },
      });
      if (!lesson) throw new ApiError(404, "NOT_FOUND", "Lesson not found.");
      if (method === "DELETE") {
        await prisma.lesson.delete({ where: { id: lessonId } });
        return new NextResponse(null, { status: 204 });
      }
      const data = await readJson(request, lessonSchema.partial());
      if (data.courseId && data.courseId !== lesson.courseId) {
        const target = await prisma.course.findFirst({
          where: { id: data.courseId, ...(isAdmin ? {} : { batches: { some: { trainerId: user.id } } }) },
          select: { id: true },
        });
        if (!target) throw new ApiError(404, "NOT_FOUND", "Course not found in your assigned batches.");
      }
      const updated = await prisma.lesson.update({ where: { id: lessonId }, data });
      return NextResponse.json({ lesson: updated });
    }

    if (resource === "reports" && method === "GET") {
      const batchIds = await prisma.batch.findMany({ where: scope, select: { id: true } });
      const ids = batchIds.map((batch) => batch.id);
      const [attendance, submissions, learners, progress] = await Promise.all([
        prisma.attendance.groupBy({ by: ["status"], where: { batchId: { in: ids } }, _count: { _all: true } }),
        prisma.submission.groupBy({ by: ["status"], where: { assignment: { batchId: { in: ids } } }, _count: { _all: true } }),
        prisma.enrollment.count({ where: { batchId: { in: ids }, status: "ACTIVE" } }),
        prisma.learningProgress.findMany({ where: { course: { batches: { some: { id: { in: ids } } } } }, select: { progressPercentage: true } }),
      ]);
      return NextResponse.json({ attendance, submissions, learners, averageProgress: progress.length ? Math.round(progress.reduce((sum, row) => sum + row.progressPercentage, 0) / progress.length) : 0 });
    }

    throw new ApiError(404, "NOT_FOUND", "API endpoint not found.");
  } catch (error) {
    if (error instanceof Prisma.PrismaClientKnownRequestError && error.code === "P2002") {
      return errorResponse(new ApiError(409, "DUPLICATE_RECORD", "A record with the same unique values already exists."));
    }
    return errorResponse(error);
  }
}
