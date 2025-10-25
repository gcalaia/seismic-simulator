import { Inter } from 'next/font/google'
import './globals.css'

const inter = Inter({ subsets: ['latin'] })

export const metadata = {
  title: 'Mesa Vibratoria Sísmica - UTN',
  description: 'Sistema de control remoto para mesa vibratoria sísmica - Universidad Tecnológica Nacional',
  keywords: ['sísmica', 'vibración', 'terremoto', 'UTN', 'ingeniería'],
  authors: [{ name: 'UTN - Facultad Regional' }],
  icons: {
    icon: '/favicon.ico',
    apple: '/apple-touch-icon.png',
  },
  openGraph: {
    title: 'Mesa Vibratoria Sísmica - UTN',
    description: 'Sistema de control remoto para simulación sísmica',
    type: 'website',
  },
}

export default function RootLayout({ children }) {
  return (
    <html lang="es">
      <head>
        <link rel="icon" href="/favicon.ico" sizes="any" />
        <link rel="icon" href="/favicon.svg" type="image/svg+xml" />
        <link rel="apple-touch-icon" href="/apple-touch-icon.png" />
      </head>
      <body className={inter.className}>{children}</body>
    </html>
  )
}
