import { useNavigate } from 'react-router-dom';
import Stars from './Stars';
import { apiCall, resolveImage } from '../lib/api';
import { fmtMoney, effectivePrice } from '../lib/format';
import { showToast } from '../lib/toast';
import { useAuth } from '../context/AuthContext';
import { useCart } from '../context/CartContext';

/* Product tile, ported from productCardHtml() in app.js. */
export default function ProductCard({ product, onQuickView }) {
  const navigate = useNavigate();
  const { isLoggedIn } = useAuth();
  const { addItem } = useCart();

  const p = product;
  const eff = effectivePrice(p);
  const disc = Number(p.discountPercent || 0);
  const outOfStock = !p.available || Number(p.stockQuantity) <= 0;
  const lowStock = !outOfStock && Number(p.stockQuantity) <= 8;
  const img = resolveImage(p.imageUrl);

  let stockHtml;
  if (outOfStock) stockHtml = <span className="out-stock"><i className="fa-solid fa-circle"></i> Out of Stock</span>;
  else if (lowStock) stockHtml = <span className="low-stock"><i className="fa-solid fa-circle"></i> Only {p.stockQuantity} {p.unit || 'KG'} left</span>;
  else stockHtml = <span className="in-stock"><i className="fa-solid fa-circle"></i> In Stock</span>;

  async function quickAdd(e) {
    e.preventDefault();
    e.stopPropagation();
    if (!isLoggedIn) {
      navigate('/login?redirect=' + encodeURIComponent('/shop'));
      return;
    }
    let cuttingOption;
    try {
      const detail = await apiCall('/api/products/' + p.id);
      const options = detail.data.cuttingOptions || [];
      cuttingOption = options.length > 0 ? options[0] : undefined;
    } catch (err) { /* ignore */ }

    try {
      await addItem(p.id, 1, cuttingOption);
      showToast('Added to cart!');
    } catch (err) {
      showToast((err && err.message) || 'Could not add to cart', 'error');
    }
  }

  return (
    <div className="col-6 col-md-4 col-lg-3">
      <div className="card card-fm product-card">
        <div className="product-img">
          <img src={img} alt={p.name} loading="lazy" />
          <div className="product-badges">
            {disc > 0 ? <span className="badge-fm gold">{Math.round(disc)}% OFF</span> : null}
            {p.freshToday ? <span className="badge-fm green"><i className="fa-solid fa-leaf"></i> Fresh Today</span> : null}
            {outOfStock ? <span className="badge-fm dark">Out of Stock</span> : null}
          </div>
          <button className="quick-view-btn" onClick={() => onQuickView && onQuickView(p.id)} title="Quick View">
            <i className="fa-solid fa-eye"></i>
          </button>
        </div>
        <div className="product-body">
          <span className="cat-tag">{p.categoryName || 'Premium'}</span>
          <h6 title={p.name}>{p.name}</h6>
          <div><Stars rating={p.avgRating} /><span className="rating-val">{(Number(p.avgRating) || 0).toFixed(1)} ({p.reviewCount || 0})</span></div>
          <div className="price-row">
            <span className="price-now">{fmtMoney(eff)}</span>
            {disc > 0 ? <span className="price-was">{fmtMoney(p.pricePerKg)}</span> : null}
            <span className="price-off">/{(p.unit || 'KG').toUpperCase()}</span>
          </div>
          <div className="stock-inline">{stockHtml}</div>
          <div className="product-actions">
            <button className="btn btn-fm-outline" onClick={() => navigate('/product-details?id=' + p.id)}>
              <i className="fa-regular fa-eye me-1"></i>Details
            </button>
            {outOfStock ? (
              <button className="btn btn-fm" disabled><i className="fa-solid fa-cart-plus me-1"></i>Sold Out</button>
            ) : (
              <button className="btn btn-fm" onClick={quickAdd}><i className="fa-solid fa-cart-plus me-1"></i>Add</button>
            )}
          </div>
        </div>
      </div>
    </div>
  );
}
