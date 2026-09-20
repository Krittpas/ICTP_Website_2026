'use server'

import { revalidatePath } from 'next/cache'
import { createClient } from '@/lib/supabase/server'
import { getActionUser } from '@/lib/auth/dal'
import type { AnswerResult, MyPuzzle } from '@/types/app'

export async function getMyPuzzle(): Promise<MyPuzzle> {
  if (!(await getActionUser())) return { status: 'unauthorized' }
  const supabase = await createClient()
  const { data, error } = await supabase.rpc('get_my_puzzle')
  if (error) return { status: 'unauthorized' }
  return data as MyPuzzle
}

/**
 * ส่งคำตอบ
 *
 * action ตัวนี้ไม่ตัดสินอะไรเลย — แค่ตรวจรูปแบบแล้วส่งต่อให้ RPC
 * เงื่อนไขทุกข้อ (ที่นั่งของใคร ถึงคิวหรือยัง ตอบกี่ครั้งแล้ว) ตัดสินในฐานข้อมูล
 * ซึ่งเป็นที่เดียวที่ client เลี่ยงไม่ได้
 */
export async function submitAnswerAction(puzzleId: number, answer: string): Promise<AnswerResult> {
  if (!(await getActionUser())) return { status: 'unauthorized' }

  const trimmed = answer?.trim()
  if (!trimmed || trimmed.length > 500) return { status: 'incorrect' }
  if (!Number.isInteger(puzzleId)) return { status: 'not_your_puzzle' }

  const supabase = await createClient()
  const { data, error } = await supabase.rpc('submit_city_answer', {
    p_puzzle_id: puzzleId,
    p_answer: trimmed,
  })

  if (error) {
    console.error('submit_city_answer:', error.message)
    return { status: 'error' }
  }

  const result = data as AnswerResult
  if (result.status === 'correct') {
    revalidatePath('/senior/puzzles')
    revalidatePath('/senior/decrypt')
  }
  return result
}
