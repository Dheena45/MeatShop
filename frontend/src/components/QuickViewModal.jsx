import { useEffect, useState } from 'react';
import { apiCall, resolveImage } from '../lib/api';
import { fmtMoney, effectivePrice } from '../lib/format';
import { showToast } from '../lib/toast';
import { onQuickView } from '../lib/quickview';
import { showModal, hideModal } from '../lib/modal';
import Stars from './Stars';
import { useAuth } from '../context/AuthContext';
import { useCart } from '../context/CartContext';
import { useNavigate } from 'react-router-dom';

/* Global Quick View modal (#quickViewModal), ported from openQuickView(). */
export default function QuickViewModal() {
  const [product, setProduct] = useState(null);
  const [outOfStock, setOutOfStock] = useState(false);
  const { isLoggedIn } = useAuth();
  const { addItem } = useCart();
  const navigate = useNavigate();

  useEffect(() => {
    const off = onQuickView(async (id) => {
      try {
        const res = await apiCall('/api/products/' + id);
        const p = res.data;
        setProduct(p);
        setOutOfStock(!p.available || Number(p.stockQuantity) <= 0);
        showModal('quickViewModal');
      } catch (e) {
        showToast('Could not load product', 'error');
      }
    });
    return off;
  }, []);

  async function add() {
    if (!isLoggedIn) {
      hideModal('quickViewModal');
      navigate('/login?redirect=' + encodeURIComponent('/shop'));
      return;
    }
    try {
      const options = (product.cuttingOptions || []);
      await addItem(product.id, 1, options.length ? options[0] : undefined);
      showToast('Added to cart!');
      hideModal('quickViewModal');
    } catch (e) {
      showToast((e && e.message) || 'Could not add to cart', 'error');
    }
  }

  function goDetails() {
    hideModal('quickViewModal');
    navigate('/product-details?id=' + product.id);
  }

  const p = product;
  const eff = p ? effectivePrice(p) : 0;
  const disc = p ? Number(p.discountPercent || 0) : 0;

  return (
    <div className="modal fade" id="quickViewModal" tabIndex={-1}>
      <div className="modal-dialog modal-lg modal-dialog-centered">
        <div className="modal-content">
          {p ? (
            <div className="row g-0">
              <div className="col-md-5">
                <img
                  src={resolveImage(p.imageUrl)}
                  alt={p.name}
                  style={{ width: '100%', height: '100%', minHeight: 300, objectFit: 'cover', borderRadius: 0 }}
                />
              </div>
              <div className="col-md-7">
                <div className="p-4">
                  <span className="pd-cat-tag">{p.categoryName}</span>
                  <h4 className="fw-bold mt-1">{p.name}</h4>
                  <div className="mb-2">
                    <Stars rating={p.avgRating} />
                    <span className="rating-val">{(Number(p.avgRating) || 0).toFixed(1)} ({p.reviewCount || 0} reviews)</span>
                  </div>
                  <p className="text-muted small">{p.shortDescription || p.description || ''}</p>
                  <div className="price-row mb-3">
                    <span className="pd-price">{fmtMoney(eff)}</span>
                    {disc > 0 ? (
                      <>
                        <span className="pd-price-was">{fmtMoney(p.pricePerKg)}</span>
                        <span className="pd-price-off">{Math.round(disc)}% OFF</span>
                      </>
                    ) : null}
                    <span className="ms-1 text-muted small">{'/' + (p.unit || 'KG').toUpperCase()}</span>
                  </div>
                  {outOfStock ? (
                    <span className="badge-fm dark">Out of Stock</span>
                  ) : (
                    <span className="badge-fm green">
                      <i className="fa-solid fa-circle"></i>{' '}
                      {p.stockQuantity > 8 ? 'In Stock' : 'Only ' + p.stockQuantity + ' ' + (p.unit || 'KG') + ' left'}
                    </span>
                  )}
                  <div className="d-flex gap-2 mt-4">
                    <button className="btn btn-fm-outline" onClick={goDetails}>
                      <i className="fa-regular fa-eye me-1"></i>Full Details
                    </button>
                    {outOfStock ? null : (
                      <button className="btn btn-fm" onClick={add}>
                        <i className="fa-solid fa-cart-plus me-1"></i>Add to Cart
                      </button>
                    )}
                  </div>
                </div>
              </div>
            </div>
          ) : null}
        </div>
      </div>
    </div>
  );
}
