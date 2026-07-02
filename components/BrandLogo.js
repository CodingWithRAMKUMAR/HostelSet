import Image from 'next/image'

const sizes = {
  header: 'h-12 sm:h-14 w-auto max-w-[86px]',
  login: 'h-36 sm:h-44 w-auto max-w-full',
  footer: 'h-20 w-auto max-w-[124px]',
}

export default function BrandLogo({ size = 'header', className = '', priority = false }) {
  return (
    <Image
      src="/brand/logo-primary.png"
      alt="HostelSet"
      width={605}
      height={493}
      priority={priority}
      className={`shrink-0 object-contain ${sizes[size] || sizes.header} ${className}`}
    />
  )
}
