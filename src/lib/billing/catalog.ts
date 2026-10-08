export const plans = {
 event_pass: {price: process.env.STRIPE_PRICE_EVENT_PASS || "price_1UO6cQBT7bmxRGOQYUXxXI3W", amount: 4900},
 standard: {price: process.env.STRIPE_PRICE_STANDARD || "price_1UO6fABT7bmxRGOQW651BRq4", amount: 19900},
 premium: {price: process.env.STRIPE_PRICE_PREMIUM || "price_1UO6giBT7bmxRGOQVa0kvEtw", amount: 34900},
} as const;
export type PaidTier = keyof typeof plans;
export function paidTier(value: string | undefined | null): value is PaidTier {
 return !!value && Object.prototype.hasOwnProperty.call(plans, value);
}
