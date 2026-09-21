import type { NextConfig } from 'next'

/**
 * ส่วนหัวความปลอดภัยที่ค่าคงที่ตลอด — ตัวที่ต้องเปลี่ยนทุกคำขอ (CSP ที่มี nonce)
 * อยู่ใน middleware.ts เพราะที่นี่สร้างค่าต่อคำขอไม่ได้
 *
 * ทุกตัวเป็น "ปฏิเสธไว้ก่อน" แล้วค่อยเปิดเฉพาะที่เว็บนี้ใช้จริง
 */
const securityHeaders = [
  // บังคับ https ทั้งโดเมนและโดเมนย่อย 2 ปี — เบราว์เซอร์จะไม่ยอมต่อ http อีกเลย
  { key: 'Strict-Transport-Security', value: 'max-age=63072000; includeSubDomains; preload' },
  // ห้ามเบราว์เซอร์เดาชนิดไฟล์เอง กันไฟล์แนบถูกตีความเป็นสคริปต์
  { key: 'X-Content-Type-Options', value: 'nosniff' },
  // กันเว็บอื่นเอาหน้านี้ไปใส่ iframe แล้วหลอกให้กดปุ่ม (clickjacking)
  // CSP frame-ancestors คือตัวจริง อันนี้ไว้ให้เบราว์เซอร์เก่า
  { key: 'X-Frame-Options', value: 'DENY' },
  // ออกนอกเว็บแล้วไม่ส่ง path ติดไปด้วย — ลิงก์รูปโจทย์ไม่ควรรั่วไปที่อื่น
  { key: 'Referrer-Policy', value: 'strict-origin-when-cross-origin' },
  // ปิดความสามารถของเบราว์เซอร์ที่เว็บนี้ไม่ได้ใช้เลยสักอย่าง
  {
    key: 'Permissions-Policy',
    value: [
      'accelerometer=()', 'autoplay=()', 'camera=()', 'display-capture=()',
      'encrypted-media=()', 'fullscreen=(self)', 'geolocation=()', 'gyroscope=()',
      'magnetometer=()', 'microphone=()', 'midi=()', 'payment=()',
      'picture-in-picture=()', 'publickey-credentials-get=()', 'screen-wake-lock=()',
      'usb=()', 'xr-spatial-tracking=()',
    ].join(', '),
  },
  // กันหน้าอื่นที่เปิดจากเว็บนี้เข้าถึง window ของกันและกัน
  { key: 'Cross-Origin-Opener-Policy', value: 'same-origin' },
  // ทรัพยากรของเว็บนี้ถูกดึงไปใช้จากโดเมนอื่นไม่ได้
  { key: 'Cross-Origin-Resource-Policy', value: 'same-origin' },
  { key: 'X-DNS-Prefetch-Control', value: 'off' },
  // ไม่ให้ Flash/PDF รุ่นเก่าอ่าน crossdomain policy
  { key: 'X-Permitted-Cross-Domain-Policies', value: 'none' },
]

const nextConfig: NextConfig = {
  // ไม่ต้องประกาศให้โลกรู้ว่าเว็บนี้รันด้วยอะไร
  poweredByHeader: false,

  images: {
    remotePatterns: [
      { protocol: 'https', hostname: '*.supabase.co', pathname: '/storage/v1/object/public/**' },
    ],
  },

  async headers() {
    return [{ source: '/:path*', headers: securityHeaders }]
  },
}

export default nextConfig
