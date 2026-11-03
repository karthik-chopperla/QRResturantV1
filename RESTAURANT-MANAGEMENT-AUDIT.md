# Restaurant Management Application — End-to-End Audit

**Audit date:** 2026-11-03
**Audit type:** Read-only source-code audit
**Scope:** Current application implementation, roles, permissions, workflows, and build

## Audit boundaries

This audit did not modify application source code or database records. No real orders, stock receipts, payments, or refunds were created or triggered. The source code and production build were inspected, but live role logins, database-backed operations, and payment-provider behavior were not runtime-verified. Findings about workflows therefore describe the implementation found in code; they are not claims of successful production execution.

## A. Overall Project Status

- **Functional domains inspected:** 12 — authentication/RBAC, customer ordering, Owner, Manager, Cashier, Service, Kitchen, Inventory, Purchasing, Payments, Accounting, and Settings/Notifications.
- **Module status:** 0 COMPLETE, 11 PARTIAL, 1 BROKEN. No complete domain was certified; there are implemented features in every listed domain.
- **Overall readiness:** Substantial functionality exists, but the application should not be certified production-ready until payment handling, order completion, and access-scope concerns are resolved and tested end to end.
- **Build:** `npm run build` succeeded, including TypeScript checks and route generation.
- **Build warnings:** Next.js inferred a workspace root from multiple lockfiles; custom static-file cache headers may affect development behavior; the `middleware` convention is deprecated.
- **Testing limitation:** The project package scripts do not define a test command. No safe production workflow tests were performed.

## B. Role-by-Role Status

The shared sign-in and active-staff checks are implemented. Role-specific dashboard routing and server-side authorization helpers are present. Login success and actual access denials could not be verified without test accounts and credentials.

| Role | Login | Dashboard | Features found in code | Permission findings | Overall |
|---|---|---|---|---|---|
| Restaurant Owner (Admin) | NOT VERIFIED | `/dashboard` | Dashboard, orders, menu/categories, tables/QRs, offers, staff, settings, notifications, inventory, purchasing, accounting | Owner-only operations are generally guarded server-side. Some shared order/notification reads expose more data than needed. | PARTIAL |
| Manager | NOT VERIFIED | `/manager` | Operations overview, order monitoring, reservations, kitchen access | Can change orders to arbitrary statuses; no equivalent Owner-level staff-account or table/QR administration found. | PARTIAL |
| Cashier | NOT VERIFIED | `/cashier` | POS takeaway orders, register open/close, manual offline-payment confirmation | Cashier actions are guarded. Shared `getOrders` is broader than cashier-specific data needs; cashier refund workflow is absent. | PARTIAL |
| Service Staff (Waiter + Delivery) | NOT VERIFIED | `/service` | Ready-order handover, waiter/bill requests, dine-in serving, takeaway collection | Service page filters assigned/unassigned orders, but shared `getOrders` can return all orders and payment/invoice data. | PARTIAL |
| Chef / Kitchen Staff | NOT VERIFIED | `/kitchen` | Kitchen order board and preparation status transitions | Kitchen transitions are constrained, but its shared order read can return all order/payment/invoice details. | PARTIAL |
| Inventory Manager | NOT VERIFIED | `/inventory` | Ingredients, stock, wastage, adjustments, stock history, reports, expiry, purchase requests | Server guards are present. Category and recipe changes are Owner-only. | PARTIAL |
| Purchase Manager | NOT VERIFIED | `/purchasing` | Suppliers, purchase orders, receiving, partial deliveries, supplier payments | Server guards are present. Owner approves purchase orders. | PARTIAL |
| Accountant | NOT VERIFIED | `/accountant` | Accounting summary, expenses, CSV export, Razorpay refunds | Server guards are present. Refund action is Razorpay-only; reports are not a formal accounting ledger/P&L. | PARTIAL |

## C. Module-by-Module Status

Statuses:

- **COMPLETE** — Fully functional and verified.
- **PARTIAL** — Some functionality exists, but some is incomplete.
- **MISSING** — Not implemented.
- **BROKEN** — Implemented but not functioning correctly.
- **NOT VERIFIED** — Could not verify.

