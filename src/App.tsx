import React, { useState, useEffect, useRef } from "react";
import {
  UploadCloud,
  Trash2,
  Plus,
  X,
  Sparkles,
  RefreshCw,
  Check,
  UserPlus,
  Users,
  FileText,
  TrendingUp,
  DollarSign,
  AlertCircle,
  HelpCircle,
  ChevronDown,
  ChevronUp,
  Link,
  Download,
  Share2
} from "lucide-react";
import { motion, AnimatePresence } from "motion/react";
import html2canvas from "html2canvas";
import { jsPDF } from "jspdf";
import { SAMPLE_RECEIPTS } from "./sampleReceipts";
import { Receipt, ReceiptItem, ChatMessage, SummaryOwed } from "./types";

export default function App() {
  // Receipt data
  const [receipt, setReceipt] = useState<Receipt | null>(null);

  // Participants
  const [participants, setParticipants] = useState<string[]>([]);
  const [newPersonName, setNewPersonName] = useState("");

  // States of activities
  const [isParsing, setIsParsing] = useState(false);
  const [parsingError, setParsingError] = useState<string | null>(null);
  const [dragActive, setDragActive] = useState(false);

  // Chat state
  const [chatMessages, setChatMessages] = useState<ChatMessage[]>([
    {
      id: "welcome-main",
      sender: "system",
      text: "👋 Welcome to Receipt Bill Splitter! Upload a receipt image or load one of our quick sample templates on the left to start splitting. I will automatically process your split request commands in this chat (e.g., 'Frank and Sarah split the Pizza equally', 'Add Dhruv to Nachos', etc.)",
      timestamp: new Date().toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' })
    }
  ]);
  const [chatInput, setChatInput] = useState("");
  const [isChatLoading, setIsChatLoading] = useState(false);

  // Manual interactive features
  const [activeItemDropdownId, setActiveItemDropdownId] = useState<string | null>(null);
  const [showAddItemForm, setShowAddItemForm] = useState(false);
  const [newItemName, setNewItemName] = useState("");
  const [newItemPrice, setNewItemPrice] = useState("");
  const [newItemQty, setNewItemQty] = useState("1");
  const [expandedSummaryName, setExpandedSummaryName] = useState<string | null>(null);

  // Export receipt modal & clipboard indicators
  const [isExportModalOpen, setIsExportModalOpen] = useState(false);
  const [copiedLink, setCopiedLink] = useState(false);

  // Responsive navigation state for mobile/tablets
  const [activeMobileTab, setActiveMobileTab] = useState<"receipt" | "chat" | "splits">("receipt");

  const messagesEndRef = useRef<HTMLDivElement | null>(null);
  const fileInputRef = useRef<HTMLInputElement | null>(null);

  // Restore split state from URL if "split" base64 parameter is loaded
  useEffect(() => {
    const searchParams = new URLSearchParams(window.location.search);
    const splitParam = searchParams.get("split");
    if (splitParam) {
      try {
        const decoded = decodeURIComponent(splitParam);
        const jsonStr = decodeURIComponent(escape(atob(decoded)));
        const parsed = JSON.parse(jsonStr);
        if (parsed && parsed.receipt) {
          setReceipt(parsed.receipt);
          if (parsed.participants) {
            setParticipants(parsed.participants);
          }
          setChatMessages([
            {
              id: `welcome-restore-${Date.now()}`,
              sender: "system",
              text: `🔗 **Shared Split Bill Loaded Successfully!** Restored the receipt for **${parsed.receipt.storeName}** with **${parsed.participants?.length || 0} participants** (${parsed.participants?.join(", ")}).\n\nYou can continue splitting items, adding tips & taxes, or chatting below!`,
              timestamp: new Date().toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' })
            }
          ]);
        }
      } catch (err) {
        console.error("Failed to parse shared split URL", err);
      }
    }
  }, []);

  // Auto scroll chat to bottom
  useEffect(() => {
    messagesEndRef.current?.scrollIntoView({ behavior: "smooth" });
  }, [chatMessages, isChatLoading]);

  // Color hash function for assigning consistent visual badges to participants
  const getParticipantColor = (name: string): string => {
    const colors = [
      "bg-blue-100 text-blue-700 border-blue-200/50 rounded-md font-semibold",
      "bg-pink-100 text-pink-700 border-pink-200/50 rounded-md font-semibold",
      "bg-indigo-100 text-indigo-700 border-indigo-200/50 rounded-md font-semibold",
      "bg-emerald-100 text-emerald-700 border-emerald-200/50 rounded-md font-semibold",
      "bg-purple-100 text-purple-700 border-purple-200/50 rounded-md font-semibold",
      "bg-amber-100 text-amber-700 border-amber-200/50 rounded-md font-semibold",
      "bg-rose-100 text-rose-700 border-rose-200/50 rounded-md font-semibold",
      "bg-teal-100 text-teal-700 border-teal-200/50 rounded-md font-semibold"
    ];
    let hash = 0;
    for (let i = 0; i < name.length; i++) {
      hash = name.charCodeAt(i) + ((hash << 5) - hash);
    }
    const index = Math.abs(hash) % colors.length;
    return colors[index];
  };

  // Drag and drop handlers
  const handleDrag = (e: React.DragEvent) => {
    e.preventDefault();
    e.stopPropagation();
    if (e.type === "dragenter" || e.type === "dragover") {
      setDragActive(true);
    } else if (e.type === "dragleave") {
      setDragActive(false);
    }
  };

  const handleDrop = (e: React.DragEvent) => {
    e.preventDefault();
    e.stopPropagation();
    setDragActive(false);
    if (e.dataTransfer.files && e.dataTransfer.files[0]) {
      handleImageFile(e.dataTransfer.files[0]);
    }
  };

  const handleFileChange = (e: React.ChangeEvent<HTMLInputElement>) => {
    if (e.target.files && e.target.files[0]) {
      handleImageFile(e.target.files[0]);
    }
  };

  const handleImageFile = (file: File) => {
    if (!file.type.startsWith("image/")) {
      setParsingError("Please upload an image file (PNG, JPG, etc.)");
      return;
    }
    const reader = new FileReader();
    reader.onload = () => {
      const base64 = reader.result as string;
      parseReceipt(base64);
    };
    reader.onerror = () => {
      setParsingError("Error reading image file.");
    };
    reader.readAsDataURL(file);
  };

  // Call the server API to parse the receipt
  const parseReceipt = async (base64Image: string) => {
    setIsParsing(true);
    setParsingError(null);
    try {
      const response = await fetch("/api/parse-receipt", {
        method: "POST",
        headers: {
          "Content-Type": "application/json",
        },
        body: JSON.stringify({ image: base64Image }),
      });

      if (!response.ok) {
        const errorData = await response.json();
        throw new Error(errorData.error || "Failed to analyze receipt image.");
      }

      const parsedJSON = await response.json();

      const formattedItems: ReceiptItem[] = (parsedJSON.items || []).map((item: any, idx: number) => ({
        id: `item-${Date.now()}-${idx}`,
        name: item.name || "Unnamed Item",
        price: typeof item.price === "number" ? Math.max(0, item.price) : 0,
        quantity: typeof item.quantity === "number" ? Math.max(1, item.quantity) : 1,
        assignedTo: []
      }));

      const finalReceipt: Receipt = {
        storeName: parsedJSON.storeName || "Unknown Restaurant",
        subtotal: typeof parsedJSON.subtotal === "number" ? parsedJSON.subtotal : formattedItems.reduce((acc, it) => acc + it.price, 0),
        tax: typeof parsedJSON.tax === "number" ? parsedJSON.tax : 0,
        tip: typeof parsedJSON.tip === "number" ? parsedJSON.tip : 0,
        total: typeof parsedJSON.total === "number" ? parsedJSON.total : 0,
        items: formattedItems
      };

      // Recalculate total if empty
      if (finalReceipt.total <= 0) {
        finalReceipt.total = finalReceipt.subtotal + finalReceipt.tax + finalReceipt.tip;
      }

      setReceipt(finalReceipt);
      setParticipants(["Dhruv", "Sarah", "Sue"]); // Populated for easy instant splits
      setActiveMobileTab("receipt");
      setChatMessages([
        {
          id: `parse-msg-${Date.now()}`,
          sender: "system",
          text: `🎉 Loaded receipt for **${finalReceipt.storeName}**! Split total is $${finalReceipt.total.toFixed(2)}. Pre-loaded participants: **Dhruv**, **Sarah**, **Sue**.\nType split commands below!`,
          timestamp: new Date().toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' })
        }
      ]);
    } catch (err: any) {
      console.error(err);
      setParsingError(err.message || "Something went wrong while communicating with the server receipt parser.");
    } finally {
      setIsParsing(false);
    }
  };

  // Load sample receipt templates
  const loadSample = (sampleId: string) => {
    const found = SAMPLE_RECEIPTS.find(s => s.id === sampleId);
    if (found) {
      // Deep copy sample
      const cloned: Receipt = {
        ...found.receipt,
        items: found.receipt.items.map(it => ({ ...it, assignedTo: [] }))
      };
      setReceipt(cloned);
      setParticipants(["Dhruv", "Sarah", "Sue"]);
      setActiveMobileTab("receipt");
      setChatMessages([
        {
          id: `welcome-sample-${Date.now()}`,
          sender: "system",
          text: `📝 Loaded the **${found.name}** receipt! Try entering commands such as "Dhruv got the burger", "Sarah and Sue split the tea", or "split Onion rings with everyone".`,
          timestamp: new Date().toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' })
        }
      ]);
    }
  };

  // Chat commands calling the Express API
  const handleSendCommand = async (customQuery?: string) => {
    const queryToSend = customQuery || chatInput;
    if (!queryToSend.trim() || !receipt) return;

    if (!customQuery) {
      setChatInput("");
    }

    // Append user message
    const userMessage: ChatMessage = {
      id: `chat-usr-${Date.now()}`,
      sender: "user",
      text: queryToSend,
      timestamp: new Date().toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' })
    };

    setChatMessages((prev) => [...prev, userMessage]);
    setIsChatLoading(true);

    try {
      const response = await fetch("/api/chat-command", {
        method: "POST",
        headers: {
          "Content-Type": "application/json"
        },
        body: JSON.stringify({
          query: queryToSend,
          items: receipt.items,
          participants: participants,
          history: chatMessages.slice(-5).map(m => m.text)
        })
      });

      if (!response.ok) {
        throw new Error("Chat command failed to resolve on backend.");
      }

      const result = await response.json();

      // Update registry participants
      let finalParticipants = [...participants];
      if (result.newParticipants && result.newParticipants.length > 0) {
        result.newParticipants.forEach((p: string) => {
          const formatted = p.trim();
          if (formatted && !finalParticipants.some(curr => curr.toLowerCase() === formatted.toLowerCase())) {
            finalParticipants.push(cleanNameString(formatted));
          }
        });
        setParticipants(finalParticipants);
      }

      // Update receipt item assignments
      if (result.assignments && result.assignments.length > 0) {
        const updatedItems = receipt.items.map(origItem => {
          const match = result.assignments.find((asg: any) => asg.itemId === origItem.id);
          if (match) {
            // align assignment strings to actual participant names to keep casing perfect
            const mappedNames = (match.assignedTo || []).map((name: string) => {
              const matchedParticipant = finalParticipants.find(p => p.toLowerCase() === name.toLowerCase());
              return matchedParticipant || cleanNameString(name);
            });
            return {
              ...origItem,
              assignedTo: mappedNames
            };
          }
          return origItem;
        });

        setReceipt((prev) => prev ? { ...prev, items: updatedItems } : null);
      }

      // Add AI Response
      setChatMessages((prev) => [
        ...prev,
        {
          id: `chat-ai-${Date.now()}`,
          sender: "ai",
          text: result.explanation || "Done!",
          timestamp: new Date().toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' }),
          suggestedAction: result.suggestedNextAction
        }
      ]);
    } catch (err: any) {
      console.error(err);
      setChatMessages((prev) => [
        ...prev,
        {
          id: `chat-ai-err-${Date.now()}`,
          sender: "ai",
          text: `Whoops, I couldn't interpret that split request perfectly. Error: "${err.message}". Try using simple assignments like: "Dhruv got Onion Rings" or "Sarah and Sue split pizza".`,
          timestamp: new Date().toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' }),
          isError: true
        }
      ]);
    } finally {
      setIsChatLoading(false);
    }
  };

  // Helper formatting name capitalizations beautifully
  const cleanNameString = (s: string): string => {
    return s.charAt(0).toUpperCase() + s.slice(1);
  };

  // Dynamic user additions in Left sidebar
  const handleAddParticipant = (e?: React.FormEvent) => {
    e?.preventDefault();
    if (!newPersonName.trim()) return;
    const cleanName = cleanNameString(newPersonName.trim());
    if (!participants.includes(cleanName)) {
      setParticipants([...participants, cleanName]);
    }
    setNewPersonName("");
  };

  const handleRemoveParticipant = (name: string) => {
    // Filter participants
    setParticipants(participants.filter(p => p !== name));
    // Remove their assignments too
    if (receipt) {
      const cleanedItems = receipt.items.map(item => ({
        ...item,
        assignedTo: item.assignedTo.filter(p => p !== name)
      }));
      setReceipt({ ...receipt, items: cleanedItems });
    }
  };

  // Manual interactive item assignee toggler
  const toggleItemAssignee = (itemId: string, name: string) => {
    if (!receipt) return;
    const updatedItems = receipt.items.map(item => {
      if (item.id === itemId) {
        const contains = item.assignedTo.includes(name);
        const nextAssigned = contains
          ? item.assignedTo.filter(p => p !== name)
          : [...item.assignedTo, name];
        return {
          ...item,
          assignedTo: nextAssigned
        };
      }
      return item;
    });
    setReceipt({ ...receipt, items: updatedItems });
  };

  // Custom receipt management additions
  const handleAddNewItem = (e: React.FormEvent) => {
    e.preventDefault();
    if (!receipt || !newItemName.trim() || !newItemPrice) return;

    const priceNum = parseFloat(newItemPrice);
    const qtyNum = parseInt(newItemQty) || 1;
    if (isNaN(priceNum)) return;

    const added: ReceiptItem = {
      id: `item-${Date.now()}-man`,
      name: newItemName.trim(),
      price: priceNum,
      quantity: qtyNum,
      assignedTo: []
    };

    const nextItems = [...receipt.items, added];
    const nextSubtotal = parseFloat((receipt.subtotal + (priceNum)).toFixed(2));
    const nextTotal = parseFloat((nextSubtotal + receipt.tax + receipt.tip).toFixed(2));

    setReceipt({
      ...receipt,
      items: nextItems,
      subtotal: nextSubtotal,
      total: nextTotal
    });

    setNewItemName("");
    setNewItemPrice("");
    setNewItemQty("1");
    setShowAddItemForm(false);
  };

  const handleRemoveItem = (itemId: string) => {
    if (!receipt) return;
    const targetItem = receipt.items.find(it => it.id === itemId);
    if (!targetItem) return;

    const nextItems = receipt.items.filter(it => it.id !== itemId);
    const nextSubtotal = parseFloat((receipt.subtotal - targetItem.price).toFixed(2));
    const nextTotal = parseFloat((nextSubtotal + receipt.tax + receipt.tip).toFixed(2));

    setReceipt({
      ...receipt,
      items: nextItems,
      subtotal: Math.max(0, nextSubtotal),
      total: Math.max(0, nextTotal)
    });
  };

  // Trigger inline adjustments for tax/tip/subtotal
  const updateReceiptTotals = (field: "tax" | "tip" | "subtotal", val: string) => {
    if (!receipt) return;
    const floatVal = parseFloat(val) || 0;

    let updated = { ...receipt };
    if (field === "tax") updated.tax = floatVal;
    if (field === "tip") updated.tip = floatVal;
    if (field === "subtotal") updated.subtotal = floatVal;

    updated.total = updated.subtotal + updated.tax + updated.tip;
    setReceipt(updated);
  };

  // Calculate proportional math breakdown
  const calculateSplits = (): SummaryOwed[] => {
    if (!receipt || participants.length === 0) return [];

    // Calculate individual food subtotals
    const attendeesBreakdown = participants.map((name) => {
      const itemsAssigned: { itemName: string; itemPrice: number; sharePrice: number }[] = [];
      let itemSubtotal = 0;

      receipt.items.forEach((item) => {
        if (item.assignedTo.includes(name)) {
          const sharePrice = item.price / item.assignedTo.length;
          itemSubtotal += sharePrice;
          itemsAssigned.push({
            itemName: item.name,
            itemPrice: item.price,
            sharePrice: sharePrice
          });
        }
      });

      return {
        name,
        items: itemsAssigned,
        itemSubtotal,
        taxShare: 0,
        tipShare: 0,
        totalOwed: 0
      };
    });

    // Sum of assigned food subtotals
    const totalAssignedSubtotal = attendeesBreakdown.reduce((sum, current) => sum + current.itemSubtotal, 0);

    // Apply proportional taxes & tips
    return attendeesBreakdown.map(person => {
      const proRataShare = totalAssignedSubtotal > 0 ? (person.itemSubtotal / totalAssignedSubtotal) : 0;
      const taxShare = proRataShare * receipt.tax;
      const tipShare = proRataShare * receipt.tip;
      const totalOwed = person.itemSubtotal + taxShare + tipShare;

      return {
        name: person.name,
        subtotal: true, // matching types.ts
        items: person.items,
        itemSubtotal: parseFloat(person.itemSubtotal.toFixed(2)),
        taxShare: parseFloat(taxShare.toFixed(2)),
        tipShare: parseFloat(tipShare.toFixed(2)),
        totalOwed: parseFloat(totalOwed.toFixed(2))
      };
    });
  };

  const splitsBreakdown = calculateSplits();

  // Quick quickstart chips
  const quickSuggestions = [
    { label: "Everyone share the beer 🍺", command: "everyone shared the beer" },
    { label: "Split remaining items equally ⚖️", command: "split remaining items equally between everyone" },
    { label: "Add Frank 👤", command: "introduce Frank to the party" },
    { label: "Reset all assignments 🔄", command: "reset allAssignments" }
  ];

  // Check how many items remain unassigned
  const getUnassignedCount = () => {
    if (!receipt) return 0;
    return receipt.items.filter(it => it.assignedTo.length === 0).length;
  };

  const resetAll = () => {
    if (window.confirm("Are you sure you want to clean up current session?")) {
      setReceipt(null);
      setParticipants([]);
      setActiveMobileTab("receipt");
      setChatMessages([
        {
          id: "welcome-reset",
          sender: "system",
          text: "State reset. Drag receipt images or load a sample on the left to start again!",
          timestamp: new Date().toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' })
        }
      ]);
    }
  };

  const handleCopyShareUrl = () => {
    if (!receipt) return;
    try {
      const stateToShare = {
        receipt,
        participants
      };
      const jsonStr = JSON.stringify(stateToShare);
      // UTF-8 safe base64 encoding
      const base64Str = btoa(unescape(encodeURIComponent(jsonStr)));
      const shareUrl = `${window.location.origin}${window.location.pathname}?split=${encodeURIComponent(base64Str)}`;

      navigator.clipboard.writeText(shareUrl);
      setCopiedLink(true);
      setTimeout(() => setCopiedLink(false), 2000);

      // Update system chat with link
      setChatMessages(prev => [
        ...prev,
        {
          id: `feedback-cp-${Date.now()}`,
          sender: "system",
          text: `🔗 **Share link copied!** Send this link to your friends so they can view and split: **${shareUrl}**`,
          timestamp: new Date().toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' })
        }
      ]);
    } catch (e) {
      console.error("Failed to copy share link", e);
    }
  };

  // Helper to convert oklch value string to standard rgb string
  const oklchToRgb = (oklchStr: string): string => {
    const match = oklchStr.match(/oklch\(([^)]+)\)/i);
    if (!match) return "rgb(120, 120, 120)";

    const partsStr = match[1].trim();
    const [colorPart, alphaPart] = partsStr.split("/");
    const values = colorPart.trim().replace(/,/g, " ").split(/\s+/).filter(Boolean);
    if (values.length < 3) return "rgb(120, 120, 120)";

    const lStr = values[0];
    const cStr = values[1];
    const hStr = values[2];

    let l = lStr.endsWith("%") ? parseFloat(lStr) / 100 : parseFloat(lStr);
    let c = cStr.endsWith("%") ? parseFloat(cStr) / 100 : parseFloat(cStr);
    let h = parseFloat(hStr.replace(/deg/gi, ""));

    if (isNaN(l)) l = 0.5;
    if (isNaN(c)) c = 0.1;
    if (isNaN(h)) h = 0;

    let r = 120, g = 120, b = 120;

    if (c < 0.04) {
      const gray = Math.round(l * 255);
      r = gray; g = gray; b = gray;
    } else {
      h = ((h % 360) + 360) % 360;
      if (h >= 210 && h <= 290) {
        // Indigo/Blue
        r = Math.round(79 * (l / 0.5));
        g = Math.round(70 * (l / 0.5));
        b = Math.round(229 * (l / 0.5));
      } else if (h >= 20 && h <= 85) {
        // Amber/Orange/Yellow
        r = Math.round(245 * (l / 0.6));
        g = Math.round(158 * (l / 0.6));
        b = Math.round(11 * (l / 0.6));
      } else if (h > 85 && h < 165) {
        // Green
        r = Math.round(16 * (l / 0.5));
        g = Math.round(185 * (l / 0.5));
        b = Math.round(129 * (l / 0.5));
      } else if (h >= 165 && h < 210) {
        // Cyan / Sky
        r = Math.round(14 * (l / 0.5));
        g = Math.round(165 * (l / 0.5));
        b = Math.round(233 * (l / 0.5));
      } else {
        // Red
        r = Math.round(239 * (l / 0.5));
        g = Math.round(68 * (l / 0.5));
        b = Math.round(68 * (l / 0.5));
      }
    }

    r = Math.max(0, Math.min(255, r));
    g = Math.max(0, Math.min(255, g));
    b = Math.max(0, Math.min(255, b));

    if (alphaPart) {
      let alpha = alphaPart.trim();
      if (alpha.endsWith("%")) {
        alpha = (parseFloat(alpha) / 100).toString();
      }
      return `rgba(${r}, ${g}, ${b}, ${alpha})`;
    }
    return `rgb(${r}, ${g}, ${b})`;
  };

  const oklabToRgb = (oklabStr: string): string => {
    const match = oklabStr.match(/oklab\(([^)]+)\)/i);
    if (!match) return "rgb(120, 120, 120)";

    const partsStr = match[1].trim();
    const [colorPart, alphaPart] = partsStr.split("/");
    const values = colorPart.trim().replace(/,/g, " ").split(/\s+/).filter(Boolean);
    if (values.length === 0) return "rgb(120, 120, 120)";

    const lStr = values[0];
    let l = lStr.endsWith("%") ? parseFloat(lStr) / 100 : parseFloat(lStr);

    if (isNaN(l)) l = 0.5;

    const gray = Math.max(0, Math.min(255, Math.round(l * 255)));

    if (alphaPart) {
      let alpha = alphaPart.trim();
      if (alpha.endsWith("%")) {
        alpha = (parseFloat(alpha) / 100).toString();
      }
      return `rgba(${gray}, ${gray}, ${gray}, ${alpha})`;
    }
    return `rgb(${gray}, ${gray}, ${gray})`;
  };

  const convertCSSOklchAndOklab = (cssText: string): string => {
    let processed = cssText.replace(/oklch\(([^)]+)\)/gi, (match) => {
      try {
        return oklchToRgb(match);
      } catch (e) {
        return "rgb(120, 120, 120)";
      }
    });

    processed = processed.replace(/oklab\(([^)]+)\)/gi, (match) => {
      try {
        return oklabToRgb(match);
      } catch (e) {
        return "rgb(120, 120, 120)";
      }
    });

    return processed;
  };

  const safeHtml2Canvas = async (element: HTMLElement, options: any) => {
    const originalStyleSheets = document.styleSheets;
    const originalCSSRulesMap = new Map<CSSStyleSheet, CSSRuleList>();
    const originalGetPropertyValue = CSSStyleDeclaration.prototype.getPropertyValue;
    const originalGetComputedStyle = window.getComputedStyle;
    const cssTextDescriptor = Object.getOwnPropertyDescriptor(CSSStyleDeclaration.prototype, "cssText");

    // 1. Mock local window's stylesheets where possible
    for (let i = 0; i < originalStyleSheets.length; i++) {
      const sheet = originalStyleSheets[i] as CSSStyleSheet;
      try {
        if (sheet.cssRules) {
          originalCSSRulesMap.set(sheet, sheet.cssRules);

          const mockRules: CSSRule[] = [];
          for (let j = 0; j < sheet.cssRules.length; j++) {
            const rule = sheet.cssRules[j];
            let modifiedText = rule.cssText;
            if (rule.cssText && (rule.cssText.includes("oklch") || rule.cssText.includes("oklab"))) {
              modifiedText = convertCSSOklchAndOklab(rule.cssText);
            }

            const mockRule = new Proxy(rule, {
              get(target, prop) {
                if (prop === "cssText") {
                  return modifiedText;
                }
                const val = (target as any)[prop];
                if (typeof val === "function") {
                  return val.bind(target);
                }
                return val;
              }
            });
            mockRules.push(mockRule);
          }

          Object.defineProperty(sheet, "cssRules", {
            get: () => mockRules,
            configurable: true
          });
        }
      } catch (e) {
        // Ignored CORS or static assets
      }
    }

    // 2. Monkey patch local window CSSStyleDeclaration prototype
    try {
      CSSStyleDeclaration.prototype.getPropertyValue = function (property: string) {
        const val = originalGetPropertyValue.call(this, property);
        if (typeof val === "string" && (val.includes("oklch") || val.includes("oklab"))) {
          return convertCSSOklchAndOklab(val);
        }
        return val;
      };

      if (cssTextDescriptor && cssTextDescriptor.configurable) {
        Object.defineProperty(CSSStyleDeclaration.prototype, "cssText", {
          get() {
            const val = cssTextDescriptor.get ? cssTextDescriptor.get.call(this) : "";
            if (typeof val === "string" && (val.includes("oklch") || val.includes("oklab"))) {
              return convertCSSOklchAndOklab(val);
            }
            return val;
          },
          set(v) {
            if (cssTextDescriptor.set) {
              cssTextDescriptor.set.call(this, v);
            }
          },
          configurable: true
        });
      }
    } catch (e) {
      console.warn("Failed to patch main CSSStyleDeclaration prototype", e);
    }

    // 3. Monkey patch local window getComputedStyle
    try {
      window.getComputedStyle = function (elt, pseudoElt) {
        const style = originalGetComputedStyle(elt, pseudoElt);
        return new Proxy(style, {
          get(target, prop) {
            if (prop === "getPropertyValue") {
              return function (propertyName: string) {
                const val = target.getPropertyValue(propertyName);
                if (typeof val === "string" && (val.includes("oklch") || val.includes("oklab"))) {
                  return convertCSSOklchAndOklab(val);
                }
                return val;
              };
            }
            if (prop === "cssText") {
              const val = target.cssText;
              if (typeof val === "string" && (val.includes("oklch") || val.includes("oklab"))) {
                return convertCSSOklchAndOklab(val);
              }
              return val;
            }
            const val = (target as any)[prop];
            if (typeof val === "string" && (val.includes("oklch") || val.includes("oklab"))) {
              return convertCSSOklchAndOklab(val);
            }
            if (typeof val === "function") {
              return val.bind(target);
            }
            return val;
          }
        });
      };
    } catch (e) {
      console.warn("Failed to patch main getComputedStyle", e);
    }

    // 4. Augment options to intercept iframe clone document in html2canvas
    const userOnClone = options.onclone;
    const augmentedOptions = {
      ...options,
      onclone: (clonedDoc: Document) => {
        if (typeof userOnClone === "function") {
          userOnClone(clonedDoc);
        }

        // Patch iframe getComputedStyle and CSSStyleDeclaration inside safe iframe
        const clonedWin = clonedDoc.defaultView;
        if (clonedWin) {
          try {
            // Override prototype of CSSStyleDeclaration in iframe context
            const proto = clonedWin.CSSStyleDeclaration.prototype;
            const originalIframeGetPropertyValue = proto.getPropertyValue;
            proto.getPropertyValue = function (property: string) {
              const val = originalIframeGetPropertyValue.call(this, property);
              if (typeof val === "string" && (val.includes("oklch") || val.includes("oklab"))) {
                return convertCSSOklchAndOklab(val);
              }
              return val;
            };

            const iframeCssTextDesc = Object.getOwnPropertyDescriptor(proto, "cssText");
            if (iframeCssTextDesc && iframeCssTextDesc.configurable) {
              Object.defineProperty(proto, "cssText", {
                get() {
                  const val = iframeCssTextDesc.get ? iframeCssTextDesc.get.call(this) : "";
                  if (typeof val === "string" && (val.includes("oklch") || val.includes("oklab"))) {
                    return convertCSSOklchAndOklab(val);
                  }
                  return val;
                },
                set(v) {
                  if (iframeCssTextDesc.set) {
                    iframeCssTextDesc.set.call(this, v);
                  }
                },
                configurable: true
              });
            }
          } catch (e) {
            // Fallback if prototype is protected
          }

          try {
            const originalIframeComputedStyle = clonedWin.getComputedStyle;
            clonedWin.getComputedStyle = function (elt, pseudoElt) {
              const style = originalIframeComputedStyle(elt, pseudoElt);
              return new Proxy(style, {
                get(target, prop) {
                  if (prop === "getPropertyValue") {
                    return function (propertyName: string) {
                      const val = target.getPropertyValue(propertyName);
                      if (typeof val === "string" && (val.includes("oklch") || val.includes("oklab"))) {
                        return convertCSSOklchAndOklab(val);
                      }
                      return val;
                    };
                  }
                  if (prop === "cssText") {
                    const val = target.cssText;
                    if (typeof val === "string" && (val.includes("oklch") || val.includes("oklab"))) {
                      return convertCSSOklchAndOklab(val);
                    }
                    return val;
                  }
                  const val = (target as any)[prop];
                  if (typeof val === "string" && (val.includes("oklch") || val.includes("oklab"))) {
                    return convertCSSOklchAndOklab(val);
                  }
                  if (typeof val === "function") {
                    return val.bind(target);
                  }
                  return val;
                }
              });
            };
          } catch (e) {
            // Fail safe
          }
        }

        // Rewrite cloned style tag rules text
        try {
          const styleElements = clonedDoc.querySelectorAll("style");
          styleElements.forEach((styleTag) => {
            if (styleTag.textContent) {
              styleTag.textContent = convertCSSOklchAndOklab(styleTag.textContent);
            }
          });
        } catch (e) {
          // Ignore
        }

        // Rewrite cloned inline style attributes on elements
        try {
          const allElements = clonedDoc.querySelectorAll("*");
          allElements.forEach((el) => {
            const htmlEl = el as HTMLElement;
            if (htmlEl.style && htmlEl.style.cssText) {
              if (htmlEl.style.cssText.includes("oklch") || htmlEl.style.cssText.includes("oklab")) {
                htmlEl.style.cssText = convertCSSOklchAndOklab(htmlEl.style.cssText);
              }
            }
          });
        } catch (e) {
          // Ignore
        }
      }
    };

    try {
      return await html2canvas(element, augmentedOptions);
    } finally {
      // Restore original rules in main window
      for (const [sheet, originalRules] of originalCSSRulesMap.entries()) {
        try {
          Object.defineProperty(sheet, "cssRules", {
            get: () => originalRules,
            configurable: true
          });
        } catch (e) {
          // Ignore
        }
      }

      // Restore prototype getPropertyValue
      try {
        CSSStyleDeclaration.prototype.getPropertyValue = originalGetPropertyValue;
        if (cssTextDescriptor && cssTextDescriptor.configurable) {
          Object.defineProperty(CSSStyleDeclaration.prototype, "cssText", cssTextDescriptor);
        }
      } catch (e) {
        // Ignore
      }

      // Restore getComputedStyle
      try {
        window.getComputedStyle = originalGetComputedStyle;
      } catch (e) {
        // Ignore
      }
    }
  };

  const handleExportAsImage = async () => {
    const element = document.getElementById("exportable-receipt-ticket");
    if (!element) return;
    try {
      const canvas = await safeHtml2Canvas(element, {
        scale: 2,
        useCORS: true,
        backgroundColor: "#fcfbfa",
      });
      const imgData = canvas.toDataURL("image/png");
      const link = document.createElement("a");
      link.download = `${receipt?.storeName || "receipt"}-split-bill.png`;
      link.href = imgData;
      link.click();
    } catch (err) {
      console.error("Failed to export image", err);
    }
  };

  const handleExportAsPdf = async () => {
    const element = document.getElementById("exportable-receipt-ticket");
    if (!element) return;
    try {
      const canvas = await safeHtml2Canvas(element, {
        scale: 2,
        useCORS: true,
        backgroundColor: "#fcfbfa",
      });
      const imgData = canvas.toDataURL("image/png");

      const pdf = new jsPDF("p", "mm", "a4");
      const pdfWidth = pdf.internal.pageSize.getWidth();

      const imgWidth = pdfWidth - 20; // 10mm margins on sides
      const imgHeight = (canvas.height * imgWidth) / canvas.width;

      pdf.addImage(imgData, "PNG", 10, 10, imgWidth, imgHeight);
      pdf.save(`${receipt?.storeName || "receipt"}-split-bill.pdf`);
    } catch (err) {
      console.error("Failed to export PDF", err);
    }
  };

  return (
    <div className="min-h-screen bg-[#fafbfc] flex flex-col font-sans text-slate-800">

      {/* App Header (SplitSmart AI) */}
      <header className="h-16 flex items-center justify-between px-4 sm:px-6 bg-white border-b border-slate-200 sticky top-0 z-40 shrink-0 select-none">
        <div className="flex items-center gap-2.5 sm:gap-3">
          <div className="w-8 h-8 sm:w-9 sm:h-9 bg-indigo-600 rounded-lg flex items-center justify-center text-white shadow-xs shrink-0">
            <TrendingUp className="w-4 h-4 sm:w-5 sm:h-5" />
          </div>
          <div className="min-w-0">
            <h1 className="text-sm sm:text-lg font-bold tracking-tight font-display text-slate-900 leading-none">
              SplitSmart <span className="text-indigo-600 font-extrabold">AI</span>
            </h1>
            <p className="text-[9px] sm:text-[10px] text-slate-400 font-medium truncate mt-0.5">Receipt parsing + proportional splits</p>
          </div>
        </div>
        <div className="flex items-center gap-2 sm:gap-4 text-xs font-semibold text-slate-500">
          {receipt ? (
            <span className="px-2 py-0.5 sm:px-2.5 sm:py-1 bg-emerald-50 text-emerald-700 rounded-full font-bold border border-emerald-100 text-[10px] sm:text-xs">
              Receipt Parsed
            </span>
          ) : (
            <span className="px-2 py-0.5 sm:px-2.5 sm:py-1 bg-amber-50 text-amber-700 rounded-full font-bold border border-amber-100 text-[10px] sm:text-xs animate-pulse">
              Awaiting Document
            </span>
          )}
          <span className="hidden md:inline text-slate-400">{new Date().toLocaleDateString(undefined, { month: "short", day: "numeric", year: "numeric" })}</span>
          {receipt && (
            <button
              onClick={resetAll}
              className="flex items-center space-x-1 px-2.5 py-1.5 rounded-lg border border-slate-200 text-[10px] sm:text-[11px] bg-white text-slate-550 hover:bg-slate-50 hover:text-slate-800 transition-all font-medium cursor-pointer"
            >
              <RefreshCw className="w-3.5 h-3.5" />
              <span className="hidden xs:inline">Reset</span>
            </button>
          )}
        </div>
      </header>

      {/* Mobile Navigation Tabs (Only visible on screens smaller than lg, if a receipt is loaded) */}
      {receipt && (
        <div className="lg:hidden bg-white border-b border-slate-200 sticky top-16 z-30 px-4 py-2 shrink-0 select-none">
          <div className="bg-slate-100 p-0.5 rounded-xl flex items-center justify-between text-xs font-bold text-slate-500 shadow-3xs">
            <button
              onClick={() => setActiveMobileTab("receipt")}
              className={`flex-1 flex items-center justify-center gap-1.5 py-2 rounded-lg transition-all ${activeMobileTab === "receipt"
                  ? "bg-white text-indigo-600 shadow-xs"
                  : "hover:text-slate-800 hover:bg-white/40"
                }`}
            >
              <FileText className="w-3.5 h-3.5 shrink-0" />
              <span>Receipt</span>
            </button>
            <button
              onClick={() => setActiveMobileTab("chat")}
              className={`flex-1 flex items-center justify-center gap-1.5 py-2 rounded-lg transition-all relative ${activeMobileTab === "chat"
                  ? "bg-white text-indigo-600 shadow-xs"
                  : "hover:text-slate-800 hover:bg-white/40"
                }`}
            >
              <Sparkles className="w-3.5 h-3.5 shrink-0" />
              <span>AI Chat</span>
              {getUnassignedCount() > 0 && (
                <span className="absolute -top-1 -right-0.5 bg-amber-500 text-white font-black text-[8px] rounded-full h-4 w-4 flex items-center justify-center animate-pulse">
                  {getUnassignedCount()}
                </span>
              )}
            </button>
            <button
              onClick={() => setActiveMobileTab("splits")}
              className={`flex-1 flex items-center justify-center gap-1.5 py-2 rounded-lg transition-all ${activeMobileTab === "splits"
                  ? "bg-white text-indigo-600 shadow-xs"
                  : "hover:text-slate-800 hover:bg-white/40"
                }`}
            >
              <Users className="w-3.5 h-3.5 shrink-0" />
              <span>Owed</span>
            </button>
          </div>
        </div>
      )}

      {/* Main container splitscreen */}
      <main className="max-w-7xl w-full mx-auto p-4 sm:p-5 flex-1 grid grid-cols-1 lg:grid-cols-12 gap-6 lg:overflow-hidden">

        {/* Left column: Receipt viewer & Upload Panel (5 cols) */}
        <div className={`lg:col-span-5 flex flex-col space-y-4 ${activeMobileTab === "receipt" ? "flex" : "hidden lg:flex"}`}>

          {!receipt ? (
            /* Uploader layout when nothing is parsed yet */
            <div className="flex flex-col flex-1 bg-white border border-slate-200 rounded-2xl p-6 justify-between min-h-[500px] shadow-xs">
              <div>
                <div className="mb-6">
                  <span className="bg-indigo-50 text-indigo-600 text-[9px] font-bold uppercase tracking-wider px-2 py-0.5 rounded border border-indigo-100 font-sans">
                    Step 1: Receipt Input
                  </span>
                  <h2 className="text-xl font-bold font-display text-slate-900 mt-2">
                    Upload or Parse Receipt
                  </h2>
                  <p className="text-slate-500 text-xs mt-1 leading-relaxed">
                    Choose an image of your receipt to let Split Smart extract names, prices, tax, and totals automatically.
                  </p>
                </div>

                {/* Upload drag drop stage */}
                <div
                  onDragEnter={handleDrag}
                  onDragOver={handleDrag}
                  onDragLeave={handleDrag}
                  onDrop={handleDrop}
                  className={`border-2 border-dashed rounded-2xl p-8 flex flex-col items-center justify-center text-center transition-all cursor-pointer ${dragActive
                      ? "border-indigo-500 bg-indigo-50/40"
                      : "border-slate-200 hover:border-indigo-400 hover:bg-slate-50/20"
                    }`}
                  onClick={() => fileInputRef.current?.click()}
                >
                  <input
                    ref={fileInputRef}
                    type="file"
                    className="hidden"
                    accept="image/*"
                    onChange={handleFileChange}
                  />

                  {isParsing ? (
                    <div className="flex flex-col items-center py-6">
                      <div className="relative">
                        <div className="w-12 h-12 rounded-full border-4 border-slate-100 border-t-indigo-600 animate-spin"></div>
                        <Sparkles className="w-4 h-4 text-indigo-500 absolute -top-1 -right-1 animate-pulse" />
                      </div>
                      <p className="text-slate-800 text-xs font-semibold mt-4 animate-pulse font-display">
                        Split Smart AI mapping receipt lines...
                      </p>
                      <p className="text-slate-400 text-[10px] mt-1">
                        Extracting items, subtotal, and tax
                      </p>
                    </div>
                  ) : (
                    <div className="py-6">
                      <div className="bg-indigo-50 p-4 rounded-full inline-block text-indigo-600 mb-3 border border-indigo-100/50">
                        <UploadCloud className="w-7 h-7 text-indigo-600" />
                      </div>
                      <p className="text-slate-700 text-xs font-semibold">
                        Drag & Drop receipt picture here
                      </p>
                      <p className="text-slate-400 text-[10px] mt-1">
                        or click to browse local files
                      </p>
                      <span className="mt-4 inline-block text-[9px] bg-indigo-50 border border-indigo-100 text-indigo-700 px-2.5 py-0.5 rounded font-mono font-bold uppercase tracking-wider">

                      </span>
                    </div>
                  )}
                </div>

                {parsingError && (
                  <div className="mt-4 bg-rose-50 border border-rose-100 text-rose-700 p-3 rounded-xl flex items-start space-x-2 text-xs">
                    <AlertCircle className="w-4 h-4 text-rose-500 shrink-0 mt-0.5" />
                    <p className="leading-relaxed">{parsingError}</p>
                  </div>
                )}
              </div>

              {/* Sample prebuilt receipts list */}
              <div className="mt-8 border-t border-slate-100 pt-5">
                <p className="text-slate-400 text-[10px] font-bold uppercase tracking-widest mb-3">
                  Quick Sample Templates
                </p>
                <div className="grid grid-cols-1 gap-2">
                  {SAMPLE_RECEIPTS.map((item) => (
                    <button
                      key={item.id}
                      onClick={() => loadSample(item.id)}
                      className="w-full flex items-center justify-between text-left p-3 rounded-xl border border-slate-200 bg-white hover:bg-slate-50 hover:border-slate-300 hover:shadow-xs transition-all text-xs group cursor-pointer"
                    >
                      <div className="flex items-center space-x-3">
                        <div className="bg-indigo-50 p-2 rounded-lg text-indigo-600 group-hover:bg-indigo-100 transition-colors">
                          <FileText className="w-4 h-4 text-indigo-600" />
                        </div>
                        <div>
                          <p className="font-semibold text-slate-800">{item.name}</p>
                          <p className="text-slate-400 text-[10px] sm:inline">
                            {item.receipt.items.length} items • Subtotal ${item.receipt.subtotal.toFixed(2)}
                          </p>
                        </div>
                      </div>
                      <div className="text-right flex items-center space-x-1.5 font-mono">
                        <span className="text-slate-950 font-bold font-sans">${item.receipt.total.toFixed(2)}</span>
                        <span className="text-slate-300 text-[10px] group-hover:translate-x-0.5 transition-transform">➔</span>
                      </div>
                    </button>
                  ))}
                </div>
              </div>
            </div>
          ) : (
            /* Structured receipt detail editor pane */
            <div className="flex flex-col flex-1 bg-white border border-slate-200 rounded-2xl overflow-hidden h-[calc(100vh-12rem)] md:h-[calc(100vh-10rem)] lg:h-full lg:max-h-[calc(100vh-8.5rem)] shadow-xs animate-fade-in">

              {/* Receipt Header details */}
              <div className="pt-6 px-6 pb-4 border-b border-slate-200 bg-slate-50/50">
                <div className="flex items-center justify-between">
                  <div className="flex-1 min-w-0 mr-4">
                    <span className="text-[10px] font-bold uppercase tracking-widest text-slate-400 mb-0.5 block">
                      Parsed Content
                    </span>
                    <div className="flex items-center space-x-2">
                      <input
                        type="text"
                        value={receipt.storeName}
                        onChange={(e) => setReceipt({ ...receipt, storeName: e.target.value })}
                        className="text-xl font-bold font-display text-slate-900 bg-transparent hover:bg-slate-100 border-none rounded px-1 py-0.5 focus:bg-white focus:ring-1 focus:ring-indigo-400 w-full focus:outline-none transition-colors cursor-pointer"
                        title="Click to edit store name"
                      />
                    </div>
                  </div>
                  <button
                    onClick={() => setReceipt(null)}
                    className="p-1.5 px-3 rounded-lg border border-slate-200 hover:bg-slate-100 hover:text-slate-800 text-[10px] font-bold text-slate-500 transition-colors flex items-center space-x-1.5 cursor-pointer"
                  >
                    <X className="w-3 h-3 text-slate-400" />
                    <span>Unload</span>
                  </button>
                </div>
              </div>

              {/* Items scroll list */}
              <div className="p-5 flex-1 overflow-y-auto space-y-4">
                <div className="flex items-center justify-between">
                  <span className="text-[11px] font-bold uppercase text-slate-400 tracking-wider">
                    Receipt Items ({receipt.items.length})
                  </span>
                  <button
                    onClick={() => setShowAddItemForm(!showAddItemForm)}
                    className="text-[11px] text-indigo-600 font-bold hover:text-indigo-700 transition-colors flex items-center space-x-1 cursor-pointer"
                  >
                    <span>+ Add item manually</span>
                  </button>
                </div>

                {/* Inline manual item additions form */}
                <AnimatePresence>
                  {showAddItemForm && (
                    <motion.form
                      initial={{ opacity: 0, y: -8 }}
                      animate={{ opacity: 1, y: 0 }}
                      exit={{ opacity: 0, y: -8 }}
                      onSubmit={handleAddNewItem}
                      className="bg-slate-50 border border-slate-200 p-3 rounded-xl space-y-3"
                    >
                      <div className="grid grid-cols-6 gap-2">
                        <div className="col-span-3">
                          <label className="text-[9px] font-bold text-slate-400 uppercase tracking-widest block mb-1">Item name</label>
                          <input
                            type="text"
                            placeholder="e.g. Garlic Fries"
                            value={newItemName}
                            onChange={(e) => setNewItemName(e.target.value)}
                            required
                            className="bg-white border border-slate-200 text-xs rounded-lg px-2 py-1.5 w-full focus:outline-indigo-500"
                          />
                        </div>
                        <div className="col-span-2">
                          <label className="text-[9px] font-bold text-slate-400 uppercase tracking-widest block mb-1">Total price</label>
                          <input
                            type="number"
                            step="0.01"
                            placeholder="$9.50"
                            value={newItemPrice}
                            onChange={(e) => setNewItemPrice(e.target.value)}
                            required
                            className="bg-white border border-slate-200 text-xs rounded-lg px-2 py-1.5 w-full font-mono focus:outline-indigo-505"
                          />
                        </div>
                        <div className="col-span-1">
                          <label className="text-[9px] font-bold text-slate-400 uppercase tracking-widest block mb-1">Qty</label>
                          <input
                            type="number"
                            value={newItemQty}
                            onChange={(e) => setNewItemQty(e.target.value)}
                            className="bg-white border border-slate-200 text-xs rounded-lg px-2 py-1.5 w-full text-center font-mono focus:outline-indigo-505"
                          />
                        </div>
                      </div>
                      <div className="flex items-center justify-end space-x-2 text-[11px] font-bold">
                        <button
                          type="button"
                          onClick={() => setShowAddItemForm(false)}
                          className="px-2.5 py-1 text-slate-500 hover:text-slate-700"
                        >
                          Cancel
                        </button>
                        <button
                          type="submit"
                          className="bg-indigo-600 hover:bg-indigo-700 text-white rounded-lg px-3 py-1 text-xs cursor-pointer"
                        >
                          Add Item
                        </button>
                      </div>
                    </motion.form>
                  )}
                </AnimatePresence>

                {/* Core structured list of receipt items */}
                <div className="space-y-2">
                  {receipt.items.map((item) => {
                    const isAssigned = item.assignedTo.length > 0;
                    return (
                      <div
                        key={item.id}
                        className={`relative border rounded-xl p-3 transition-all ${isAssigned
                            ? "bg-white border-slate-200"
                            : "bg-amber-50/20 border-amber-200/50"
                          }`}
                      >
                        {/* Item main row details */}
                        <div className="flex items-start justify-between">
                          <div className="flex-1 min-w-0 pr-3">
                            <div className="flex items-center space-x-1.5">
                              {item.quantity > 1 && (
                                <span className="text-[10px] font-mono font-bold bg-slate-100 text-slate-500 rounded px-1 shrink-0">
                                  {item.quantity}x
                                </span>
                              )}
                              <input
                                type="text"
                                value={item.name}
                                onChange={(e) => {
                                  const next = { ...receipt };
                                  next.items = next.items.map(it => it.id === item.id ? { ...it, name: e.target.value } : it);
                                  setReceipt(next);
                                }}
                                className="text-xs font-semibold text-slate-700 bg-transparent border-none rounded-sm px-0.5 hover:bg-slate-100/50 focus:bg-white focus:outline-none focus:ring-1 focus:ring-indigo-400 w-full cursor-pointer"
                              />
                            </div>

                            {/* Visual assigned users with flat tags */}
                            <div className="mt-2 flex flex-wrap gap-1 items-center">
                              {item.assignedTo.map((name) => (
                                <span
                                  key={name}
                                  className={`text-[9px] font-semibold border rounded-full px-2 py-0.5 flex items-center space-x-1 ${getParticipantColor(name)}`}
                                >
                                  <span>{name}</span>
                                  <button
                                    onClick={(e) => {
                                      e.stopPropagation();
                                      toggleItemAssignee(item.id, name);
                                    }}
                                    className="hover:bg-slate-900/15 rounded-full p-0.5 text-current"
                                  >
                                    <X className="w-2 h-2 text-current" />
                                  </button>
                                </span>
                              ))}

                              {/* Split button triggers checkbox overlay drop down */}
                              <div className="relative inline-block">
                                <button
                                  onClick={() => setActiveItemDropdownId(activeItemDropdownId === item.id ? null : item.id)}
                                  className="text-[9px] border hover:border-slate-300 rounded-full px-2 py-0.5 flex items-center space-x-0.5 cursor-pointer bg-slate-50/80 hover:bg-slate-100 transition-colors text-slate-500 font-bold"
                                >
                                  <Plus className="w-2.5 h-2.5" />
                                  <span>Split</span>
                                </button>

                                {activeItemDropdownId === item.id && (
                                  <>
                                    <div
                                      className="fixed inset-0 z-10"
                                      onClick={() => setActiveItemDropdownId(null)}
                                    />
                                    <div className="absolute left-0 mt-1 z-20 bg-white border border-slate-200 rounded-xl shadow-lg p-2 min-w-44 space-y-1 text-[11px] max-h-48 overflow-y-auto">
                                      <p className="px-2 py-1 text-slate-400 font-bold uppercase text-[8px] tracking-wider border-b border-slate-100">
                                        Toggle assignee
                                      </p>

                                      {participants.length === 0 ? (
                                        <p className="px-2 py-2 text-slate-400 italic text-[10px]">
                                          Add participants listed on sidebar to check them.
                                        </p>
                                      ) : (
                                        participants.map((name) => {
                                          const isChecked = item.assignedTo.includes(name);
                                          return (
                                            <button
                                              key={name}
                                              onClick={() => toggleItemAssignee(item.id, name)}
                                              className="w-full flex items-center justify-between px-2 py-1.5 rounded-lg hover:bg-slate-50 text-left cursor-pointer font-medium"
                                            >
                                              <span className="text-slate-600 font-medium">{name}</span>
                                              {isChecked ? (
                                                <Check className="w-3.5 h-3.5 text-indigo-600 shrink-0" />
                                              ) : (
                                                <div className="w-3.5 h-3.5 rounded border border-slate-300 inline-block shrink-0" />
                                              )}
                                            </button>
                                          );
                                        })
                                      )}
                                    </div>
                                  </>
                                )}
                              </div>
                            </div>
                          </div>

                          {/* Item cost input */}
                          <div className="text-right flex flex-col items-end pl-2 shrink-0">
                            <div className="flex items-center space-x-1">
                              <span className="text-slate-400 text-[10px] font-mono">$</span>
                              <input
                                type="number"
                                step="0.01"
                                value={item.price}
                                onChange={(e) => {
                                  const next = { ...receipt };
                                  const cleanPrice = parseFloat(e.target.value) || 0;
                                  next.items = next.items.map(it => it.id === item.id ? { ...it, price: cleanPrice } : it);
                                  next.subtotal = next.items.reduce((sum, current) => sum + current.price, 0);
                                  next.total = next.subtotal + next.tax + next.tip;
                                  setReceipt(next);
                                }}
                                className="text-xs font-mono font-bold text-slate-700 bg-transparent border-none rounded-sm text-right px-0.5 hover:bg-slate-100/50 focus:bg-white focus:outline-none focus:ring-1 focus:ring-indigo-400 w-16 cursor-pointer"
                              />
                            </div>

                            <button
                              onClick={() => handleRemoveItem(item.id)}
                              className="mt-2.5 text-slate-300 hover:text-rose-500 transition-colors p-1 rounded-sm cursor-pointer"
                              title="Remove item"
                            >
                              <Trash2 className="w-3.5 h-3.5" />
                            </button>
                          </div>
                        </div>
                      </div>
                    );
                  })}
                </div>
              </div>

              {/* Sidebar list of custom attendees */}
              <div className="p-4 border-t border-b border-dashed border-slate-200 bg-slate-50 flex flex-col space-y-2.5">
                <div className="flex items-center justify-between">
                  <span className="text-[11px] font-bold uppercase text-slate-505 tracking-wider flex items-center space-x-1">
                    <Users className="w-3.5 h-3.5 text-slate-400 shrink-0" />
                    <span>Participant Directory ({participants.length})</span>
                  </span>
                </div>

                <div className="flex flex-wrap gap-1.5 max-h-24 overflow-y-auto">
                  {participants.map((p) => (
                    <span
                      key={p}
                      className={`text-[10px] font-semibold border rounded-full px-2.5 py-1 flex items-center space-x-1.5 ${getParticipantColor(p)}`}
                    >
                      <span>{p}</span>
                      <button
                        onClick={() => handleRemoveParticipant(p)}
                        className="hover:bg-black/10 rounded-full p-0.5 cursor-pointer text-current"
                      >
                        <X className="w-2.5 h-2.5 text-current" />
                      </button>
                    </span>
                  ))}

                  {participants.length === 0 && (
                    <p className="text-slate-400 text-[10px] italic py-1 leading-snug">
                      No participants added. Create participants below or type their names in the split chat.
                    </p>
                  )}
                </div>

                <form onSubmit={handleAddParticipant} className="flex space-x-1.5">
                  <input
                    type="text"
                    placeholder="Add name manually..."
                    value={newPersonName}
                    onChange={(e) => setNewPersonName(e.target.value)}
                    className="flex-1 text-xs bg-white border border-slate-200 rounded-xl px-3 py-1.5 focus:outline-emerald-400 focus:ring-1"
                  />
                  <button
                    type="submit"
                    className="bg-slate-200 hover:bg-slate-300 transition-colors text-slate-700 font-bold text-xs rounded-xl px-3 flex items-center justify-center cursor-pointer"
                  >
                    <UserPlus className="w-3.5 h-3.5" />
                  </button>
                </form>
              </div>

              {/* Total calculations block */}
              <div className="p-4 bg-slate-100/70 border-t border-slate-100 flex flex-col space-y-2">
                <div className="flex justify-between items-center text-xs">
                  <span className="text-slate-400 font-medium">Subtotal</span>
                  <div className="flex items-center space-x-0.5 font-mono">
                    <span className="text-slate-400">$</span>
                    <input
                      type="number"
                      step="0.01"
                      value={receipt.subtotal}
                      onChange={(e) => updateReceiptTotals("subtotal", e.target.value)}
                      className="font-bold text-slate-700 bg-transparent border-none rounded-xs select-all text-right px-0.5 hover:bg-slate-200/50 w-16 focus:outline-none cursor-pointer"
                    />
                  </div>
                </div>

                <div className="flex justify-between items-center text-xs">
                  <span className="text-slate-505 font-medium flex items-center space-x-1">
                    <span>Tax (proportional)</span>
                    <HelpCircle className="w-3 h-3 text-slate-300 shrink-0" title="Calculated pro-rata based on item subtotals" />
                  </span>
                  <div className="flex items-center space-x-0.5 font-mono">
                    <span className="text-slate-400">$</span>
                    <input
                      type="number"
                      step="0.01"
                      value={receipt.tax}
                      onChange={(e) => updateReceiptTotals("tax", e.target.value)}
                      className="font-bold text-slate-700 bg-transparent border-none rounded-xs select-all text-right px-0.5 hover:bg-slate-200/50 w-16 focus:outline-none cursor-pointer"
                    />
                  </div>
                </div>

                <div className="flex justify-between items-center text-xs">
                  <span className="text-slate-505 font-medium flex items-center space-x-1">
                    <span>Tip (proportionate)</span>
                    <HelpCircle className="w-3 h-3 text-slate-300 shrink-0" title="Calculated pro-rata based on item subtotals" />
                  </span>
                  <div className="flex items-center space-x-0.5 font-mono">
                    <span className="text-slate-400">$</span>
                    <input
                      type="number"
                      step="0.01"
                      value={receipt.tip}
                      onChange={(e) => updateReceiptTotals("tip", e.target.value)}
                      className="font-bold text-slate-700 bg-transparent border-none rounded-xs select-all text-right px-0.5 hover:bg-slate-200/50 w-16 focus:outline-none cursor-pointer"
                    />
                  </div>
                </div>

                <div className="border-t border-slate-200/60 my-1"></div>

                <div className="flex justify-between items-center">
                  <span className="text-xs font-bold text-slate-700 font-sans">Total</span>
                  <span className="font-mono text-base font-extrabold text-indigo-600">
                    ${receipt.total.toFixed(2)}
                  </span>
                </div>
              </div>

            </div>
          )}

        </div>

        {/* Right column: Smart Chat interface & Real-time Split Breakdown (7 cols) */}
        <div className={`lg:col-span-7 flex flex-col space-y-4 lg:overflow-hidden h-full lg:max-h-[calc(100vh-8.5rem)] ${activeMobileTab !== "receipt" ? "flex" : "hidden lg:flex"} animate-fade-in`}>

          {/* Upper Sub-pane: Chat interface card */}
          <div className={`bg-white border border-slate-200 rounded-2xl flex flex-col overflow-hidden h-[calc(100vh-12rem)] md:h-[calc(100vh-10rem)] lg:h-[350px] xl:h-[48%] shrink-0 shadow-xs ${activeMobileTab === "chat" ? "flex" : "hidden lg:flex"}`}>
            {/* Header chat status */}
            <div className="px-5 py-4 border-b border-slate-200 flex items-center justify-between bg-slate-50/50 select-none">
              <div className="flex items-center space-x-2.5">
                <div className="bg-indigo-50 p-2 rounded-lg text-indigo-600">
                  <Sparkles className="w-4 h-4" />
                </div>
                <div>
                  <h3 className="text-xs font-bold text-slate-800 font-display">Smart Splitting Chat</h3>
                  <p className="text-[10px] text-slate-400 font-mono">Split Smart AI Assistant</p>
                </div>
              </div>

              <div className="flex items-center space-x-1.5 text-[10px] font-semibold">
                {receipt && getUnassignedCount() > 0 ? (
                  <span className="bg-amber-50 text-amber-700 px-2.5 py-1 rounded-full border border-amber-200/50">
                    ⚠️ {getUnassignedCount()} items left
                  </span>
                ) : receipt ? (
                  <span className="bg-emerald-50 text-emerald-700 px-2.5 py-1 rounded-full border border-emerald-200/50">
                    ✓ Clean Split Complete!
                  </span>
                ) : (
                  <span className="text-slate-400 italic font-normal">Awaiting receipt upload</span>
                )}
              </div>
            </div>

            {/* Chat message stream */}
            <div className="flex-1 overflow-y-auto p-5 space-y-4">
              {chatMessages.map((msg) => {
                const isUser = msg.sender === "user";
                return (
                  <div
                    key={msg.id}
                    className={`flex ${isUser ? "justify-end" : "justify-start"}`}
                  >
                    <div
                      className={`max-w-[80%] rounded-2xl p-3 px-4 text-xs leading-relaxed shadow-3xs ${isUser
                          ? "bg-slate-800 text-white rounded-tr-none text-sm"
                          : msg.sender === "system"
                            ? "bg-slate-50 border border-slate-200 text-slate-600 font-medium"
                            : msg.isError
                              ? "bg-rose-50 border border-rose-100 text-rose-700 font-medium"
                              : "bg-indigo-50/40 border border-indigo-100 text-indigo-950 rounded-tl-none text-sm"
                        }`}
                    >
                      {/* Message content */}
                      <div className="whitespace-pre-line text-[13px]">
                        {isUser ? (
                          <span className="text-white block font-medium">{msg.text}</span>
                        ) : (
                          <div dangerouslySetInnerHTML={{
                            __html: msg.text
                              .replace(/\*\*(.*?)\*\*/g, '<strong class="font-bold text-slate-900">$1</strong>')
                              .replace(/`([^`]+)`/g, '<code class="bg-indigo-50 text-indigo-700 rounded px-1 font-mono text-[11px] font-bold">$1</code>')
                          }} />
                        )}
                      </div>

                      {msg.suggestedAction && (
                        <div className="mt-2.5 pt-2 border-t border-slate-100/80 flex flex-col space-y-0.5 select-none">
                          <span className="text-[9px] text-slate-400 font-extrabold uppercase tracking-wider flex items-center space-x-1">
                            <Sparkles className="w-3 h-3 text-indigo-500" />
                            <span>Suggested Next Step</span>
                          </span>
                          <p className="text-[11px] text-slate-500 italic">
                            "{msg.suggestedAction}"
                          </p>
                        </div>
                      )}

                      <div className="text-right mt-1.5 select-none opacity-60">
                        <span className={`text-[8px] font-mono ${isUser ? "text-indigo-200" : "text-slate-400"}`}>
                          {msg.timestamp}
                        </span>
                      </div>
                    </div>
                  </div>
                );
              })}

              {isChatLoading && (
                <div className="flex justify-start">
                  <div className="bg-slate-50 border border-slate-200 rounded-2xl rounded-tl-none p-3 px-4 text-xs text-slate-500 flex items-center space-x-2">
                    <div className="flex space-x-1 shrink-0">
                      <div className="w-1.5 h-1.5 bg-indigo-600 rounded-full animate-bounce"></div>
                      <div className="w-1.5 h-1.5 bg-indigo-600 rounded-full animate-bounce delay-100"></div>
                      <div className="w-1.5 h-1.5 bg-indigo-600 rounded-full animate-bounce delay-200"></div>
                    </div>
                    <span className="text-[10px] text-slate-500 font-medium animate-pulse">
                      Split Smart is interpreting splitting command...
                    </span>
                  </div>
                </div>
              )}

              <div ref={messagesEndRef} />
            </div>

            {/* Quick helper action chips */}
            {receipt && (
              <div className="px-4 py-2 border-t border-slate-100 bg-slate-50/50 flex gap-2 overflow-x-auto shrink-0 border-b border-rose-50/10 select-none">
                {quickSuggestions.map((pill, idx) => (
                  <button
                    key={idx}
                    onClick={() => handleSendCommand(pill.command)}
                    className="text-[10px] font-bold text-slate-600 bg-white border border-slate-200 rounded-full px-3 py-1.5 whitespace-nowrap hover:bg-slate-50 hover:border-slate-300 hover:text-slate-800 transition-all cursor-pointer shadow-3xs shrink-0"
                  >
                    {pill.label}
                  </button>
                ))}
              </div>
            )}

            {/* Chat inputs footer */}
            <div className="p-3 border-t border-slate-200 shrink-0 select-none bg-white">
              <div className="flex items-center gap-2 bg-slate-50 p-1.5 rounded-2xl border border-slate-200/80 shadow-3xs">
                <input
                  type="text"
                  disabled={!receipt || isChatLoading}
                  placeholder={
                    !receipt
                      ? "🔒 Load or upload a receipt first to chat"
                      : "Type natural command (e.g. 'frank split fries with sarah')"
                  }
                  value={chatInput}
                  onChange={(e) => setChatInput(e.target.value)}
                  onKeyDown={(e) => {
                    if (e.key === "Enter") handleSendCommand();
                  }}
                  className="flex-1 text-sm bg-transparent border-none focus:ring-0 px-3 text-slate-700 outline-none disabled:opacity-50"
                />

                <button
                  type="button"
                  disabled={!receipt || !chatInput.trim() || isChatLoading}
                  onClick={() => handleSendCommand()}
                  className="w-10 h-10 bg-indigo-600 hover:bg-indigo-700 text-white rounded-xl flex items-center justify-center transition-colors shadow-sm disabled:opacity-40 cursor-pointer shrink-0"
                  title="Send split instructions to AI"
                >
                  <Sparkles className="w-4 h-4 text-white shrink-0" />
                </button>
              </div>
            </div>
          </div>

          {/* Lower Sub-pane: Real-time Split summary calculation table cards */}
          <div className={`bg-white border border-slate-200 rounded-2xl shadow-sm flex flex-col overflow-hidden h-[calc(100vh-12rem)] md:h-[calc(100vh-10rem)] lg:h-auto lg:flex-1 select-none ${activeMobileTab === "splits" ? "flex" : "hidden lg:flex"}`}>
            <div className="px-5 py-4 border-b border-slate-200 bg-slate-50/50 flex justify-between items-center shrink-0">
              <span className="text-[11px] font-bold uppercase text-slate-400 tracking-wider flex items-center space-x-1.5">
                <Users className="w-4 h-4 text-indigo-500 shrink-0" />
                <span>Real-Time Owed Splits (Proportional)</span>
              </span>
              <span className="text-[10px] text-slate-400 font-mono">
                Updates dynamically as items split
              </span>
            </div>

            <div className="flex-1 overflow-y-auto p-5 space-y-3.5">
              {splitsBreakdown.length === 0 ? (
                <div className="h-full flex flex-col items-center justify-center text-center py-8 text-slate-400 border border-dashed border-slate-200 rounded-xl bg-slate-50/50 m-2">
                  <AlertCircle className="w-7 h-7 text-slate-300 mb-2.5" />
                  <p className="text-xs font-semibold">No participants listed yet</p>
                  <p className="text-[10px] mt-1 text-slate-400">
                    Add participants and split some items to see what each person owes.
                  </p>
                </div>
              ) : (
                splitsBreakdown.map((owed) => {
                  const isExpanded = expandedSummaryName === owed.name;
                  return (
                    <div
                      key={owed.name}
                      className="border border-slate-200 rounded-xl bg-white overflow-hidden shadow-3xs hover:border-indigo-200 transition-colors"
                    >
                      {/* Summary card visual row */}
                      <div
                        onClick={() => setExpandedSummaryName(isExpanded ? null : owed.name)}
                        className="p-4 flex items-center justify-between cursor-pointer group"
                      >
                        <div className="flex items-center space-x-3.5 max-w-[60%]">
                          <div className={`w-9 h-9 rounded-full font-bold flex items-center justify-center text-[11px] shrink-0 border ${getParticipantColor(owed.name)}`}>
                            {owed.name.slice(0, 2).toUpperCase()}
                          </div>
                          <div className="min-w-0">
                            <span className="font-bold text-slate-900 text-sm block truncate leading-snug group-hover:text-indigo-600 transition-colors">
                              {owed.name}
                            </span>
                            <span className="text-[10px] text-slate-400 font-mono block mt-0.5">
                              {owed.items.length} items assigned
                            </span>
                          </div>
                        </div>

                        <div className="flex items-center space-x-3.5 font-mono">
                          <div className="text-right">
                            <span className="text-slate-400 text-[10px] block font-sans">
                              Subtotal: ${owed.itemSubtotal.toFixed(2)}
                            </span>
                            <span className="text-slate-900 text-sm font-extrabold block">
                              ${owed.totalOwed.toFixed(2)}
                            </span>
                          </div>

                          <div className="text-slate-400">
                            {isExpanded ? (
                              <ChevronUp className="w-4 h-4 text-slate-400" />
                            ) : (
                              <ChevronDown className="w-4 h-4 text-slate-400" />
                            )}
                          </div>
                        </div>
                      </div>

                      {/* Display item detail breakdown inside accordion */}
                      <AnimatePresence>
                        {isExpanded && (
                          <motion.div
                            initial={{ height: 0, opacity: 0 }}
                            animate={{ height: "auto", opacity: 1 }}
                            exit={{ height: 0, opacity: 0 }}
                            className="bg-slate-50 border-t border-slate-150 overflow-hidden"
                          >
                            <div className="p-4 space-y-3 text-[11px]">

                              {/* Assigned items list */}
                              <div>
                                <p className="text-[9px] font-extrabold text-slate-400 uppercase tracking-widest mb-2">
                                  Items breakdown
                                </p>

                                {owed.items.length === 0 ? (
                                  <p className="text-slate-400 italic text-[10px] bg-white p-2.5 rounded-lg border border-slate-200">
                                    No items assigned yet.
                                  </p>
                                ) : (
                                  <div className="space-y-1.5">
                                    {owed.items.map((it, idx) => (
                                      <div
                                        key={idx}
                                        className="bg-white border border-slate-200/80 rounded-lg p-2.5 flex justify-between items-center"
                                      >
                                        <div className="font-semibold text-slate-700 max-w-[70%] truncate">
                                          {it.itemName}
                                        </div>
                                        <div className="text-right font-mono text-slate-500">
                                          ${it.sharePrice.toFixed(2)}{" "}
                                          <span className="text-[9px] text-slate-300">
                                            (Total ${it.itemPrice.toFixed(2)})
                                          </span>
                                        </div>
                                      </div>
                                    ))}
                                  </div>
                                )}
                              </div>

                              {/* Math details breakdown lines of tax/tip proportions */}
                              <div className="border-t border-slate-200 my-2 pt-2.5 space-y-1 bg-white p-3 rounded-lg border border-slate-150">
                                <div className="flex justify-between text-slate-500 font-sans">
                                  <span>Food Subtotal:</span>
                                  <span className="font-mono">${owed.itemSubtotal.toFixed(2)}</span>
                                </div>
                                <div className="flex justify-between text-slate-500 font-sans">
                                  <span>Proportional Tax Share:</span>
                                  <span className="font-mono">${owed.taxShare.toFixed(2)}</span>
                                </div>
                                <div className="flex justify-between text-slate-500 font-sans">
                                  <span>Proportional Tip Share:</span>
                                  <span className="font-mono">${owed.tipShare.toFixed(2)}</span>
                                </div>
                                <div className="flex justify-between border-t border-slate-200 pt-1.5 font-bold mt-1">
                                  <span className="text-slate-700">Total Owed by {owed.name}:</span>
                                  <span className="font-mono text-indigo-600">${owed.totalOwed.toFixed(2)}</span>
                                </div>
                              </div>
                            </div>
                          </motion.div>
                        )}
                      </AnimatePresence>
                    </div>
                  );
                })
              )}
            </div>

            {/* Sticky Share and Export Controls panel */}
            {receipt && splitsBreakdown.length > 0 && (
              <div className="p-4 bg-slate-50 border-t border-slate-200 flex flex-col sm:flex-row gap-3 items-center justify-between shrink-0">
                <span className="text-xs text-slate-500 font-semibold font-sans">
                  Export & Share Report
                </span>
                <div className="flex gap-2 w-full sm:w-auto">
                  <button
                    onClick={handleCopyShareUrl}
                    className="flex-1 sm:flex-initial flex items-center justify-center space-x-1.5 px-3 py-2 bg-white hover:bg-slate-100 text-slate-700 hover:text-slate-900 border border-slate-200 rounded-xl text-xs font-bold transition-all shadow-3xs cursor-pointer select-none active:scale-95"
                    title="Copy unique link to share this split bill"
                  >
                    <Link className="w-3.5 h-3.5 text-indigo-500" />
                    <span>{copiedLink ? "Link Copied!" : "Share URL"}</span>
                  </button>
                  <button
                    onClick={() => setIsExportModalOpen(true)}
                    className="flex-1 sm:flex-initial flex items-center justify-center space-x-1.5 px-3 py-2 bg-indigo-600 hover:bg-indigo-700 text-white rounded-xl text-xs font-bold transition-all shadow-md cursor-pointer select-none active:scale-95"
                    title="Convert split bill to image or PDF document"
                  >
                    <Share2 className="w-3.5 h-3.5 text-white" />
                    <span>Export Image / PDF</span>
                  </button>
                </div>
              </div>
            )}

          </div>

        </div>

      </main>

      {/* Dynamic Export Modal Overlay */}
      {isExportModalOpen && receipt && (
        <div className="fixed inset-0 bg-slate-950/50 backdrop-blur-xs flex items-center justify-center p-4 z-50 overflow-y-auto">
          <motion.div
            initial={{ opacity: 0, scale: 0.95 }}
            animate={{ opacity: 1, scale: 1 }}
            exit={{ opacity: 0, scale: 0.95 }}
            className="bg-slate-100 rounded-2xl max-w-sm w-full overflow-hidden shadow-2xl flex flex-col max-h-[90vh]"
          >
            {/* Modal header */}
            <div className="px-5 py-3.5 bg-white border-b border-slate-200 flex items-center justify-between select-none">
              <div className="flex items-center space-x-2">
                <Share2 className="w-4 h-4 text-indigo-600" />
                <h3 className="font-bold text-slate-800 text-xs tracking-wide uppercase">Export Split Receipt</h3>
              </div>
              <button
                onClick={() => setIsExportModalOpen(false)}
                className="p-1 rounded-lg text-slate-400 hover:text-slate-600 hover:bg-slate-50 transition-all cursor-pointer"
              >
                <X className="w-5 h-5" />
              </button>
            </div>

            {/* Modal Scroll Content */}
            <div className="p-5 flex-1 overflow-y-auto flex flex-col items-center gap-6">

              {/* Thermal Paper Ticket Representation */}
              <div
                id="exportable-receipt-ticket"
                className="w-full bg-[#fcfbfa] border border-amber-100/50 rounded-xs shadow-md p-5 font-mono text-xs text-slate-800 relative max-w-[340px] leading-relaxed"
                style={{
                  boxShadow: "0 10px 25px -5px rgba(0,0,0,0.05), 0 8px 10px -6px rgba(0,0,0,0.05)"
                }}
              >
                {/* Serrated edge effect placeholder top */}
                <div className="absolute top-0 inset-x-0 h-1 bg-[linear-gradient(45deg,transparent_33.333%,#f1f0ee_33.333%,#f1f0ee_66.666%,transparent_66.666%),linear-gradient(-45deg,transparent_33.333%,#f1f0ee_33.333%,#f1f0ee_66.666%,transparent_66.666%)] bg-[size:8px_8px] -mt-1" />

                {/* Receipt header */}
                <div className="text-center space-y-1 mb-4">
                  <h4 className="text-sm font-black tracking-widest text-slate-900 uppercase">
                    *** SPLIT SMART ***
                  </h4>
                  <p className="text-[11px] text-slate-450 uppercase font-black">
                    {receipt.storeName}
                  </p>
                  <p className="text-[9px] text-slate-400 font-sans mt-1">
                    Date: {new Date().toLocaleDateString()} • {new Date().toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' })}
                  </p>
                  <div className="border-b border-dashed border-slate-300 pt-2" />
                </div>

                {/* Core Items summary directory */}
                <div className="space-y-4">

                  {/* Share item groups for each participant */}
                  {splitsBreakdown.map((owed) => (
                    <div key={owed.name} className="space-y-1 bg-white p-2 text-[11px] rounded border border-slate-200/50 shadow-3xs">
                      <div className="flex items-center justify-between font-black text-slate-900 uppercase border-b border-dashed border-slate-200 pb-1 text-[11px]">
                        <span>{owed.name}</span>
                        <span>${owed.totalOwed.toFixed(2)}</span>
                      </div>

                      {owed.items.length === 0 ? (
                        <p className="text-slate-400 italic text-[9px] p-1 text-center">No items assigned</p>
                      ) : (
                        <div className="space-y-1 text-[10px] pt-1">
                          {owed.items.map((it, idx) => (
                            <div key={idx} className="flex justify-between items-start text-slate-600 gap-2">
                              <span className="truncate max-w-[160px]">{it.itemName}</span>
                              <span className="shrink-0 text-slate-500">${it.sharePrice.toFixed(2)}</span>
                            </div>
                          ))}
                        </div>
                      )}

                      {/* Subtotal, tax and tip share detailed lines */}
                      <div className="border-t border-dashed border-slate-150 pt-1 mt-1 text-[9px] text-slate-500 flex flex-col space-y-0.5">
                        <div className="flex justify-between">
                          <span>Subtotal:</span>
                          <span>${owed.itemSubtotal.toFixed(2)}</span>
                        </div>
                        <div className="flex justify-between">
                          <span>Tax share:</span>
                          <span>${owed.taxShare.toFixed(2)}</span>
                        </div>
                        <div className="flex justify-between">
                          <span>Tip share:</span>
                          <span>${owed.tipShare.toFixed(2)}</span>
                        </div>
                      </div>
                    </div>
                  ))}

                </div>

                {/* Overall grand totals */}
                <div className="border-t border-dashed border-slate-350 pt-3 mt-4 space-y-1 text-[11px]">
                  <div className="flex justify-between text-slate-600 font-sans">
                    <span>Receipt Food Subtotal:</span>
                    <span>${receipt.subtotal.toFixed(2)}</span>
                  </div>
                  <div className="flex justify-between text-slate-600 font-sans">
                    <span>Receipt Total Tax:</span>
                    <span>${receipt.tax.toFixed(2)}</span>
                  </div>
                  <div className="flex justify-between text-slate-600 font-sans">
                    <span>Receipt Total Tip:</span>
                    <span>${receipt.tip.toFixed(2)}</span>
                  </div>
                  <div className="border-t border-slate-300 pt-2 mt-2" />
                  <div className="flex justify-between font-black text-xs text-slate-900 uppercase">
                    <span>GRAND COMBINED TOTAL:</span>
                    <span>${receipt.total.toFixed(2)}</span>
                  </div>
                </div>

                {/* Ticket footer message */}
                <div className="text-center text-[9px] text-slate-400 mt-5 space-y-1">
                  <div className="border-b border-dashed border-slate-300 mb-2" />
                  <p className="uppercase font-bold tracking-wider">THANK YOU FOR BILL SPLITTING</p>
                  <p className="font-sans italic">Powered by SplitSmart AI</p>
                </div>

                {/* Serrated edge effect placeholder bottom */}
                <div className="absolute bottom-0 inset-x-0 h-1 bg-[linear-gradient(45deg,transparent_33.333%,#f1f0ee_33.333%,#f1f0ee_66.666%,transparent_66.666%),linear-gradient(-45deg,transparent_33.333%,#f1f0ee_33.333%,#f1f0ee_66.666%,transparent_66.666%)] bg-[size:8px_8px] rotate-180 -mb-1" />
              </div>

            </div>

            {/* Modal Action Bar footer */}
            <div className="px-4 py-3 bg-white border-t border-slate-200 grid grid-cols-3 gap-2 shrink-0 select-none">
              <button
                type="button"
                onClick={handleCopyShareUrl}
                className="flex flex-col items-center justify-center p-2 rounded-xl text-slate-700 bg-slate-50 border border-slate-200 hover:bg-slate-100 hover:text-slate-900 transition-colors cursor-pointer text-center"
              >
                <Link className="w-4 h-4 text-indigo-500 mb-1" />
                <span className="text-[10px] font-bold">{copiedLink ? "Copied!" : "Copy Link"}</span>
              </button>

              <button
                type="button"
                onClick={handleExportAsImage}
                className="flex flex-col items-center justify-center p-2 rounded-xl text-slate-700 bg-slate-50 border border-slate-200 hover:bg-slate-100 hover:text-slate-900 transition-colors cursor-pointer text-center"
              >
                <Download className="w-4 h-4 text-indigo-500 mb-1" />
                <span className="text-[10px] font-bold">Save PNG</span>
              </button>

              <button
                type="button"
                onClick={handleExportAsPdf}
                className="flex flex-col items-center justify-center p-2 rounded-xl text-indigo-950 bg-indigo-50 border border-indigo-100 hover:bg-indigo-100 hover:text-indigo-900 transition-colors cursor-pointer text-center"
              >
                <FileText className="w-4 h-4 text-indigo-600 mb-1" />
                <span className="text-[10px] font-bold">Save PDF</span>
              </button>
            </div>
          </motion.div>
        </div>
      )}

      {/* Global simple footer instructions */}
      <footer className="bg-white border-t border-slate-200 py-3 text-center text-[10px] text-slate-400 select-none">
        <p className="font-medium leading-relaxed">
          Smart Receipt Bill Splitter Applet • Drag images to analyze subtotal/tax/tip • Chat interprets names and item splits intelligently.
        </p>
      </footer>
    </div>
  );
}
