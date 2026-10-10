// One number (or short fact) with its name in a small tile: "DURATION, 90 min".
// note is a line of smaller text under the value, and children is anything
// else the tile shows under it, for example a progress bar. Both can be left out.
const Stat = ({ label, value, note, children }) => {
  return (
    <div className="stat">
      <div className="stat-label">{label}</div>
      <div className="stat-value">{value}</div>
      {note && <div className="stat-note">{note}</div>}
      {children}
    </div>
  );
};

export default Stat;
