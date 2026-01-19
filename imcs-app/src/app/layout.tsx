import type { Metadata } from 'next'
import { Providers } from './providers'
import './globals.css'

export const metadata: Metadata = {
  title: 'IMCS - Imaginary Magic Crypto Savants',
  description: 'i wish i was autistic...in like a super hacker programmer type of way',
  openGraph: {
    title: 'Imaginary Magic Crypto Savants',
    description: 'i wish i was autistic...in like a super hacker programmer type of way',
    images: ['/og-image.png'],
  },
  twitter: {
    card: 'summary_large_image',
    site: '@imcsnft',
    title: 'Imaginary Magic Crypto Savants',
    description: 'i wish i was autistic...in like a super hacker programmer type of way',
    images: ['/og-image.png'],
  },
}

export default function RootLayout({
  children,
}: {
  children: React.ReactNode
}) {
  return (
    <html lang="en">
      <body>
        <Providers>
          {/* Noise overlay - covers entire app */}
          <div className="noise-overlay" />
          {children}
        </Providers>
      </body>
    </html>
  )
}
