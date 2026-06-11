export const PALETTE = [
  { fill: '#fef3c7', stroke: '#d97706' },
  { fill: '#dbeafe', stroke: '#2563eb' },
  { fill: '#dcfce7', stroke: '#16a34a' },
  { fill: '#fce7f3', stroke: '#db2777' },
  { fill: '#ede9fe', stroke: '#7c3aed' },
  { fill: '#ffedd5', stroke: '#ea580c' },
  { fill: '#ecfdf5', stroke: '#059669' },
  { fill: '#fdf4ff', stroke: '#9333ea' },
];

// Shelf-packing (guilhotina) para chapas com múltiplas SKUs.
// Retorna placements e a quantidade de chapas necessárias.
export function packSheets(sheet, refilo, espac, pieces) {
  const blanks = [];
  pieces.forEach(p => {
    for (let i = 0; i < p.Q; i++)
      blanks.push({ w: p.des, h: p.C, fill: p.fill, stroke: p.stroke, label: p.label });
  });

  // Área decrescente — peças maiores primeiro
  blanks.sort((a, b) => b.w * b.h - a.w * a.h);

  const placements = [];
  const unplaced   = [];
  // Cada chapa tem uma lista de faixas: { y, height, nextX }
  const sheetShelves = [[]];

  function tryPlace(si, blank) {
    const shelves = sheetShelves[si];
    const tries = [{ w: blank.w, h: blank.h }];
    if (blank.w !== blank.h) tries.push({ w: blank.h, h: blank.w });

    // Tentar encaixar em faixa existente
    for (const shelf of shelves) {
      for (const { w, h } of tries) {
        if (h <= shelf.height && shelf.nextX + w <= sheet.w - refilo) {
          placements.push({ si, x: shelf.nextX, y: shelf.y, w, h, fill: blank.fill, stroke: blank.stroke, label: blank.label });
          shelf.nextX += w + espac;
          return true;
        }
      }
    }

    // Abrir nova faixa
    const newY = shelves.length
      ? shelves[shelves.length - 1].y + shelves[shelves.length - 1].height + espac
      : refilo;

    for (const { w, h } of tries) {
      if (newY + h <= sheet.h - refilo && w <= sheet.w - 2 * refilo) {
        shelves.push({ y: newY, height: h, nextX: refilo + w + espac });
        placements.push({ si, x: refilo, y: newY, w, h, fill: blank.fill, stroke: blank.stroke, label: blank.label });
        return true;
      }
    }
    return false;
  }

  for (const blank of blanks) {
    let placed = false;
    for (let i = 0; i < sheetShelves.length; i++) {
      if (tryPlace(i, blank)) { placed = true; break; }
    }
    if (!placed) {
      sheetShelves.push([]);
      if (!tryPlace(sheetShelves.length - 1, blank)) unplaced.push(blank);
    }
  }

  return { placements, sheetCount: sheetShelves.length, unplaced, sheetShelves };
}
