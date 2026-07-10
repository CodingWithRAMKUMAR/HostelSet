import { useState } from 'react'
import BrandLogo from '../BrandLogo'
import NotificationBell from '../common/NotificationBell'
import DashboardIcon from './DashboardIcon'

function ProfileAvatar({ avatar, avatarUrl, avatarAlt, fallbackIcon }) {
  const [imageFailed, setImageFailed] = useState(false)
  const showImage = Boolean(avatarUrl) && !imageFailed

  if (showImage) {
    return <img src={avatarUrl} alt={avatarAlt || 'Profile photo'} onError={() => setImageFailed(true)} className="h-full w-full rounded-full object-cover" />
  }

  if (fallbackIcon) {
    return <DashboardIcon name={fallbackIcon} className="h-4 w-4" aria-hidden="true" />
  }

  return <span>{avatar}</span>
}

export default function MobileTopbar({ title, subtitle, isHome, onBack, controls, onProfile, avatar = 'U', avatarUrl, avatarAlt, fallbackIcon, accountMenu }) {
  return (
    <header className="sticky top-0 z-50 border-b border-white/10 bg-slate-950/95 pt-[env(safe-area-inset-top)] text-white backdrop-blur lg:hidden">
      <div className="flex min-h-[44px] w-full min-w-0 items-center gap-1.5 px-2.5 py-1">
        {isHome ? (
          <div className="w-8 shrink-0 overflow-hidden">
            <BrandLogo size="mobile" priority />
          </div>
        ) : (
          <button type="button" onClick={onBack} aria-label="Back to dashboard" className="flex h-8 w-8 shrink-0 items-center justify-center rounded-xl bg-white/10 text-base focus:outline-none focus-visible:ring-2 focus-visible:ring-orange-400">
            &larr;
          </button>
        )}
        <div className="min-w-0 flex-1 px-1 text-center">
          <p className="truncate text-[13px] font-black leading-tight">{title}</p>
          {subtitle && <p className="truncate text-[10px] font-medium leading-tight text-slate-400">{subtitle}</p>}
        </div>
        <div className="relative flex shrink-0 items-center gap-0.5">
          {controls ?? <NotificationBell listenForGlobalOpen />}
          <button type="button" onClick={onProfile} aria-label="Open account menu" className="flex h-8 w-8 items-center justify-center overflow-hidden rounded-full bg-gradient-to-br from-orange-500 to-amber-500 text-xs font-bold focus:outline-none focus-visible:ring-2 focus-visible:ring-orange-300">
            <ProfileAvatar avatar={avatar} avatarUrl={avatarUrl} avatarAlt={avatarAlt} fallbackIcon={fallbackIcon} />
          </button>
          {accountMenu}
        </div>
      </div>
    </header>
  )
}
