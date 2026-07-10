import { useCallback, useEffect } from 'react'

const DEFAULT_MESSAGE = 'You have unsaved changes. Leave without saving?'

export function useUnsavedChangesGuard(isDirty, message = DEFAULT_MESSAGE) {
  useEffect(() => {
    if (!isDirty || typeof window === 'undefined') return undefined

    const handleBeforeUnload = (event) => {
      event.preventDefault()
      event.returnValue = ''
      return ''
    }

    window.addEventListener('beforeunload', handleBeforeUnload)
    return () => window.removeEventListener('beforeunload', handleBeforeUnload)
  }, [isDirty])

  return useCallback(() => {
    if (!isDirty) return true
    return window.confirm(message)
  }, [isDirty, message])
}
