'use client'

import { useState, useTransition } from 'react'
import { Check, Copy, Download, TriangleAlert } from 'lucide-react'
import { createStudentsChunkAction } from '@/actions/admin'
import { NAME_RULE, THAI_FULL_NAME, THAI_NICKNAME, tidyName } from '@/lib/profile/names'
import { BULK_CHUNK, parsePastedRows, type BulkStudentResult, type BulkStudentRow } from '@/lib/admin/rows'
import { isStudentEmail, normalizeEmail } from '@/lib/auth/email'
import { useConfirm } from '@/components/layout/ConfirmDialog'

const HEADER = ['อีเมล', 'ชื่อ-นามสกุล', 'ชื่อเล่น', 'รหัสผ่าน']

function toRows(text: string): BulkStudentRow[] {
  return parsePastedRows(text).map(({ line, cells }) => ({
    line,
    email: normalizeEmail(cells[0] ?? ''),
    name: tidyName(cells[1] ?? ''),
    nickname: tidyName(cells[2] ?? ''),
  }))
}

function problems(rows: BulkStudentRow[]) {
  const seen = new Set<string>()
  const bad: string[] = []
  for (const r of rows) {
    if (!isStudentEmail(r.email)) bad.push(`บรรทัด ${r.line}: อีเมลไม่ถูกต้อง`)
    else if (seen.has(r.email)) bad.push(`บรรทัด ${r.line}: อีเมลซ้ำกับบรรทัดก่อนหน้า`)
    else if (!THAI_FULL_NAME.test(r.name) || r.name.length > 100) bad.push(`บรรทัด ${r.line}: ชื่อ-นามสกุลไม่ถูกต้อง`)
    else if (!THAI_NICKNAME.test(r.nickname)) bad.push(`บรรทัด ${r.line}: ชื่อเล่นไม่ถูกต้อง`)
    seen.add(r.email)
  }
  return bad
}

/**
 * สร้างบัญชีน้องหลายคนจากการวางสเปรดชีต
 *
 * ส่งทีละก้อนเล็ก ๆ แล้วสะสมผลไว้ฝั่งเบราว์เซอร์ — ก้อนไหนพลาดก็เสียแค่ก้อนนั้น
 * รหัสผ่านทั้งหมดดูได้ครั้งเดียวตรงนี้ ต้องดาวน์โหลดหรือคัดลอกเก็บไว้ก่อนปิดหน้า
 */
