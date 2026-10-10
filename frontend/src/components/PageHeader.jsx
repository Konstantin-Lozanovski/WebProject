// The band at the top of every page that has no intro of its own: the title,
// one line about the page and, at the right, the page's buttons (children).
// It uses the colours of the intro on the Home page, so the pages read as
// one app.
// ball is the picture that rolls in behind the text; the logo when left out.
const PageHeader = ({ title, text, ball = "/favicon.svg", children }) => {
  return (
    <div className="page-header">
      {/* Only decoration, so it is hidden from screen readers */}
      <img className="page-header-ball" src={ball} alt="" aria-hidden="true" />
      <div className="container page-header-text">
        <div className="d-flex flex-wrap justify-content-between align-items-end gap-3">
          <div>
            <h1 className="page-title">{title}</h1>
            {text && <p className="page-lead">{text}</p>}
          </div>
          {children && <div className="d-flex flex-wrap gap-2">{children}</div>}
        </div>
      </div>
    </div>
  );
};

export default PageHeader;
