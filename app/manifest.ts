import { MetadataRoute } from 'next'
 
export default function manifest(): MetadataRoute.Manifest {
  return {
    name: 'Is This Even Legit?',
    short_name: 'ITEL',
    description: 'Scan job postings and emails to find out if they are legit or a scam.',
    start_url: '/',
    display: 'standalone',
    background_color: '#fbf9ff',
    theme_color: '#fbf9ff',
    icons: [
      {
        src: '/icon-192x192.png',
        sizes: '192x192',
        type: 'image/png',
      },
      {
        src: '/icon-512x512.png',
        sizes: '512x512',
        type: 'image/png',
      },
    ],
  }
}