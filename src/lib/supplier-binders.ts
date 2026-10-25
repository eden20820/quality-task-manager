export type SupplierBinderEntry = {
  id?: string;
  name: string;
  aliases?: readonly string[];
  supplierId?: string | null;
  sortOrder?: number;
};

export type SupplierBinder = {
  id: string;
  label: string;
  sortOrder: number;
  suppliers: readonly SupplierBinderEntry[];
};

export type SupplierBinderRecord = {
  id: string;
  supplier_name: string;
  status: string;
  expiration_date: string | null;
};

export const supplierBinders: readonly SupplierBinder[] = [
  {
    id: "binder-1",
    label: "I",
    sortOrder: 1,
    suppliers: [
      { name: "WURTH" },
      { name: "טכנו-דורג" },
      { name: "אל.די.אר טכנולוגיות" },
      { name: "Plastomold" },
      { name: "har-zion" },
      { name: "אילון את גביש" },
      { name: "סרמט בע״מ" },
    ],
  },
  {
    id: "binder-2",
    label: "II",
    sortOrder: 2,
    suppliers: [
      { name: "אירוסל" },
      { name: "אורגת סחר" },
      { name: "טכנו עד" },
      { name: "פלונטר טכנולוגיות" },
      { name: "GalBoreg" },
      { name: "Jetlazer" },
      { name: "Rotal" },
      { name: "Decostop" },
      { name: "bental motian systems" },
      { name: "קפיצי בוחבוט אשגם בע״מ" },
    ],
  },
  {
    id: "binder-3",
    label: "III",
    sortOrder: 3,
    suppliers: [
      { name: "CHEMSOL" },
      { name: "WINEXT" },
      { name: "גדעון שמיים" },
      { name: "גבריאל-טק" },
      { name: "Tarantula" },
      { name: "DIGIKEY" },
      { name: "ברקוד סנטר" },
      { name: "גוטמן ברזילי" },
      { name: "AMRON" },
      { name: "MASTERAN LTD" },
      { name: "Shenzhen Tianzhi" },
    ],
  },
  {
    id: "binder-4b",
    label: "IV-B",
    sortOrder: 4,
    suppliers: [
      { name: "Sampling systems" },
      { name: "HLH" },
      { name: "סקופ מתכות" },
      { name: "Nautec", aliases: ["נאוטק", "נאותק"] },
    ],
  },
  {
    id: "binder-5",
    label: "V",
    sortOrder: 5,
    suppliers: [
      { name: "סטילקוט" },
      { name: "Bladtech" },
      { name: "SMC" },
      { name: "בנבנית" },
      { name: "JMI" },
      { name: "PCB Way" },
    ],
  },
  {
    id: "binder-6b",
    label: "VI-B",
    sortOrder: 6,
    suppliers: [
      { name: "וולפסון סיליקון" },
      { name: "Breton" },
      { name: "Mouser" },
      { name: "Reefs RC" },
      { name: "תמיר ערן הנדסה" },
    ],
  },
  {
    id: "binder-7b",
    label: "VII-B",
    sortOrder: 7,
    suppliers: [
      { name: "LMI" },
      { name: "אלון טכנולוגיות" },
      { name: "דגות" },
      { name: "CONLOG" },
      { name: "מאי" },
      { name: "עולם הרפואה" },
      { name: "שמיר" },
      { name: "Marchton" },
      { name: "AMI" },
      { name: "עמוס גזית" },
      { name: "זיטק" },
      { name: "3M" },
      { name: "DoorNet", aliases: ["Door Net"] },
    ],
  },
  {
    id: "binder-8b",
    label: "VIII-B",
    sortOrder: 8,
    suppliers: [
      { name: "Poseidon" },
      { name: "Alconox" },
      { name: "Wirtheim" },
      { name: "FLIR" },
      { name: "רומיכל" },
      { name: "ליליטק" },
      { name: "3M" },
      { name: "TTI" },
      { name: "Door Net", aliases: ["DoorNet"] },
    ],
  },
] as const;

