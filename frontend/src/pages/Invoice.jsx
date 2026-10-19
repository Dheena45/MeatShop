import { useState } from 'react';
import { useNavigate, useSearchParams } from 'react-router-dom';
import { apiCall, downloadFile } from '../lib/api';
import { showToast } from '../lib/toast';
import { setAuthRole } from '../lib/auth';
import { useAuth } from '../context/AuthContext';
import { useEffect } from 'react';

/* Printable bill — ported from invoice.html + js/invoice.js.
   Standalone route (no site chrome) so it prints cleanly. Serves both the
   customer (/invoice?order=X) and admin (/invoice?order=X&admin=1). */

const INVOICE_CSS = `
  * { box-sizing: border-box; margin: 0; padding: 0; }
  body { background: #f3f4f6; font-family: 'Courier New', Courier, monospace; -webkit-print-color-adjust: exact; print-color-adjust: exact; }
  .invoice-toolbar { position: sticky; top: 0; z-index: 50; display: flex; align-items: center; justify-content: space-between; gap: 12px; padding: 12px 24px; background: #1f2937; font-family: 'Poppins', system-ui, sans-serif; box-shadow: 0 2px 10px rgba(0,0,0,.18); }
  .btn-invoice { display: inline-flex; align-items: center; gap: 8px; border: 1px solid rgba(255,255,255,.28); background: transparent; color: #fff; font-size: 0.85rem; font-weight: 500; padding: 9px 18px; border-radius: 8px; cursor: pointer; transition: background .2s, border-color .2s; }
  .btn-invoice:hover { background: rgba(255,255,255,.12); border-color: #fff; }
  .btn-invoice.primary { background: #8b1a1a; border-color: #8b1a1a; }
  .btn-invoice.primary:hover { background: #6e1414; border-color: #6e1414; }
  .invoice-wrap { max-width: 460px; margin: 28px auto; padding: 0 12px; }
  .invoice-sheet { background: #fff; color: #111; padding: 26px 24px; border-radius: 4px; box-shadow: 0 6px 24px rgba(0,0,0,.10); font-size: 13px; line-height: 1.55; }
  .rc-brand { text-align: center; font-size: 20px; font-weight: 700; letter-spacing: 1px; color: #8b1a1a; }
  .rc-sub { text-align: center; font-size: 11px; color: #555; }
  .rc-sep { border-top: 1px dashed #999; margin: 9px 0; }
  .rc-meta .kv { display: flex; justify-content: space-between; font-size: 12.5px; }
  .rc-customer { margin: 8px 0; }
  .rc-customer .line { white-space: pre-line; }
  .rc-items { margin: 8px 0 2px; }
  .rc-items .item { display: flex; justify-content: space-between; gap: 8px; font-size: 12.5px; padding: 1px 0; }
  .rc-items .item .rc-name { text-align: left; flex: 1 1 auto; }
  .rc-items .item .rc-qty { white-space: nowrap; }
  .rc-items .item .rc-amt { white-space: nowrap; }
  .rc-cutting { display: block; font-size: 11px; color: #666; }
  .rc-totals { margin: 8px 0; }
  .rc-totals .kv { display: flex; justify-content: space-between; font-size: 12.5px; padding: 1px 0; }
  .rc-totals .kv.total { font-size: 16px; font-weight: 700; }
  .rc-pay .kv { display: flex; justify-content: space-between; font-size: 12.5px; padding: 1px 0; }
  .rc-notes { margin-top: 8px; font-size: 11.5px; color: #444; white-space: pre-line; }
  .rc-foot { text-align: center; margin-top: 10px; }
  .rc-foot .thanks { font-weight: 700; }
  .rc-foot .helpline { font-size: 11px; color: #555; white-space: pre-line; }
  .invoice-loading, .invoice-error { text-align: center; padding: 60px 20px; color: #6b7280; font-size: 13px; font-family: 'Poppins', system-ui, sans-serif; }
  .invoice-error .big { font-size: 1.05rem; font-weight: 600; color: #b91c1c; margin-bottom: 8px; }
  .invoice-error button { border: 1px solid #cbd5e1; color: #111; background: #fff; padding: 8px 16px; border-radius: 8px; cursor: pointer; margin-top: 14px; }
  @media print {
    @page { size: A4; margin: 10mm; }
    body { background: #fff; }
    .invoice-toolbar { display: none !important; }
    .invoice-wrap { max-width: none; margin: 0; padding: 0; }
    .invoice-sheet { border-radius: 0; box-shadow: none; padding: 0; max-width: 420px; margin: 0 auto; }
  }
`;

