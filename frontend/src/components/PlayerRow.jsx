import { useDraggable } from "@dnd-kit/core";

// One player in a column of the teams view.
// canDrag says whether this row can be picked up and dropped on a column.
// showRemove says whether the row has a Remove button.
// working is true while an action is on its way, so it cannot be sent twice.
const PlayerRow = ({
  player,
  isOrganizer,
  canDrag,
  showRemove,
  working,
  onRemove,
}) => {
  // The id is how the drop tells us which player was dragged.
  // transform is how far the row has been dragged from its place so far.
  const { setNodeRef, listeners, transform, isDragging } = useDraggable({
    id: player._id,
    disabled: !canDrag,
  });

  const content = (
    <>
      <span>
        {player.username()}{" "}
        {isOrganizer && <span className="badge text-bg-dark">Organizer</span>}
      </span>
      {showRemove && (
        <button
          className="btn btn-outline-danger btn-sm"
          type="button"
          disabled={working}
          onClick={() => onRemove(player)}
        >
          Remove
        </button>
      )}
    </>
  );

  // Everyone but the organizer and admins gets a plain row
  if (!canDrag) {
    return (
      <li className="list-group-item d-flex justify-content-between align-items-center gap-2">
        {content}
      </li>
    );
  }

  // The library only reports the distance; moving the row is up to us
  let style;
  if (transform) {
    style = { transform: `translate(${transform.x}px, ${transform.y}px)` };
  }

  // listeners are the mouse and touch handlers that start a drag
  return (
    <li
      className={`list-group-item d-flex justify-content-between align-items-center gap-2 player-draggable ${isDragging ? "is-dragging" : ""}`}
      ref={setNodeRef}
      style={style}
      {...listeners}
    >
      {content}
    </li>
  );
};

export default PlayerRow;
