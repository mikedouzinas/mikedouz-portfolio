// app/layout.tsx
import '../styles/globals.css'

export default function RootLayout({
  children,
}: {
  children: React.ReactNode
}) {
  return (
    <html lang="en">
      <head>
        <title>Mike Veson Portfolio</title>
      </head>
      <body>
        {children}
      </body>
    </html>
  )
}
