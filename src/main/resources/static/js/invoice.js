/* FreshMeat — Invoice viewer (customer + admin) */

(function () {
    const params = new URLSearchParams(window.location.search);
    const orderId = params.get('order');
    const isAdmin = params.get('admin') === '1';
    const autoPrint = params.get('print') === '1';

    if (!orderId) {
        document.getElementById('invoice-root').innerHTML = errorHtml('Missing order reference.');
        return;
    }

    const invoiceUrl = isAdmin
        ? '/api/admin/orders/' + orderId + '/invoice'
        : '/api/orders/' + orderId + '/invoice';
    const pdfUrl = isAdmin
        ? '/api/admin/orders/' + orderId + '/invoice/pdf'
        : '/api/orders/' + orderId + '/invoice/pdf';

    document.addEventListener('DOMContentLoaded', init);

    function init() {
        if (isAdmin) { if (!Auth.requireAdmin()) return; }
        else if (!Auth.requireLogin()) return;

        document.getElementById('inv-back').addEventListener('click', () => {
            window.history.length > 1 ? window.history.back() : window.location.href = '/orders.html';
        });
        document.getElementById('inv-print').addEventListener('click', () => window.print());
        document.getElementById('inv-download').addEventListener('click', downloadPdf);

        loadInvoice();
    }

    async function loadInvoice() {
        const root = document.getElementById('invoice-root');
        try {
            const res = await apiCall(invoiceUrl);
            renderInvoice(res.data, root);
            if (autoPrint) window.print();
        } catch (e) {
            if (e.status === 401 || e.status === 403) {
                if (isAdmin) { Auth.requireAdmin(); Auth.clear(); window.location.href = '/login.html'; }
                else { Auth.clear(); window.location.href = '/login.html?redirect=' + encodeURIComponent('/invoice.html?order=' + orderId); }
                return;
            }
            root.innerHTML = errorHtml(e.message || 'Could not load the invoice.');
        }
    }

    async function downloadPdf() {
        const btn = document.getElementById('inv-download');
        btn.disabled = true;
        try {
            await downloadFile(pdfUrl, 'FreshMeat-Invoice.pdf');
        } catch (e) {
            showToast(e.message || 'Download failed', 'error');
        } finally {
            btn.disabled = false;
        }
    }

    function renderInvoice(inv, root) {
        const rcMoney = v => {
            const n = Number(v || 0);
            const s = n.toLocaleString('en-IN', { minimumFractionDigits: 2, maximumFractionDigits: 2 });
            return '\u20B9' + s.replace(/\.00$/, '');
        };
        const qty = v => String(Number(v || 0)).replace(/\.0+$/, '');
        const cutting = c => c ? String(c).replace(/_/g, ' ') : 'Standard';
        const ddMMyyyy = d => {
            if (!d) return '-';
            const dt = new Date(d);
            if (isNaN(dt.getTime())) return '-';
            const p = x => String(x).padStart(2, '0');
            return p(dt.getDate()) + '-' + p(dt.getMonth() + 1) + '-' + dt.getFullYear();
        };

        const itemsHtml = (inv.items || []).map(it => `
            <div class="item">
                <span class="rc-name">${escapeHtml(it.productName)}<span class="rc-cutting">(${escapeHtml(cutting(it.cuttingOption))})</span></span>
                <span class="rc-qty">${qty(it.quantity)} ${escapeHtml(it.unit || 'KG')}</span>
                <span class="rc-amt">${rcMoney(it.subtotal)}</span>
            </div>`).join('');

        const doorStreetArea = [inv.deliveryDoor, inv.deliveryStreet, inv.deliveryArea]
            .filter(Boolean).join(', ');
        const cityPart = [inv.deliveryCity, inv.deliveryPincode].filter(Boolean).join(' - ');
        const deliveryAddress = [doorStreetArea, (cityPart ? '(' + cityPart + ')' : ''), inv.deliveryState]
            .filter(Boolean).join(', ');

        const paidAt = inv.paidAt
            ? `<div class="kv"><span>Paid On</span><b>${ddMMyyyy(inv.paidAt)}</b></div>` : '';

        root.innerHTML = `
        <div class="rc-brand">FRESHMEAT</div>
        <div class="rc-sub">Fresh Meat Shop</div>
        <div class="rc-sep"></div>

        <div class="rc-meta">
            <div class="kv"><span>Invoice</span><b>${escapeHtml(inv.invoiceNumber || '-')}</b></div>
            <div class="kv"><span>Order</span><b>#${escapeHtml(inv.orderNumber || '')}</b></div>
            <div class="kv"><span>Date</span><b>${ddMMyyyy(inv.invoiceDate)}</b></div>
        </div>

        <div class="rc-customer">
            <div class="kv"><span>Customer</span><b>${escapeHtml(inv.customerName || '')}</b></div>
            <div class="kv"><span>Mobile</span><b>${escapeHtml(inv.customerPhone || '')}</b></div>
            ${deliveryAddress ? `<div class="line">Deliver To: ${escapeHtml(deliveryAddress)}</div>` : ''}
        </div>

        <div class="rc-sep"></div>
        <div class="rc-items">
            ${itemsHtml || '<div class="item">No items</div>'}
        </div>
        <div class="rc-sep"></div>

        <div class="rc-totals">
            <div class="kv"><span>Subtotal</span><span>${rcMoney(inv.subtotal)}</span></div>
            <div class="kv"><span>Discount</span><span>-${rcMoney(inv.discountAmount)}</span></div>
            <div class="kv"><span>Delivery</span><span>${Number(inv.deliveryCharge) === 0 ? 'FREE' : rcMoney(inv.deliveryCharge)}</span></div>
            <div class="rc-sep"></div>
            <div class="kv total"><span>TOTAL</span><span>${rcMoney(inv.grandTotal)}</span></div>
        </div>

        <div class="rc-sep"></div>
        <div class="rc-pay">
            <div class="kv"><span>Payment</span><b>${escapeHtml((inv.paymentMethod || '-').replace(/_/g, ' '))}</b></div>
            <div class="kv"><span>Status</span><b>${escapeHtml((inv.paymentStatus || '-').replace(/_/g, ' '))}</b></div>
            ${paidAt}
            <div class="kv"><span>Order Status</span><b>${escapeHtml((inv.orderStatus || '-').replace(/_/g, ' '))}</b></div>
            ${inv.deliverySlot ? `<div class="kv"><span>Delivery</span><b>${escapeHtml(inv.deliverySlot)}</b></div>` : ''}
            ${inv.notes ? `<div class="rc-notes">Notes: ${escapeHtml(inv.notes)}</div>` : ''}
        </div>

        <div class="rc-sep"></div>
        <div class="rc-foot">
            <div class="thanks">Thank you for shopping with FreshMeat!</div>
            <div class="helpline">${escapeHtml(inv.storeAddress || '')}${inv.storePhone ? ' • ' + escapeHtml(inv.storePhone) : ''}${inv.storeEmail ? ' • ' + escapeHtml(inv.storeEmail) : ''}</div>
        </div>`;
    }

    function errorHtml(message) {
        return `<div class="invoice-error">
            <div class="big"><i class="fa-solid fa-circle-exclamation me-2"></i>Invoice unavailable</div>
            <div>${escapeHtml(message)}</div>
            <div style="margin-top:18px;">
                <button class="btn-invoice" style="border:1px solid #cbd5e1;color:var(--ink);" onclick="window.history.back()">Go Back</button>
            </div>
        </div>`;
    }
})();