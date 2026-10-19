/* Customer-facing order status milestones (shared by the order list, the order
   details timeline and the profile's recent orders).

   The customer sees exactly five milestones. The backend still uses
   READY_FOR_PICKUP as an internal handover status between PREPARING and
   OUT_FOR_DELIVERY, so it is mapped onto the Preparing step instead of being
   shown as a sixth stage of its own. */

export const CUSTOMER_ORDER_STEPS = [
  { key: 'PLACED', label: 'Order Placed' },
  { key: 'CONFIRMED', label: 'Confirmed' },
  { key: 'PREPARING', label: 'Preparing' },
  { key: 'OUT_FOR_DELIVERY', label: 'Out for Delivery' },
  { key: 'DELIVERED', label: 'Delivered' }
];

export const CUSTOMER_STATUS_STAGE = {
  PLACED: 'PLACED',
  CONFIRMED: 'CONFIRMED',
  PREPARING: 'PREPARING',
  READY_FOR_PICKUP: 'PREPARING',
  OUT_FOR_DELIVERY: 'OUT_FOR_DELIVERY',
  DELIVERED: 'DELIVERED'
};

export function customerOrderStepIndex(status) {
  const stage = CUSTOMER_STATUS_STAGE[status];
  if (!stage) return -1;
  return CUSTOMER_ORDER_STEPS.findIndex(s => s.key === stage);
}

export function customerOrderStatusLabel(status) {
  const idx = customerOrderStepIndex(status);
  return idx >= 0 ? CUSTOMER_ORDER_STEPS[idx].label : String(status || '').replace(/_/g, ' ');
}

export function customerOrderStatusClass(status) {
  return CUSTOMER_STATUS_STAGE[status] || 'CANCELLED';
}
