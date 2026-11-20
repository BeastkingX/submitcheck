import type { Metadata } from "next";
import "./globals.css";

export const metadata: Metadata = {
  title: "SubmitCheck",
  description:
    "Compare hackathon rules with a draft submission and see what is met, missing, or unclear.",
};

export default function RootLayout({
  children,
}: {
  children: React.ReactNode;
}) {
  return (
    <html lang="en">
      <body>{children}</body>
    </html>
  );
}
