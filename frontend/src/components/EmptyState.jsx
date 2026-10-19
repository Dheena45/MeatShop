import { Link } from 'react-router-dom';

/* Empty / error state block used across the app (.empty-state). */
export default function EmptyState({ icon = 'fa-solid fa-face-frown', title, text, to, actionLabel }) {
  const iconClass = /fa-(solid|regular|brands)\b/.test(icon) ? icon : 'fa-solid ' + icon;
  return (
    <div className="empty-state">
      <div className="es-icon"><i className={iconClass}></i></div>
      <h6>{title}</h6>
      {text ? <p>{text}</p> : null}
      {to && actionLabel ? (
        <Link to={to} className="btn btn-fm mt-2">{actionLabel}</Link>
      ) : null}
    </div>
  );
}