export function StudentBulkCreator() {
  const [text, setText] = useState('')
  const [results, setResults] = useState<BulkStudentResult[]>([])
  const [done, setDone] = useState(0)
  const [total, setTotal] = useState(0)
  const [error, setError] = useState<string | null>(null)
  const [copied, setCopied] = useState(false)
  const [running, start] = useTransition()
  const confirm = useConfirm()

  const rows = toRows(text)
  const bad = problems(rows)
  const created = results.filter(r => r.password)
  const failed = results.filter(r => r.error)

  function run() {
    setError(null)
    if (bad.length) return
    start(async () => {
      const ok = await confirm({
        title: `สร้างบัญชีน้อง ${rows.length} คน?`,
        message: <>รหัสผ่านทั้งหมดแสดง<strong>ครั้งเดียว</strong> ดาวน์โหลดไฟล์เก็บไว้ก่อนปิดหน้า</>,
        confirmLabel: 'สร้างบัญชี',
      })
      if (!ok) return

      setResults([])
      setDone(0)
      setTotal(rows.length)
      setCopied(false)

      for (let i = 0; i < rows.length; i += BULK_CHUNK) {
        const chunk = rows.slice(i, i + BULK_CHUNK)
        const res = await createStudentsChunkAction(chunk)
        if (res.error) {
          setError(`${res.error} — หยุดที่บรรทัด ${chunk[0].line} บัญชีก่อนหน้าถูกสร้างแล้ว`)
          return
        }
        setResults(list => [...list, ...(res.results ?? [])])
        setDone(n => n + chunk.length)
      }
      setText('')
    })
  }

  function tsv() {
    return [HEADER.join('\t'), ...created.map(r => [r.email, r.name, r.nickname, r.password].join('\t'))].join('\n')
  }

  function download() {
    // ครอบทุกช่องด้วยอัญประกาศ กันชื่อที่มีจุลภาคทำให้คอลัมน์เพี้ยน
    const line = (cells: string[]) => cells.map(v => `"${v.replace(/"/g, '""')}"`).join(',')
    // ﻿ ข้างหน้า ไม่อย่างนั้น Excel อ่านภาษาไทยเป็นตัวยึกยือ
    const csv = '﻿' + [line(HEADER), ...created.map(r => line([r.email, r.name, r.nickname, r.password!]))].join('\r\n')
    const url = URL.createObjectURL(new Blob([csv], { type: 'text/csv;charset=utf-8' }))
    const a = document.createElement('a')
    a.href = url
    a.download = `ictp-accounts-${new Date().toISOString().slice(0, 10)}.csv`
    a.click()
    URL.revokeObjectURL(url)
  }

  async function copyAll() {
    try {
      await navigator.clipboard.writeText(tsv())
      setCopied(true)
    } catch {
      setCopied(false)
    }
  }

  return (
    <section className="panel" style={{ padding: '1.4rem', display: 'flex', flexDirection: 'column', gap: 14 }}>
      <span className="stamp" style={{ fontSize: '0.72rem', color: 'var(--neon)' }}>สร้างบัญชีทีละหลายคน</span>

      <p style={{ margin: 0, fontSize: '0.84rem', color: 'var(--muted)', lineHeight: 1.7 }}>
        หนึ่งบรรทัดต่อหนึ่งคน เรียงคอลัมน์ <span style={{ fontFamily: 'var(--tech)' }}>อีเมลน้อง | ชื่อ-นามสกุล | ชื่อเล่น</span>
        {' '}คัดลอกจาก Google Sheets มาวางได้เลย · {NAME_RULE}
      </p>

      <textarea
        rows={8} className="field" value={text} onChange={e => setText(e.target.value)} disabled={running}
        style={{ fontFamily: 'var(--tech)', fontSize: '0.85rem', resize: 'vertical' }}
        placeholder={'s12345@bj.ac.th\tสมชาย ใจดี\tเอก\ns12346@bj.ac.th\tสมหญิง ตั้งใจ\tหญิง'}
      />

      {rows.length > 0 && bad.length === 0 && !running && (
        <p style={{ margin: 0, fontSize: '0.86rem', color: 'var(--neon)' }}>พร้อมสร้าง {rows.length} บัญชี</p>
      )}

      {bad.length > 0 && (
        <div role="alert" style={{ fontSize: '0.84rem', color: 'var(--ember)', lineHeight: 1.7 }}>
          <div style={{ display: 'flex', alignItems: 'center', gap: 7 }}>
            <TriangleAlert size={15} aria-hidden="true" /> ต้องแก้ก่อนจึงจะสร้างได้
          </div>
          <ul style={{ margin: '0.3rem 0 0', paddingLeft: '1.4rem' }}>
            {bad.slice(0, 8).map(b => <li key={b}>{b}</li>)}
            {bad.length > 8 && <li>… และอีก {bad.length - 8} บรรทัด</li>}
          </ul>
        </div>
      )}

      {running && total > 0 && (
        <div>
          <div style={{ fontSize: '0.84rem', color: 'var(--muted)' }}>กำลังสร้าง {done} / {total} บัญชี — อย่าปิดหน้านี้</div>
          <div role="progressbar" aria-valuenow={done} aria-valuemin={0} aria-valuemax={total}
               style={{ height: 7, background: 'var(--plank-2)', borderRadius: 4, marginTop: 8, overflow: 'hidden' }}>
            <div style={{ width: `${total ? (done / total) * 100 : 0}%`, height: '100%', background: 'var(--brass)', transition: 'width 0.2s' }} />
          </div>
        </div>
      )}

      {error && <p role="alert" style={{ margin: 0, fontSize: '0.86rem', color: 'var(--ember)' }}>{error}</p>}

      <button type="button" className="btn-brass" disabled={running || rows.length === 0 || bad.length > 0} onClick={run}>
        {running ? 'กำลังสร้างบัญชี…' : rows.length > 0 ? `สร้างบัญชี ${rows.length} คน` : 'สร้างบัญชีทั้งหมด'}
      </button>

      {results.length > 0 && (
        <>
          <div style={{
            padding: '0.9rem 1rem', borderRadius: 8,
            background: 'var(--plank-2)', border: `1px solid ${failed.length ? 'var(--ember)' : 'var(--neon)'}`,
            display: 'flex', flexDirection: 'column', gap: 10,
          }}>
            <span style={{ fontSize: '0.86rem' }}>
              สร้างสำเร็จ {created.length} บัญชี{failed.length > 0 && ` · ไม่สำเร็จ ${failed.length}`}
              <br />
              <span style={{ color: 'var(--ember)' }}>รหัสผ่านแสดงครั้งเดียว — เก็บไฟล์ไว้ก่อนปิดหน้านี้</span>
            </span>
            <div style={{ display: 'flex', gap: 8, flexWrap: 'wrap' }}>
              <button type="button" className="btn-brass" onClick={download} disabled={created.length === 0}
                      style={{ padding: '0.5rem 1rem', minHeight: 40 }}>
                <Download size={14} aria-hidden="true" /> ดาวน์โหลดไฟล์ CSV
              </button>
              <button type="button" className="btn-ghost" onClick={copyAll} disabled={created.length === 0}
                      style={{ padding: '0.5rem 1rem', minHeight: 40 }}>
                {copied ? <><Check size={14} aria-hidden="true" /> คัดลอกแล้ว</> : <><Copy size={14} aria-hidden="true" /> คัดลอกทั้งหมด</>}
              </button>
            </div>
          </div>

          <div style={{ overflowX: 'auto' }}>
            <table className="match-table">
              <thead>
                <tr><th>อีเมล</th><th>ชื่อ-นามสกุล</th><th>ชื่อเล่น</th><th>รหัสผ่าน</th></tr>
              </thead>
              <tbody>
                {results.map(r => (
                  <tr key={`${r.line}-${r.email}`}>
                    <td style={{ fontFamily: 'var(--tech)', fontSize: '0.8rem' }}>{r.email}</td>
                    <td>{r.name}</td>
                    <td>{r.nickname}</td>
                    <td style={{ fontFamily: 'var(--tech)', color: r.password ? 'var(--neon)' : 'var(--ember)' }}>
                      {r.password ?? r.error}
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        </>
      )}
    </section>
  )
}