| Module | Status | Findings |
|---|---|---|
| Authentication and role access | PARTIAL | Supabase sign-in, active-user lookup, role routes, and server guards exist. Successful logins and actual cross-role denial were not live-tested. |
| Owner dashboard | PARTIAL | Dashboard, staff, menu, offers, tables/QR, payment, and settings surfaces exist. Some dashboard aggregates are misleading, and runtime button flows were not tested. |
| Manager operations | PARTIAL | Overview, orders, and reservations exist. Manager status changes are not constrained to valid order transitions. |
| Cashier POS and register | PARTIAL | Takeaway creation, register sessions, and offline payment confirmation exist. Cashier cannot refund, and end-to-end handover/payment sequencing was not verified. |
| Service | PARTIAL | Handles customer requests and marks ready orders served/collected. It does not itself close a dine-in order after payment. |
| Kitchen | PARTIAL | Preparation stages and READY handling exist. A missing-recipe warning is returned by the action but is not surfaced by the kitchen UI. |
| Customer QR ordering | PARTIAL | Signed table tokens gate menu viewing; server code recalculates menu prices. The order-creation action accepts a table ID without validating the QR token. |
| Inventory | PARTIAL | Ingredients/categories, stock movements, recipe management, adjustments, wastage, history, reports, batches, expiry alerts, and expired-stock exclusion are implemented. Automatic consumption does not create low-stock notifications, and no-recipe warnings are not shown to staff. |
| Purchasing | PARTIAL | Requests, suppliers, Owner approval, expected delivery, partial receipts, stock updates on receipt, and supplier payments exist. Runtime receipt and approval flows were not tested. |
| Payments and refunds | BROKEN | Razorpay verification/webhooks and manual offline confirmation exist, but the webhook treats `payment.authorized` as success. Refunds are limited to Razorpay and require Accountant/Owner access. |
| Accounting | PARTIAL | Payment/refund/expense/supplier-payment totals, GST/service charge figures, and CSV export exist. “Estimated net” is not a full profit-and-loss statement or ledger. |
| Settings and notifications | PARTIAL | Settings and notification actions exist. Several read actions return empty results on errors, which can hide failures as empty data. |

### Inventory features checked

- Ingredients, categories, current stock, manual stock additions, wastage, physical stock adjustments, movement history, recipes, and purchase integration are present in code.
- Batch/expiry fields and expiring-soon alerts exist; stock consumption excludes expired batches.
- Recipe management supports base items, variants, and add-ons; recipe cost and stock history surfaces exist.
- Inventory reports include current stock, low stock, consumption, wastage, and purchase history with CSV export.
- Automatic consumption occurs on transition to **READY**, not on the first `PREPARING` transition.
- The deduction uses saved recipes and ordered quantity; stock movements are recorded and cancellation attempts to reverse consumption.
- Missing-recipe warnings do not prevent READY and are not displayed in the Kitchen UI. Insufficient unexpired stock causes the READY transaction to fail.
- Automatic deductions do not create low-stock notifications.

### Purchasing features checked

- Inventory Manager purchase requests, Purchase Manager suppliers and purchase orders, Owner approval, expected delivery, partial receipts, confirmed stock receiving, and supplier payments are represented in code.
- Receipts update inventory only after a receipt is submitted, and the receiving action checks purchase status and remaining quantities.
- Runtime behavior was not verified against a database or supplier workflow.

## D. End-to-End Workflow Results

| Workflow | Starting point and completed steps | Missing or failed steps | Final outcome |
|---|---|---|---|
| **A. Dine-in QR ordering** | Signed table token → menu → order creation → kitchen preparation → READY → service handover → bill request/payment paths are present. | The order remains `SERVED` after payment unless an Owner/Manager separately sets it to `COMPLETED`. Completion creates the dine-in invoice and frees the table. Payment authorization may also be treated as payment success before capture. Not live-tested. | PARTIAL |
| **B. Counter takeaway** | Cashier opens register → creates POS order/payment/invoice → kitchen receives it → preparation → READY → Service can mark it collected. | Payment confirmation and collection are separate actions; the terminal state is `COLLECTED`, not `COMPLETED`. Full timing and receipt experience were not tested. | PARTIAL |
| **C. Inventory deduction** | Saved recipe → ordered item/quantity → first eligible transition to READY → stock allocation across unexpired batches → stock movement record. Cancellation attempts to reverse recorded consumption. | Missing recipes do not block READY and the returned warning is not shown in the UI. Insufficient unexpired stock rolls back READY. No post-placement order-quantity editing action was found to verify quantity-change handling. Low-stock notifications are not created by this automatic deduction path. | PARTIAL |
| **D. Purchasing** | Low stock can prompt a manual request → Purchase Manager can create a PO → Owner approval → expected delivery → partial or full receipt → confirmed quantities update inventory and create movements. | Workflow exists in code, but no live supplier/receipt workflow was executed. | PARTIAL |
| **E. Staff management** | Owner-only staff actions and role assignment exist; sign-in checks an active staff record and maps roles to dashboards. | No credentials were available to verify each role login, dashboard redirect, or unauthorized access denial at runtime. Shared order reads are not scoped to the signed-in staff member. | PARTIAL / NOT RUNTIME-VERIFIED |
| **F. Payments** | Razorpay signature verification/webhook handling, offline payment confirmation, invoices, and an Accountant/Owner Razorpay refund action exist. | `payment.authorized` is handled as success. Cash/UPI/Card refunds are not implemented in the refund action. Dine-in payment does not automatically close the order or free its table. No real payment/refund was triggered. | BROKEN / PARTIAL |
| **G. Financial management** | Payment collections, refunds, expenses, supplier payments, GST/service-charge figures, and CSV export are represented. | “Estimated net” is not a formal P&L; no complete accounting ledger or verified tax-report workflow was found. | PARTIAL |