const FINAL_HEBREW_LETTERS: Record<string, string> = {
  ך: "כ",
  ם: "מ",
  ן: "נ",
  ף: "פ",
  ץ: "צ",
};

const HEBREW_TO_LATIN: Record<string, string> = {
  א: "a", ב: "b", ג: "g", ד: "d", ה: "h", ו: "o", ז: "z", ח: "h", ט: "t", י: "i",
  כ: "k", ל: "l", מ: "m", נ: "n", ס: "s", ע: "a", פ: "p", צ: "ts", ק: "k", ר: "r", ש: "sh", ת: "t",
};

export function normalizeSupplierName(value: string) {
  return value
    .normalize("NFKD")
    .toLocaleLowerCase("he-IL")
    .replace(/[\u0591-\u05C7]/g, "")
    .replace(/[ךםןףץ]/g, (letter) => FINAL_HEBREW_LETTERS[letter] ?? letter)
    .replace(/[^a-z0-9\u05d0-\u05ea]+/g, "");
}

export function transliterateSupplierName(value: string) {
  return normalizeSupplierName(value).replace(/[\u05d0-\u05ea]/g, (letter) => HEBREW_TO_LATIN[letter] ?? letter);
}

function levenshtein(left: string, right: string) {
  if (left === right) return 0;
  if (!left.length) return right.length;
  if (!right.length) return left.length;

  let previous = Array.from({ length: right.length + 1 }, (_, index) => index);
  for (let leftIndex = 1; leftIndex <= left.length; leftIndex += 1) {
    const current = [leftIndex];
    for (let rightIndex = 1; rightIndex <= right.length; rightIndex += 1) {
      current[rightIndex] = Math.min(
        current[rightIndex - 1] + 1,
        previous[rightIndex] + 1,
        previous[rightIndex - 1] + (left[leftIndex - 1] === right[rightIndex - 1] ? 0 : 1),
      );
    }
    previous = current;
  }
  return previous[right.length];
}

export function supplierNameScore(query: string, candidate: string) {
  const normalizedQuery = normalizeSupplierName(query);
  const normalizedCandidate = normalizeSupplierName(candidate);
  if (!normalizedQuery || !normalizedCandidate) return 0;
  const pairs = [
    [normalizedQuery, normalizedCandidate],
    [transliterateSupplierName(query), transliterateSupplierName(candidate)],
  ];
  let best = 0;
  for (const [left, right] of pairs) {
    if (left === right) return 100;
    if (right.includes(left) || left.includes(right)) best = Math.max(best, 92);
    const longest = Math.max(left.length, right.length);
    best = Math.max(best, Math.round((1 - levenshtein(left, right) / longest) * 90));
  }
  return best;
}

export function entrySearchScore(query: string, entry: SupplierBinderEntry) {
  return Math.max(...[entry.name, ...(entry.aliases ?? [])].map((candidate) => supplierNameScore(query, candidate)));
}

export function isSupplierSearchMatch(query: string, entry: SupplierBinderEntry) {
  const length = normalizeSupplierName(query).length;
  if (!length) return true;
  const minimumScore = length <= 2 ? 92 : length === 3 ? 82 : length === 4 ? 72 : 62;
  return entrySearchScore(query, entry) >= minimumScore;
}

export function findSupplierRecord(entry: SupplierBinderEntry, suppliers: readonly SupplierBinderRecord[]) {
  if (entry.supplierId) {
    return suppliers.find((supplier) => supplier.id === entry.supplierId) ?? null;
  }
  let best: { supplier: SupplierBinderRecord; score: number } | null = null;
  let secondScore = 0;

  for (const supplier of suppliers) {
    const score = Math.max(
      supplierNameScore(entry.name, supplier.supplier_name),
      ...(entry.aliases ?? []).map((alias) => supplierNameScore(alias, supplier.supplier_name)),
    );
    if (!best || score > best.score) {
      secondScore = best?.score ?? 0;
      best = { supplier, score };
    } else if (score > secondScore) {
      secondScore = score;
    }
  }

  if (!best) return null;
  const certain = best.score >= 92 || (best.score >= 72 && best.score - secondScore >= 8);
  return certain ? best.supplier : null;
}
