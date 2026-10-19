/* Five-star rating display, matching the original starsHtml() output. */
export default function Stars({ rating = 0 }) {
  const r = Math.round(Number(rating) || 0);
  return (
    <span className="stars">
      {[1, 2, 3, 4, 5].map(i => (
        <i
          key={i}
          className={i <= r ? 'fa-solid fa-star' : 'fa-solid fa-star empty-star'}
        ></i>
      ))}
    </span>
  );
}
