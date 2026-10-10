// There are no profile pictures, so the first letter of the username in a
// round badge stands in for one. name is the username.
const Avatar = ({ name }) => {
  // aria-hidden: the username is always written next to it
  return (
    <span className="user-avatar" aria-hidden="true">
      {name.charAt(0).toUpperCase()}
    </span>
  );
};

export default Avatar;
