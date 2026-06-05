export interface ReceiptItem {
  id: string;
  name: string;
  price: number;
  quantity: number;
  assignedTo: string[]; // List of participant names
}

export interface Receipt {
  storeName: string;
  items: ReceiptItem[];
  subtotal: number;
  tax: number;
  tip: number;
  total: number;
}

export interface ChatMessage {
  id: string;
  sender: "user" | "ai" | "system";
  text: string;
  timestamp: string;
  isError?: boolean;
  suggestedAction?: string;
}

export interface SummaryOwed {
  name: string;
  subtotal: boolean; // placeholder or calculations
  items: { itemName: string; itemPrice: number; sharePrice: number }[];
  itemSubtotal: number;
  taxShare: number;
  tipShare: number;
  totalOwed: number;
}
