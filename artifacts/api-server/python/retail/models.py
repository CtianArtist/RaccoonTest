from typing import Literal
from uuid import UUID
from pydantic import BaseModel, ConfigDict, Field

class Input(BaseModel):
    model_config = ConfigDict(extra="forbid", str_strip_whitespace=True)

class CartItem(Input):
    slug: str = Field(min_length=1, max_length=120)
    quantity: int = Field(ge=1, le=10, strict=True)
    size: str = Field(default="One size", max_length=30)

class CheckoutInput(Input):
    items: list[CartItem] = Field(min_length=1, max_length=30)
    requestId: UUID

class OrderStatus(BaseModel):
    id: str
    number: str
    customerId: str
    status: str
    shippingStatus: str
    returnStatus: str
    synthetic: bool
    trackingNumber: str | None = None
    carrier: str | None = None

class ReturnInput(Input):
    orderId: str = Field(min_length=1, max_length=80)
    reason: str = Field(min_length=10, max_length=3000)
    kind: Literal["return", "refund"]
    conditionConfirmed: Literal[True]

class TicketInput(Input):
    subject: str = Field(min_length=4, max_length=160)
    description: str = Field(min_length=10, max_length=10000)
    category: Literal["Order", "Shipping", "Return", "Product", "Account", "Other"]

class MessageInput(Input):
    body: str = Field(min_length=3, max_length=10000)

class DiscussionInput(Input):
    title: str = Field(min_length=8, max_length=180)
    category: str = Field(min_length=1, max_length=100)
    body: str = Field(min_length=20, max_length=10000)

class ModerationInput(Input):
    id: UUID
    action: Literal["publish", "hide", "lock", "unlock", "publish-reply", "hide-reply"]

class TicketStatusInput(Input):
    status: Literal["Open", "Pending", "Solved", "Closed"]

class ReturnStatusInput(Input):
    status: Literal["Approved", "Rejected", "Inspected"]

class ShippingInput(Input):
    status: Literal["Processing", "Packed", "Shipped", "Out for delivery", "Delivered"]
    description: str = Field(min_length=3, max_length=1000)

class CredentialInput(Input):
    userId: str = Field(min_length=1, max_length=100)
    label: str = Field(min_length=3, max_length=100)
    scopes: list[Literal["orders:read", "returns:read", "returns:create", "tickets:read"]] = Field(min_length=1, max_length=4)
