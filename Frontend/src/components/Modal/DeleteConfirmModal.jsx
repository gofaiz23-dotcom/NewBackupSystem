import './Modal.css'

const DeleteConfirmModal = ({ setting, onClose, onConfirm }) => {
  return (
    <div className="modal-overlay" onClick={onClose}>
      <div className="modal-content delete-modal" onClick={(e) => e.stopPropagation()}>
        <div className="modal-header">
          <h2>Delete Setting</h2>
          <button className="modal-close" onClick={onClose}>×</button>
        </div>

        <div className="modal-body">
          <p>Are you sure you want to delete this setting?</p>
          <div className="delete-info">
            <strong>ID:</strong> {setting.id}<br />
            <strong>Backend Name:</strong> {setting.backendname}
          </div>
        </div>

        <div className="modal-actions">
          <button type="button" onClick={onClose}>Cancel</button>
          <button type="button" className="btn-delete-confirm" onClick={onConfirm}>
            Delete
          </button>
        </div>
      </div>
    </div>
  )
}

export default DeleteConfirmModal
