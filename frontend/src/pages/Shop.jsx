import { useCallback, useEffect, useRef, useState } from 'react';
import { Link, useSearchParams } from 'react-router-dom';
import { apiCall } from '../lib/api';
import { fmtMoney } from '../lib/format';
import { openQuickView } from '../lib/quickview';
import Spinner from '../components/Spinner';
import EmptyState from '../components/EmptyState';
import ProductCard from '../components/ProductCard';
import { useCart } from '../context/CartContext';

const PAGE_SIZE = 12;

/* Small window of page numbers with ellipses, matching pagerItems() in shop.js */
function pagerItems(current, totalPages) {
  const candidates = new Set([0, totalPages - 1, current - 1, current, current + 1]);
  const pages = [...candidates].filter(p => p >= 0 && p < totalPages).sort((a, b) => a - b);
  const items = [];
  let prev = -1;
  for (const p of pages) {
    if (prev !== -1 && p - prev > 1) items.push('...');
    items.push(p);
    prev = p;
  }
  return items;
}

/* Shop page — ported from shop.html + js/shop.js */
export default function Shop() {
  const [searchParams] = useSearchParams();
  const initialSearch = searchParams.get('search') || '';
  const initialCategory = searchParams.get('category') || '';

  const [search, setSearch] = useState(initialSearch);
  const [category, setCategory] = useState(initialCategory);
  const [categories, setCategories] = useState([]);
  const [catsError, setCatsError] = useState(false);
  const [products, setProducts] = useState(null);
  const [error, setError] = useState('');
  const [page, setPage] = useState(0);
  const [totalPages, setTotalPages] = useState(0);
  const [totalElements, setTotalElements] = useState(0);
  const { cart } = useCart();

  const debounceRef = useRef(null);

  useEffect(() => {
    apiCall('/api/categories')
      .then(res => setCategories(res.data || []))
      .catch(() => setCatsError(true));
  }, []);

  const loadProducts = useCallback(async (opts = {}) => {
    const p = opts.page != null ? opts.page : page;
    const q = opts.search != null ? opts.search : search;
    const cat = opts.category != null ? opts.category : category;
    setProducts(null);
    setError('');
    const params = new URLSearchParams();
    if (q) params.set('search', q);
    if (cat) params.set('categoryId', cat);
    params.set('page', p);
    params.set('size', PAGE_SIZE);
    try {
      const res = await apiCall('/api/products?' + params.toString());
      const data = res.data;
      setTotalPages(data.totalPages || 1);
      setTotalElements(data.totalElements || (data.content || []).length);
      setProducts(data.content || []);
    } catch (e) {
      setError(e.message || 'Error loading products');
      setProducts([]);
    }
  }, [page, search, category]);

  // Initial load
  useEffect(() => { loadProducts({ page: 0 }); /* eslint-disable-line */ }, []);

  function onSearchChange(value) {
    setSearch(value);
    if (debounceRef.current) clearTimeout(debounceRef.current);
    debounceRef.current = setTimeout(() => {
      setPage(0);
      loadProducts({ page: 0, search: value });
    }, 500);
  }

  function onCategoryChange(value) {
    setCategory(value);
    setPage(0);
    loadProducts({ page: 0, category: value });
  }

  function goPage(p) {
    setPage(p);
    loadProducts({ page: p });
    window.scrollTo({ top: 0, behavior: 'smooth' });
  }

  const cartItems = (cart && cart.items) || [];
  const showBar = cartItems.length > 0;

  return (
    <>
      <section className="shop-hero">
        <div className="container">
          <h1 className="mb-1">Shop Fresh Cuts</h1>
          <p>Pick your favourite meat, choose your cut, and we&apos;ll deliver it fresh. </p>
        </div>
      </section>

      <section className="section-pad pt-4">
        <div className="container">
          <div className="row g-4">
            {/* FILTERS */}
            <div className="col-lg-3">
              <div className="filter-card">
                <h6><i className="fa-solid fa-magnifying-glass me-1"></i> Search</h6>
                <input type="text" className="search-bar-lg" placeholder="Search chicken, mutton, fish..."
                  value={search} onChange={e => onSearchChange(e.target.value)} />
              </div>

              <div className="filter-card">
                <h6><i className="fa-solid fa-layer-group me-1"></i> Category</h6>
                <div className="d-flex flex-column gap-1">
                  {catsError ? (
                    <span className="text-muted small">Could not load categories</span>
                  ) : (
                    <>
                      <div className="form-check">
                        <input className="form-check-input" type="radio" name="catFilter" id="cat-none"
                          checked={!category} onChange={() => onCategoryChange('')} />
                        <label className="form-check-label" htmlFor="cat-none">All Categories</label>
                      </div>
                      {categories.map(c => (
                        <div className="form-check" key={c.id}>
                          <input className="form-check-input" type="radio" name="catFilter" id={'cat-' + c.id}
                            checked={String(category) === String(c.id)} onChange={() => onCategoryChange(String(c.id))} />
                          <label className="form-check-label" htmlFor={'cat-' + c.id}>{c.name}</label>
                        </div>
                      ))}
                    </>
                  )}
                </div>
              </div>
            </div>

            {/* PRODUCTS */}
            <div className="col-lg-9">
              <div className="mb-3">
                <strong>{totalElements}</strong> <span className="text-muted small">products found</span>
              </div>
              <div className="row g-3">
                {products === null ? (
                  <div className="col-12 text-center"><Spinner /></div>
                ) : error ? (
                  <div className="col-12">
                    <EmptyState icon="fa-triangle-exclamation" title={error} />
                  </div>
                ) : products.length === 0 ? (
                  <div className="col-12">
                    <EmptyState icon="fa-magnifying-glass" title="No products found" text="Try adjusting your filters or search keywords." />
                  </div>
                ) : (
                  products.map(p => <ProductCard key={p.id} product={p} onQuickView={openQuickView} />)
                )}
              </div>
              {totalPages > 1 ? (
                <div className="pagination-fm">
                  <button className="page-btn prev" disabled={page === 0} onClick={() => goPage(page - 1)} aria-label="Previous page">&#8249;</button>
                  {pagerItems(page, totalPages).map((item, i) => item === '...' ? (
                    <span className="page-dots" key={'d' + i}>&#8230;</span>
                  ) : (
                    <button key={item} className={'page-btn' + (item === page ? ' active' : '')} onClick={() => goPage(item)}>{item + 1}</button>
                  ))}
                  <button className="page-btn next" disabled={page >= totalPages - 1} onClick={() => goPage(page + 1)} aria-label="Next page">&#8250;</button>
                </div>
              ) : null}
            </div>
          </div>
        </div>
      </section>

      {/* Sticky bottom cart bar */}
      {showBar ? (
        <div className="cart-bar" style={{ display: 'block' }}>
          <div className="cart-bar-inner">
            <i className="fa-solid fa-basket-shopping cart-bar-icon" aria-hidden="true"></i>
            <div className="cart-bar-info">
              <strong className="cart-bar-count">
                {cartItems.length} {cartItems.length === 1 ? 'item' : 'items'} in your cart
              </strong>
              <span className="cart-bar-total">Total: {fmtMoney(cart.grandTotal != null ? cart.grandTotal : cart.subtotal)}</span>
            </div>
            <div className="cart-bar-actions">
              <Link className="btn cart-bar-btn-outline" to="/cart"><i className="fa-solid fa-cart-shopping me-1"></i>View Cart</Link>
              <Link className="btn cart-bar-btn" to="/checkout"><i className="fa-solid fa-bolt me-1"></i>Buy Now</Link>
            </div>
          </div>
        </div>
      ) : null}
    </>
  );
}
