import BouncingBalls from "./BouncingBalls.jsx";

// The frame around the Log in and Register forms: the form (children) on one
// side of a card and the app's intro on the other.
const AuthLayout = ({ title, text, children }) => {
  return (
    <div className="container py-5">
      <div className="card auth">
        <div className="row g-0">
          {/* Hidden on phones, where it would push the form off the screen */}
          <div className="col-md-5 d-none d-md-flex auth-side">
            <BouncingBalls />
            <p className="auth-slogan">Find a game. Fill a team. Play.</p>
            <p className="auth-text">
              Create a pickup game at a venue in your city, or join one that
              still has places left.
            </p>
          </div>
          <div className="col-12 col-md-7 auth-form">
            <h1 className="h2 mb-1">{title}</h1>
            <p className="text-muted mb-4">{text}</p>
            {children}
          </div>
        </div>
      </div>
    </div>
  );
};

export default AuthLayout;
