import type { FastifyPluginAsync } from "fastify";
import { z } from "zod";
import { prisma } from "../lib/prisma.js";
import { verifyPassword } from "../lib/auth.js";

const loginSchema = z.object({
  email: z.email(),
  password: z.string().min(8)
});

const switchCompanySchema = z.object({
  companyId: z.string().min(1)
});

async function getUserWithMemberships(userId: string) {
  return prisma.user.findUniqueOrThrow({
    where: { id: userId },
    include: {
      memberships: {
        include: {
          company: true
        },
        orderBy: [{ isDefault: "desc" }, { createdAt: "asc" }]
      }
    }
  });
}

function buildAuthResponse(user: Awaited<ReturnType<typeof getUserWithMemberships>>, activeCompanyId?: string) {
  const activeMembership =
    user.memberships.find((membership) => membership.companyId === activeCompanyId) ??
    user.memberships.find((membership) => membership.isDefault) ??
    user.memberships[0];

  if (!activeMembership) {
    throw new Error("User has no company membership");
  }

  return {
    activeMembership,
    payload: {
      user: {
        id: user.id,
        name: user.name,
        email: user.email,
        role: activeMembership.role
      },
      activeCompany: {
        id: activeMembership.company.id,
        name: activeMembership.company.name,
        domain: activeMembership.company.domain
      },
      memberships: user.memberships.map((membership) => ({
        id: membership.id,
        role: membership.role,
        isDefault: membership.isDefault,
        company: {
          id: membership.company.id,
          name: membership.company.name,
          domain: membership.company.domain
        }
      }))
    }
  };
}

const authRoutes: FastifyPluginAsync = async (app) => {
  app.post("/login", async (request, reply) => {
    const payload = loginSchema.parse(request.body);

    const user = await prisma.user.findUnique({
      where: { email: payload.email.toLowerCase() },
      include: {
        memberships: {
          include: {
            company: true
          },
          orderBy: [{ isDefault: "desc" }, { createdAt: "asc" }]
        }
      }
    });

    if (!user || !(await verifyPassword(payload.password, user.passwordHash))) {
      reply.code(401);
      return { message: "Invalid credentials" };
    }

    const auth = buildAuthResponse(user);
    const token = await reply.jwtSign({
      sub: user.id,
      role: auth.activeMembership.role,
      activeCompanyId: auth.activeMembership.companyId,
      companyId: auth.activeMembership.companyId,
      email: user.email,
      name: user.name
    });

    await prisma.auditLog.create({
      data: {
        action: "auth.login",
        resource: "user",
        companyId: auth.activeMembership.companyId,
        userId: user.id,
        details: {
          email: user.email
        }
      }
    });

    return {
      token,
      ...auth.payload
    };
  });

  app.get(
    "/me",
    {
      preHandler: app.authenticate
    },
    async (request) => {
      const user = await getUserWithMemberships(request.user.sub);
      return buildAuthResponse(user, request.user.activeCompanyId).payload;
    }
  );

  app.post(
    "/switch-company",
    {
      preHandler: app.authenticate
    },
    async (request, reply) => {
      const payload = switchCompanySchema.parse(request.body);
      const user = await getUserWithMemberships(request.user.sub);
      const auth = buildAuthResponse(user, payload.companyId);

      if (auth.activeMembership.companyId !== payload.companyId) {
        reply.code(403);
        return { message: "Forbidden" };
      }

      const token = await reply.jwtSign({
        sub: user.id,
        role: auth.activeMembership.role,
        activeCompanyId: auth.activeMembership.companyId,
        companyId: auth.activeMembership.companyId,
        email: user.email,
        name: user.name
      });

      return {
        token,
        ...auth.payload
      };
    }
  );
};

export default authRoutes;
