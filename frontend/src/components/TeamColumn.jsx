import { useDroppable } from "@dnd-kit/core";

// One of the three columns of the teams view: a card a player can be
// dropped on.
// team is "A", "B" or "unassigned" and is what a drop here sets.
// size is how many spaces the team has; null for the unassigned column,
// which has no limit.
// children are the rows of the players in this column.
const TeamColumn = ({ team, title, size, playerCount, hint, children }) => {
  const isFull = size !== null && playerCount >= size;

  // A full team is switched off as a place to drop, so the drop is refused
  // here and no request is sent
  const { setNodeRef, isOver } = useDroppable({ id: team, disabled: isFull });

  // One entry for each space nobody is in
  const freeSpaces = [];
  if (size !== null) {
    for (let space = playerCount; space < size; space++) {
      freeSpaces.push(space);
    }
  }

  return (
    // "team-A", "team-B" or "team-unassigned" gives the column its colour
    <div
      className={`card h-100 team-column team-${team} ${isOver ? "is-over" : ""}`}
      ref={setNodeRef}
    >
      <div className="card-header">
        {title}{" "}
        <span className="text-muted">
          {size === null ? `(${playerCount})` : `(${playerCount} of ${size})`}
        </span>
      </div>
      <ul className="list-group list-group-flush">
        {children}
        {freeSpaces.map((space) => (
          <li className="free-space" key={space}>
            Free space
          </li>
        ))}
      </ul>
      {hint && (
        <div className="card-body text-muted">
          <small>{hint}</small>
        </div>
      )}
    </div>
  );
};

export default TeamColumn;
