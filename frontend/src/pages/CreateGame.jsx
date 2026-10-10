import { useNavigate } from "react-router-dom";
import PageHeader from "../components/PageHeader.jsx";
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
    <>
      <PageHeader
        title="Create game"
        text="Pick the sport, the venue and the time. You are the organizer and the first player; the others send you join requests."
      />
      <div className="container page-body">
        <div className="row g-4">
          <div className="col-12 col-lg-8">
            <GameForm submitLabel="Create game" backTo="/" onSubmit={handleSubmit} />
          </div>
          <div className="col-12 col-lg-4">
            <div className="card">
              <div className="card-header">Good to know</div>
              <ul className="list-group list-group-flush">
                <li className="list-group-item">
                  You count toward the max number of players.
                </li>
                <li className="list-group-item">
                  The players are split into Team A and Team B, each with half
                  of the max.
                </li>
                <li className="list-group-item">
                  The game cannot overlap another game you are a player in.
                </li>
                <li className="list-group-item">
                  You can edit or cancel the game until it starts.
                </li>
              </ul>
            </div>
          </div>
        </div>
      </div>
    </>
  );
};

export default CreateGame;
