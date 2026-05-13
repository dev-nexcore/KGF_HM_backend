import ExcelJS from 'exceljs';
import path from 'path';
import { fileURLToPath } from 'url';

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);

// ── Item code shortcuts (for naming) ────────────────────────────────────────
const itemCode = {
  'BEDS': 'B', 'MATTRESSES': 'M', 'MATTRESSES COVERS': 'MC',
  'CUPBOARDS': 'C', 'FANS': 'FN', 'TUBE LIGHTS': 'TL',
  'Bulb': 'BL', 'CURTAINS(Set)': 'CT', 'SHOE RACKS': 'SR',
  'Panels': 'PL', 'Carpets': 'CP', 'Dust Bin': 'DB',
  'Steel Table': 'ST', 'Microwave': 'MW', 'Hot Plate': 'HP',
  'Fridge': 'FG', 'Washing Machine': 'WM', 'Inverter': 'INV',
  'Batteries': 'BAT', 'Stabilizers': 'STB', 'Exhaust Fan': 'EF',
  'Chairs': 'CH', 'Routers': 'RT', 'CCTV Camera': 'CCTV',
  'TV': 'TV', 'Computer': 'COM', 'Mobile': 'MOB',
};

// ── Category mapping ────────────────────────────────────────────────────────
const categoryMap = {
  'BEDS': 'BEDS', 'MATTRESSES': 'MATTRESSES', 'MATTRESSES COVERS': 'MATTRESSES COVERS',
  'CUPBOARDS': 'CUPBOARDS', 'FANS': 'FANS', 'TUBE LIGHTS': 'TUBE LIGHTS',
  'Bulb': 'Bulb', 'CURTAINS(Set)': 'CURTAINS(Set)', 'SHOE RACKS': 'SHOE RACKS',
  'Panels': 'Panels', 'Carpets': 'Carpets', 'Dust Bin': 'Dust Bin',
  'Steel Table': 'Steel Table', 'Microwave': 'Microwave', 'Hot Plate': 'Hot Plate',
  'Fridge': 'Fridge', 'Washing Machine': 'Washing Machine', 'Inverter': 'Inverter',
  'Batteries': 'Batteries', 'Stabilizers': 'Stabilizers', 'Exhaust Fan': 'Exhaust Fan',
  'Chairs': 'Chairs', 'Routers': 'Routers', 'CCTV Camera': 'CCTV Camera',
  'TV': 'TV', 'Computer': 'Computer', 'Mobile': 'Mobile',
};

// ── Location short codes (for non-room item naming) ─────────────────────────
const locationCode = {
  'Gym': 'GYM', 'Prayer Room': 'PR', 'Kitchen Room': 'KR',
  'Dining Room': 'DR', 'Study Room': 'STD', 'Conference Room': 'CR',
  'Store Room': 'STOR', 'Washing Machine Area': 'WMA',
  'Corridor-1st Floor': 'C1', 'Corridor-2nd Floor': 'C2', 'Corridor-3rd Floor': 'C3',
  'Wash Rooms': 'WR', 'Ground Floor': 'GF', 'Terrace': 'TER',
};

// ── Room definitions ─────────────────────────────────────────────────────────
const ROOMS = [102,103,104,105,106,107,108,109,110,201,202,203,204,205,206,207,208,209,210];
const getFloor = (r) => r >= 200 ? '2' : '1';

// ── Matrix data [per room in order of ROOMS array] ───────────────────────────
const roomMatrix = {
  'BEDS':              [5,5,5,4,4,4,3,3,1,5,5,5,5,4,4,4,3,3,3],
  'MATTRESSES':        [5,5,5,4,4,4,3,3,1,5,5,5,5,4,4,4,3,3,3],
  'MATTRESSES COVERS': [5,5,5,4,4,4,3,3,1,5,5,5,5,4,4,4,3,3,3],
  'CUPBOARDS':         [5,5,5,4,4,4,3,3,2,5,5,5,5,4,4,4,3,3,3],
  'FANS':              [3,3,3,2,2,2,2,2,2,3,3,3,3,2,2,2,2,2,2],
  'TUBE LIGHTS':       [3,3,3,2,2,2,2,2,2,3,3,3,3,2,2,2,2,2,2],
  'CURTAINS(Set)':     [1,1,1,1,1,1,0,0,0,1,1,1,1,1,1,1,0,0,0],
  'SHOE RACKS':        [1,1,1,1,1,1,1,1,1,1,1,1,1,1,1,1,1,1,1],
  'Stabilizers':       [0,0,0,0,0,0,0,0,1,0,0,0,0,0,0,0,0,0,0],
  'Exhaust Fan':       [0,0,1,1,1,0,0,0,0,0,0,0,0,0,0,0,1,1,1],
  'TV':                [0,0,0,0,0,0,0,1,0,0,0,0,0,0,0,0,0,0,0],
  'Computer':          [0,0,0,0,0,0,0,1,0,0,0,0,0,0,0,0,0,0,0],
  'Mobile':            [0,0,0,0,0,0,0,1,0,0,0,0,0,0,0,0,0,0,0],
};

