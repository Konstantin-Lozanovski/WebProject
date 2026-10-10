import { Link } from "react-router-dom";
import BouncingBalls from "./BouncingBalls.jsx";

// What the app is for, in the order a new user does it
const STEPS = [
  {
    title: "Find a game",
    text: "Search the upcoming games by sport, city and date.",
  },
  {
    title: "Ask to join",
    text: "Send a join request and the organizer accepts you as a player.",
  },
  {
    title: "Play",
    text: "Chat with the other players and get placed on Team A or Team B.",
  },
];

// The intro at the top of the Home page. user is null for a guest.
const Hero = ({ user }) => {
  const renderButtons = () => {
    if (user) {
      return (
        <>
          <Link className="btn btn-light" to="/games/new">
            Create a game
          </Link>
          <Link className="btn btn-outline-light" to="/my-games">
            My games
          </Link>
        </>
      );
    }

    return (
      <>
        <Link className="btn btn-light" to="/register">
          Create an account
        </Link>
        <Link className="btn btn-outline-light" to="/login">
          Log in
        </Link>
      </>
    );
  };

  return (
    <div className="hero">
      <div className="container">
        <div className="row align-items-center g-4">
          <div className="col-12 col-md-7 hero-text">
            <h1 className="hero-title">Find a game. Fill a team. Play.</h1>
            <p className="hero-lead">
              PickupGames brings together people who want to play. Create a
              pickup game at a venue in your city, or join one that still has
              places left.
            </p>
            <div className="d-flex flex-wrap gap-2">{renderButtons()}</div>
          </div>

          {/* Only decoration, so it is hidden on phones, where it would push
              the games down */}
          <div className="col-md-5 d-none d-md-block">
            <BouncingBalls />
          </div>
        </div>

        <div className="row g-3 mt-2 steps">
          {STEPS.map((step, index) => (
            <div className="col-12 col-md-4" key={step.title}>
              <div className="step">
                <span className="step-number">{index + 1}</span>
                <div>
                  <h2 className="step-title">{step.title}</h2>
                  <p className="step-text">{step.text}</p>
                </div>
              </div>
            </div>
          ))}
        </div>
      </div>
    </div>
  );
};

export default Hero;
