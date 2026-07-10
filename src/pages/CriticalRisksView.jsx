import { ChevronDown } from 'lucide-react'
import { BackButton } from '../components/BackButton.jsx'
import { FormPageHeader } from '../components/forms/FormPageHeader.jsx'
import {
  CRITICAL_RISKS_INTRO,
  CRITICAL_RISKS_FOOTER,
  CRITICAL_RISK_CATEGORIES,
} from '../constants/criticalRisks.js'

export function CriticalRisksView({ onBack }) {
  return (
    <>
      <BackButton onClick={onBack} />

      <FormPageHeader
        title="Critical Risks"
        subtitle="Site reference — review before work begins"
      />

      <section className="critical-risks" aria-labelledby="critical-risks-intro">
        <p id="critical-risks-intro" className="critical-risks__intro">
          {CRITICAL_RISKS_INTRO}
        </p>

        <div className="critical-risks__list critical-risks__list--grid">
          {CRITICAL_RISK_CATEGORIES.map((category) => (
              <details
                key={category.id}
                className="critical-risks__item"
              >
                <summary className="critical-risks__summary">
                  <span className="critical-risks__title">{category.title}</span>
                  <ChevronDown
                    className="critical-risks__chevron"
                    size={18}
                    strokeWidth={2}
                    aria-hidden="true"
                  />
                </summary>

                <div className="critical-risks__content">
                  <div className="critical-risks__block">
                    <h3 className="critical-risks__heading">What must be checked</h3>
                    <ul className="critical-risks__bullets">
                      {category.checks.map((item) => (
                        <li key={item}>{item}</li>
                      ))}
                    </ul>
                  </div>

                  <div className="critical-risks__block">
                    <h3 className="critical-risks__heading">Required controls</h3>
                    <ul className="critical-risks__bullets">
                      {category.controls.map((item) => (
                        <li key={item}>{item}</li>
                      ))}
                    </ul>
                  </div>

                  <div className="critical-risks__block critical-risks__block--stop">
                    <h3 className="critical-risks__heading">Stop-work triggers</h3>
                    <ul className="critical-risks__bullets">
                      {category.stopWork.map((item) => (
                        <li key={item}>{item}</li>
                      ))}
                    </ul>
                  </div>
                </div>
              </details>
          ))}
        </div>

        <p className="critical-risks__footer">{CRITICAL_RISKS_FOOTER}</p>
      </section>
    </>
  )
}
