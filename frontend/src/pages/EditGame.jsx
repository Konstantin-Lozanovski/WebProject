import { useState, useEffect } from "react";
import { Link, useParams, useNavigate } from "react-router-dom";
import PageHeader from "../components/PageHeader.jsx";
import EmptyState from "../components/EmptyState.jsx";
import GameForm from "../components/GameForm.jsx";
import { fetchGame, updateGame } from "../services/api.js";
import { SPORT_BALLS } from "../models/Game.js";

const EditGame = ({ user }) => {
  // The id is the ":id" part of the address /games/:id/edit
  const { id } = useParams();
  const navigate = useNavigate();

  const [game, setGame] = useState(null);
  const [loading, setLoading] = useState(true);
  // Empty when the game loaded; otherwise what to tell the user
  const [loadError, setLoadError] = useState("");

  useEffect(() => {
    const getGame = async () => {
      setLoading(true);
      setLoadError("");

      try {
        const data = await fetchGame(id);
        setGame(data.game);
      } catch (error) {
        console.error("Error fetching the game:", error);
        const status = error.response ? error.response.status : null;
        if (status === 404 || status === 400) {
          setLoadError("Game not found. It may have been cancelled.");
        } else {
          setLoadError("The game could not be loaded. Please try again later.");
        }
      } finally {
        setLoading(false);
      }
    };

    getGame();
  }, [id]);

  // An error is not caught here: the form catches it and shows the message
  const handleSubmit = async (gameData) => {
    await updateGame(id, gameData);
    navigate(`/games/${id}`);
  };

  if (loading) return <p className="text-center py-5">Loading...</p>;

  if (loadError) {
    return (
      <div className="container py-5">
        <EmptyState title={loadError}>
          <Link className="btn btn-primary" to="/">
            Back to Home
          </Link>
        </EmptyState>
      </div>
    );
  }

  // Someone who typed the address of a game they cannot edit. The API would
  // refuse the edit anyway; this only saves them filling in the form.
  if (!game.canBeChangedBy(user)) {
    return (
      <div className="container py-5">
        <EmptyState
          title={
            game.isOrganizedBy(user)
              ? "This game has already started, so it can no longer be changed."
              : "Only the organizer can edit this game."
          }
        >
          <Link className="btn btn-primary" to={`/games/${id}`}>
            Back to the game
          </Link>
        </EmptyState>
      </div>
    );
  }

  return (
    <>
      <PageHeader
        title="Edit game"
        text={`${game.sport} in ${game.city}, organized by ${game.organizerName()}`}
        ball={SPORT_BALLS[game.sport]}
      />
      <div className="container page-body">
        <div className="row g-4">
          <div className="col-12 col-lg-8">
            <GameForm
              game={game}
              submitLabel="Save changes"
              backTo={`/games/${id}`}
              onSubmit={handleSubmit}
            />
          </div>
          <div className="col-12 col-lg-4">
            <div className="card">
              <div className="card-header">Good to know</div>
              <ul className="list-group list-group-flush">
                <li className="list-group-item">
                  The max cannot go below the {game.playerCount} players the
                  game has now.
                </li>
                <li className="list-group-item">
                  A new time is refused if it makes the game overlap another
                  game of one of its players.
                </li>
                <li className="list-group-item">
                  The organizer can edit the game until it starts.
                </li>
              </ul>
            </div>
          </div>
        </div>
      </div>
    </>
  );
};

export default EditGame;
