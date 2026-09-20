'use client'

import { createContext, useCallback, useContext, useEffect, useRef, useState } from 'react'
import { CircleHelp, TriangleAlert } from 'lucide-react'

export interface ConfirmOptions {
  title: string
  message?: React.ReactNode
  confirmLabel?: string
  cancelLabel?: string
  /** danger = ปุ่มยืนยันสีแดง และโฟกัสเริ่มที่ปุ่มยกเลิก กันกด Enter พลาด */
  tone?: 'danger' | 'default'
}

type Confirm = (options: ConfirmOptions) => Promise<boolean>

const ConfirmContext = createContext<Confirm>(async () => false)

/**
 * แทน window.confirm() ของเบราว์เซอร์ — เรียกได้แบบเดียวกันแต่ต้อง await
 *   const confirm = useConfirm()
 *   if (!(await confirm({ title: 'ลบประกาศนี้?', tone: 'danger' }))) return
 */
export const useConfirm = () => useContext(ConfirmContext)

export function ConfirmProvider({ children }: { children: React.ReactNode }) {
  const ref = useRef<HTMLDialogElement>(null)
  const resolver = useRef<((ok: boolean) => void) | null>(null)
  const [options, setOptions] = useState<ConfirmOptions | null>(null)
  // เปลี่ยนทุกครั้งที่เปิด ให้ React สร้างปุ่มใหม่ autoFocus จึงทำงานทุกรอบ
  const [round, setRound] = useState(0)

  const confirm = useCallback<Confirm>(opts => new Promise(resolve => {
    resolver.current?.(false)          // มีกล่องค้างอยู่ = ถือว่ายกเลิกอันเก่า
    resolver.current = resolve
    setOptions(opts)
    setRound(n => n + 1)
  }), [])

  useEffect(() => {
    if (options && !ref.current?.open) ref.current?.showModal()
  }, [options, round])

  function settle(ok: boolean) {
    resolver.current?.(ok)
    resolver.current = null
    if (ref.current?.open) ref.current.close()
  }

  const danger = options?.tone === 'danger'

  return (
    <ConfirmContext.Provider value={confirm}>
      {children}
      <dialog
        ref={ref}
        className="confirm"
        data-tone={danger ? 'danger' : 'default'}
        aria-labelledby="confirm-title"
        aria-describedby={options?.message ? 'confirm-message' : undefined}
        // Esc ปิด = ยกเลิก
        onClose={() => settle(false)}
        // คลิกนอกกล่อง = ยกเลิก
        onClick={e => { if (e.target === e.currentTarget) settle(false) }}
      >
        {options && (
          <div className="confirm-card" key={round}>
            <span className="confirm-icon" aria-hidden="true">
              {danger ? <TriangleAlert size={26} /> : <CircleHelp size={26} />}
            </span>
            <h2 id="confirm-title" className="confirm-title">{options.title}</h2>
            {options.message && <div id="confirm-message" className="confirm-message">{options.message}</div>}
            <div className="confirm-actions">
              <button type="button" className="confirm-btn confirm-btn--cancel" autoFocus={danger} onClick={() => settle(false)}>
                {options.cancelLabel ?? 'ยกเลิก'}
              </button>
              <button type="button" className="confirm-btn confirm-btn--ok" autoFocus={!danger} onClick={() => settle(true)}>
                {options.confirmLabel ?? 'ยืนยัน'}
              </button>
            </div>
          </div>
        )}
      </dialog>
    </ConfirmContext.Provider>
  )
}
