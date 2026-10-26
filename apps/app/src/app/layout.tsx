import "@/css/style.css";

import "flatpickr/dist/flatpickr.min.css";
import "jsvectormap/dist/jsvectormap.css";

import ConditionalLayout from "@/components/Layouts/ConditionalLayout";
import type { Metadata } from "next";
import NextTopLoader from "nextjs-toploader";
import type { PropsWithChildren } from "react";
import { Inter } from "next/font/google";
import { Providers } from "./providers";
import VersionChecker from "@/components/Common/VersionChecker";

// Load Inter font with Vietnamese subset
const inter = Inter({
  subsets: ["latin", "vietnamese"],
  display: "swap",
  variable: "--font-inter",
});

export const metadata: Metadata = {
  metadataBase: new URL(process.env.NEXT_PUBLIC_SITE_URL || "https://app.classly.io.vn"),
  title: {
    template: "%s | Classly - Quản lý Giáo dục",
    default: "Classly - Hệ thống Quản lý Giáo dục",
  },
  description:
    "Nền tảng SaaS cho trung tâm giáo dục và gia sư cá nhân để quản lý lớp học, học viên, điểm danh, bài tập và nhiều hơn nữa.",
  keywords: "quản lý giáo dục, trung tâm học, gia sư, lớp học, học viên, điểm danh, bài tập",
  authors: [{ name: "Classly Team" }],
  creator: "Classly",
  publisher: "Classly",
  robots: {
    index: true,
    follow: true,
  },
  openGraph: {
    type: "website",
    locale: "vi_VN",
    url: process.env.NEXT_PUBLIC_SITE_URL || "https://app.classly.io.vn",
    siteName: "Classly",
    title: "Classly - Hệ thống Quản lý Giáo dục Thông minh",
    description: "Nền tảng SaaS cho trung tâm giáo dục và gia sư cá nhân để quản lý lớp học, học viên, điểm danh, bài tập và nhiều hơn nữa.",
    images: [
      {
        url: "/images/og-image.png",
        width: 1200,
        height: 630,
        alt: "Classly - Hệ thống Quản lý Giáo dục",
      },
    ],
  },
  twitter: {
    card: "summary_large_image",
    title: "Classly - Hệ thống Quản lý Giáo dục Thông minh",
    description: "Nền tảng SaaS cho trung tâm giáo dục và gia sư cá nhân để quản lý lớp học, học viên, điểm danh, bài tập.",
    images: ["/images/og-image.png"],
    creator: "@classly", // TODO: Replace with your Twitter handle
  },
  verification: {
    // Add verification meta tags if you have them
    // google: "your-google-verification-code",
  },
  other: {
    // Zalo specific meta tags
    "zalo-platform-site-verification": "your-zalo-verification-code-if-available",
    "mobile-web-app-capable": "yes",
    "apple-mobile-web-app-capable": "yes",
    "apple-mobile-web-app-status-bar-style": "default",
  },
};

export default function RootLayout({ children }: PropsWithChildren) {
  return (
    <html lang="vi" suppressHydrationWarning className={inter.variable}>
      <body className={inter.className}>
        <VersionChecker />
        <Providers>
          <NextTopLoader color="#EF4444" showSpinner={false} />
          <ConditionalLayout>
            {children}
          </ConditionalLayout>
        </Providers>
      </body>
    </html>
  );
}
