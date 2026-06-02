import type { FastifyPluginAsync } from "fastify";
import { z } from "zod";
import { prisma } from "../lib/prisma.js";
import { verifyPassword } from "../lib/auth.js";

const loginSchema = z.object({
  email: z.email(),
  password: z.string().min(8)
});

const authRoutes: FastifyPluginAsync = async (app) => {
  app.post("/login", async (request, reply) => {
    const payload = loginSchema.parse(request.body);

    const user = await prisma.user.findUnique({
      where: { email: payload.email.toLowerCase() },
      include: { company: true }
    });

    if (!user || !(await verifyPassword(payload.password, user.passwordHash))) {
      reply.code(401);
      return { message: "Invalid credentials" };
    }

    const token = await reply.jwtSign({
      sub: user.id,
      role: user.role,
      companyId: user.companyId,
      email: user.email,
      name: user.name
    });

    await prisma.auditLog.create({
      data: {
        action: "auth.login",
        resource: "user",
        companyId: user.companyId,
        userId: user.id,
        details: {
          email: user.email
        }
      }
    });

    return {
      token,
      user: {
        id: user.id,
        name: user.name,
        email: user.email,
        role: user.role
      },
      company: {
        id: user.company.id,
        name: user.company.name,
        domain: user.company.domain
      }
    };
  });

  app.get(
    "/me",
    {
      preHandler: app.authenticate
    },
    async (request) => {
      const user = await prisma.user.findUniqueOrThrow({
        where: { id: request.user.sub },
        include: { company: true }
      });

      return {
        user: {
          id: user.id,
          name: user.name,
          email: user.email,
          role: user.role
        },
        company: {
          id: user.company.id,
          name: user.company.name,
          domain: user.company.domain
        }
      };
    }
  );
};

export default authRoutes;
