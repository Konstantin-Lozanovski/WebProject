// What a list shows when it has nothing in it, and what a page shows when
// its game could not be found: a title, one line of text and, as children,
// a button that leads somewhere useful. text and children can be left out.
const EmptyState = ({ title, text, children }) => {
  return (
    <div className="empty">
      {/* Only decoration: the logo, greyed out by the stylesheet */}
      <img className="empty-ball" src="/favicon.svg" alt="" />
      <h2 className="empty-title">{title}</h2>
      {text && <p className="empty-text">{text}</p>}
      {children}
    </div>
  );
};

export default EmptyState;
