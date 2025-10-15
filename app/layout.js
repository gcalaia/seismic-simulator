import './globals.css'
import { Inter } from 'next/font/google'

const inter = Inter({ subsets: ['latin'] })

export const metadata = {
  title: 'Simulador Sísmico - Mesa Vibratoria ESP32',
  description: 'Sistema profesional de simulación sísmica para pruebas estructurales con control ESP32',
  keywords: 'sismo, simulador, ESP32, mesa vibratoria, Arduino, ingeniería',
  authors: [{ name: 'Tu Nombre' }],
  openGraph: {
    title: 'Simulador Sísmico - Mesa Vibratoria',
    description: 'Control profesional de simulación sísmica con ESP32',
    type: 'website',
  },
}

export default function RootLayout({ children }) {
  return (
    <html lang="es">
      <body className={inter.className}>
        <main className="min-h-screen bg-gradient-to-br from-slate-900 via-blue-900 to-slate-900">
          {children}
        </main>
      </body>
    </html>
  )
}