function rcMoney(v) {
  const n = Number(v || 0);
  const s = n.toLocaleString('en-IN', { minimumFractionDigits: 2, maximumFractionDigits: 2 });
  return '\u20B9' + s.replace(/\.00$/, '');
}
const rcQty = v => String(Number(v || 0)).replace(/\.0+$/, '');
const rcCutting = c => c ? String(c).replace(/_/g, ' ') : 'Standard';
function ddMMyyyy(d) {
  if (!d) return '-';
  const dt = new Date(d);
  if (isNaN(dt.getTime())) return '-';
  const p = x => String(x).padStart(2, '0');
  return p(dt.getDate()) + '-' + p(dt.getMonth() + 1) + '-' + dt.getFullYear();
}

export default function Invoice() {
  const [searchParams] = useSearchParams();
  const navigate = useNavigate();
  const { isLoggedIn, isAdmin, logout } = useAuth();
  const orderId = searchParams.get('order');
  const isAdminMode = searchParams.get('admin') === '1';
  const autoPrint = searchParams.get('print') === '1';

  // Admin-mode invoices send the admin token even though the path is /invoice.
  if (isAdminMode) setAuthRole('admin');

  const [invoice, setInvoice] = useState(null);
  const [error, setError] = useState(orderId ? '' : 'Missing order reference.');
  const [downloading, setDownloading] = useState(false);

  useEffect(() => {
    if (!orderId) return;
    let cancelled = false;

    (async () => {
      // Client-side guard (server re-checks the token/role on the request).
      if (isAdminMode) {
        if (!isLoggedIn || !isAdmin) {
          if (isAdminMode) { logout(); navigate('/login?role=admin'); }
          return;
        }
      } else if (!isLoggedIn) {
        navigate('/login?redirect=' + encodeURIComponent('/invoice?order=' + orderId));
        return;
      }

      const url = isAdminMode
        ? '/api/admin/orders/' + orderId + '/invoice'
        : '/api/orders/' + orderId + '/invoice';
      try {
        const res = await apiCall(url);
        if (cancelled) return;
        setInvoice(res.data);
        if (autoPrint) setTimeout(() => window.print(), 300);
      } catch (e) {
        if (cancelled) return;
        if (e.status === 401 || e.status === 403) {
          if (isAdminMode) { logout(); navigate('/login?role=admin'); }
          else { logout(); navigate('/login?redirect=' + encodeURIComponent('/invoice?order=' + orderId)); }
          return;
        }
        setError(e.message || 'Could not load the invoice.');
      }
    })();

    return () => { cancelled = true; };
    /* eslint-disable-next-line */
  }, [orderId, isAdminMode]);

  async function downloadPdf() {
    setDownloading(true);
    try {
      const pdfUrl = isAdminMode
        ? '/api/admin/orders/' + orderId + '/invoice/pdf'
        : '/api/orders/' + orderId + '/invoice/pdf';
      await downloadFile(pdfUrl, 'FreshMeat-Invoice.pdf');
    } catch (e) {
      showToast(e.message || 'Download failed', 'error');
    } finally {
      setDownloading(false);
    }
  }

  function goBack() {
    if (window.history.length > 1) window.history.back();
    else navigate(isAdminMode ? '/admin/orders' : '/orders');
  }

  return (
    <>
      <style>{INVOICE_CSS}</style>
      <div className="invoice-toolbar no-print">
        <button className="btn-invoice" onClick={goBack}><i className="fa-solid fa-arrow-left"></i> Back</button>
        <div style={{ display: 'flex', gap: 10 }}>
          <button className="btn-invoice" onClick={() => window.print()}><i className="fa-solid fa-print"></i> Print</button>
          <button className="btn-invoice primary" onClick={downloadPdf} disabled={downloading}>
            <i className="fa-solid fa-download"></i> Download PDF
          </button>
        </div>
      </div>

      <div className="invoice-wrap">
        <div className="invoice-sheet">
          {error ? (
            <div className="invoice-error">
              <div className="big"><i className="fa-solid fa-circle-exclamation me-2"></i>Invoice unavailable</div>
              <div>{error}</div>
              <div style={{ marginTop: 18 }}>
                <button onClick={goBack}>Go Back</button>
              </div>
            </div>
          ) : !invoice ? (
            <div className="invoice-loading"><i className="fa-solid fa-circle-notch fa-spin me-2"></i>Loading bill...</div>
          ) : (
            <>
              <div className="rc-brand">FRESHMEAT</div>
              <div className="rc-sub">Fresh Meat Shop</div>
              <div className="rc-sep"></div>

              <div className="rc-meta">
                <div className="kv"><span>Invoice</span><b>{invoice.invoiceNumber || '-'}</b></div>
                <div className="kv"><span>Order</span><b>#{invoice.orderNumber || ''}</b></div>
                <div className="kv"><span>Date</span><b>{ddMMyyyy(invoice.invoiceDate)}</b></div>
              </div>

              <div className="rc-customer">
                <div className="kv"><span>Customer</span><b>{invoice.customerName || ''}</b></div>
                <div className="kv"><span>Mobile</span><b>{invoice.customerPhone || ''}</b></div>
                {(() => {
                  const doorStreetArea = [invoice.deliveryDoor, invoice.deliveryStreet, invoice.deliveryArea].filter(Boolean).join(', ');
                  const cityPart = [invoice.deliveryCity, invoice.deliveryPincode].filter(Boolean).join(' - ');
                  const deliveryAddress = [doorStreetArea, (cityPart ? '(' + cityPart + ')' : ''), invoice.deliveryState].filter(Boolean).join(', ');
                  return deliveryAddress ? <div className="line">Deliver To: {deliveryAddress}</div> : null;
                })()}
              </div>

              <div className="rc-sep"></div>
              <div className="rc-items">
                {(invoice.items || []).length ? invoice.items.map((it, i) => (
                  <div className="item" key={i}>
                    <span className="rc-name">{it.productName}<span className="rc-cutting">({rcCutting(it.cuttingOption)})</span></span>
                    <span className="rc-qty">{rcQty(it.quantity)} {it.unit || 'KG'}</span>
                    <span className="rc-amt">{rcMoney(it.subtotal)}</span>
                  </div>
                )) : <div className="item">No items</div>}
              </div>
              <div className="rc-sep"></div>

              <div className="rc-totals">
                <div className="kv"><span>Subtotal</span><span>{rcMoney(invoice.subtotal)}</span></div>
                <div className="kv"><span>Discount</span><span>-{rcMoney(invoice.discountAmount)}</span></div>
                <div className="kv"><span>Delivery</span><span>{Number(invoice.deliveryCharge) === 0 ? 'FREE' : rcMoney(invoice.deliveryCharge)}</span></div>
                <div className="rc-sep"></div>
                <div className="kv total"><span>TOTAL</span><span>{rcMoney(invoice.grandTotal)}</span></div>
              </div>

              <div className="rc-sep"></div>
              <div className="rc-pay">
                <div className="kv"><span>Payment</span><b>{(invoice.paymentMethod || '-').replace(/_/g, ' ')}</b></div>
                <div className="kv"><span>Status</span><b>{(invoice.paymentStatus || '-').replace(/_/g, ' ')}</b></div>
                {invoice.paidAt ? <div className="kv"><span>Paid On</span><b>{ddMMyyyy(invoice.paidAt)}</b></div> : null}
                <div className="kv"><span>Order Status</span><b>{(invoice.orderStatus || '-').replace(/_/g, ' ')}</b></div>
                {invoice.deliverySlot ? <div className="kv"><span>Delivery</span><b>{invoice.deliverySlot}</b></div> : null}
                {invoice.notes ? <div className="rc-notes">Notes: {invoice.notes}</div> : null}
              </div>

              <div className="rc-sep"></div>
              <div className="rc-foot">
                <div className="thanks">Thank you for shopping with FreshMeat!</div>
                <div className="helpline">
                  {invoice.storeAddress || ''}{invoice.storePhone ? ' \u2022 ' + invoice.storePhone : ''}{invoice.storeEmail ? ' \u2022 ' + invoice.storeEmail : ''}
                </div>
              </div>
            </>
          )}
        </div>
      </div>
    </>
  );
}