## E. Critical Issues

1. **HIGH — Authorization is treated as a successful payment.** The Razorpay webhook handles both `payment.captured` and `payment.authorized` as success; the entity status is read but does not gate the update. Authorization is not proof of capture.
2. **HIGH — Order transitions can bypass the workflow.** Owner and Manager are allowed to set arbitrary order statuses without the transition checks applied to Kitchen and Service roles. They can mark an order `COMPLETED` without confirming payment or service, which also frees the table.
3. **HIGH — Shared order reads expose more data than the role needs.** `getOrders` allows Cashier, Service, and Kitchen roles and returns all orders with payment and invoice records, rather than filtering to assigned or role-relevant records. Generic notification reads are also available to all authenticated staff.
4. **HIGH — Dine-in orders do not close automatically after service and payment.** The status remains `SERVED` until an Owner/Manager changes it to `COMPLETED`; otherwise the table remains occupied and the completion invoice step is not reached.
5. **MEDIUM — Missing recipes can result in unrecorded consumption.** READY still succeeds when a menu item has no base recipe; a warning is returned, but the UI does not display it. Insufficient stock prevents READY by rolling back the transaction.
6. **MEDIUM — Public order/service actions are not bound to the signed QR token.** Menu retrieval validates a signed table token, but order creation and service requests accept table IDs and have no corresponding token check. Public service requests have no evident rate limit.
7. **MEDIUM — Automatic deductions do not create low-stock notifications.** Low-stock notifications are generated by some manual stock adjustments, but the recipe-consumption path does not generate one after reducing stock.
8. **LOW — Dashboard figures can be misleading.** Owner dashboard `totalRevenue` is calculated from a seven-day query, and average order value divides successful revenue by all orders, including unpaid orders. Errors in that analytics action return zero-shaped stats.

## F. Prioritized Implementation Roadmap

### 1. Critical bug fixes

- Only mark Razorpay payments successful on a captured/verified payment event; test duplicate and out-of-order webhook delivery.
- Enforce valid order transitions and require payment/service conditions before completion or table release.
- Scope order and notification reads to role and assignment needs; test direct server-action authorization, not only page/sidebar visibility.
- Bind public order and service requests to the signed table token and add abuse controls.

### 2. Missing core features

- Display missing-recipe and low-stock warnings in the Kitchen flow; define a safe resolution path for insufficient stock.
- Add or verify an order quantity-change path that adjusts inventory correctly if changes are allowed after preparation.
- Complete non-Razorpay refunds if they are required by the business.
- Add a formal P&L/ledger and complete tax reporting if accounting requirements demand them.

### 3. Incomplete role dashboards

- Verify all eight role logins and server-side denials with test accounts.
- Clarify Manager staff/table responsibilities and ensure those actions have matching server authorization.
- Verify service assignment, cashier payment-confirmation visibility, and purchase approval responsibilities.

### 4. Workflow improvements

- Close dine-in orders and release tables consistently after payment and service.
- Add low-stock notification checks after all stock decreases, including automatic consumption.
- Correct Owner dashboard revenue/average-order calculations and surface data-fetch failures instead of silently showing zeros.

### 5. Verification

- Run safe, non-production end-to-end tests for QR, POS, Kitchen READY deduction, partial receiving, payment verification, and refunds.
- Add automated tests for duplicate status updates, insufficient stock, cancellation/reversal, and authorization boundaries.
- Re-test the build and address workspace-root and middleware deprecation warnings when convenient.

## Audit references

- Authentication: `actions/auth.ts`
- Role guards and default routes: `lib/roles.ts`
- Orders, payment status, and inventory deduction: `actions/orders.ts`
- Razorpay verification: `app/api/payments/verify/route.ts`
- Razorpay webhook: `app/api/payments/webhook/route.ts`
- Inventory actions and reports: `actions/inventory.ts`
- Purchasing actions: `actions/purchasing.ts`
- Accounting actions: `actions/accounting.ts`
- Dashboard statistics: `actions/analytics.ts`
- Project scripts: `package.json`
