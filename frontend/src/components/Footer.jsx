import { useEffect, useState } from 'react';
import { apiCall } from '../lib/api';

/* Shared site footer, ported from renderSharedFooter() in app.js. Contact
   details come from /api/contact-settings with the same fallbacks. */
export default function Footer() {
  const [cs, setCs] = useState(null);

  useEffect(() => {
    apiCall('/api/contact-settings')
      .then(res => setCs(res && res.data ? res.data : null))
      .catch(() => setCs(null));
  }, []);

  const fallbackDescription = 'Fresh Cuts. Honest Prices. Delivered Fast. We bring premium quality meat, hygienically processed and delivered fresh to your doorstep.';
  const description = cs && cs.businessDescription ? cs.businessDescription : fallbackDescription;
  const address = cs && cs.address ? cs.address : '12, Meat Market Road, Chennai, Tamil Nadu 600001';
  const phone = cs && cs.phone ? cs.phone : '+91 98765 43210';
  const email = cs && cs.email ? cs.email : 'support@freshmeat.com';
  const hours = cs && cs.businessHours ? cs.businessHours : 'Mon\u2013Sun, 6 AM \u2013 9 PM';

  const socials = [
    { url: cs ? cs.facebookUrl : '', icon: 'fa-brands fa-facebook-f' },
    { url: cs ? cs.instagramUrl : '', icon: 'fa-brands fa-instagram' },
    { url: cs ? cs.twitterUrl : '', icon: 'fa-brands fa-x-twitter' },
    { url: cs ? cs.youtubeUrl : '', icon: 'fa-brands fa-youtube' }
  ].filter(s => s.url);

  return (
    <footer className="footer-fm">
      <div className="container">
        <div className="row g-4 align-items-start footer-main">
          <div className="col-lg-7 col-md-12">
            <h5 className="fw-bold" style={{ fontFamily: 'var(--font-head)', fontSize: '1.4rem' }}>
              Fresh<span style={{ color: 'var(--gold)' }}>Meat</span>
            </h5>
            <p className="mt-2" style={{ fontSize: '0.88rem' }}>{description}</p>
            {socials.length ? (
              <div className="social-icons mt-3">
                {socials.map((s, i) => (
                  <a key={i} href={s.url} target="_blank" rel="noopener noreferrer"><i className={s.icon}></i></a>
                ))}
              </div>
            ) : null}
          </div>
          <div className="col-lg-5 col-md-12 footer-contact-col">
            <h5>Contact</h5>
            <ul className="list-unstyled f-contact">
              <li><i className="fa-solid fa-location-dot"></i><span>{address}</span></li>
              <li><i className="fa-solid fa-phone"></i><span>{phone}</span></li>
              <li><i className="fa-solid fa-envelope"></i><span>{email}</span></li>
              <li><i className="fa-solid fa-clock"></i><span>{hours}</span></li>
            </ul>
          </div>
        </div>
        <div className="footer-bottom d-flex flex-wrap justify-content-between align-items-center">
          <span>&copy; {new Date().getFullYear()} FreshMeat. All rights reserved.</span>
          <span>
            <a href="#">Terms &amp; Conditions</a> &nbsp;|&nbsp;
            <a href="#">Privacy Policy</a>
          </span>
        </div>
      </div>
    </footer>
  );
}
