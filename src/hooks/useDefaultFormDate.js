import { useEffect } from 'react'
import { TODAY } from '../constants/index.js'

export function useDefaultFormDate(setDraft) {
  useEffect(() => {
    setDraft((prev) => {
      if (prev.fields?.date?.trim()) return prev
      return { ...prev, fields: { ...prev.fields, date: TODAY() } }
    })
  }, [setDraft])
}
