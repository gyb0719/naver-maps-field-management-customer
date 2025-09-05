export const metadata = {
  title: '네이버 지도 필지 관리',
  description: '네이버 지도 필지 관리 프로그램',
}

export default function RootLayout({ children }) {
  return (
    <html lang="ko">
      <body>{children}</body>
    </html>
  )
}