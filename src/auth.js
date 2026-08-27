import NextAuth from "next-auth";
import Credentials from "next-auth/providers/credentials";
import Google from "next-auth/providers/google";
import { PrismaAdapter } from "@auth/prisma-adapter";

import { authenticateCredentials } from "@/lib/auth/credentials";
import { ensureCustomerAccountById } from "@/lib/auth/provisioning";
import { getSafeRedirectPath } from "@/lib/auth/redirects";
import { prisma } from "@/lib/prisma";

const providers = [
  Credentials({
    credentials: {
      email: { label: "Email", type: "email" },
      password: { label: "Password", type: "password" },
    },
    authorize(credentials) {
      return authenticateCredentials(credentials || {});
    },
  }),
];

if (process.env.AUTH_GOOGLE_ID && process.env.AUTH_GOOGLE_SECRET) {
  providers.push(
    Google({
      clientId: process.env.AUTH_GOOGLE_ID,
      clientSecret: process.env.AUTH_GOOGLE_SECRET,
      allowDangerousEmailAccountLinking: false,
    })
  );
}

export const googleAuthConfigured = providers.some(
  (provider) => (typeof provider === "function" ? provider().id : provider.id) === "google"
);

export const { handlers, auth, signIn, signOut } = NextAuth({
  adapter: PrismaAdapter(prisma),
  secret: process.env.AUTH_SECRET,
  trustHost: process.env.AUTH_TRUST_HOST === "true",
  session: {
    strategy: "jwt",
    maxAge: 30 * 24 * 60 * 60,
  },
  pages: {
    signIn: "/login",
    error: "/login",
  },
  providers,
  callbacks: {
    async signIn({ user }) {
      if (!user?.id) {
        return false;
      }

      const databaseUser = await prisma.user.findUnique({
        where: { id: user.id },
        select: { role: true },
      });

      if (!databaseUser) {
        return false;
      }

      if (databaseUser.role === "CUSTOMER") {
        await ensureCustomerAccountById(user.id);
      }

      return true;
    },
    async jwt({ token, user }) {
      const userId = user?.id || token.userId || token.sub;

      if (!userId) {
        return token;
      }

      const databaseUser = await prisma.user.findUnique({
        where: { id: userId },
        select: {
          id: true,
          email: true,
          name: true,
          image: true,
          role: true,
        },
      });

      if (!databaseUser) {
        return {};
      }

      token.sub = databaseUser.id;
      token.userId = databaseUser.id;
      token.email = databaseUser.email;
      token.name = databaseUser.name;
      token.picture = databaseUser.image;
      token.role = databaseUser.role;
      return token;
    },
    session({ session, token }) {
      if (session.user) {
        session.user.id = token.userId || token.sub;
        session.user.role = token.role || null;
      }

      return session;
    },
    redirect({ url, baseUrl }) {
      const requestedPath = url.startsWith(baseUrl) ? url.slice(baseUrl.length) : url;
      return `${baseUrl}${getSafeRedirectPath(requestedPath, "/account")}`;
    },
  },
  events: {
    async createUser({ user }) {
      if (user?.id) {
        await ensureCustomerAccountById(user.id);
      }
    },
  },
});
