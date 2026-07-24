import ExcelJS from 'exceljs';

export default async function handler(req, res) {
  if (req.method !== 'POST') return res.status(405).json({ error: 'Método não permitido.' });
  const { sections, projectTitle, limite } = req.body;
  if (!sections || !Array.isArray(sections)) return res.status(400).json({ error: 'Dados inválidos.' });

  try {
    const wb = new ExcelJS.Workbook();
    wb.creator = 'Movie Magic';
    const ws = wb.addWorksheet('Orçamento Detalhado');

    ws.columns = [
      { width: 4 },
      { width: 8 },
      { width: 42 },
      { width: 8 },
      { width: 10 },
      { width: 18 },
      { width: 18 },
      { width: 18 },
      { width: 7 },
      { width: 7 },
      { width: 7 },
    ];

    const BRL = 'R$\\ #,##0.00';
    const FONT = 'Arial';
    const C_DARK = 'FF2C3E50';
    const C_HEADER = 'FF1A1A2E';
    const C_GREEN = 'FF1D9E75';
    const C_BLUE = 'FF185FA5';
    const C_WHITE = 'FFFFFFFF';
    const C_LIGHT = 'FFECF0F1';
    const C_MID = 'FF7F8C8D';

    function fill(color) {
      return { type: 'pattern', pattern: 'solid', fgColor: { argb: color } };
    }
    function border() {
      const s = { style: 'thin', color: { argb: 'FFD5D8DC' } };
      return { top: s, bottom: s, left: s, right: s };
    }
    function applyRow(row, bgArgb, fontArgb, bold = false, size = 9) {
      [2,3,4,5,6,7,8,9,10,11].forEach(c => {
        const cell = row.getCell(c);
        cell.fill = fill(bgArgb);
        cell.font = { name: FONT, size, bold, color: { argb: fontArgb } };
        cell.border = border();
        cell.alignment = { vertical: 'middle' };
      });
    }

    // ── BLOCO DE RESUMO (cabeçalho fixo) ─────────────────────────────────────
    // Linha 1: título
    const r1 = ws.addRow(['', '', projectTitle || 'Orçamento']);
    r1.height = 26;
    r1.getCell(3).font = { name: FONT, size: 15, bold: true, color: { argb: C_HEADER } };
    ws.mergeCells(`C1:K1`);

    // Linha 2: subtítulo
    const r2 = ws.addRow(['', '', 'ORÇAMENTO DETALHADO DE PRODUÇÃO']);
    r2.height = 16;
    r2.getCell(3).font = { name: FONT, size: 9, color: { argb: C_MID } };
    ws.mergeCells(`C2:K2`);

    // Linha 3: em branco
    ws.addRow([]).height = 8;

    // Linha 4-6: bloco de resumo financeiro
    const limiteNum = parseFloat((limite || '0').replace(/\./g, '').replace(',', '.')) || 0;

    const r4 = ws.addRow(['', 'VALOR LIMITE', '', 'ORÇADO', '', 'SALDO', '', '', '', '', '']);
    r4.height = 16;
    [2,4,6].forEach(c => {
      r4.getCell(c).font = { name: FONT, size: 8, bold: true, color: { argb: C_MID } };
      r4.getCell(c).fill = fill(C_LIGHT);
    });
    ws.mergeCells(`B4:C4`);
    ws.mergeCells(`D4:E4`);
    ws.mergeCells(`F4:H4`);

    // Referência para total geral — será calculado depois, usamos H_TOTAL placeholder
    // Linha 5: valores
    const r5 = ws.addRow(['', limiteNum || '', '', '', '', '', '', '', '', '', '']);
    r5.height = 22;
    r5.getCell(2).numFmt = BRL;
    r5.getCell(2).font = { name: FONT, size: 12, bold: true, color: { argb: C_BLUE } };
    r5.getCell(2).fill = fill(C_LIGHT);
    ws.mergeCells(`B5:C5`);

    // D5: total orçado — será uma fórmula referenciando o total geral (linha será definida depois)
    // Vamos guardar a referência para preencher depois
    r5.getCell(4).font = { name: FONT, size: 12, bold: true, color: { argb: C_GREEN } };
    r5.getCell(4).numFmt = BRL;
    r5.getCell(4).fill = fill(C_LIGHT);
    ws.mergeCells(`D5:E5`);

    // F5: saldo
    r5.getCell(6).font = { name: FONT, size: 12, bold: true };
    r5.getCell(6).numFmt = BRL;
    r5.getCell(6).fill = fill(C_LIGHT);
    ws.mergeCells(`F5:H5`);

    // Linha 6: espaço
    ws.addRow([]).height = 8;

    // ── CABEÇALHO DA TABELA ───────────────────────────────────────────────────
    const rH = ws.addRow(['', 'Nº', 'Descrição', 'Qtd', 'Unid', 'Valor unit (R$)', 'Sub-total (R$)', 'Total (R$)', 'Pré', 'Prod', 'Pós']);
    rH.height = 20;
    applyRow(rH, C_HEADER, C_WHITE, true, 9);
    [6,7,8].forEach(c => rH.getCell(c).alignment = { vertical: 'middle', horizontal: 'right' });
    [9,10,11].forEach(c => rH.getCell(c).alignment = { vertical: 'middle', horizontal: 'center' });

    // ── SEÇÕES COM FÓRMULAS ───────────────────────────────────────────────────
    const secTotalRows = []; // guarda linha de total de cada seção para fórmula de total geral

    sections.forEach(sec => {
      // Linha da seção
      const rSec = ws.addRow(['', sec.id, sec.label, '', '', '', '', '', '', '', '']);
      rSec.height = 20;
      applyRow(rSec, C_DARK, C_WHITE, true, 10);
      rSec.getCell(2).font = { name: FONT, size: 8, color: { argb: 'FFAAB7C4' }, bold: false };

      const firstItemRow = ws.rowCount + 1;

      // Itens
      sec.items.forEach((item, idx) => {
        const bg = idx % 2 === 0 ? 'FFFFFFFF' : 'FFF8F9FA';
        const rItem = ws.addRow([
          '',
          item.id,
          item.desc,
          parseFloat(item.qtd) || 0,
          item.unid,
          parseFloat(item.valor) || 0,
          '', // sub-total = fórmula
          '', // total = fórmula
          item.pre ? 'Sim' : '',
          item.prod ? 'Sim' : '',
          item.pos ? 'Sim' : '',
        ]);
        rItem.height = 17;
        applyRow(rItem, bg, C_DARK, false, 9);

        const rowNum = rItem.number;
        // Fórmula: Sub-total = Qtd * Valor unit
        rItem.getCell(7).value = { formula: `D${rowNum}*F${rowNum}` };
        rItem.getCell(7).numFmt = BRL;
        rItem.getCell(7).alignment = { vertical: 'middle', horizontal: 'right' };
        // Total = mesmo que sub-total
        rItem.getCell(8).value = { formula: `G${rowNum}` };
        rItem.getCell(8).numFmt = BRL;
        rItem.getCell(8).font = { name: FONT, size: 9, bold: true, color: { argb: C_DARK } };
        rItem.getCell(8).alignment = { vertical: 'middle', horizontal: 'right' };

        rItem.getCell(2).font = { name: FONT, size: 8, color: { argb: C_MID } };
        rItem.getCell(3).alignment = { vertical: 'middle', indent: 2 };
        rItem.getCell(4).alignment = { vertical: 'middle', horizontal: 'center' };
        rItem.getCell(5).alignment = { vertical: 'middle', horizontal: 'center' };
        rItem.getCell(6).numFmt = BRL;
        rItem.getCell(6).font = { name: FONT, size: 9, color: { argb: C_BLUE } };
        rItem.getCell(6).alignment = { vertical: 'middle', horizontal: 'right' };
        [9,10,11].forEach(c => {
          rItem.getCell(c).alignment = { vertical: 'middle', horizontal: 'center' };
          if (rItem.getCell(c).value === 'Sim') {
            rItem.getCell(c).font = { name: FONT, size: 9, color: { argb: C_GREEN } };
          }
        });
      });

      const lastItemRow = ws.rowCount;

      // Total da seção com fórmula SUM
      const rSecTotal = ws.addRow(['', '', `Total ${sec.label}`, '', '', '', '', '', '', '', '']);
      rSecTotal.height = 16;
      applyRow(rSecTotal, 'FFD9EAD3', C_DARK, true, 9);
      rSecTotal.getCell(3).alignment = { vertical: 'middle', horizontal: 'right' };
      rSecTotal.getCell(8).value = { formula: `SUM(H${firstItemRow}:H${lastItemRow})` };
      rSecTotal.getCell(8).numFmt = BRL;
      rSecTotal.getCell(8).font = { name: FONT, size: 9, bold: true, color: { argb: C_GREEN } };
      rSecTotal.getCell(8).alignment = { vertical: 'middle', horizontal: 'right' };

      secTotalRows.push(rSecTotal.number);
      ws.addRow([]).height = 4;
    });

    // ── TOTAL GERAL ───────────────────────────────────────────────────────────
    const totalFormula = secTotalRows.map(r => `H${r}`).join('+');
    const rTotal = ws.addRow(['', '', 'TOTAL GERAL', '', '', '', '', '', '', '', '']);
    rTotal.height = 26;
    applyRow(rTotal, C_GREEN, C_WHITE, true, 12);
    rTotal.getCell(3).alignment = { vertical: 'middle', horizontal: 'right' };
    rTotal.getCell(8).value = { formula: totalFormula };
    rTotal.getCell(8).numFmt = BRL;
    rTotal.getCell(8).font = { name: FONT, size: 12, bold: true, color: { argb: C_WHITE } };
    rTotal.getCell(8).alignment = { vertical: 'middle', horizontal: 'right' };

    // Agora preenche D5 e F5 com fórmulas referenciando o total geral
    ws.getRow(5).getCell(4).value = { formula: `H${rTotal.number}` };
    ws.getRow(5).getCell(6).value = { formula: limiteNum > 0 ? `B5-H${rTotal.number}` : `""` };
    if (limiteNum > 0) {
      ws.getRow(5).getCell(6).font = { name: FONT, size: 12, bold: true,
        color: { argb: C_GREEN } // será verde — Excel não suporta condicional fácil aqui
      };
    }

    // Congela cabeçalho
    ws.views = [{ state: 'frozen', xSplit: 0, ySplit: 7, activeCell: 'C8' }];

    res.setHeader('Content-Type', 'application/vnd.openxmlformats-officedocument.spreadsheetml.sheet');
    res.setHeader('Content-Disposition', `attachment; filename="orcamento_${(projectTitle || 'projeto').replace(/[^a-zA-Z0-9]/g, '_')}.xlsx"`);
    await wb.xlsx.write(res);
    res.end();

  } catch (err) {
    console.error('Erro ao exportar:', err.message);
    if (!res.headersSent) res.status(500).json({ error: err.message });
  }
}
