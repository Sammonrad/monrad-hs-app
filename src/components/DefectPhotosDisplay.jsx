export function DefectPhotosDisplay({ photos, title = 'Defect photos', className = '' }) {
  if (!photos?.length) return null

  return (
    <div className={`record__photos ${className}`.trim()}>
      <h3 className="record__subtitle">{title}</h3>
      <ul className="photos__thumbs photos__thumbs--record">
        {photos.map((photo) => (
          <li key={photo.id} className="photos__thumb">
            <img src={photo.dataUrl} alt={photo.name} />
          </li>
        ))}
      </ul>
    </div>
  )
}
