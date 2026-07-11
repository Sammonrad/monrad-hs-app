import { FormField } from '../forms/FormField.jsx'
import { FormSection } from '../forms/FormSection.jsx'
import { SsspInput, SsspTextarea } from './SsspFields.jsx'
import { SSSP_SECTIONS } from '../../constants/ssspSections.js'
import { RiskRegister } from './RiskRegister.jsx'
import { RiskMatrix } from './RiskMatrix.jsx'
import { RepeatableList } from './RepeatableList.jsx'
import { SsspPlantEquipmentList } from './SsspPlantEquipmentList.jsx'

export function SsspSectionForm({
  sectionId,
  recordData,
  hazards,
  onSectionChange,
  onHazardsChange,
  readOnly = false,
  onNavigateCriticalRisks,
  equipment = [],
  isAdmin = false,
}) {
  const section = SSSP_SECTIONS.find((s) => s.id === sectionId)
  if (!section) return null

  if (section.isRiskRegister) {
    return (
      <FormSection title={section.title} id={`sssp-section-${section.id}`}>
        <RiskRegister
          hazards={hazards}
          onChange={onHazardsChange}
          readOnly={readOnly}
          onNavigateCriticalRisks={onNavigateCriticalRisks}
        />
        <div className="sssp-section-form__matrix">
          <h3 className="form-section__title">Risk matrix reference</h3>
          <RiskMatrix compact />
        </div>
      </FormSection>
    )
  }

  const data = recordData?.[section.id]

  if (section.repeatable) {
    const ListComponent = section.id === 'plant' ? SsspPlantEquipmentList : RepeatableList
    return (
      <FormSection title={section.title} id={`sssp-section-${section.id}`}>
        <ListComponent
          items={data}
          itemFields={section.itemFields}
          onChange={(next) => onSectionChange(section.id, next)}
          readOnly={readOnly}
          addLabel={`Add ${section.shortTitle ?? section.title} row`}
          equipment={equipment}
          isAdmin={isAdmin}
        />
      </FormSection>
    )
  }

  return (
    <FormSection title={section.title} id={`sssp-section-${section.id}`}>
      {section.fields.map((field) => (
        <FormField key={field.key} label={field.label} required={field.required}>
          {field.type === 'textarea' ? (
            readOnly ? (
              <p className="sssp-readonly-value">{data?.[field.key] || '—'}</p>
            ) : (
              <SsspTextarea
                value={data?.[field.key] ?? ''}
                onChange={(v) =>
                  onSectionChange(section.id, { ...data, [field.key]: v })
                }
                rows={4}
              />
            )
          ) : readOnly ? (
            <p className="sssp-readonly-value">{data?.[field.key] || '—'}</p>
          ) : (
            <SsspInput
              type={field.type === 'date' ? 'date' : 'text'}
              value={data?.[field.key] ?? ''}
              onChange={(v) =>
                onSectionChange(section.id, { ...data, [field.key]: v })
              }
            />
          )}
        </FormField>
      ))}
    </FormSection>
  )
}

export function SsspSectionNav({ sections, activeSectionId, onSelect, recordData, hazards }) {
  function sectionComplete(section) {
    if (section.isRiskRegister) {
      return (hazards ?? []).some((h) => !h.archived)
    }
    const data = recordData?.[section.id]
    if (section.repeatable) return Array.isArray(data) && data.length > 0
    return section.fields?.some((f) => f.required && data?.[f.key]?.trim?.())
  }

  return (
    <nav className="sssp-section-nav" aria-label="SSSP sections">
      {sections.map((section, index) => {
        const complete = sectionComplete(section)
        return (
          <button
            key={section.id}
            type="button"
            className={`sssp-section-nav__btn${activeSectionId === section.id ? ' sssp-section-nav__btn--active' : ''}${complete ? ' sssp-section-nav__btn--complete' : ''}`}
            onClick={() => onSelect(section.id)}
          >
            <span className="sssp-section-nav__num">{index + 1}</span>
            <span className="sssp-section-nav__label">{section.shortTitle ?? section.title}</span>
          </button>
        )
      })}
    </nav>
  )
}
