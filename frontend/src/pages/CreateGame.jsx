import { useNavigate } from "react-router-dom";
import GameForm from "../components/GameForm.jsx";
import { createGame } from "../services/api.js";

const CreateGame = () => {
  const navigate = useNavigate();

  // An error is not caught here: the form catches it and shows the message
  const handleSubmit = async (gameData) => {
    const game = await createGame(gameData);
    navigate(`/games/${game._id}`);
  };

  return (
    <div className="container py-4">
      <div className="row justify-content-center">
        <div className="col-12 col-md-10 col-lg-7">
          <h1 className="h2 mb-4">Create game</h1>
          <GameForm submitLabel="Create game" backTo="/" onSubmit={handleSubmit} />
        </div>
      </div>
    </div>
  );
};

export default CreateGame;
