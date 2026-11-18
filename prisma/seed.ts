import { PrismaClient, type AttendanceStatus } from "@prisma/client";
import { hash } from "bcryptjs";

const prisma = new PrismaClient();
const password = process.env.DEMO_PASSWORD ?? "MyaiguruDemo2026!";
const firstNames = ["Olivia", "Ethan", "Ava", "Noah", "Mia", "Liam", "Sophia", "Lucas", "Amelia", "Mason", "Isabella", "Elijah"];
const lastNames = ["Parker", "Brooks", "Thompson", "Williams", "Chen", "Patel", "Rivera", "Morgan", "Shah", "Kim", "Carter", "Reed"];

async function main() {
  const passwordHash = await hash(password, 12);
  const admin = await prisma.user.upsert({
    where: { email: "admin@myaiguru.demo" },
    update: { fullName: "MYAIGURU Admin", passwordHash, role: "ADMIN" },
    create: { fullName: "MYAIGURU Admin", email: "admin@myaiguru.demo", passwordHash, role: "ADMIN" },
  });
  const trainers = await Promise.all(
    ["Sarah Mitchell", "Daniel Kim", "Emily Carter"].map((fullName, index) =>
      prisma.user.upsert({
        where: { email: `trainer${index + 1}@myaiguru.demo` },
        update: { fullName, passwordHash, role: "TRAINER" },
        create: { fullName, email: `trainer${index + 1}@myaiguru.demo`, passwordHash, role: "TRAINER" },
      }),
    ),
  );
  const studentUsers = await Promise.all(
    Array.from({ length: 120 }, (_, index) => {
      const fullName = `${firstNames[index % firstNames.length]} ${lastNames[Math.floor(index / firstNames.length) % lastNames.length]}`;
      const email = `student${String(index + 1).padStart(3, "0")}@myaiguru.demo`;
      return prisma.user.upsert({
        where: { email },
        update: { fullName, passwordHash, role: "STUDENT" },
        create: { fullName, email, passwordHash, role: "STUDENT" },
      });
    }),
  );

  const catalog = [
    { title: "Mathematics Foundations", subject: "Mathematics", level: "Intermediate", trainer: trainers[0] },
    { title: "English Communication", subject: "English", level: "Intermediate", trainer: trainers[1] },
    { title: "Physics in Motion", subject: "Physics", level: "Foundations", trainer: trainers[2] },
    { title: "Biology Essentials", subject: "Biology", level: "Foundations", trainer: trainers[0] },
  ];
  const courses = await Promise.all(
    catalog.map(({ title, subject, level }) =>
      prisma.course.upsert({
        where: { title_subject_level: { title, subject, level } },
        update: {},
        create: { title, subject, level, description: `A practical ${level.toLowerCase()} course in ${subject}.`, duration: 12 },
      }),
    ),
  );

  const batches = await Promise.all(
    catalog.map(async (item, index) =>
      prisma.batch.upsert({
        where: { name_courseId: { name: `Batch ${String.fromCharCode(65 + index)}`, courseId: courses[index].id } },
        update: {
          description: `${item.subject} learning group`,
          trainerId: item.trainer.id,
          status: "ACTIVE",
          startDate: new Date(Date.now() - 45 * 86400000),
          endDate: new Date(Date.now() + 45 * 86400000),
        },
        create: {
          name: `Batch ${String.fromCharCode(65 + index)}`,
          description: `${item.subject} learning group`,
          courseId: courses[index].id,
          trainerId: item.trainer.id,
          status: "ACTIVE",
          startDate: new Date(Date.now() - 45 * 86400000),
          endDate: new Date(Date.now() + 45 * 86400000),
        },
      }),
    ),
  );

  const lessonsByCourse: { id: string; courseId: string; title: string; order: number }[][] = [];
  for (let courseIndex = 0; courseIndex < courses.length; courseIndex += 1) {
    const lessonNames = ["Getting started", "Core concepts", "Guided practice", "Review and reflect"];
    const lessons = [];
    for (let order = 1; order <= lessonNames.length; order += 1) {
      const lesson = await prisma.lesson.upsert({
        where: { courseId_order: { courseId: courses[courseIndex].id, order } },
        update: { title: lessonNames[order - 1], trainerId: catalog[courseIndex].trainer.id },
        create: {
          title: lessonNames[order - 1],
          description: `${catalog[courseIndex].subject}: ${lessonNames[order - 1].toLowerCase()}.`,
          content: `Lesson ${order} introduces ${catalog[courseIndex].subject.toLowerCase()} concepts with a worked example and a short practice activity.`,
          courseId: courses[courseIndex].id,
          trainerId: catalog[courseIndex].trainer.id,
          order,
          duration: 45,
        },
      });
      lessons.push(lesson);
    }
    lessonsByCourse.push(lessons);
  }

  const enrollments = studentUsers.map((student, index) => {
    const batchIndex = index % batches.length;
    return { studentId: student.id, batchId: batches[batchIndex].id, status: "ACTIVE" as const };
  });
  await prisma.enrollment.createMany({ data: enrollments, skipDuplicates: true });

  const assignmentRows = await Promise.all(
    batches.map((batch, index) =>
      prisma.assignment.upsert({
        where: { batchId_title: { batchId: batch.id, title: `${catalog[index].subject} practice set` } },
        update: { trainerId: catalog[index].trainer.id },
        create: {
          title: `${catalog[index].subject} practice set`,
          description: `Practice key ${catalog[index].subject.toLowerCase()} concepts.`,
          instructions: "Complete each section and include your reasoning.",
          batchId: batch.id,
          trainerId: catalog[index].trainer.id,
          dueDate: new Date(Date.now() + 7 * 86400000),
          totalMarks: 20,
        },
      }),
    ),
  );

  const submissionRows = studentUsers.map((student, index) => {
    const batchIndex = index % batches.length;
    const reviewed = index % 4 !== 0;
    return {
      assignmentId: assignmentRows[batchIndex].id,
      studentId: student.id,
      submissionContent: `Demonstration submission ${index + 1}: completed practice and included working.`,
      status: (reviewed ? "REVIEWED" : "SUBMITTED") as "REVIEWED" | "SUBMITTED",
      marks: reviewed ? 12 + (index % 9) : null,
      feedback: reviewed ? "Good reasoning. Review the final step for accuracy." : null,
      reviewedAt: reviewed ? new Date() : null,
    };
  });
  for (const submission of submissionRows) {
    await prisma.submission.upsert({
      where: { assignmentId_studentId: { assignmentId: submission.assignmentId, studentId: submission.studentId } },
      update: {
        status: submission.status,
        marks: submission.marks,
        feedback: submission.feedback,
        reviewedAt: submission.reviewedAt,
      },
      create: submission,
    });
  }

  const quizzes = await Promise.all(courses.flatMap((course, courseIndex) =>
    Array.from({ length: 4 }, (_, quizIndex) => {
      const title = `${catalog[courseIndex].subject} checkpoint ${quizIndex + 1}`;
      return prisma.quiz.upsert({
        where: { courseId_title: { courseId: course.id, title } },
        update: {},
        create: { title, courseId: course.id, batchId: batches[courseIndex].id, totalMarks: 20 },
      });
    }),
  ));
  const quizzesByCourse = courses.map((course) => quizzes.filter((quiz) => quiz.courseId === course.id));
  const resultRows = studentUsers.flatMap((student, index) => {
    const courseIndex = index % courses.length;
    return quizzesByCourse[courseIndex].map((quiz, quizIndex) => ({
      quizId: quiz.id,
      studentId: student.id,
      score: Math.min(100, 58 + ((index * 7 + quizIndex * 9) % 43)),
      completedAt: new Date(Date.now() - (3 - quizIndex) * 7 * 86400000 - (index % 7) * 3600000),
    }));
  });
  for (let offset = 0; offset < resultRows.length; offset += 10) {
    const batch = resultRows.slice(offset, offset + 10);
    await Promise.all(batch.map((result) =>
      prisma.quizResult.upsert({
        where: { quizId_studentId: { quizId: result.quizId, studentId: result.studentId } },
        update: { score: result.score, completedAt: result.completedAt },
        create: result,
      }),
    ));
  }

  const progressRows = studentUsers.map((student, index) => {
    const courseIndex = index % courses.length;
    const completedLessons = (index * 3 + courseIndex * 2) % 5;
    return {
      studentId: student.id,
      courseId: courses[courseIndex].id,
      completedLessons: Math.min(completedLessons, lessonsByCourse[courseIndex].length),
      totalLessons: lessonsByCourse[courseIndex].length,
      progressPercentage: Math.min(100, Math.round((completedLessons / lessonsByCourse[courseIndex].length) * 100)),
    };
  });
  for (const progress of progressRows) {
    await prisma.learningProgress.upsert({
      where: { studentId_courseId: { studentId: progress.studentId, courseId: progress.courseId } },
      update: {
        completedLessons: progress.completedLessons,
        totalLessons: progress.totalLessons,
        progressPercentage: progress.progressPercentage,
      },
      create: progress,
    });
  }

  const attendanceStatuses: AttendanceStatus[] = ["PRESENT", "PRESENT", "PRESENT", "LATE", "ABSENT", "PRESENT"];
  const attendanceRows = studentUsers.flatMap((student, studentIndex) =>
    Array.from({ length: 14 }, (_, dayIndex) => {
      const batchIndex = studentIndex % batches.length;
      const date = new Date();
      date.setUTCHours(0, 0, 0, 0);
      date.setUTCDate(date.getUTCDate() - dayIndex);
      return {
        studentId: student.id,
        batchId: batches[batchIndex].id,
        date,
        status: attendanceStatuses[(studentIndex + dayIndex) % attendanceStatuses.length],
        markedBy: catalog[batchIndex].trainer.id,
      };
    }),
  );
  await prisma.attendance.createMany({ data: attendanceRows, skipDuplicates: true });

  const studyRows = studentUsers.flatMap((student, studentIndex) =>
    Array.from({ length: 3 }, (_, sessionIndex) => {
      const startTime = new Date(Date.now() + (sessionIndex - 1) * 86400000);
      startTime.setHours(15 + sessionIndex, 0, 0, 0);
      return {
        id: `demo-study-${student.id}-${sessionIndex + 1}`,
        studentId: student.id,
        subject: catalog[(studentIndex + sessionIndex) % catalog.length].subject,
        title: ["Focused practice", "Lesson review", "Weekly recap"][sessionIndex],
        startTime,
        endTime: new Date(startTime.getTime() + 45 * 60000),
        completed: sessionIndex === 0,
      };
    }),
  );
  await prisma.studySession.createMany({ data: studyRows, skipDuplicates: true });

  await prisma.notification.createMany({
    data: [...studentUsers, ...trainers, admin].map((user) => ({
      id: `demo-notification-${user.id}`,
      userId: user.id,
      title: user.role === "STUDENT" ? "Welcome to MYAIGURU" : "Your teaching overview is ready",
      message: user.role === "STUDENT" ? "Your enrolled courses and upcoming work are ready to explore." : "Review your batches, attendance and submissions.",
    })),
    skipDuplicates: true,
  });

  console.info(`Seeded 1 admin, ${trainers.length} trainers, ${studentUsers.length} students and ${batches.length} batches.`);
  console.info("Demo password is controlled by DEMO_PASSWORD (default: MyaiguruDemo2026!).");
}

main()
  .catch((error: unknown) => {
    console.error("Database seed failed", error);
    process.exitCode = 1;
  })
  .finally(async () => {
    await prisma.$disconnect();
  });
