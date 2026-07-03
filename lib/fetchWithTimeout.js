export async function fetchWithTimeout(input, options = {}, timeoutMs = 15000) {
  const controller = new AbortController()
  const timeout = setTimeout(() => controller.abort(), timeoutMs)
  const externalSignal = options.signal
  const abortFromExternal = () => controller.abort()

  if (externalSignal) {
    if (externalSignal.aborted) controller.abort()
    else externalSignal.addEventListener('abort', abortFromExternal, { once: true })
  }

  try {
    return await fetch(input, { ...options, signal: controller.signal })
  } catch (error) {
    if (error?.name === 'AbortError' && !externalSignal?.aborted) {
      throw new Error('The request timed out. Check your connection and try again.')
    }
    throw error
  } finally {
    clearTimeout(timeout)
    externalSignal?.removeEventListener('abort', abortFromExternal)
  }
}
