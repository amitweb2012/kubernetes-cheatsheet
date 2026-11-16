import "./globals.css";

export const metadata = {
  title: "Platform Notes",
  description: "A simple Next.js frontend for the Kubernetes Platform API Stack"
};

export default function RootLayout({ children }) {
  return (
    <html lang="en">
      <body>{children}</body>
    </html>
  );
}
