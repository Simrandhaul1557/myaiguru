import { hash } from "bcryptjs";
import { Prisma } from "@prisma/client";
import { NextResponse } from "next/server";
import { requireUser } from "@/backend/lib/auth/access";
import { ApiError, errorResponse, readJson } from "@/backend/lib/api/errors";
import { prisma } from "@/backend/lib/db/prisma";
import {
  batchSchema, courseSchema, idSchema, userAdminSchema,
} from "@/backend/lib/validations/education";

function routeParts(request: Request) {
  return new URL(request.url).pathname.split("/").filter(Boolean).slice(2);
}

export async function handleAdminApi(request: Request) {
  try {
    const admin = await requireUser(["ADMIN"]);
    const [resource, id, action] = routeParts(request);
    const { method } = request;

    if (resource === "users" && method === "GET" && !id) {
      const users = await prisma.user.findMany({
        select: { id: true, fullName: true, email: true, role: true, profileImage: true, createdAt: true },
        orderBy: { createdAt: "desc" },
        take: 500,
      });
      return NextResponse.json({ users });
    }

    if (resource === "users" && method === "POST" && !id) {
      const schema = userAdminSchema.extend({ password: userAdminSchema.shape.password.unwrap() });
      const data = await readJson(request, schema);
      const user = await prisma.user.create({
        data: { fullName: data.fullName, email: data.email, role: data.role, passwordHash: await hash(data.password, 12) },
        select: { id: true, fullName: true, email: true, role: true, createdAt: true },
      });
      return NextResponse.json({ user }, { status: 201 });
    }

    if (resource === "users" && id && method === "PATCH") {
      const userId = idSchema.parse(id);
      const data = await readJson(request, userAdminSchema.partial());
      const user = await prisma.user.update({
        where: { id: userId },
        data: {
          ...(data.fullName ? { fullName: data.fullName } : {}),
          ...(data.email ? { email: data.email } : {}),
          ...(data.role ? { role: data.role } : {}),
          ...(data.password ? { passwordHash: await hash(data.password, 12) } : {}),
        },
        select: { id: true, fullName: true, email: true, role: true, profileImage: true, updatedAt: true },
      });
      return NextResponse.json({ user });
    }

    if (resource === "users" && id && method === "DELETE") {
      const userId = idSchema.parse(id);
      if (userId === admin.id) throw new ApiError(400, "CANNOT_DELETE_SELF", "You cannot delete your own administrator account.");
      await prisma.user.delete({ where: { id: userId } });
      return new NextResponse(null, { status: 204 });
    }

    if (resource === "courses" && method === "GET" && !id) {
      const courses = await prisma.course.findMany({
        include: { _count: { select: { batches: true, lessons: true } } },
        orderBy: [{ subject: "asc" }, { title: "asc" }],
      });
      return NextResponse.json({ courses });
    }

    if (resource === "courses" && method === "POST" && !id) {
      const data = await readJson(request, courseSchema);
      const course = await prisma.course.create({ data });
      return NextResponse.json({ course }, { status: 201 });
    }

    if (resource === "courses" && id && method === "PATCH") {
      const courseId = idSchema.parse(id);
      const data = await readJson(request, courseSchema.partial());
      const course = await prisma.course.update({ where: { id: courseId }, data });
      return NextResponse.json({ course });
    }

    if (resource === "courses" && id && method === "DELETE") {
      await prisma.course.delete({ where: { id: idSchema.parse(id) } });
      return new NextResponse(null, { status: 204 });
    }

    if (resource === "batches" && method === "GET" && !id) {
      const batches = await prisma.batch.findMany({
        include: {
          course: { select: { id: true, title: true, subject: true } },
          trainer: { select: { id: true, fullName: true, email: true } },
          _count: { select: { enrollments: true, assignments: true } },
        },
        orderBy: { startDate: "desc" },
      });
      return NextResponse.json({ batches });
    }

    if (resource === "batches" && method === "POST" && !id) {
      const data = await readJson(request, batchSchema);
      const [course, trainer] = await Promise.all([
        prisma.course.findUnique({ where: { id: data.courseId }, select: { id: true } }),
        prisma.user.findUnique({ where: { id: data.trainerId }, select: { id: true, role: true } }),
      ]);
      if (!course) throw new ApiError(404, "COURSE_NOT_FOUND", "Course not found.");
      if (!trainer || trainer.role !== "TRAINER") throw new ApiError(400, "INVALID_TRAINER", "The assigned user must have the trainer role.");
      const batch = await prisma.batch.create({ data });
      return NextResponse.json({ batch }, { status: 201 });
    }

    if (resource === "batches" && id && method === "PATCH") {
      const batchId = idSchema.parse(id);
      const data = await readJson(request, batchSchema.partial());
      if (data.trainerId) {
        const trainer = await prisma.user.findUnique({ where: { id: data.trainerId }, select: { role: true } });
        if (trainer?.role !== "TRAINER") throw new ApiError(400, "INVALID_TRAINER", "The assigned user must have the trainer role.");
      }
      const batch = await prisma.batch.update({ where: { id: batchId }, data });
      return NextResponse.json({ batch });
    }

    if (resource === "batches" && id && method === "DELETE") {
      await prisma.batch.delete({ where: { id: idSchema.parse(id) } });
      return new NextResponse(null, { status: 204 });
    }

    if (resource === "enrollments" && method === "GET") {
      const batchId = new URL(request.url).searchParams.get("batchId");
      const studentId = new URL(request.url).searchParams.get("studentId");
      const enrollments = await prisma.enrollment.findMany({
        where: {
          ...(batchId ? { batchId: idSchema.parse(batchId) } : {}),
          ...(studentId ? { studentId: idSchema.parse(studentId) } : {}),
        },
        include: { student: { select: { id: true, fullName: true, email: true } }, batch: { select: { id: true, name: true, course: { select: { title: true } } } } },
        orderBy: { enrolledAt: "desc" },
        take: 1000,
      });
      return NextResponse.json({ enrollments });
    }

    if (resource === "enrollments" && method === "POST") {
      const data = await readJson(request, courseSchema.pick({}).extend({
        studentId: idSchema,
        batchId: idSchema,
      }));
      const [student, batch] = await Promise.all([
        prisma.user.findUnique({ where: { id: data.studentId }, select: { id: true, role: true } }),
        prisma.batch.findUnique({ where: { id: data.batchId }, select: { id: true } }),
      ]);
      if (!student || student.role !== "STUDENT") throw new ApiError(400, "INVALID_STUDENT", "Only student accounts can be enrolled.");
      if (!batch) throw new ApiError(404, "BATCH_NOT_FOUND", "Batch not found.");
      const enrollment = await prisma.enrollment.create({ data: { studentId: student.id, batchId: batch.id } });
      return NextResponse.json({ enrollment }, { status: 201 });
    }

    if (resource === "enrollments" && id && method === "DELETE") {
      await prisma.enrollment.delete({ where: { id: idSchema.parse(id) } });
      return new NextResponse(null, { status: 204 });
    }

    if (resource === "assign-trainer" && method === "POST") {
      const data = await readJson(request, courseSchema.pick({}).extend({ batchId: idSchema, trainerId: idSchema }));
      const trainer = await prisma.user.findUnique({ where: { id: data.trainerId }, select: { id: true, role: true } });
      if (trainer?.role !== "TRAINER") throw new ApiError(400, "INVALID_TRAINER", "The assigned user must have the trainer role.");
      const batch = await prisma.batch.update({ where: { id: data.batchId }, data: { trainerId: trainer.id } });
      return NextResponse.json({ batch });
    }

    throw new ApiError(404, "NOT_FOUND", "API endpoint not found.");
  } catch (error) {
    if (error instanceof Prisma.PrismaClientKnownRequestError) {
      if (error.code === "P2002") return errorResponse(new ApiError(409, "DUPLICATE_RECORD", "A record with the same unique values already exists."));
      if (error.code === "P2025") return errorResponse(new ApiError(404, "NOT_FOUND", "The requested resource was not found."));
      if (error.code === "P2003") return errorResponse(new ApiError(409, "RELATED_RECORDS_EXIST", "This record is still referenced by related records."));
    }
    return errorResponse(error);
  }
}
