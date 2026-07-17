export function dashboardPanelProps(scope, tab, active) {
  return {
    hidden: !active,
    'aria-hidden': active ? 'false' : 'true',
    inert: active ? undefined : '',
    tabIndex: active ? -1 : undefined,
    'data-dashboard-panel': scope,
    'data-dashboard-tab': tab,
  }
}

function escapeSelectorValue(value) {
  if (typeof CSS !== 'undefined' && typeof CSS.escape === 'function') return CSS.escape(String(value))
  return String(value).replace(/["\\]/g, '\\$&')
}

export function getDashboardPanel(scope, tab) {
  if (typeof document === 'undefined') return null
  return document.querySelector(`[data-dashboard-panel="${escapeSelectorValue(scope)}"][data-dashboard-tab="${escapeSelectorValue(tab)}"]`)
}

export function prepareDashboardTabFocus(scope, currentTab, nextTab) {
  if (typeof document === 'undefined' || currentTab === nextTab) return false
  const activeElement = document.activeElement
  const currentPanel = getDashboardPanel(scope, currentTab)
  if (!activeElement || !currentPanel || !currentPanel.contains(activeElement)) return false
  if (typeof activeElement.blur === 'function') activeElement.blur()
  window.requestAnimationFrame?.(() => focusDashboardPanel(scope, nextTab))
  return true
}

export function focusDashboardPanel(scope, tab) {
  const panel = getDashboardPanel(scope, tab)
  if (!panel || panel.hidden || panel.getAttribute('aria-hidden') === 'true') return false
  panel.focus({ preventScroll: true })
  return document.activeElement === panel
}
