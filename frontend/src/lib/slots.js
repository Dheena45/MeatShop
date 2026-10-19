/* Delivery time slots. Mirrors js/checkout.js: shorter windows on weekdays and
   extra evening windows on weekends. Shared with the admin order editor. */

export const WEEKDAY_DELIVERY_SLOTS = [
  '6 AM - 8 AM',
  '8 AM - 10 AM',
  '10 AM - 12 PM'
];

export const WEEKEND_DELIVERY_SLOTS = [
  '6 AM - 8 AM',
  '8 AM - 10 AM',
  '10 AM - 12 PM',
  '12 PM - 2 PM',
  '4 PM - 6 PM',
  '6 PM - 8 PM'
];

/* Slots offered for a given JS day-of-week (0 = Sunday). */
export function deliverySlotsForDay(day) {
  return (day === 0 || day === 6) ? WEEKEND_DELIVERY_SLOTS : WEEKDAY_DELIVERY_SLOTS;
}

/* En dash rendering used in the checkout picker ("6 AM – 8 AM"). */
export function slotLabel(slot) {
  return String(slot || '').replace(/ - /g, ' \u2013 ');
}
