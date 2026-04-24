# 📘 GoHighLevel (GHL) Webhooks – Complete Reference

## 🔹 1. Base Webhook Payload Structure

All GHL webhooks follow a **standard envelope format**:

```json
{
  "type": "EventName",
  "timestamp": "2025-01-28T14:35:00.000Z",
  "webhookId": "unique-id",
  "locationId": "string",
  "companyId": "string",
  "data": {
    // Event-specific payload
  }
}
```

### Key Fields:

* `type` → Event name (e.g. `ContactCreate`)
* `timestamp` → Event time (ISO format)
* `webhookId` → Unique delivery ID
* `locationId` → Sub-account ID
* `companyId` → Agency ID
* `data` → Actual payload (varies per event)

📌 This structure is consistent across all events. ([App Marketplace][1])

---

# 🔹 2. All Available Webhook Events (Grouped)

## 📇 Contact Events

* `ContactCreate`
* `ContactUpdate`
* `ContactDelete`
* `ContactDndUpdate`
* `ContactTagUpdate`

## 📅 Appointment Events

* `AppointmentCreate`
* `AppointmentUpdate`
* `AppointmentDelete`

## 💰 Invoice Events

* `InvoiceCreate`
* `InvoiceUpdate`
* `InvoiceDelete`
* `InvoiceSent`
* `InvoicePaid`
* `InvoicePartiallyPaid`
* `InvoiceVoid`

## 💼 Opportunity Events

* `OpportunityCreate`
* `OpportunityUpdate`
* `OpportunityDelete`
* `OpportunityStageUpdate`
* `OpportunityStatusUpdate`
* `OpportunityAssignedToUpdate`
* `OpportunityMonetaryValueUpdate`

## 📦 Order Events

* `OrderCreate`
* `OrderStatusUpdate`

## 🛍️ Product & Pricing

* `ProductCreate`
* `ProductUpdate`
* `ProductDelete`
* `PriceCreate`
* `PriceUpdate`
* `PriceDelete`

## 👤 User Events

* `UserCreate`
* `UserUpdate`
* `UserDelete`

## 🏢 Location Events

* `LocationCreate`
* `LocationUpdate`

## 📝 Notes & Tasks

* `NoteCreate`
* `NoteUpdate`
* `NoteDelete`
* `TaskCreate`
* `TaskComplete`
* `TaskDelete`

## 💬 Messaging Events

* `InboundMessage`
* `OutboundMessage`
* `ProviderOutboundMessage`
* `ConversationUnreadWebhook`

## 📧 Email

* `LCEmailStats`

## 🔗 Associations / Custom Objects

* `AssociationCreate`
* `AssociationUpdate`
* `AssociationDelete`
* `RecordCreate`
* `RecordUpdate`
* `RecordDelete`
* `ObjectSchemaCreate`
* `ObjectSchemaUpdate`
* `RelationCreate`
* `RelationDelete`

## ⚙️ System / App Events

* `AppInstall`
* `AppUninstall`
* `ExternalAuthConnected`
* `PlanChange`
* `CampaignStatusUpdate`
* `VoiceAiCallEnd`
* `SaaSPlanCreate`

📌 Total: ~50+ webhook events available ([App Marketplace][2])

---

# 🔹 3. Sample JSON Payloads (Important Ones)

## 👤 ContactCreate

```json
{
  "type": "ContactCreate",
  "data": {
    "id": "contact_id",
    "firstName": "John",
    "lastName": "Doe",
    "email": "[email protected]",
    "phone": "+61400000000",
    "tags": ["lead", "new"],
    "source": "website",
    "dateCreated": "2025-01-28T14:35:00.000Z"
  }
}
```

---

## 📅 AppointmentCreate

```json
{
  "type": "AppointmentCreate",
  "data": {
    "id": "appt_id",
    "title": "Consultation",
    "startTime": "2025-02-01T10:00:00Z",
    "endTime": "2025-02-01T10:30:00Z",
    "contactId": "contact_id",
    "assignedUserId": "user_id",
    "status": "confirmed"
  }
}
```

---

## 💼 OpportunityCreate

```json
{
  "type": "OpportunityCreate",
  "data": {
    "id": "opp_id",
    "name": "New Deal",
    "pipelineId": "pipeline_id",
    "stageId": "stage_id",
    "status": "open",
    "monetaryValue": 1500,
    "contactId": "contact_id"
  }
}
```

---

## 💰 InvoicePaid

```json
{
  "type": "InvoicePaid",
  "data": {
    "id": "invoice_id",
    "contactId": "contact_id",
    "amount": 250,
    "currency": "AUD",
    "status": "paid",
    "paidAt": "2025-02-01T12:00:00Z"
  }
}
```

---

## 💬 InboundMessage

```json
{
  "type": "InboundMessage",
  "data": {
    "messageId": "msg_id",
    "contactId": "contact_id",
    "message": "Hi, I need help",
    "channel": "sms",
    "direction": "inbound",
    "timestamp": "2025-02-01T12:00:00Z"
  }
}
```

---

## 📦 OrderCreate

```json
{
  "type": "OrderCreate",
  "data": {
    "id": "order_id",
    "contactId": "contact_id",
    "totalAmount": 99.99,
    "currency": "AUD",
    "status": "created",
    "items": [
      {
        "productId": "prod_1",
        "name": "Service A",
        "price": 99.99,
        "quantity": 1
      }
    ]
  }
}
```

---

# 🔹 4. Security (IMPORTANT)

GHL sends signatures in headers:

* `X-GHL-Signature` (Ed25519 – **current**)
* `X-WH-Signature` (deprecated)