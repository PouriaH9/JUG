# JUG — launch requirements

JUG is a premium juggling brand for professional jugglers and beginners. Its launch catalogue sells ready-made juggling balls individually and in sets, with tutorial courses to support progression. Dark charcoal and burnt orange define the visual identity. The product model is an original concept: no prototype image was accessible in the supplied workspace.

## Customer experience

- Browse and filter a catalogue, inspect product details, choose existing variants and quantities, and manage a shopping cart.
- Purchase as a guest or register an account. Customer accounts provide order history and wishlists.
- Read and submit product reviews, subject to moderation. Apply configurable discount codes at checkout.
- Browse beginner and advanced tutorial courses. Course price, access policy, media hosting and actual lesson content require confirmation before commercial launch.
- Enter delivery details and see a configurable shipping fee. Checkout currently uses a clearly labelled test payment action. No actual money is charged and no Zarinpal transaction is initiated.
- Experience an interactive Blender-derived 3D hero with a usable fallback and reduced-motion support.

## Administration

An authenticated admin area manages products, descriptions, images, variants, prices, stock, orders and fulfilment status. It should also manage discounts, review moderation, courses and shipping settings as launch scope matures. Admin credentials must be separated from ordinary customers, and order/payment changes must be recorded.

## Initial operating assumptions

The first market is Iran and displayed prices use toman; the gateway integration must explicitly convert units if its API requires rial. Delivery fees, supported regions, lead times and return terms remain business-configurable. Catalogue entries, prices, stock and lesson content in the demo are sample data and must be replaced before selling. Customers cannot design or customize balls.

## Technical direction

Next.js provides the storefront and administration interface. Go provides the API and business rules. PostgreSQL is the persistent source of truth. Blender supplies an editable original ball scene and exported GLB; Framer Motion provides interface motion. The initial release must distinguish working demo behaviour from production readiness.

## Acceptance and production checklist

- Product/cart/checkout flows work on mobile and desktop; unavailable stock cannot be purchased.
- A successful test checkout records an order visible to the customer and administrator. Refreshes preserve relevant state.
- Customer data and administration operations require appropriate authorization; clients cannot set order totals or payment state.
- Before commercial launch: activate and verify the real gateway and callbacks, configure PostgreSQL backups, replace demonstration data, secure secrets and sessions, add production email/SMS delivery, publish shipping/return/privacy terms, and perform deployment and security verification.
- Real gateway checkout must validate server-side totals, handle duplicate callbacks safely, reconcile transactions, and only mark payment successful after gateway verification.
