import type { Metadata } from "next";
import "./globals.css";

export const metadata: Metadata = {
  title: "TAROT LAB — 둘이 함께 만드는 타로 작업실",
  description: "두 사람이 통화하면서 타로카드에 대해 토론하고, 그 결과를 한곳에 함께 기록하는 공동 작업 노트.",
};

export default function RootLayout({ children }: { children: React.ReactNode }) {
  return (
    <html lang="ko">
      <body className="min-h-screen">
        <div className="min-h-screen flex flex-col">
          {children}
        </div>
      </body>
    </html>
  );
}
