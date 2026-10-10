// The three bouncing balls of the intro on the Home page, also shown beside
// the Log in and Register forms.
// Only decoration, so it is hidden from screen readers (empty alt, aria-hidden).
const BouncingBalls = () => {
  return (
    <div className="hero-art" aria-hidden="true">
      <div className="hero-ball">
        <img src="/ball-football.svg" alt="" />
      </div>
      {/* The basketball is the app's logo, the same file as the icon of the
          browser tab */}
      <div className="hero-ball hero-ball-high">
        <img src="/favicon.svg" alt="" />
      </div>
      <div className="hero-ball hero-ball-quick">
        <img src="/ball-tennis.svg" alt="" />
      </div>
    </div>
  );
};

export default BouncingBalls;
