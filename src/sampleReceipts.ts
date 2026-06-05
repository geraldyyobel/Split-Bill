import { Receipt, ReceiptItem } from "./types";

export const SAMPLE_RECEIPTS: { id: string; name: string; receipt: Receipt }[] = [
  {
    id: "sunset_diner",
    name: "Sunset Diner & Grill",
    receipt: {
      storeName: "Sunset Diner & Grill",
      subtotal: 71.00,
      tax: 6.50,
      tip: 12.00,
      total: 89.50,
      items: [
        {
          id: "item-1",
          name: "Grande Cheese Nachos",
          price: 16.50,
          quantity: 1,
          assignedTo: []
        },
        {
          id: "item-2",
          name: "Double Wagyu Burger",
          price: 24.00,
          quantity: 1,
          assignedTo: []
        },
        {
          id: "item-3",
          name: "Crispy Onion Rings",
          price: 8.50,
          quantity: 1,
          assignedTo: []
        },
        {
          id: "item-4",
          name: "Vanilla Malt Shake",
          price: 7.00,
          quantity: 1,
          assignedTo: []
        },
        {
          id: "item-5",
          name: "Draft Pale Ale Beer",
          price: 15.00,
          quantity: 2,
          assignedTo: []
        }
      ]
    }
  },
  {
    id: "bento_sushi",
    name: "Sakura Sushi Cafe",
    receipt: {
      storeName: "Sakura Sushi Cafe",
      subtotal: 104.00,
      tax: 9.60,
      tip: 18.00,
      total: 131.60,
      items: [
        {
          id: "bento-1",
          name: "Sashimi Premium Platter",
          price: 45.00,
          quantity: 1,
          assignedTo: []
        },
        {
          id: "bento-2",
          name: "Spicy Tuna Roll Duo",
          price: 26.00,
          quantity: 2,
          assignedTo: []
        },
        {
          id: "bento-3",
          name: "Pork Gyoza Dumplings",
          price: 12.00,
          quantity: 1,
          assignedTo: []
        },
        {
          id: "bento-4",
          name: "Iced Premium Matcha Tea",
          price: 11.00,
          quantity: 2,
          assignedTo: []
        },
        {
          id: "bento-5",
          name: "Sesame Swirl Mochi Ice Cream",
          price: 10.00,
          quantity: 2,
          assignedTo: []
        }
      ]
    }
  },
  {
    id: "bella_italia",
    name: "Trattoria Bella Italia",
    receipt: {
      storeName: "Trattoria Bella Italia",
      subtotal: 147.00,
      tax: 13.50,
      tip: 26.00,
      total: 186.50,
      items: [
        {
          id: "ital-1",
          name: "Burrata Caprese Salad",
          price: 18.00,
          quantity: 1,
          assignedTo: []
        },
        {
          id: "ital-2",
          name: "Truffle Porcini Risotto",
          price: 28.00,
          quantity: 1,
          assignedTo: []
        },
        {
          id: "ital-3",
          name: "Prosciutto Arugula Pizza",
          price: 22.00,
          quantity: 1,
          assignedTo: []
        },
        {
          id: "ital-4",
          name: "Seafood Linguine",
          price: 32.00,
          quantity: 1,
          assignedTo: []
        },
        {
          id: "ital-5",
          name: "Chianti Classico Red Wine Carafe",
          price: 35.00,
          quantity: 1,
          assignedTo: []
        },
        {
          id: "ital-6",
          name: "Espresso Tiramisu Cake Cups",
          price: 12.00,
          quantity: 2,
          assignedTo: []
        }
      ]
    }
  }
];
