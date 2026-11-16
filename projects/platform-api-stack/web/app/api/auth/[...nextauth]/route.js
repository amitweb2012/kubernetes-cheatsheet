import NextAuth from "next-auth";
import KeycloakProvider from "next-auth/providers/keycloak";

async function refreshAccessToken(token) {
  try {
    const response = await fetch(`${process.env.OIDC_ISSUER}/protocol/openid-connect/token`, {
      method: "POST",
      headers: { "Content-Type": "application/x-www-form-urlencoded" },
      body: new URLSearchParams({
        grant_type: "refresh_token",
        client_id: process.env.OIDC_CLIENT_ID,
        client_secret: process.env.OIDC_CLIENT_SECRET,
        refresh_token: token.refreshToken
      })
    });
    const refreshed = await response.json();
    if (!response.ok) throw new Error("OIDC refresh failed");
    return {
      ...token,
      accessToken: refreshed.access_token,
      accessTokenExpires: Date.now() + refreshed.expires_in * 1000,
      refreshToken: refreshed.refresh_token || token.refreshToken
    };
  } catch {
    return { ...token, error: "RefreshAccessTokenError" };
  }
}

export const authOptions = {
  providers: [
    KeycloakProvider({
      clientId: process.env.OIDC_CLIENT_ID,
      clientSecret: process.env.OIDC_CLIENT_SECRET,
      issuer: process.env.OIDC_ISSUER,
      checks: ["pkce", "state"]
    })
  ],
  session: { strategy: "jwt" },
  callbacks: {
    async jwt({ token, account }) {
      if (account) {
        token.accessToken = account.access_token;
        token.accessTokenExpires = account.expires_at ? account.expires_at * 1000 : null;
        token.refreshToken = account.refresh_token;
        return token;
      }
      if (token.accessTokenExpires && Date.now() < token.accessTokenExpires - 60_000) return token;
      return refreshAccessToken(token);
    }
  }
};

const handler = NextAuth(authOptions);
export { handler as GET, handler as POST };
