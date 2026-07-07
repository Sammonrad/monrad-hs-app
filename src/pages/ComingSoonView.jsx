import { BackButton } from '../components/BackButton.jsx'

export function ComingSoonView({ title, onBack }) {
  return (
    <div className="placeholder-view">
      <BackButton onClick={onBack} />
      <header className="header">
        <p className="company">Monrad Earthworx</p>
        <h1 className="title">{title}</h1>
      </header>
      <div className="placeholder-view__content">
        <p className="placeholder-view__label">Coming soon</p>
        <p className="placeholder-view__text">
          This form is not available yet. Job Start Checklist is ready to use now.
        </p>
      </div>
    </div>
  )
}
