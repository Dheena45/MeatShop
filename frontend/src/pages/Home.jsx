import { useEffect, useState } from 'react';
import { Link, useNavigate } from 'react-router-dom';
import { apiCall } from '../lib/api';
import { fmtDateOnly, initials } from '../lib/format';
import { showToast } from '../lib/toast';
import Spinner from '../components/Spinner';
import EmptyState from '../components/EmptyState';
import { useAuth } from '../context/AuthContext';

/* Homepage — ported from index.html + js/home.js */
export default function Home() {
  const { isLoggedIn } = useAuth();
  const navigate = useNavigate();
  const [stats, setStats] = useState({ premiumCuts: '', happyCustomers: '' });
  const [reviews, setReviews] = useState(null); // null = loading
  const [reviewsError, setReviewsError] = useState(false);
  const [message, setMessage] = useState('');
  const [sending, setSending] = useState(false);

  useEffect(() => {
    apiCall('/api/site-settings')
      .then(res => {
        const s = (res && res.data) || {};
        setStats({ premiumCuts: s.premiumCuts || '', happyCustomers: s.happyCustomers || '' });
      })
      .catch(() => setStats({ premiumCuts: '\u2014', happyCustomers: '\u2014' }));
  }, []);

  function loadReviews() {
    setReviews(null);
    setReviewsError(false);
    apiCall('/api/reviews')
      .then(res => setReviews(res.data || []))
      .catch(() => { setReviews([]); setReviewsError(true); });
  }

  useEffect(() => { loadReviews(); }, []);

  async function sendMessage() {
    if (!isLoggedIn) {
      showToast('Please login to send a message.', 'warning');
      setTimeout(() => navigate('/login?redirect=' + encodeURIComponent('/')), 1400);
      return;
    }
    const text = message.trim();
    if (!text) { showToast('Please enter your message.', 'warning'); return; }
    if (text.length > 2000) { showToast('Message must be at most 2000 characters.', 'warning'); return; }

    setSending(true);
    try {
      await apiCall('/api/contact/messages', { method: 'POST', body: { message: text } });
      showToast('Message sent successfully.');
      setMessage('');
    } catch (e) {
      if (e.status === 401) {
        showToast('Please login to send a message.', 'warning');
        setTimeout(() => navigate('/login?redirect=' + encodeURIComponent('/')), 1400);
      } else {
        showToast((e.status === 400 && e.message) ? e.message : 'Unable to send your message. Please try again.', 'error');
      }
    } finally {
      setSending(false);
    }
  }

  return (
    <>
      {/* HERO */}
      <section className="hero-section">
        <div className="container">
          <div className="row align-items-center gy-5">
            <div className="col-lg-7">
              <span className="hero-badge"><i className="fa-solid fa-leaf"></i> 100% Fresh &bull; Hygienically Processed</span>
              <h1 className="hero-title">Fresh Meat, Delivered to <span className="accent">Your Door</span>.</h1>
              <p className="hero-sub">Premium quality meat, hygienically prepared and delivered fresh to your doorstep. Choose your cut, pick your slot, we take care of the rest.</p>
              <div className="mt-4">
                <Link to="/shop" className="btn btn-fm-gold btn-fm-lg">Shop Now <i className="fa-solid fa-arrow-right ms-1"></i></Link>
              </div>
              <div className="hero-stats">
                <div className="hero-stat"><h3>{stats.premiumCuts}</h3><span>Premium Cuts</span></div>
                <div className="hero-stat"><h3>{stats.happyCustomers}</h3><span>Happy Customers</span></div>
                <div className="hero-stat"><h3>45 min</h3><span>Avg. Delivery</span></div>
              </div>
            </div>
            <div className="col-lg-5">
              <div className="hero-img-wrap">
                <div className="hero-card">
                  <img src="https://placehold.co/700x500/2b0a0a/ffffff?text=Choice+Cuts%0AFresh+Daily" alt="Fresh meat selection" />
                </div>
                <div className="float-tag f1"><i className="fa-solid fa-temperature-high mini-icon"></i>Flash Fresh<br /><small style={{ color: 'var(--muted)' }}>Chilled 0&ndash;4&deg;C</small></div>
                <div className="float-tag f2"><i className="fa-solid fa-truck-fast mini-icon"></i>Free Delivery<br /><small style={{ color: 'var(--muted)' }}>Orders above &#8377;499</small></div>
              </div>
            </div>
          </div>
        </div>
      </section>

      {/* TRUST BAR */}
      <section className="trust-bar">
        <div className="container">
          <div className="row g-3">
            <div className="col-6 col-lg-3"><div className="t-item"><i className="fa-solid fa-shield-halved"></i> 100% Fresh Guaranteed</div></div>
            <div className="col-6 col-lg-3"><div className="t-item"><i className="fa-solid fa-droplet"></i> Hygienically Processed</div></div>
            <div className="col-6 col-lg-3"><div className="t-item"><i className="fa-solid fa-certificate"></i> Quality Assured</div></div>
            <div className="col-6 col-lg-3"><div className="t-item"><i className="fa-solid fa-truck-fast"></i> Fast &amp; Secure Delivery</div></div>
          </div>
        </div>
      </section>

      {/* WHY CHOOSE US */}
      <section className="section-pad">
        <div className="container">
          <div className="section-title-wrap">
            <span className="section-eyebrow">Why FreshMeat</span>
            <h2 className="section-title">Why Choose FreshMeat?</h2>
            <p className="section-sub">We obsess over freshness so you can focus on great food.</p>
          </div>
          <div className="row g-3">
            {[
              { icon: 'fa-leaf', title: '100% Fresh', text: 'Cut fresh every morning' },
              { icon: 'fa-droplet', title: 'Hygienically Processed', text: 'FDA-grade facility' },
              { icon: 'fa-certificate', title: 'Quality Assured', text: 'Vet-inspected stock' },
              { icon: 'fa-truck-fast', title: 'Fast Delivery', text: '45-minute average' },
              { icon: 'fa-shield-halved', title: 'Secure Ordering', text: 'Safe & encrypted' },
              { icon: 'fa-hand-holding-heart', title: 'Fair Prices', text: 'Honest per-KG pricing' }
            ].map(w => (
              <div className="col-6 col-md-4 col-lg-2" key={w.title}>
                <div className="card card-fm why-card">
                  <div className="why-icon"><i className={'fa-solid ' + w.icon}></i></div>
                  <h6>{w.title}</h6><p>{w.text}</p>
                </div>
              </div>
            ))}
          </div>
        </div>
      </section>

      {/* REVIEWS */}
      <section className="section-pad section-alt">
        <div className="container">
          <div className="section-title-wrap">
            <span className="section-eyebrow">Testimonials</span>
            <h2 className="section-title">What Our Customers Say</h2>
          </div>
          <div id="reviews-grid" className="row g-3">
            {reviews === null ? (
              <div className="col-12 text-center"><Spinner /></div>
            ) : reviewsError ? (
              <div className="col-12">
                <EmptyState icon="fa-regular fa-star" title="Reviews are not available right now" text="Please try again later." />
                <div className="text-center mt-2">
                  <button className="btn btn-fm btn-sm" onClick={loadReviews}>Retry</button>
                </div>
              </div>
            ) : reviews.length === 0 ? (
              <div className="col-12">
                <EmptyState icon="fa-regular fa-star" title="No reviews yet" text="Be the first customer to share your experience." />
              </div>
            ) : (
              reviews.slice(0, 3).map((r, i) => {
                const rating = Math.min(5, Math.max(0, r.rating || 0));
                return (
                  <div className="col-md-4" key={i}>
                    <div className="card card-fm testimonial-card">
                      <span className="quote-mark">&quot;</span>
                      <div className="t-stars">{'\u2605'.repeat(rating)}{'\u2606'.repeat(5 - rating)}</div>
                      <p>&quot;{r.comment}&quot;</p>
                      <div className="t-user">
                        <div className="avatar">{initials(r.customerName || 'FR')}</div>
                        <div>
                          <strong>{r.customerName || 'FreshMeat User'}</strong>
                          <span>{r.createdAt ? fmtDateOnly(r.createdAt) : ''}</span>
                        </div>
                      </div>
                    </div>
                  </div>
                );
              })
            )}
          </div>
        </div>
      </section>

      {/* ABOUT / CONTACT */}
      <section className="section-pad" id="about">
        <div className="container">
          <div className="row align-items-center g-5">
            <div className="col-lg-6">
              <span className="section-eyebrow">About FreshMeat</span>
              <h2 className="section-title">From Farm to Your Kitchen, the Honest Way.</h2>
              <p className="text-muted">FreshMeat was born from a simple belief: everyone deserves access to safe, fresh, honestly-priced meat. We work with verified farms, process in hygienic facilities, and deliver within hours of cutting &mdash; not days.</p>
              <div className="row g-3 mt-3">
                <div className="col-sm-6">
                  <div className="d-flex gap-2 align-items-start">
                    <i className="fa-solid fa-circle-check text-gold mt-1"></i>
                    <div><strong>Traceable sourcing</strong><p className="small text-muted mb-0">Every cut traceable to a verified farm.</p></div>
                  </div>
                </div>
                <div className="col-sm-6">
                  <div className="d-flex gap-2 align-items-start">
                    <i className="fa-solid fa-circle-check text-gold mt-1"></i>
                    <div><strong>Cold-chain logistics</strong><p className="small text-muted mb-0">Temperature-controlled till your door.</p></div>
                  </div>
                </div>
              </div>
            </div>
            <div className="col-lg-6" id="contact">
              <div className="card card-fm p-4">
                <h4 style={{ fontFamily: 'var(--font-body)', fontWeight: 600 }}>Get in Touch</h4>
                <p className="text-muted small">Questions about an order or a custom cut? Write to us.</p>
                <div className="mb-3">
                  <label className="form-label fw-semibold small">Message</label>
                  <textarea className="form-control form-control-fm" rows={3} placeholder="How can we help?"
                    value={message} onChange={e => setMessage(e.target.value)}></textarea>
                </div>
                <button className="btn btn-fm" onClick={sendMessage} disabled={sending}>
                  {sending ? <><span className="spinner-border spinner-border-sm me-1"></span>Sending...</> : 'Send Message'}
                </button>
              </div>
            </div>
          </div>
        </div>
      </section>
    </>
  );
}
