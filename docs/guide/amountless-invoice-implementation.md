# Amountless BOLT11 Invoice Support in LNbits

This document provides a comprehensive analysis supporting the implementation of amountless (zero-amount) BOLT11 invoice payments in LNbits, with a focus on the LND REST backend.

## Table of Contents

- [Overview](#overview)
- [What Are Amountless Invoices?](#what-are-amountless-invoices)
- [Use Cases](#use-cases)
- [Industry Analysis: Mobile Wallet Implementations](#industry-analysis-mobile-wallet-implementations)
  - [Blixt Wallet (React Native)](#blixt-wallet-react-native)
  - [Breez SDK (Flutter)](#breez-sdk-flutter)
  - [Zeus Wallet (React Native)](#zeus-wallet-react-native)
  - [Common Patterns](#common-patterns)
- [LND API Specification](#lnd-api-specification)
  - [SendPaymentRequest Fields](#sendpaymentrequest-fields)
  - [Amountless Invoice Handling](#amountless-invoice-handling)
  - [Validation Logic](#validation-logic)
- [LNbits Implementation](#lnbits-implementation)
  - [Architecture Overview](#architecture-overview)
  - [Layer-by-Layer Changes](#layer-by-layer-changes)
  - [API Usage](#api-usage)
- [Verification Matrix](#verification-matrix)
- [Security Considerations](#security-considerations)
- [Testing](#testing)

---

## Overview

This implementation adds the ability to pay BOLT11 invoices that don't have an embedded amount by specifying the amount at payment time via the `amount_msat` parameter.

**Key Changes:**

- Added `Feature.amountless_invoice` to wallet base class for capability detection
- Updated `Wallet.pay_invoice()` signature with optional `amount_msat` parameter
- Implemented amountless invoice support in LND REST and LND gRPC wallets
- Updated payment service layer to validate and pass through `amount_msat`
- Added `amount_msat` field to CreateInvoice API model

---

## What Are Amountless Invoices?

A BOLT11 invoice typically encodes a specific amount to be paid. However, the BOLT11 specification allows for invoices without an amount field, leaving the payment amount to be determined by the payer. These are commonly called:

- **Amountless invoices**
- **Zero-amount invoices**
- **Open invoices**

When decoded, these invoices have `amount_msat = null` or `amount_msat = 0`.

---

## Use Cases

1. **Donations**: Accept any amount the donor wishes to give
2. **Tips**: Allow customers to decide the tip amount
3. **Variable services**: Pay-what-you-want pricing models
4. **LNURL-withdraw**: Some LNURL flows use amountless invoices
5. **NFC payments**: Tap-to-pay scenarios where amount is determined at payment time

---

## Industry Analysis: Mobile Wallet Implementations

To ensure our implementation follows established patterns, we analyzed three major Lightning mobile wallets.

### Blixt Wallet (React Native)

**Detection** (`src/state/Send.ts:185`):

```typescript
if (!paymentRequest.numSatoshis) {
  // Invoice is amountless - require user input
}
```

**Amount Injection** (`src/state/Send.ts:203-204`):

```typescript
// Mutate the payment request with user-provided amount
paymentRequest.numSatoshis = payload.amount
```

**UI Handling** (`src/windows/Send/SendConfirmation.tsx:67-70`):

```typescript
const amountEditable = !paymentRequest.numSatoshis
// Shows editable amount field when invoice has no amount
```

**Key Pattern**: Blixt mutates the payment request object directly before sending to the LND backend.

### Breez SDK (Flutter)

**Detection** (`lib/widgets/payment_request_info_dialog.dart:162`):

```dart
if (widget.invoice.amount == 0) {
  // Show amount input field
}
```

**Validation** (`lib/widgets/payment_request_info_dialog.dart:251`):

```dart
var validationResult = acc.validateOutgoingPayment(amountToPay);
if (validationResult.isNotEmpty) {
  // Show validation error
}
```

**Key Pattern**: Breez validates the user-entered amount against account balance before payment.

### Zeus Wallet (React Native)

**Detection** (`views/PaymentRequest.tsx:602-603`):

```typescript
const isNoAmountInvoice = !requestAmount || requestAmount === 0
```

**Amount Handling** (`views/Send.tsx:339-341`):

```typescript
if (isNoAmountInvoice) {
  // Use amount from user input instead of invoice
  amountToSend = userEnteredAmount
}
```

**Key Pattern**: Zeus uses explicit boolean flags (`isNoAmountInvoice`) for clear code intent.

### Common Patterns

All three wallets follow the same logical flow:

| Step        | Pattern                                |
| ----------- | -------------------------------------- |
| 1. Decode   | Parse BOLT11 invoice                   |
| 2. Detect   | Check if `amount == 0` or `null`       |
| 3. Prompt   | Show UI for amount input if amountless |
| 4. Validate | Verify amount > 0 and within balance   |
| 5. Inject   | Pass amount to payment backend         |
| 6. Pay      | Execute payment with specified amount  |

---

## LND API Specification

The implementation must comply with LND's REST and gRPC API specifications.

### SendPaymentRequest Fields

From `lnrpc/routerrpc/router.proto`:

```protobuf
message SendPaymentRequest {
    // Number of satoshis to send.
    // The fields amt and amt_msat are mutually exclusive.
    int64 amt = 2;

    // A bare-bones invoice for a payment within the Lightning Network.
    // The amount in the payment request may be zero. In that case it is
    // required to set the amt field as well.
    string payment_request = 5;

    // Number of millisatoshis to send.
    // The fields amt and amt_msat are mutually exclusive.
    int64 amt_msat = 12;
}
```

**Key Points:**

- `amt` and `amt_msat` are mutually exclusive
- When `payment_request` has zero amount, `amt` or `amt_msat` is **required**
- When `payment_request` has an amount, `amt`/`amt_msat` must **not** be specified

### Amountless Invoice Handling

From `lnrpc/routerrpc/router_backend.go:1028-1045`:

```go
// If the amount was not included in the invoice, then we let
// the payer specify the amount of satoshis they wish to send.
if payReq.MilliSat == nil {
    if reqAmt == 0 {
        return nil, errors.New("amount must be specified when paying a zero amount invoice")
    }
    payIntent.Amount = reqAmt
} else {
    if reqAmt != 0 {
        return nil, errors.New("amount must not be specified when paying a non-zero amount invoice")
    }
    payIntent.Amount = *payReq.MilliSat
}
```

### Validation Logic

LND's `UnmarshallAmt` function (`lnrpc/marshall_utils.go:57-72`):

```go
func UnmarshallAmt(amtSat, amtMsat int64) (lnwire.MilliSatoshi, error) {
    if amtSat != 0 && amtMsat != 0 {
        return 0, ErrSatMsatMutualExclusive
    }
    if amtSat < 0 || amtMsat < 0 {
        return 0, ErrNegativeAmt
    }
    if amtSat != 0 {
        return lnwire.NewMSatFromSatoshis(btcutil.Amount(amtSat)), nil
    }
    return lnwire.MilliSatoshi(amtMsat), nil
}
```

---

## LNbits Implementation

### Architecture Overview

LNbits uses a layered architecture where changes flow from API → Service → Wallet:

```
┌─────────────────────────────────────────────────────────┐
│  API Layer (payment_api.py)                             │
│  - Receives amount_msat from client                     │
└─────────────────────┬───────────────────────────────────┘
                      │
┌─────────────────────▼───────────────────────────────────┐
│  Service Layer (payments.py)                            │
│  - Validates amountless invoice + amount_msat           │
│  - Checks funding source capability                     │
│  - Passes amountless_amount_msat through chain          │
└─────────────────────┬───────────────────────────────────┘
                      │
┌─────────────────────▼───────────────────────────────────┐
│  Wallet Layer (lndrest.py, lndgrpc.py, etc.)            │
│  - Adds amt_msat to LND request if provided             │
│  - Declares Feature.amountless_invoice capability       │
└─────────────────────────────────────────────────────────┘
```

### Layer-by-Layer Changes

#### 1. Base Wallet Class (`lnbits/wallets/base.py`)

**Feature Declaration:**

```python
class Feature(Enum):
    nodemanager = "nodemanager"
    holdinvoice = "holdinvoice"
    amountless_invoice = "amountless_invoice"  # NEW
```

**Method Signature:**

```python
@abstractmethod
def pay_invoice(
    self, bolt11: str, fee_limit_msat: int, amount_msat: int | None = None
) -> Coroutine[None, None, PaymentResponse]:
    """
    Pay a BOLT11 invoice.

    Args:
        bolt11: The BOLT11 invoice string
        fee_limit_msat: Maximum fee in millisatoshis
        amount_msat: Amount to pay in millisatoshis. Required for amountless
            invoices on wallets that support Feature.amountless_invoice.
            Ignored for invoices that already contain an amount.
    """
    pass
```

#### 2. LND REST Wallet (`lnbits/wallets/lndrest.py`)

**Feature Declaration:**

```python
features = [Feature.nodemanager, Feature.holdinvoice, Feature.amountless_invoice]
```

**Payment Implementation:**

```python
async def pay_invoice(
    self, bolt11: str, fee_limit_msat: int, amount_msat: int | None = None
) -> PaymentResponse:
    req: dict = {
        "payment_request": bolt11,
        "fee_limit_msat": fee_limit_msat,
        "timeout_seconds": 30,
        "no_inflight_updates": True,
    }
    # For amountless invoices, specify the amount to pay
    if amount_msat is not None:
        req["amt_msat"] = amount_msat
    # ... rest of implementation
```

#### 3. Payment Service (`lnbits/core/services/payments.py`)

**Validation:**

```python
def _validate_payment_request(
    payment_request: str, max_sat: int | None = None, amount_msat: int | None = None
) -> Bolt11:
    invoice = bolt11_decode(payment_request)

    if not invoice.amount_msat or invoice.amount_msat <= 0:
        # Amountless invoice - check capability and require amount
        funding_source = get_funding_source()
        if not funding_source.has_feature(Feature.amountless_invoice):
            raise PaymentError(
                "Amountless invoices not supported by the funding source.",
                status="failed",
            )
        if not amount_msat or amount_msat <= 0:
            raise PaymentError(
                "Amount required for amountless invoices.",
                status="failed",
            )
        check_amount_msat = amount_msat
    else:
        check_amount_msat = invoice.amount_msat

    # Validate against max payment limit
    # ...
```

**Amount Handling:**

```python
# Determine the actual amount to pay
pay_amount_msat = invoice.amount_msat or amount_msat

# Only pass amount to funding source if invoice is amountless
amountless_amount_msat = amount_msat if not invoice.amount_msat else None
```

#### 4. API Layer (`lnbits/core/views/payment_api.py`)

```python
payment = await pay_invoice(
    wallet_id=wallet_id,
    payment_request=invoice_data.bolt11,
    extra=invoice_data.extra,
    labels=invoice_data.labels,
    amount_msat=invoice_data.amount_msat,  # NEW
)
```

#### 5. API Model (`lnbits/core/models/payments.py`)

```python
class CreateInvoice(BaseModel):
    # ... existing fields
    amount_msat: int | None = Query(
        None,
        ge=1,
        description=(
            "Amount to pay in millisatoshis. Required for amountless invoices "
            "when the funding source supports them."
        ),
    )
```

### API Usage

**Paying an amountless invoice:**

```bash
curl -X POST "https://lnbits.example.com/api/v1/payments" \
  -H "X-Api-Key: <admin_key>" \
  -H "Content-Type: application/json" \
  -d '{
    "out": true,
    "bolt11": "lnbc1p...",
    "amount_msat": 100000
  }'
```

**Response:**

```json
{
  "payment_hash": "abc123...",
  "checking_id": "abc123...",
  "status": "success"
}
```

---

## Verification Matrix

| Requirement                       | LND Spec                 | Mobile Wallets           | LNbits Implementation           |
| --------------------------------- | ------------------------ | ------------------------ | ------------------------------- |
| Detect amountless                 | `payReq.MilliSat == nil` | Check `amount == 0/null` | `not invoice.amount_msat`       |
| Require amount for amountless     | Error if `reqAmt == 0`   | Show input field         | `PaymentError` if not provided  |
| Block amount for regular invoices | Error if `reqAmt != 0`   | N/A (UI doesn't allow)   | `amountless_amount_msat = None` |
| Field name                        | `amt_msat`               | N/A (native SDK)         | `amt_msat`                      |
| Type                              | int64 (msat)             | varies                   | int (msat)                      |
| Feature detection                 | N/A                      | Hardcoded                | `Feature.amountless_invoice`    |

---

## Security Considerations

1. **Balance Validation**: The service layer validates that the wallet has sufficient balance for the specified amount before attempting payment.

2. **Maximum Amount**: Amountless payments are still subject to `lnbits_max_outgoing_payment_amount_sats` limits.

3. **Feature Gating**: Only wallets that explicitly declare `Feature.amountless_invoice` support can process amountless payments. This prevents accidental payment failures on unsupported backends.

4. **Input Validation**: The API model enforces `amount_msat >= 1` when provided, preventing zero or negative amounts.

---

## Testing

Two test cases cover the amountless invoice functionality:

### Happy Path

```python
@pytest.mark.anyio
async def test_pay_amountless_invoice_with_amount(client, adminkey_headers_from):
    """Test paying an amountless invoice by specifying amount_msat."""
    # Create amountless invoice via FakeWallet
    # Pay with amount_msat specified
    # Verify payment succeeds
```

### Error Case

```python
@pytest.mark.anyio
async def test_pay_amountless_invoice_without_amount_fails(client, adminkey_headers_from):
    """Test that paying an amountless invoice without amount_msat fails."""
    # Create amountless invoice
    # Attempt payment WITHOUT amount_msat
    # Verify proper error: "Amount required for amountless invoices"
```

---

## References

- [BOLT11 Specification](https://github.com/lightning/bolts/blob/master/11-payment-encoding.md)
- [LND Router RPC Documentation](https://lightning.engineering/api-docs/api/lnd/router/)
- [LND SendPaymentV2 API](https://lightning.engineering/api-docs/api/lnd/router/send-payment-v2/)
