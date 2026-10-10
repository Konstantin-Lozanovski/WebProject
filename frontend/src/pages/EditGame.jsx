import { useState, useEffect } from "react";
import { Link, useParams, useNavigate } from "react-router-dom";
import GameForm from "../components/GameForm.jsx";
import { fetchGame, updateGame } from "../services/api.js";

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
      <div className="container text-center py-5">
        <h1 className="h2 mb-3">{loadError}</h1>
        <Link className="btn btn-primary" to="/">
          Back to Home
        </Link>
      </div>
    );
  }

  // Someone who typed the address of a game they cannot edit. The API would
  // refuse the edit anyway; this only saves them filling in the form.
  if (!game.canBeChangedBy(user)) {
    return (
      <div className="container text-center py-5">
        <h1 className="h2 mb-3">
          {game.isOrganizedBy(user)
            ? "This game has already started, so it can no longer be changed."
            : "Only the organizer can edit this game."}
        </h1>
        <Link className="btn btn-primary" to={`/games/${id}`}>
          Back to the game
        </Link>
      </div>
    );
  }

  return (
    <div className="container py-4">
      <div className="row justify-content-center">
        <div className="col-12 col-md-10 col-lg-7">
          <h1 className="h2 mb-4">Edit game</h1>
          <GameForm
            game={game}
            submitLabel="Save changes"
            backTo={`/games/${id}`}
            onSubmit={handleSubmit}
          />
        </div>
      </div>
    </div>
  );
};

export default EditGame;
