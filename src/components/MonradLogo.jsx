export const MONRAD_LOGO_SRC = '/monrad-logo.jpg'
export const MONRAD_LOGO_HEADER_SRC = '/monrad-logo-cropped.jpg'

const LOGO_SRC_BY_VARIANT = {
  header: MONRAD_LOGO_HEADER_SRC,
  print: MONRAD_LOGO_SRC,
  default: MONRAD_LOGO_SRC,
}

export function MonradLogo({ variant = 'default', className = '' }) {
  const classes = ['monrad-logo', `monrad-logo--${variant}`, className].filter(Boolean).join(' ')
  const src = LOGO_SRC_BY_VARIANT[variant] ?? MONRAD_LOGO_SRC

  const img = (
    <img
      src={src}
      alt="Monrad Earthworx"
      className={classes}
      width={variant === 'header' ? 750 : 160}
      height={variant === 'header' ? 120 : 48}
    />
  )

  return img
}
