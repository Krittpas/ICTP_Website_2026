/**
 * แยกข้อความที่วางมาจากสเปรดชีตเป็นแถว — ใช้ร่วมกันทั้งฝั่งเบราว์เซอร์และ server
 * คั่นด้วยแท็บ (คัดลอกจาก Google Sheets มาตรง ๆ) หรือจุลภาค
 * ช่องสุดท้ายเก็บส่วนที่เหลือทั้งหมด เผื่อมีจุลภาคอยู่ข้างใน เช่นข้อความเบาะแส
 */
export interface BulkStudentRow { line: number; email: string; name: string; nickname: string }
export interface BulkStudentResult extends BulkStudentRow { password?: string; error?: string }

/** จำนวนสูงสุดต่อหนึ่งคำขอ — เบราว์เซอร์ส่งมาทีละก้อน กันคำขอค้างจนหมดเวลาแล้วรหัสผ่านหาย */
export const BULK_CHUNK = 5

export interface PastedRow {
  line: number
  cells: string[]
  /** ช่องที่ 4 เป็นต้นไปรวมกัน */
  rest: string
}

export function parsePastedRows(text: string): PastedRow[] {
  return text.split(/\r?\n/)
    .map((raw, i) => ({ raw, line: i + 1 }))
    .filter(({ raw }) => raw.trim())
    // ข้ามหัวตารางถ้าคัดลอกมาทั้งแผ่น
    .filter(({ raw, line }) => !(line === 1 && /email|อีเมล/i.test(raw)))
    .map(({ raw, line }) => {
      const tabbed = raw.includes('\t')
      const cells = raw.split(tabbed ? '\t' : ',').map(c => c.trim())
      return { line, cells, rest: cells.slice(3).join(tabbed ? ' ' : ', ').trim() }
    })
}
