import {
  DndContext,
  MouseSensor,
  TouchSensor,
  useSensor,
  useSensors,
} from "@dnd-kit/core";
import TeamColumn from "./TeamColumn.jsx";
import PlayerRow from "./PlayerRow.jsx";

// The three columns, in the order they are shown
const COLUMNS = [
  { team: "A", title: "Team A" },
  { team: "unassigned", title: "Unassigned" },
  { team: "B", title: "Team B" },
];

// The teams view of the Game page: Team A, the unassigned players and
// Team B. Everyone sees it; canArrange says whether this user may drag the
// players, and canRemove whether they get the Remove buttons.
// myPlayer is the logged-in user's own player, or undefined.
// working is true while an action is on its way, so it cannot be sent twice.
const Teams = ({
  game,
  players,
  myPlayer,
  canArrange,
  canRemove,
  working,
  onMove,
  onRemove,
}) => {
  // A drag starts only after the mouse moved 5 pixels, so a plain click on
  // Remove is still a click
  const mouseSensor = useSensor(MouseSensor, {
    activationConstraint: { distance: 5 },
  });
  // On a phone a drag starts after the finger rested on a player for a
  // moment; a quick swipe still scrolls the page
  const touchSensor = useSensor(TouchSensor, {
    activationConstraint: { delay: 200, tolerance: 5 },
  });
  const sensors = useSensors(mouseSensor, touchSensor);

  // Either side can be missing when that account was deleted
  const isOrganizer = (player) => {
    if (!game.organizer || !player.user) return false;
    return player.user._id === game.organizer._id;
  };

  // The organizer is never removed: the game is cancelled instead. An admin
  // who is a player has "Leave game" for their own row.
  const showsRemoveFor = (player) => {
    if (!canRemove || isOrganizer(player)) return false;
    // When the organizer's account was deleted, their player cannot be told
    // apart from another deleted user's, and the server refuses to remove
    // the organizer. So none of the "deleted user" rows of such a game gets
    // the button.
    if (!game.organizer && !player.user) return false;
    return !myPlayer || player._id !== myPlayer._id;
  };

  // active is the row that was dragged, over the column it was dropped on.
  // Their ids are the ones PlayerRow and TeamColumn gave to the library.
  const handleDragEnd = (event) => {
    // Dropped outside every column, or on a full team
    if (!event.over) return;

    const player = players.find((player) => player._id === event.active.id);
    const team = event.over.id;
    // Back where they were: nothing to save
    if (player.team === team) return;

    onMove(player, team);
  };

  return (
    <>
      <h2 className="h4 mb-3">Teams</h2>
      <DndContext sensors={sensors} onDragEnd={handleDragEnd}>
        <div className="row g-3">
          {COLUMNS.map((column) => {
            const columnPlayers = players.filter((player) => {
              return player.team === column.team;
            });
            const isUnassigned = column.team === "unassigned";

            return (
              <div className="col-12 col-md-4" key={column.team}>
                <TeamColumn
                  team={column.team}
                  title={column.title}
                  size={isUnassigned ? null : game.teamSize()}
                  playerCount={columnPlayers.length}
                  hint={
                    isUnassigned && canArrange
                      ? "Drag a player onto a team to assign them."
                      : ""
                  }
                >
                  {columnPlayers.map((player) => (
                    <PlayerRow
                      key={player._id}
                      player={player}
                      isOrganizer={isOrganizer(player)}
                      canDrag={canArrange}
                      showRemove={showsRemoveFor(player)}
                      working={working}
                      onRemove={onRemove}
                    />
                  ))}
                </TeamColumn>
              </div>
            );
          })}
        </div>
      </DndContext>
    </>
  );
};

export default Teams;
