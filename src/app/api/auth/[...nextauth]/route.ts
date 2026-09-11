import NextAuth from "next-auth";

import { authOptions } from "@/lib/auth";

/* NextAuth v4 credentials/JWT auth — POST /api/auth/signin,
   /api/auth/signout, /api/auth/session, /api/auth/csrf. */

const handler = NextAuth(authOptions);

export { handler as GET, handler as POST };