// ── Non-room location data ────────────────────────────────────────────────────
const locationMatrix = {
  'Gym':                { 'FANS': 4, 'TUBE LIGHTS': 1, 'Panels': 6, 'CCTV Camera': 1 },
  'Prayer Room':        { 'FANS': 1, 'Panels': 4, 'Carpets': 1, 'CCTV Camera': 1 },
  'Kitchen Room':       { 'FANS': 1, 'TUBE LIGHTS': 1, 'Bulb': 1, 'Steel Table': 2, 'Microwave': 2, 'Hot Plate': 3, 'Fridge': 2, 'Stabilizers': 2, 'Exhaust Fan': 1, 'CCTV Camera': 1 },
  'Dining Room':        { 'FANS': 3, 'TUBE LIGHTS': 1, 'Panels': 8, 'Steel Table': 2, 'Microwave': 2, 'Stabilizers': 2, 'Chairs': 24, 'CCTV Camera': 1 },
  'Study Room':         { 'FANS': 4, 'TUBE LIGHTS': 6, 'Exhaust Fan': 2, 'Chairs': 24, 'CCTV Camera': 1 },
  'Conference Room':    { 'BEDS': 3, 'MATTRESSES': 3, 'MATTRESSES COVERS': 3, 'CUPBOARDS': 3, 'FANS': 2, 'TUBE LIGHTS': 2, 'Exhaust Fan': 1 },
  'Store Room':         { 'Panels': 2, 'Stabilizers': 2, 'Washing Machine': 3 },
  'Washing Machine Area': { 'FANS': 1, 'Panels': 3 },
  'Corridor-1st Floor': { 'TUBE LIGHTS': 6, 'Fridge': 1, 'Inverter': 1, 'Batteries': 2, 'Stabilizers': 3, 'Routers': 1, 'CCTV Camera': 4 },
  'Corridor-2nd Floor': { 'TUBE LIGHTS': 6, 'Fridge': 1, 'Inverter': 1, 'Batteries': 2, 'Stabilizers': 1, 'Routers': 1, 'CCTV Camera': 4 },
  'Corridor-3rd Floor': { 'TUBE LIGHTS': 6, 'Inverter': 1, 'Batteries': 2, 'Stabilizers': 1, 'Routers': 1, 'CCTV Camera': 3 },
  'Wash Rooms':         { 'Exhaust Fan': 14 },
  'Ground Floor':       { 'TUBE LIGHTS': 6, 'CCTV Camera': 4 },
  'Terrace':            { 'TUBE LIGHTS': 5, 'CCTV Camera': 3 },
};

// ── Build rows ────────────────────────────────────────────────────────────────
const rows = [];

// From room matrix — item name: {roomNo}-{code}{n}  e.g. 102-B1
for (const [item, quantities] of Object.entries(roomMatrix)) {
  for (let i = 0; i < ROOMS.length; i++) {
    const qty = quantities[i];
    if (!qty || qty === 0) continue;
    const room = ROOMS[i];
    const floor = getFloor(room);
    const code = itemCode[item] || item.substring(0, 3).toUpperCase();
    for (let q = 0; q < qty; q++) {
      const name = `${room}-${code}${q + 1}`;   // e.g. 102-B1, 102-B2
      rows.push([name, categoryMap[item] || 'General', `Room No ${room}`, 'Available', String(room), floor, '', '', '']);
    }
  }
}

// From non-room locations — item name: {locCode}-{itemCode}{n}  e.g. GYM-FN1
for (const [location, items] of Object.entries(locationMatrix)) {
  const locCode = locationCode[location] || location.substring(0, 3).toUpperCase();
  for (const [item, qty] of Object.entries(items)) {
    if (!qty || qty === 0) continue;
    const code = itemCode[item] || item.substring(0, 3).toUpperCase();
    for (let q = 0; q < qty; q++) {
      const name = `${locCode}-${code}${q + 1}`;  // e.g. GYM-FN1, GYM-FN2
      rows.push([name, categoryMap[item] || 'General', location, 'Available', '', '', '', '', '']);
    }
  }
}

// ── Write Excel ───────────────────────────────────────────────────────────────
const workbook = new ExcelJS.Workbook();
const ws = workbook.addWorksheet('Inventory');

// Header
const headerRow = ws.addRow(['Item Name', 'Category', 'Location', 'Status', 'Room No', 'Floor', 'Description', 'Purchase Date', 'Purchase Cost']);
headerRow.eachCell(cell => {
  cell.font = { bold: true, color: { argb: 'FFFFFF' } };
  cell.fill = { type: 'pattern', pattern: 'solid', fgColor: { argb: '366092' } };
  cell.border = { top: { style: 'thin' }, left: { style: 'thin' }, bottom: { style: 'thin' }, right: { style: 'thin' } };
  cell.alignment = { horizontal: 'center' };
});

// Data
for (const r of rows) {
  ws.addRow(r);
}

ws.columns = [
  { width: 18 }, { width: 15 }, { width: 24 }, { width: 13 },
  { width: 10 }, { width: 7 }, { width: 20 }, { width: 15 }, { width: 14 }
];

const outPath = path.join(__dirname, '..', 'inventory_bulk_upload.xlsx');
await workbook.xlsx.writeFile(outPath);

console.log(`\n✅ Excel file generated: ${outPath}`);
console.log(`📦 Total rows: ${rows.length}`);
