import { FormField } from '../forms/FormField.jsx'
import { FormSection } from '../forms/FormSection.jsx'
import { SsspInput, SsspTextarea } from './SsspFields.jsx'
import { SSSP_SECTIONS } from '../../constants/ssspSections.js'
import { RiskRegister } from './RiskRegister.jsx'
import { RiskMatrix } from './RiskMatrix.jsx'
import { RepeatableList } from './RepeatableList.jsx'
import { SsspPlantEquipmentList } from './SsspPlantEquipmentList.jsx'
import {
  getSectionNotApplicableKey,
  getSsspRecordContext,
  isSectionNotApplicable,
  isSsspSectionComplete,
} from '../../utils/storage/ssspValidation.js'

function NotApplicableToggle({ checked, onChange, disabled }) {
  return (
    <label className="sssp-na-toggle">
      <input
        type="checkbox"
        className="item__checkbox"
        checked={checked}
        disabled={disabled}
        onChange={(event) => onChange(event.target.checked)}
      />
      <span>Not applicable for this job</span>
    </label>
  )
}

export function SsspSectionForm({
  sectionId,
  recordData,
  hazards,
  onSectionChange,
  onNotApplicableChange,
  onHazardsChange,
  readOnly = false,
  onNavigateCriticalRisks,
  equipment = [],
  isAdmin = false,
}) {
  const section = SSSP_SECTIONS.find((s) => s.id === sectionId)
  if (!section) return null

  const notApplicable = isSectionNotApplicable(recordData, section)
  const fieldsDisabled = readOnly || notApplicable

  function handleNotApplicableChange(checked) {
    const key = getSectionNotApplicableKey(section)
    if (!key || !onNotApplicableChange) return
    onNotApplicableChange(key, checked)
  }

  const naToggle = section.allowsNotApplicable ? (
    <NotApplicableToggle
      checked={notApplicable}
      onChange={handleNotApplicableChange}
      disabled={readOnly}
    />
  ) : null

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
        {naToggle}
        <div className={notApplicable ? 'sssp-section-form__body--na' : undefined}>
          <ListComponent
            items={data}
            itemFields={section.itemFields}
            onChange={(next) => onSectionChange(section.id, next)}
            readOnly={fieldsDisabled}
            addLabel={`Add ${section.shortTitle ?? section.title} row`}
            equipment={equipment}
            isAdmin={isAdmin}
          />
        </div>
      </FormSection>
    )
  }

  return (
    <FormSection title={section.title} id={`sssp-section-${section.id}`}>
      {naToggle}
      <div className={notApplicable ? 'sssp-section-form__body--na' : undefined}>
        {section.fields.map((field) => (
          <FormField key={field.key} label={field.label} required={field.required && !notApplicable}>
            {field.type === 'textarea' ? (
              fieldsDisabled ? (
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
            ) : fieldsDisabled ? (
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
      </div>
    </FormSection>
  )
}

export function SsspSectionNav({ sections, activeSectionId, onSelect, record }) {
  const { recordData, hazards } = getSsspRecordContext(record)

  function sectionComplete(section) {
    return isSsspSectionComplete(section, recordData, hazards, 'ready')
  }

  return (
    <>
    <label className="sssp-section-select">
      <span>SSSP section</span>
      <select value={activeSectionId} onChange={(event) => onSelect(event.target.value)}>
        {sections.map((section, index) => (
          <option key={section.id} value={section.id}>
            {index + 1}. {section.title}{sectionComplete(section) ? ' — complete' : ''}
          </option>
        ))}
      </select>
    </label>
    <nav className="sssp-section-nav" aria-label="SSSP sections">
      {sections.map((section, index) => {
        const complete = sectionComplete(section)
        return (
          <button
            key={section.id}
            type="button"
            className={`sssp-section-nav__btn${activeSectionId === section.id ? ' sssp-section-nav__btn--active' : ''}${complete ? ' sssp-section-nav__btn--complete' : ''}`}
            onClick={() => onSelect(section.id)}
            aria-current={activeSectionId === section.id ? 'step' : undefined}
          >
            <span className="sssp-section-nav__num">{index + 1}</span>
            <span className="sssp-section-nav__label">{section.shortTitle ?? section.title}</span>
            <span className="sssp-section-nav__state" aria-hidden="true">{complete ? '✓' : ''}</span>
          </button>
        )
      })}
    </nav>
    </>
  )
}
