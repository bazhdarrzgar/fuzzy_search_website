import '@/app/globals.css'
import Providers from './providers'

export const metadata = {
  title: 'Excel Explorer',
  description: 'Upload, search, filter, and export Excel data in your browser.',
}

export default function RootLayout({ children }) {
  return (
    <html lang="en" suppressHydrationWarning>
      <body className="min-h-screen bg-background text-foreground">
        <Providers>
          {children}
        </Providers>
      </body>
    </html>
  )
}