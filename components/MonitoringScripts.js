import { useEffect } from 'react'
import Script from 'next/script'
import { useRouter } from 'next/router'
import { logger } from '../lib/logger'

export default function MonitoringScripts() {
  const router = useRouter()
  const gaId = process.env.NEXT_PUBLIC_GA_MEASUREMENT_ID
  const posthogKey = process.env.NEXT_PUBLIC_POSTHOG_KEY
  const posthogHost = (process.env.NEXT_PUBLIC_POSTHOG_HOST || 'https://us.i.posthog.com').replace(/\/$/, '')

  useEffect(() => {
    const onError = event => logger.error('Unhandled browser error', event.error || new Error(event.message), { source: event.filename, line: event.lineno, column: event.colno })
    const onRejection = event => logger.error('Unhandled promise rejection', event.reason instanceof Error ? event.reason : new Error(String(event.reason)))
    window.addEventListener('error', onError)
    window.addEventListener('unhandledrejection', onRejection)
    return () => { window.removeEventListener('error', onError); window.removeEventListener('unhandledrejection', onRejection) }
  }, [])

  useEffect(() => {
    const trackPage = url => {
      if (gaId && window.gtag) window.gtag('config', gaId, { page_path: url, anonymize_ip: true })
      if (posthogKey && window.posthog?.capture) window.posthog.capture('$pageview', { $current_url: window.location.href })
    }
    router.events.on('routeChangeComplete', trackPage)
    return () => router.events.off('routeChangeComplete', trackPage)
  }, [router.events, gaId, posthogKey])

  return <>
    {gaId && <>
      <Script src={`https://www.googletagmanager.com/gtag/js?id=${encodeURIComponent(gaId)}`} strategy="afterInteractive" />
      <Script id="hostelset-ga4" strategy="afterInteractive" dangerouslySetInnerHTML={{ __html: `window.dataLayer=window.dataLayer||[];function gtag(){dataLayer.push(arguments)}gtag('js',new Date());gtag('config',${JSON.stringify(gaId)},{anonymize_ip:true});` }} />
    </>}
    {posthogKey && <Script id="hostelset-posthog" strategy="afterInteractive" dangerouslySetInnerHTML={{ __html: `!function(t,e){var o,n,p,r;e.__SV||(window.posthog=e,e._i=[],e.init=function(i,s,a){function g(t,e){var o=e.split('.');2==o.length&&(t=t[o[0]],e=o[1]),t[e]=function(){t.push([e].concat(Array.prototype.slice.call(arguments,0)))}}(p=t.createElement('script')).type='text/javascript',p.async=!0,p.src=s.api_host+'/static/array.js',(r=t.getElementsByTagName('script')[0]).parentNode.insertBefore(p,r);var u=e;for(void 0!==a?u=e[a]=[]:a='posthog',u.people=u.people||[],u.toString=function(t){var e='posthog';return'posthog'!==a&&(e+='.'+a),t||(e+=' (stub)'),e},u.people.toString=function(){return u.toString(1)+'.people (stub)'},o='capture identify alias people.set people.set_once reset'.split(' '),n=0;n<o.length;n++)g(u,o[n]);e._i.push([i,s,a])},e.__SV=1)}(document,window.posthog||[]);posthog.init(${JSON.stringify(posthogKey)},{api_host:${JSON.stringify(posthogHost)},capture_pageview:true,person_profiles:'identified_only'});` }} />}
  </>
}
