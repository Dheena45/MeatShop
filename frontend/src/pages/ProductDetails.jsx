import { useEffect, useState } from 'react';
import { Link, useNavigate, useSearchParams } from 'react-router-dom';
import { apiCall, resolveImage } from '../lib/api';
import { fmtMoney, effectivePrice } from '../lib/format';
import { showToast } from '../lib/toast';
import Spinner from '../components/Spinner';
import EmptyState from '../components/EmptyState';
import Stars from '../components/Stars';
import { useCart } from '../context/CartContext';

/* Product details — ported from product-details.html + js/product-details.js */
export default function ProductDetails() {
  const [searchParams] = useSearchParams();
  const navigate = useNavigate();
  const id = searchParams.get('id');
  const { addItem } = useCart();

  const [product, setProduct] = useState(null);
  const [error, setError] = useState('');
  const [selectedCutting, setSelectedCutting] = useState(null);
  const [qty, setQty] = useState(1);

  useEffect(() => {
    if (!id) { navigate('/shop'); return; }
    apiCall('/api/products/' + id)
      .then(res => {
        const p = res.data;
        setProduct(p);
        setSelectedCutting((p.cuttingOptions || [])[0] || null);
        setQty(p.minOrderQty || 1);
      })
      .catch(e => setError(e.message || 'Product not found'));
  }, [id, navigate]);

  if (error) {
    return (
      <section className="section-pad pt-4">
        <div className="container">
          <EmptyState icon="fa-triangle-exclamation" title={error} />
          <div className="text-center mt-2"><Link to="/shop" className="btn btn-fm">Back to Shop</Link></div>
        </div>
      </section>
    );
  }

  if (!product) {
    return (
      <section className="section-pad pt-4">
        <div className="container"><Spinner /></div>
      </section>
    );
  }

  const p = product;
  const eff = Number(p.effectivePrice) || effectivePrice(p);
  const disc = Number(p.discountPercent || 0);
  const outOfStock = !p.available || Number(p.stockQuantity) <= 0;
  const lowStock = !outOfStock && Number(p.stockQuantity) <= 8;
  const unit = (p.unit || 'KG').toUpperCase();
  const cuttingOptions = p.cuttingOptions || [];

  function changeQty(delta) {
    setQty(q => Math.max(p.minOrderQty || 1, q + delta));
  }

  async function addToCart(buyNow) {
    if (!id) return;
    if (qty > Number(p.stockQuantity)) {
      showToast('Only ' + p.stockQuantity + ' ' + (p.unit || 'KG') + ' available in stock', 'error');
      return;
    }
    try {
      await addItem(p.id, qty, selectedCutting || undefined);
      showToast('Added to cart!');
      if (buyNow) navigate('/checkout');
    } catch (e) {
      showToast(e.message || 'Failed to add to cart', 'error');
    }
  }

  return (
    <section className="section-pad pt-4">
      <div className="container">
        <nav aria-label="breadcrumb" className="mb-3">
          <ol className="breadcrumb small">
            <li className="breadcrumb-item"><Link to="/">Home</Link></li>
            <li className="breadcrumb-item"><Link to="/shop">Shop</Link></li>
            <li className="breadcrumb-item active">{p.categoryName || 'Product'}</li>
          </ol>
        </nav>

        <div className="row g-5">
          <div className="col-lg-6">
            <div className="pd-gallery position-relative">
              <img src={resolveImage(p.imageUrl)} alt={p.name} />
              {p.freshToday ? (
                <span className="badge-fm green position-absolute" style={{ top: 16, left: 16 }}>
                  <i className="fa-solid fa-leaf"></i> Freshly Prepared Today
                </span>
              ) : null}
            </div>
          </div>
          <div className="col-lg-6">
            <div className="pd-info">
              <span className="pd-cat-tag">{p.categoryName}</span>
              <h1 className="fw-bold mt-1">{p.name}</h1>
              <div className="d-flex align-items-center gap-2 mb-3">
                <Stars rating={p.avgRating} />
                <span className="rating-val">{(Number(p.avgRating) || 0).toFixed(1)} ({p.reviewCount || 0} reviews)</span>
              </div>
              <p className="text-muted">{p.description || p.shortDescription || ''}</p>

              <div className="d-flex align-items-center gap-3 mb-3">
                <span className="pd-price">{fmtMoney(eff)}</span>
                <span className="text-muted">/ {unit}</span>
                {disc > 0 ? (
                  <>
                    <span className="pd-price-was">{fmtMoney(p.pricePerKg)}</span>
                    <span className="pd-price-off">{Math.round(disc)}% OFF</span>
                  </>
                ) : null}
              </div>

              <div className="mb-3">
                {outOfStock ? (
                  <span className="badge-fm dark"><i className="fa-solid fa-circle"></i> Out of Stock</span>
                ) : lowStock ? (
                  <span className="badge-fm dark"><i className="fa-solid fa-circle"></i> Only {p.stockQuantity} {p.unit || 'KG'} left</span>
                ) : (
                  <span className="badge-fm green" style={{ position: 'static' }}>
                    <i className="fa-solid fa-circle"></i> In Stock &mdash; {p.stockQuantity} {p.unit || 'KG'} available
                  </span>
                )}
              </div>

              {cuttingOptions.length ? (
                <div className="mb-3">
                  <label className="form-label fw-semibold">Cutting Preference</label>
                  <div className="cutting-options">
                    {cuttingOptions.map((opt, idx) => (
                      <button key={idx} type="button"
                        className={'cutting-option' + (selectedCutting === opt ? ' selected' : '')}
                        onClick={() => setSelectedCutting(opt)}>
                        {opt.replace(/_/g, ' ')}
                      </button>
                    ))}
                  </div>
                </div>
              ) : null}

              <div className="d-flex align-items-center gap-3 mb-3">
                <label className="fw-semibold mb-0">Quantity ({unit})</label>
                <div className="qty-stepper">
                  <button type="button" onClick={() => changeQty(-1)}><i className="fa-solid fa-minus"></i></button>
                  <input type="number" value={qty} min="1" readOnly />
                  <button type="button" onClick={() => changeQty(1)}><i className="fa-solid fa-plus"></i></button>
                </div>
              </div>

              <div className="total-price-bar">
                <div>
                  <small className="text-muted d-block">Total Price</small>
                  <strong className="fs-5">{fmtMoney(eff * qty)}</strong>
                </div>
                <div className="d-flex gap-2">
                  {outOfStock ? null : (
                    <>
                      <button className="btn btn-fm-outline" onClick={() => addToCart(false)}>
                        <i className="fa-solid fa-basket-shopping me-1"></i>Add to Cart
                      </button>
                      <button className="btn btn-fm" onClick={() => addToCart(true)}>
                        <i className="fa-solid fa-bolt me-1"></i>Buy Now
                      </button>
                    </>
                  )}
                </div>
              </div>

              <div className="d-flex gap-4 flex-wrap mt-4 text-muted small">
                <span><i className="fa-solid fa-shield-halved text-gold me-1"></i>100% Fresh</span>
                <span><i className="fa-solid fa-droplet text-gold me-1"></i>Hygienically Processed</span>
                <span><i className="fa-solid fa-truck-fast text-gold me-1"></i>Fast Delivery</span>
              </div>
            </div>
          </div>
        </div>
      </div>
    </section>
  );
}
