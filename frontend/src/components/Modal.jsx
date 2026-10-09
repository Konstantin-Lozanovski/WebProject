import { useEffect } from "react";

// The one popup of the app. It knows nothing about what it is confirming:
// the screen that opens it passes in the title, the text, the two button
// labels and what to do on confirm.
// It is shown by rendering it and hidden by not rendering it, so the screen
// keeps the "is it open" state.
// confirmVariant is the Bootstrap colour of the confirm button, for example
// "danger" for a delete.
const Modal = ({
  title,
  text,
  confirmLabel,
  cancelLabel,
  confirmVariant = "primary",
  onConfirm,
  onClose,
}) => {
  // Escape closes the popup, the same as in Bootstrap's own modal
  useEffect(() => {
    const handleKeyDown = (e) => {
      if (e.key === "Escape") onClose();
    };

    document.addEventListener("keydown", handleKeyDown);
    // Runs when the popup is removed, so the listener does not stay behind
    return () => document.removeEventListener("keydown", handleKeyDown);
  }, [onClose]);

  return (
    <>
      {/* "show d-block" makes Bootstrap's modal visible without its script */}
      <div
        className="modal show d-block"
        tabIndex="-1"
        role="dialog"
        aria-modal="true"
        aria-labelledby="modalTitle"
      >
        <div className="modal-dialog modal-dialog-centered">
          <div className="modal-content">
            <div className="modal-header">
              <h2 className="modal-title h5" id="modalTitle">
                {title}
              </h2>
              <button
                className="btn-close"
                type="button"
                aria-label="Close"
                onClick={onClose}
              ></button>
            </div>
            <div className="modal-body">{text}</div>
            <div className="modal-footer">
              <button
                className="btn btn-outline-secondary"
                type="button"
                onClick={onClose}
              >
                {cancelLabel}
              </button>
              <button
                className={`btn btn-${confirmVariant}`}
                type="button"
                onClick={onConfirm}
              >
                {confirmLabel}
              </button>
            </div>
          </div>
        </div>
      </div>
      {/* The dark layer over the rest of the page */}
      <div className="modal-backdrop show"></div>
    </>
  );
};

export default Modal;
