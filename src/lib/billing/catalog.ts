// Amounts are USD cents and must match the live Stripe prices and billing_private.apply_payment.
export const plans = {
 event_pass: {price: process.env.STRIPE_PRICE_EVENT_PASS || "price_1UO6cQBT7bmxRGOQYUXxXI3W", amount: 5000},
 standard: {price: process.env.STRIPE_PRICE_STANDARD || "price_1UO6fABT7bmxRGOQW651BRq4", amount: 20000},
 premium: {price: process.env.STRIPE_PRICE_PREMIUM || "price_1UO6giBT7bmxRGOQVa0kvEtw", amount: 25000},
} as const;
export type PaidTier = keyof typeof plans;
export function paidTier(value: string | undefined | null): value is PaidTier {
 return !!value && Object.prototype.hasOwnProperty.call(plans, value);
}
export function displayPrice(tier: PaidTier) {
 const cents = plans[tier].amount;
 return "$" + (cents % 100 === 0 ? String(cents / 100) : (cents / 100).toFixed(2));
}
