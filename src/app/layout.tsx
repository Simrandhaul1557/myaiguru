import type { Metadata } from "next";
import "./globals.css";

export const metadata: Metadata = {
  title: "MYAIGURU — Learn with intention",
  description: "A thoughtful learning and teaching workspace.",
};

export default function RootLayout({ children }: Readonly<{ children: React.ReactNode }>) {
  return <html lang="en"><body>{children}</body></html>;
}
