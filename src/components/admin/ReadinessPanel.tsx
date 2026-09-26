'use client'

import { useState, useTransition } from 'react'
import { Check, RefreshCw, TriangleAlert } from 'lucide-react'
import { getReadinessAction } from '@/actions/admin'
import { READINESS_LABELS as LABELS } from '@/lib/admin/readiness'
import type { ReadinessCheck, ReadinessReport } from '@/types/app'


/**
 * ตรวจความพร้อมก่อนวันงาน
 *
 * ทุกอย่างที่ต้องครบก่อนเปิดระบบอยู่ในที่เดียว ไม่ต้องไล่เปิดทีละส่วนแล้วนับเอง
 * ข้อที่ทำให้ระบบ "เดินไม่ได้จริง" ขึ้นสีแดง ข้อที่แค่ไม่สวยขึ้นสีเหลือง
 */
export function ReadinessPanel({ initial }: { initial: ReadinessReport | null }) {
  const [report, setReport] = useState(initial)
  const [error, setError] = useState<string | null>(initial ? null : 'ยังตรวจไม่ได้ — ต้องรัน migration 017 ก่อน')
  const [pending, start] = useTransition()

  function recheck() {
    setError(null)
    start(async () => {
      const res = await getReadinessAction()
      if ('error' in res) setError(res.error)
      else { setReport(res); setError(null) }
    })
  }

  const checks = report?.checks ?? []
  const failed = checks.filter(c => c.count > 0)
  const blockers = failed.filter(c => LABELS[c.key]?.hard)
  const allClear = report !== null && failed.length === 0

  return (
    <section className="panel" style={{ padding: '1.4rem', display: 'flex', flexDirection: 'column', gap: 14 }}>
      <div style={{ display: 'flex', justifyContent: 'space-between', gap: 10, flexWrap: 'wrap', alignItems: 'center' }}>
        <span className="stamp" style={{ fontSize: '0.72rem', color: 'var(--neon)' }}>ตรวจความพร้อมก่อนวันงาน</span>
        <button type="button" className="btn-ghost" disabled={pending} onClick={recheck}
                style={{ padding: '0.45rem 0.9rem', minHeight: 38, fontSize: '0.82rem' }}>
          <RefreshCw size={14} aria-hidden="true" /> {pending ? 'กำลังตรวจ…' : 'ตรวจอีกครั้ง'}
        </button>
      </div>

      {error && <p role="alert" style={{ margin: 0, fontSize: '0.86rem', color: 'var(--ember)' }}>{error}</p>}

      {report && (
        <>
          <div className="ready-head" data-state={allClear ? 'ok' : blockers.length ? 'blocked' : 'warn'}>
            {allClear
              ? <><Check size={20} aria-hidden="true" /><span><strong>พร้อมเปิดระบบแล้ว</strong><small>ทุกข้อผ่านหมด</small></span></>
              : <><TriangleAlert size={20} aria-hidden="true" />
                  <span>
                    <strong>{blockers.length > 0 ? `ต้องแก้ก่อนเปิดระบบ ${blockers.length} ข้อ` : `ควรแก้อีก ${failed.length} ข้อ`}</strong>
                    <small>{blockers.length > 0 && failed.length > blockers.length && `และควรแก้อีก ${failed.length - blockers.length} ข้อ`}</small>
                  </span></>}
          </div>

          <div className="ready-stats">
            <span>น้องค่าย <strong>{report.students}</strong> คน</span>
            <span>ปริศนาที่เปิดใช้ <strong>{report.active_puzzles}</strong> ข้อ</span>
            <span>ระบบค่าย <strong style={{ color: report.camp_open ? 'var(--neon)' : 'var(--ember)' }}>
              {report.camp_open ? 'เปิดแล้ว' : 'ยังไม่เปิด'}</strong></span>
            <span>ประตูถอดรหัส <strong style={{ color: report.decrypt_unlocked ? 'var(--neon)' : 'var(--muted)' }}>
              {report.decrypt_unlocked ? 'เปิดแล้ว' : 'ยังปิด'}</strong></span>
          </div>

          <ul className="ready-list">
            {checks.map(check => <CheckRow key={check.key} check={check} />)}
          </ul>
        </>
      )}
    </section>
  )
}

function CheckRow({ check }: { check: ReadinessCheck }) {
  const meta = LABELS[check.key] ?? { title: check.key, fix: '' }
  const ok = check.count === 0
  const tone = ok ? 'ok' : meta.hard ? 'blocked' : 'warn'
  const hidden = check.count - check.sample.length

  return (
    <li className="ready-row" data-tone={tone}>
      <span className="ready-mark" aria-hidden="true">
        {ok ? <Check size={14} /> : <TriangleAlert size={14} />}
      </span>
      <div style={{ minWidth: 0, flex: 1 }}>
        <div className="ready-title">
          {meta.title}
          <span className="ready-count">{ok ? 'ผ่าน' : `${check.count} รายการ`}</span>
        </div>
        {!ok && (
          <>
            <p className="ready-fix">{meta.fix}</p>
            <p className="ready-sample">
              {check.sample.join(' · ')}{hidden > 0 && ` · และอีก ${hidden} รายการ`}
            </p>
          </>
        )}
      </div>
    </li>
  )
}
