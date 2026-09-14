'use strict';

const $ = (s, r = document) => r.querySelector(s);
const $$ = (s, r = document) => [...r.querySelectorAll(s)];
const esc = v => String(v ?? '').replace(/[&<>"']/g, c => ({ '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;', "'": '&#39;' }[c]));
const plain = v => { const d = new DOMParser().parseFromString(String(v ?? ''), 'text/html'); return d.body.textContent || ''; };

function rich(v) {
  const d = new DOMParser().parseFromString(String(v ?? ''), 'text/html');
  const allowed = ['B', 'STRONG', 'I', 'EM', 'U', 'S', 'BR', 'P', 'UL', 'OL', 'LI', 'BLOCKQUOTE', 'CODE', 'PRE', 'A'];
  function walk(node) {
    for (const el of [...node.children]) {
      if (['SCRIPT', 'STYLE', 'IFRAME', 'OBJECT', 'SVG', 'MATH'].includes(el.tagName)) { el.remove(); continue; }
      walk(el);
      if (!allowed.includes(el.tagName)) { el.replaceWith(...el.childNodes); continue; }
      const href = el.getAttribute('href');
      for (const attr of [...el.attributes]) el.removeAttribute(attr.name);
      if (el.tagName === 'A' && /^https?:\/\//i.test(href || '')) {
        el.setAttribute('href', href);
        el.setAttribute('target', '_blank');
        el.setAttribute('rel', 'noopener noreferrer');
      }
    }
  }
  walk(d.body);
  return d.body.innerHTML;
}

const amount = n => Number(n || 0).toLocaleString('en-US', { maximumFractionDigits: 2, minimumFractionDigits: 0 });
const price = n => `<span class="price">${amount(n)} <small>ج.م</small></span>`;

const state = {
  products: [],
  categories: [],
  payments: [],
  settings: {},
  user: null,
  csrf: '',
  selectedProduct: null,
  quantity: 1,
  coupon: '',
  quote: null,
  selectedPayment: '',
  orderKey: '',
  submittedOrder: null,
};

async function api(path, options = {}) {
  const res = await fetch(path, {
    credentials: 'same-origin',
    ...options,
    headers: {
      'Content-Type': 'application/json',
      ...(state.csrf ? { 'X-CSRF-Token': state.csrf } : {}),
      ...options.headers,
    },
  });
  let data;
  try {
    data = await res.json();
  } catch {
    throw Error('تعذر الاتصال بالمتجر. حاول مرة أخرى.');
  }
  if (!res.ok || data.ok === false) throw Error(data.error || 'تعذر إتمام العملية');
  return data;
}

function toast(message) {
  const t = $('#toast');
  if (!t) return;
  t.textContent = message;
  t.classList.add('visible');
  clearTimeout(toast.timer);
  toast.timer = setTimeout(() => t.classList.remove('visible'), 3500);
}

async function fileData(file) {
  if (!file || !file.size) return null;
  if (file.size > 3 * 1024 * 1024) throw Error('حجم الصورة أكبر من 3 ميجابايت');
  return new Promise((resolve, reject) => {
    const r = new FileReader();
    r.onload = () => resolve(r.result);
    r.onerror = () => reject(Error('تعذر قراءة الصورة'));
    r.readAsDataURL(file);
  });
}

function getPaymentBadge(name = '') {
  const n = name.toLowerCase();
  if (n.includes('فودافون') || n.includes('vodafone') || n.includes('كاش')) return '🇪🇬 كاش / محافظ مصر';
  if (n.includes('انستا') || n.includes('insta')) return '⚡ تحويل إنستاباي فوري';
  if (n.includes('usdt') || n.includes('crypto') || n.includes('رقمية') || n.includes('binance') || n.includes('bybit') || n.includes('trx') || n.includes('bsc') || n.includes('sol')) return '🪙 USDT / كريبتو';
  if (n.includes('فيزا') || n.includes('visa') || n.includes('card') || n.includes('paymob') || n.includes('بنك')) return '💳 بطاقة بنكية / Paymob';
  return 'وسيلة دفع معتمدة';
}

async function refreshQuote() {
  if (!state.selectedProduct) return;
  try {
    const q = await api('/api/quote', {
      method: 'POST',
      body: JSON.stringify({
        items: [{ id: state.selectedProduct.id, quantity: state.quantity }],
        coupon: state.coupon,
      }),
    });
    state.quote = q;
    render();
  } catch (err) {
    toast(err.message);
  }
}

async function refreshQuoteOnly() {
  if (!state.selectedProduct) return;
  try {
    const q = await api('/api/quote', {
      method: 'POST',
      body: JSON.stringify({
        items: [{ id: state.selectedProduct.id, quantity: state.quantity }],
        coupon: state.coupon,
      }),
    });
    state.quote = q;
    updateSummaryFigures();
    updatePaymentCardQuotes();
    updatePaymentGuide();
  } catch (err) {
    toast(err.message);
  }
}

function updateSummaryFigures() {
  const q = state.quote;
  if (!q) return;

  const qtyEl = $('#quantity-val');
  if (qtyEl) qtyEl.textContent = state.quantity;

  const subtotalEl = $('#summary-subtotal');
  if (subtotalEl) subtotalEl.textContent = `${amount(q.subtotal)} ج.م`;

  const discountRow = $('#summary-discount-row');
  const discountEl = $('#summary-discount');
  if (discountRow && discountEl) {
    if (q.discount > 0) {
      discountRow.style.display = 'flex';
      discountEl.textContent = `− ${amount(q.discount)} ج.م`;
    } else {
      discountRow.style.display = 'none';
    }
  }

  const totalEl = $('#summary-total');
  if (totalEl) totalEl.innerHTML = price(q.total);

  const sarEl = $('#summary-sar');
  if (sarEl) sarEl.textContent = `~ ${amount(q.estimates?.sar || (q.total / 13.33))} ر.س`;

  const usdEl = $('#summary-usd');
  if (usdEl) usdEl.textContent = `~ $${amount(q.estimates?.usd || (q.total / 50))}`;

  const egpEl = $('#summary-egp');
  if (egpEl) egpEl.textContent = `${amount(q.total)} ج.م`;

  const submitBtn = $('#checkout-submit-btn');
  if (submitBtn) submitBtn.textContent = `تأكيد الدفع والطلب الآن — ${amount(q.total)} ج.م`;
}

function updatePaymentCardQuotes() {
  const q = state.quote;
  if (!q || !q.payment_amounts) return;

  $$('.payment-card-item').forEach(card => {
    const id = card.dataset.paymentId;
    const desc = card.querySelector('.payment-card-desc');
    if (!desc) return;

    if (id === 'balance') {
      desc.textContent = `متاح: ${amount(state.user?.balance || 0)} ج.م`;
    } else {
      const pQuote = q.payment_amounts[id];
      if (pQuote) {
        desc.innerHTML = `<b dir="ltr">${esc(pQuote.amount)} ${esc(pQuote.currency)}</b>`;
      }
    }
  });
}

function renderProductSelector() {
  const app = $('#checkout-app');
  app.innerHTML = `
    <div style="max-width:720px;margin:40px auto;text-align:center;">
      <h1 style="font-size:1.8rem;margin-bottom:12px;">اختر الاشتراك لإتمام الشراء</h1>
      <p style="color:var(--muted);margin-bottom:28px;">اختر المنتج الرقمي الذي تود الاشتراك به للمتابعة لصفحة الدفع مباشرة.</p>
      <div class="product-grid" style="grid-template-columns:repeat(auto-fit,minmax(220px,1fr));">
        ${state.products.filter(p => !p.is_sold_out).map(p => `
          <div class="product-card" style="cursor:pointer;padding:18px;text-align:center;" data-select-product="${p.id}">
            <img src="${esc(p.image_url || '/assets/icons/default.svg')}" alt="" style="width:72px;height:72px;object-fit:contain;margin:0 auto 12px;">
            <h3 style="font-size:1.05rem;margin-bottom:6px;">${esc(p.name_ar || p.name_en)}</h3>
            <p style="color:var(--muted);font-size:.8rem;margin-bottom:12px;">${esc(p.delivery_label || 'تسليم سريع')}</p>
            <div>${price(p.price)}</div>
            <button type="button" class="button primary full" style="margin-top:14px;" data-select-product="${p.id}">اختيار ومتابعة الدفع ←</button>
          </div>
        `).join('')}
      </div>
    </div>
  `;
}

function selectProduct(id) {
  const p = state.products.find(x => x.id === Number(id));
  if (!p) return;
  state.selectedProduct = p;
  state.quantity = p.min_quantity || 1;
  history.replaceState(null, '', `?product=${p.id}`);
  refreshQuote();
}

function renderConfirmation() {
  const o = state.submittedOrder;
  const app = $('#checkout-app');
  app.innerHTML = `
    <div class="checkout-card checkout-success" style="max-width:680px;margin:30px auto;">
      <div class="checkout-success-icon">✓</div>
      <h1 style="font-size:1.8rem;margin-bottom:10px;">تم استلام طلبك بنجاح!</h1>
      <p style="color:var(--muted);font-size:.95rem;">بيانات طلبك مسجلة لدينا برقم فريد لمتابعة التفعيل والاستلام.</p>
      <div class="checkout-order-id">${esc(o.id)}</div>
      
      <div class="checkout-reassurance" style="text-align:right;margin-bottom:24px;">
        <svg viewBox="0 0 24 24"><path d="M22 11.08V12a10 10 0 1 1-5.93-9.14"/><polyline points="22 4 12 14.01 9 11.01"/></svg>
        <span>حالة الطلب الآن: <b>${esc(o.status === 'paid' ? 'تم تأكيد الدفع وجاري التجهيز' : 'بانتظار مراجعة التحويل')}</b></span>
      </div>

      ${o.payment_instructions ? `
        <div style="text-align:right;background:var(--raised);padding:18px;border-radius:12px;border:1px solid var(--line);margin-bottom:24px;">
          <h3 style="font-size:1rem;margin-bottom:8px;">تعليمات التحويل المالي:</h3>
          <div style="font-size:.9rem;line-height:1.8;white-space:pre-wrap;">${rich(o.payment_instructions)}</div>
        </div>
      ` : ''}

      ${o.deliveries && o.deliveries.length ? `
        <div style="text-align:right;background:var(--raised);padding:18px;border-radius:12px;border:1px solid var(--line);margin-bottom:24px;">
          <h3 style="font-size:1rem;margin-bottom:8px;color:var(--success);">بيانات الاشتراك والتفعيل:</h3>
          ${o.deliveries.map(d => `<pre class="delivery-data">${esc(d.payload)}</pre>`).join('')}
        </div>
      ` : ''}

      <div style="display:flex;gap:12px;justify-content:center;flex-wrap:wrap;">
        <a href="/" class="button primary">العودة للمتجر الرئيسي</a>
        ${state.settings.support_url ? `<a href="${esc(state.settings.support_url)}" target="_blank" rel="noopener noreferrer" class="button quiet">تواصل مع الدعم الفوري ↗</a>` : ''}
      </div>
    </div>
  `;
}

function render() {
  if (state.submittedOrder) {
    return renderConfirmation();
  }

  const p = state.selectedProduct;
  if (!p) {
    return renderProductSelector();
  }

  const q = state.quote;
  if (!q) {
    $('#checkout-app').innerHTML = '<div class="loading-state">جاري حساب الإجمالي وتجهيز طرق الدفع…</div>';
    return;
  }

  if (!state.selectedPayment && state.payments.length) {
    state.selectedPayment = String(state.payments[0].id);
  }

  const app = $('#checkout-app');
  app.innerHTML = `
    <div class="checkout-grid">
      <!-- Right Col: Checkout Form -->
      <form id="standalone-checkout-form" class="checkout-form-container">
        <input type="hidden" name="payment_method" value="${esc(state.selectedPayment)}">

        <!-- Step 1: Customer Info -->
        <div class="checkout-card">
          <div class="checkout-card-header">
            <span class="checkout-step-num">1</span>
            <h2>بيانات المشتري والاستلام</h2>
          </div>
          <div class="checkout-reassurance">
            <svg viewBox="0 0 24 24"><circle cx="12" cy="12" r="10"/><path d="M12 16v-4"/><path d="M12 8h.01"/></svg>
            <span>شراء سريع بدون كلمة مرور. ستصلك بيانات الاشتراك والتفعيل على بريدك الإلكتروني مباشرة.</span>
          </div>
          <div class="form-grid">
            <label>
              البريد الإلكتروني <span style="color:var(--danger)">*</span>
              <input type="email" name="email" value="${esc(state.user?.email || '')}" placeholder="you@example.com" required dir="ltr" autocomplete="email" inputmode="email">
              <small>نرسل بيانات الاشتراك وتفاصيل التفعيل إلى هذا البريد.</small>
            </label>
            <label>
              الاسم (اختياري)
              <input type="text" name="name" value="${esc(state.user?.name || '')}" placeholder="اسمك الكريم" maxlength="80">
            </label>
            ${q.items.filter(i => i.buyer_prompt).map(i => `
              <label>
                ${esc(i.name)} — ${esc(i.buyer_prompt)} <span style="color:var(--danger)">*</span>
                <input name="answer_${i.id}" ${i.buyer_prompt_expects === 'email' ? 'type="email" dir="ltr"' : 'type="text"'} placeholder="${i.buyer_prompt_expects === 'email' ? 'your-account@gmail.com' : 'بيانات التفعيل المطلوبة'}" required maxlength="500" autocomplete="off">
              </label>
            `).join('')}
          </div>
        </div>

        <!-- Step 2: Payment Method -->
        <div class="checkout-card">
          <div class="checkout-card-header">
            <span class="checkout-step-num">2</span>
            <h2>طريقة الدفع</h2>
          </div>
          <p style="color:var(--muted);font-size:.875rem;margin-bottom:16px;">اضغط على وسيلة الدفع المناسبة لك. نوفر تحويلات محلية لمصر، وبطاقات، وعملات رقمية للسعودية ودول الخليج:</p>
          
          <div class="payment-cards-grid">
            ${state.payments.map(m => {
              const selected = String(m.id) === state.selectedPayment;
              const eligible = q.payment_amounts?.[m.id]?.eligible !== false;
              return `
                <div class="payment-card-item ${selected ? 'selected' : ''}" data-payment-id="${esc(m.id)}" role="button" tabindex="0" aria-checked="${selected}">
                  <div class="payment-card-top">
                    <span class="payment-card-badge">${getPaymentBadge(m.name)}</span>
                    <div class="payment-check-dot"></div>
                  </div>
                  <div class="payment-card-title">${esc(m.name)}</div>
                  <div class="payment-card-desc">
                    ${q.payment_amounts?.[m.id] ? `<b dir="ltr">${esc(q.payment_amounts[m.id].amount)} ${esc(q.payment_amounts[m.id].currency)}</b>` : 'تحويل مباشر'}
                  </div>
                  ${!eligible ? '<span style="color:var(--danger);font-size:.7rem;">أقل من الحد الأدنى</span>' : ''}
                </div>
              `;
            }).join('')}

            ${state.user ? `
              <div class="payment-card-item ${state.selectedPayment === 'balance' ? 'selected' : ''}" data-payment-id="balance" role="button" tabindex="0" aria-checked="${state.selectedPayment === 'balance'}">
                <div class="payment-card-top">
                  <span class="payment-card-badge">💼 رصيد المتجر</span>
                  <div class="payment-check-dot"></div>
                </div>
                <div class="payment-card-title">رصيد المحفظة</div>
                <div class="payment-card-desc">متاح: ${amount(state.user.balance)} ج.م</div>
              </div>
            ` : ''}
          </div>

          <!-- Dynamic Payment Guide Box -->
          <div id="payment-guide-box" class="payment-guide-box" style="background:var(--raised);border:1px solid var(--line);border-radius:12px;padding:20px;margin-bottom:20px;">
            <div style="display:flex;align-items:center;justify-content:space-between;margin-bottom:12px;padding-bottom:10px;border-bottom:1px solid var(--line);">
              <strong style="font-size:.95rem;">بيانات التحويل المطلوب:</strong>
              <span id="payment-guide-amount" style="font-size:1.1rem;font-weight:700;color:var(--accent-strong);" dir="ltr"></span>
            </div>
            
            <div id="payment-guide-content" style="font-size:.9rem;line-height:1.8;white-space:pre-wrap;"></div>
          </div>

          <!-- Proof / Reference inputs -->
          <div id="payment-ref-group" class="form-grid" style="margin-bottom:14px;">
            <label>
              رقم العملية / المرجع أو رقم الحساب المحول منه <span style="color:var(--danger)">*</span>
              <input name="payment_ref" id="payment-ref-input" required maxlength="100" placeholder="مثال: رقم التحويل، أو آخر 4 أرقام من رقم محفظتك" autocomplete="off">
              <small>يُستخدم للتأكد من وصول التحويل واعتماد الطلب فوراً.</small>
            </label>
            <label id="payment-receipt-group">
              صورة الإيصال (اختياري لتسريع التأكيد)
              <input type="file" name="receipt" accept="image/jpeg,image/png,image/webp">
              <small>صورة التحويل أو لقطة الشاشة (JPG / PNG / WebP حتى 3 ميجابايت).</small>
            </label>
          </div>
        </div>

        <!-- Step 3: Terms & Submit -->
        <div class="checkout-card">
          <div class="form-grid">
            <label style="display:flex;align-items:flex-start;gap:10px;cursor:pointer;">
              <input type="checkbox" required checked style="margin-top:4px;">
              <span style="font-size:.875rem;line-height:1.7;">
                أوافق على استلام بيانات الاشتراك على بريدي، واطلعت على وصف المنتج وشروط الضمان والاسترجاع.
              </span>
            </label>

            <div class="form-error" role="alert" style="margin-top:10px;"></div>

            <button type="submit" id="checkout-submit-btn" class="button primary full" style="min-height:54px;font-size:1.1rem;font-weight:600;margin-top:8px;">
              تأكيد الدفع والطلب الآن — ${amount(q.total)} ج.م
            </button>
          </div>
        </div>
      </form>

      <!-- Left Col: Order Summary & International Currency Estimates -->
      <aside class="checkout-summary-sticky">
        <div class="checkout-card">
          <div class="checkout-card-header">
            <h2>ملخص الطلب</h2>
            <a href="/" style="font-size:.8125rem;color:var(--accent-strong);margin-inline-start:auto;">تغيير المنتج</a>
          </div>

          <div class="checkout-item-preview">
            <img src="${esc(p.image_url || '/assets/icons/default.svg')}" alt="">
            <div class="checkout-item-details">
              <h3>${esc(p.name_ar || p.name_en)}</h3>
              <p>${esc(p.duration || 'اشتراك رقمي')} • ${esc(p.delivery_label || 'تسليم فوري')}</p>
            </div>
          </div>

          ${p.max_quantity !== 1 ? `
            <div style="display:flex;align-items:center;justify-content:space-between;margin-top:16px;">
              <span style="font-size:.9rem;color:var(--muted);">الكمية المطلوبة:</span>
              <div class="quantity-control" style="margin-top:0;">
                <button type="button" data-qty="-1">−</button>
                <span id="quantity-val">${state.quantity}</span>
                <button type="button" data-qty="1">+</button>
              </div>
            </div>
          ` : ''}

          <!-- Coupon Input -->
          <div class="form-inline" style="margin-top:18px;">
            <input type="text" id="coupon-field" value="${esc(state.coupon)}" placeholder="كود الخصم (إن وجد)" style="height:44px;font-size:.875rem;">
            <button type="button" class="button secondary" style="min-height:44px;padding:8px 16px;" data-apply-coupon>تطبيق</button>
          </div>

          <!-- Price Breakdown -->
          <div class="purchase-summary" style="margin-top:18px;">
            <div class="row">
              <span>قيمة الاشتراك</span>
              <span id="summary-subtotal">${amount(q.subtotal)} ج.م</span>
            </div>
            <div class="row" id="summary-discount-row" style="${q.discount ? 'display:flex;' : 'display:none;'}color:var(--success);">
              <span>خصم الكوبون</span>
              <span id="summary-discount">− ${amount(q.discount)} ج.م</span>
            </div>
            <div class="row" style="border-top:1px solid var(--line);padding-top:12px;font-size:1.15rem;font-weight:700;">
              <span>الإجمالي النهائي</span>
              <span id="summary-total">${price(q.total)}</span>
            </div>
          </div>

          <!-- International / Gulf Currency Estimates -->
          <div style="margin-top:18px;">
            <span style="font-size:.8rem;color:var(--muted);display:block;margin-bottom:8px;">تقدير العملات للمشترين من السعودية والخليج:</span>
            <div class="currency-estimates">
              <div class="currency-pill highlight">
                <span>🇸🇦 السعودية:</span>
                <b id="summary-sar">~ ${amount(q.estimates?.sar || (q.total / 13.33))} ر.س</b>
              </div>
              <div class="currency-pill">
                <span>🇺🇸 الدولار:</span>
                <b id="summary-usd">~ $${amount(q.estimates?.usd || (q.total / 50))}</b>
              </div>
              <div class="currency-pill">
                <span>🇪🇬 مصر:</span>
                <b id="summary-egp">${amount(q.total)} ج.م</b>
              </div>
            </div>
          </div>
        </div>

        <!-- Trust Badges -->
        <div class="checkout-card" style="padding:18px 22px;">
          <div style="display:grid;gap:12px;font-size:.85rem;color:var(--muted);">
            <div style="display:flex;align-items:center;gap:10px;">
              <span style="color:var(--success);font-weight:700;">✓</span>
              <span>ضمان كامل على الحساب طوال فترة الاشتراك</span>
            </div>
            <div style="display:flex;align-items:center;gap:10px;">
              <span style="color:var(--success);font-weight:700;">✓</span>
              <span>استلام بيانات الاشتراك والتفعيل داخل حسابك وعبر الإيميل</span>
            </div>
            <div style="display:flex;align-items:center;gap:10px;">
              <span style="color:var(--success);font-weight:700;">✓</span>
              <span>دعم فني واستجابة سريعة لأي استفسار</span>
            </div>
          </div>
        </div>
      </aside>
    </div>
  `;

  updatePaymentGuide();
  attachFormEvents();
}

function selectPayment(id) {
  state.selectedPayment = String(id);

  $$('.payment-card-item').forEach(card => {
    const isThis = card.dataset.paymentId === state.selectedPayment;
    card.classList.toggle('selected', isThis);
    card.setAttribute('aria-checked', String(isThis));
  });

  const paymentInput = $('[name=payment_method]');
  if (paymentInput) paymentInput.value = state.selectedPayment;

  updatePaymentGuide();
}

function updatePaymentGuide() {
  const id = state.selectedPayment;
  const isBalance = id === 'balance';
  const method = state.payments.find(m => String(m.id) === id);
  const paymentQuote = state.quote?.payment_amounts?.[id];

  const amountEl = $('#payment-guide-amount');
  if (amountEl) {
    if (isBalance) {
      amountEl.textContent = `${amount(state.quote?.total)} ج.م`;
    } else if (paymentQuote) {
      amountEl.textContent = `${paymentQuote.amount} ${paymentQuote.currency}`;
    } else {
      amountEl.textContent = '';
    }
  }

  const contentEl = $('#payment-guide-content');
  if (contentEl) {
    if (isBalance) {
      contentEl.textContent = 'سيتم خصم المبلغ مباشرة من رصيد محفظتك وتفعيل طلبك فوراً.';
    } else {
      contentEl.innerHTML = rich(method?.instructions || 'اتبع بيانات التحويل وأدخل رقم العملية لتأكيد طلبك.');
    }
  }

  const refGroup = $('#payment-ref-group');
  const receiptGroup = $('#payment-receipt-group');
  const refInput = $('#payment-ref-input');

  if (refGroup) refGroup.style.display = isBalance ? 'none' : 'block';
  if (receiptGroup) receiptGroup.style.display = isBalance ? 'none' : 'block';
  if (refInput) refInput.required = !isBalance;
}

function changeQty(delta) {
  const p = state.selectedProduct;
  if (!p) return;
  const min = p.min_quantity || 1;
  const max = p.max_quantity || 100;
  const newQty = state.quantity + delta;
  if (newQty >= min && newQty <= max) {
    state.quantity = newQty;
    refreshQuoteOnly();
  }
}

function applyCoupon() {
  const val = $('#coupon-field')?.value.trim();
  state.coupon = val || '';
  refreshQuoteOnly();
  if (state.coupon) toast('تم تطبيق كود الخصم');
}

function attachFormEvents() {
  const form = $('#standalone-checkout-form');
  if (!form) return;

  form.addEventListener('submit', async e => {
    e.preventDefault();
    if (form.dataset.busy) return;
    form.dataset.busy = '1';

    const btn = $('[type=submit]', form);
    if (btn) btn.disabled = true;
    const errBox = $('.form-error', form);
    if (errBox) errBox.textContent = '';

    try {
      const fd = new FormData(form);
      const data = Object.fromEntries(fd);

      if (!state.orderKey) {
        state.orderKey = crypto.randomUUID();
      }

      const answers = {};
      for (const [k, v] of fd) {
        if (k.startsWith('answer_')) {
          answers[k.slice(7)] = v;
        }
      }

      const payload = {
        items: [{ id: state.selectedProduct.id, quantity: state.quantity }],
        coupon: state.coupon,
        email: data.email,
        name: data.name || '',
        answers,
        payment_method: state.selectedPayment,
        payment_ref: data.payment_ref || (state.selectedPayment === 'balance' ? '' : 'PENDING'),
        receipt: await fileData(fd.get('receipt')),
        idempotency_key: state.orderKey,
        quoted_total: state.quote.total,
      };

      const res = await api('/api/orders', {
        method: 'POST',
        body: JSON.stringify(payload),
      });

      state.submittedOrder = res.order;
      toast('تم تسجيل طلبك بنجاح!');
      render();
    } catch (err) {
      if (errBox) errBox.textContent = err.message;
      else toast(err.message);
    } finally {
      delete form.dataset.busy;
      if (btn) btn.disabled = false;
    }
  });
}

// Global Event Delegation (CSP compliant - no inline event attributes)
document.addEventListener('click', e => {
  const paymentCard = e.target.closest('[data-payment-id]');
  if (paymentCard) {
    e.preventDefault();
    selectPayment(paymentCard.dataset.paymentId);
    return;
  }

  const qtyBtn = e.target.closest('[data-qty]');
  if (qtyBtn) {
    e.preventDefault();
    changeQty(Number(qtyBtn.dataset.qty));
    return;
  }

  const couponBtn = e.target.closest('[data-apply-coupon]');
  if (couponBtn) {
    e.preventDefault();
    applyCoupon();
    return;
  }

  const selectProdBtn = e.target.closest('[data-select-product]');
  if (selectProdBtn) {
    e.preventDefault();
    selectProduct(selectProdBtn.dataset.selectProduct);
    return;
  }

  const retryBtn = e.target.closest('[data-retry]');
  if (retryBtn) {
    e.preventDefault();
    location.reload();
    return;
  }
});

document.addEventListener('keydown', e => {
  if (e.key === 'Enter' || e.key === ' ') {
    const paymentCard = e.target.closest('[data-payment-id]');
    if (paymentCard) {
      e.preventDefault();
      selectPayment(paymentCard.dataset.paymentId);
    }
  }
});

async function init() {
  const yearEl = $('#year');
  if (yearEl) yearEl.textContent = new Date().getFullYear();

  try {
    const catalog = await api('/api/catalog');
    const sess = await api('/api/session');

    state.products = catalog.products || [];
    state.categories = catalog.categories || [];
    state.payments = catalog.payment_methods || [];
    state.settings = catalog.settings || {};
    state.user = sess.user || null;
    state.csrf = sess.csrf || '';

    if (state.settings.store_name) {
      document.title = state.settings.store_name + ' — إتمام الشراء السريع';
      $$('.wordmark').forEach(w => {
        w.innerHTML = esc(state.settings.store_name) + '<small>CHECKOUT</small>';
      });
    }

    const params = new URLSearchParams(window.location.search);
    const prodId = params.get('product');

    if (prodId) {
      const p = state.products.find(x => x.id === Number(prodId));
      if (p && !p.is_sold_out) {
        state.selectedProduct = p;
        state.quantity = p.min_quantity || 1;
      }
    } else if (state.products.length) {
      const available = state.products.find(x => !x.is_sold_out);
      if (available) {
        state.selectedProduct = available;
        state.quantity = available.min_quantity || 1;
      }
    }

    if (state.selectedProduct) {
      await refreshQuote();
    } else {
      render();
    }
  } catch (err) {
    $('#checkout-app').innerHTML = `
      <div class="empty-state" style="max-width:500px;margin:40px auto;">
        <h3>تعذر تحميل بيانات الشراء</h3>
        <p>${esc(err.message)}</p>
        <button type="button" class="button secondary" data-retry>إعادة المحاولة</button>
      </div>
    `;
  }
}

init();
