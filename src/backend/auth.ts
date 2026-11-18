import NextAuth from "next-auth";
import Credentials from "next-auth/providers/credentials";
import { compare } from "bcryptjs";
import authConfig from "@/backend/auth.config";
import { prisma } from "@/backend/lib/db/prisma";
import { loginSchema } from "@/backend/lib/validations/auth";
import { rateLimit } from "@/backend/lib/utils/rate-limit";

export const { handlers, auth, signIn, signOut } = NextAuth({
  ...authConfig,
  providers: [
    Credentials({
      credentials: {
        email: { label: "Email", type: "email" },
        password: { label: "Password", type: "password" },
      },
      async authorize(credentials, request) {
        const address = request.headers.get("x-forwarded-for")?.split(",")[0]?.trim() ?? "unknown";
        const result = rateLimit(`login:${address}`, 10, 15 * 60 * 1000);
        if (!result.allowed) return null;

        const parsed = loginSchema.safeParse(credentials);
        if (!parsed.success) return null;

        const user = await prisma.user.findUnique({
          where: { email: parsed.data.email },
          select: { id: true, fullName: true, email: true, passwordHash: true, role: true },
        });
        if (!user || !(await compare(parsed.data.password, user.passwordHash))) return null;

        return { id: user.id, name: user.fullName, email: user.email, role: user.role };
      },
    }),
  ],
  callbacks: {
    jwt({ token, user }) {
      if (user) {
        token.sub = user.id;
        token.role = user.role;
      }
      return token;
    },
    async session({ session, token }) {
      if (!session.user || !token.sub) return session;
      const user = await prisma.user.findUnique({
        where: { id: token.sub },
        select: { id: true, fullName: true, email: true, role: true },
      });
      session.user.id = user?.id ?? "";
      session.user.role = user?.role ?? "STUDENT";
      if (user) {
        session.user.name = user.fullName;
        session.user.email = user.email;
      }
      return session;
    },
  },
});
