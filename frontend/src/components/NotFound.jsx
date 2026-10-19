import { Link } from 'react-router-dom';

export default function NotFound() {
  return (
    <div className="section-pad">
      <div className="container">
        <div className="empty-state">
          <div className="es-icon"><i className="fa-solid fa-circle-question"></i></div>
          <h6>Page not found</h6>
          <p>The page you are looking for does not exist.</p>
          <Link to="/" className="btn btn-fm mt-2">Go Home</Link>
        </div>
      </div>
    </div>
  );
}
