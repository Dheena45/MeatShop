import OrdersList from '../components/OrdersList';

/* My Orders page — ported from orders.html */
export default function Orders() {
  return (
    <section className="section-pad pt-4">
      <div className="container">
        <h1 className="section-title mb-4">My Orders</h1>
        <OrdersList />
      </div>
    </section>
  );
}
