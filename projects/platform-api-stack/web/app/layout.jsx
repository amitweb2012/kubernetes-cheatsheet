import "next-auth";
import { SessionProvider } from "next-auth/react";
import "./globals.css";

export const metadata = {
  title: "Kubernetes Notes",
  description: "Kubernetes Notes dashboard with OAuth 2.0, PostgreSQL and migrations"
};

export default function RootLayout({ children }) {
  return <html lang="en"><body><SessionProvider>{children}</SessionProvider></body></html>;
}
