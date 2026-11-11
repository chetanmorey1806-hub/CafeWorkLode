import { useEffect, useState } from 'react';
import { createPortal } from 'react-dom';
import { Printer, Banknote, Smartphone, CreditCard, Check, ReceiptText, Wallet } from 'lucide-react';
import { useStore } from '../context/StoreContext';
import { Modal, Field } from './UI';
import { money, orderTotals, fmtDateTime } from '../utils/helpers';

/** Printable receipt */
export function Receipt({ order }) {
  const { state, cur } = useStore();
  const s = state.settings;
  const t = orderTotals(order);
  const table = state.tables.find((x) => x.id === order.tableId);
  return (
    <div className="receipt">
      <div className="r-center">
        <div className="r-title">{s.cafeName}</div>
        <div>{s.address}</div>
        <div>Ph: {s.phone}</div>
        {s.gstin && <div>GSTIN: {s.gstin}</div>}
      </div>
      <div className="r-line" />
      <div className="r-row"><span>Bill #{order.no}</span><span>{fmtDateTime(order.paidAt || order.createdAt)}</span></div>
      <div className="r-row">
        <span>{order.type === 'dine-in' ? `Table ${table?.name || '-'}` : order.type}</span>
        <span>{order.customerName}</span>
      </div>
      <div className="r-line" />
      <div className="r-row r-bold"><span>Item</span><span>Qty × Rate = Amt</span></div>
      {order.items.map((i, idx) => (
        <div className="r-row" key={idx}>
          <span>{i.name}</span>
          <span>{i.qty} × {i.price} = {i.qty * i.price}</span>
        </div>
      ))}
      <div className="r-line" />
      <div className="r-row"><span>Subtotal</span><span>{money(t.subtotal, cur)}</span></div>
      {t.discount > 0 && <div className="r-row"><span>Discount</span><span>-{money(t.discount, cur)}</span></div>}
      {t.tax > 0 && <div className="r-row"><span>GST ({order.taxPercent}%)</span><span>{money(t.tax, cur)}</span></div>}
      <div className="r-row r-total"><span>TOTAL</span><span>{money(t.total, cur)}</span></div>
      {order.paymentMethod && order.status === 'paid' && (
        <div className="r-row"><span>Paid via</span><span>{order.paymentMethod.toUpperCase()}</span></div>
      )}
      <div className="r-line" />
      <div className="r-center">{s.footer}</div>
    </div>
  );
}

export function printReceipt(order) {
  window.dispatchEvent(new CustomEvent('print-order', { detail: order }));
}

/** Mounted once; listens for print requests and prints the receipt only */
export function PrintHost() {
  const [order, setOrder] = useState(null);
  useEffect(() => {
    const handler = (e) => {
      setOrder(e.detail);
      setTimeout(() => window.print(), 150);
    };
    window.addEventListener('print-order', handler);
    return () => window.removeEventListener('print-order', handler);
  }, []);
  if (!order) return null;
  return createPortal(<div className="print-area"><Receipt order={order} /></div>, document.body);
}

export function ReceiptModal({ order, onClose }) {
  return (
    <Modal
      title={`Bill #${order.no}`}
      icon={ReceiptText}
      onClose={onClose}
      footer={
        <>
          <button className="btn" onClick={onClose}>Close</button>
          <button className="btn btn-primary" onClick={() => printReceipt(order)}><Printer size={16} /> Print</button>
        </>
      }
    >
      <Receipt order={order} />
    </Modal>
  );
}

export function PaymentModal({ order, onClose, onPaid }) {
  const { state, dispatch, notify, cur } = useStore();
  const [discount, setDiscount] = useState(order.discount || 0);
  const [discType, setDiscType] = useState('amt');
  const [method, setMethod] = useState('cash');
  const [received, setReceived] = useState('');
  const [customerId, setCustomerId] = useState(order.customerId || '');

  const subtotal = order.items.reduce((s, i) => s + i.price * i.qty, 0);
  const discAmt = discType === 'pct' ? (subtotal * (Number(discount) || 0)) / 100 : Number(discount) || 0;
  const preview = { ...order, discount: discAmt };
  const t = orderTotals(preview);
  const change = method === 'cash' && received ? Number(received) - t.total : 0;
  const customer = state.customers.find((c) => c.id === customerId);

  const pay = () => {
    const patch = {
      discount: +discAmt.toFixed(2),
      paymentMethod: method,
      customerId: customerId || null,
      customerName: customer?.name || order.customerName || '',
    };
    dispatch({ type: 'PAY_ORDER', id: order.id, patch });
    notify(`Bill #${order.no} paid — ${money(t.total, cur)}`);
    onPaid?.({ ...order, ...patch, status: 'paid', paidAt: new Date().toISOString() });
  };

  return (
    <Modal
      title={`Payment · Bill #${order.no}`}
      icon={Wallet}
      onClose={onClose}
      footer={
        <>
          <button className="btn" onClick={onClose}>Cancel</button>
          <button className="btn btn-success" onClick={pay}><Check size={16} /> Confirm {money(t.total, cur)}</button>
        </>
      }
    >
      <div className="pay-summary">
        <div className="r-row"><span>Items ({order.items.reduce((s, i) => s + i.qty, 0)})</span><span>{money(t.subtotal, cur)}</span></div>
        {t.discount > 0 && <div className="r-row text-ok"><span>Discount</span><span>-{money(t.discount, cur)}</span></div>}
        <div className="r-row"><span>GST {order.taxPercent}%</span><span>{money(t.tax, cur)}</span></div>
        <div className="r-row pay-total"><span>Payable</span><span>{money(t.total, cur)}</span></div>
      </div>

      <Field label="Customer (optional)">
        <select value={customerId} onChange={(e) => setCustomerId(e.target.value)}>
          <option value="">Walk-in customer</option>
          {state.customers.map((c) => (
            <option key={c.id} value={c.id}>{c.name} · {c.phone}</option>
          ))}
        </select>
      </Field>

      <div className="grid-2">
        <Field label="Discount">
          <input type="number" min="0" value={discount} onChange={(e) => setDiscount(e.target.value)} />
        </Field>
        <Field label="Type">
          <select value={discType} onChange={(e) => setDiscType(e.target.value)}>
            <option value="amt">{cur} Amount</option>
            <option value="pct">% Percent</option>
          </select>
        </Field>
      </div>

      <div className="field"><span>Payment method</span></div>
      <div className="seg">
        {[['cash', 'Cash', Banknote], ['upi', 'UPI', Smartphone], ['card', 'Card', CreditCard]].map(([k, l, I]) => (
          <button key={k} className={`seg-btn ${method === k ? 'active' : ''}`} onClick={() => setMethod(k)}><I size={16} /> {l}</button>
        ))}
      </div>

      {method === 'cash' && (
        <div className="grid-2 mt">
          <Field label="Cash received">
            <input type="number" value={received} onChange={(e) => setReceived(e.target.value)} placeholder={t.total} />
          </Field>
          <Field label="Return change">
            <input readOnly value={change > 0 ? money(change, cur) : '—'} />
          </Field>
        </div>
      )}
    </Modal>
  );
}
