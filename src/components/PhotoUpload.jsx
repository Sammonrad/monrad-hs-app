import { MAX_PHOTOS } from '../constants/index.js'
import { createRecordId } from '../utils/ids.js'
import { compressImage } from '../utils/image.js'

export function PhotoUpload({ photos, onChange, label }) {
  async function handleFiles(event) {
    const files = Array.from(event.target.files ?? [])
    if (!files.length) return

    const remaining = MAX_PHOTOS - photos.length
    if (remaining <= 0) {
      window.alert(`Maximum ${MAX_PHOTOS} photos allowed.`)
      event.target.value = ''
      return
    }

    const selected = files.slice(0, remaining)
    try {
      const compressed = await Promise.all(
        selected.map(async (file) => ({
          id: createRecordId(),
          name: file.name,
          dataUrl: await compressImage(file),
        })),
      )
      onChange([...photos, ...compressed])
    } catch {
      window.alert('Could not process one or more images.')
    }
    event.target.value = ''
  }

  function removePhoto(photoId) {
    onChange(photos.filter((photo) => photo.id !== photoId))
  }

  return (
    <div className="photos">
      <span className="field__label">{label ?? `Photos (max ${MAX_PHOTOS})`}</span>
      <label className="photos__upload">
        <input
          type="file"
          accept="image/*"
          multiple
          className="photos__input"
          onChange={handleFiles}
          disabled={photos.length >= MAX_PHOTOS}
        />
        Add photo{photos.length > 0 ? ` (${photos.length}/${MAX_PHOTOS})` : ''}
      </label>
      {photos.length > 0 && (
        <ul className="photos__thumbs">
          {photos.map((photo) => (
            <li key={photo.id} className="photos__thumb">
              <img src={photo.dataUrl} alt={photo.name} />
              <button type="button" className="photos__remove" onClick={() => removePhoto(photo.id)}>
                Remove
              </button>
            </li>
          ))}
        </ul>
      )}
      <p className="photos__hint">
        Up to {MAX_PHOTOS} images per record, resized to ~800px JPEG for device storage.
      </p>
    </div>
  )
}
