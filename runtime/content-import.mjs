// Shared, side-effect-free CSV/TSV contract for the workbench and its public prototype.
export const CONTENT_IMPORT_MAX_BYTES = 1024 * 1024;
export const CONTENT_IMPORT_MAX_ROWS = 500;
export const CONTENT_IMPORT_HEADERS = Object.freeze(['正文', '作者', '作品 / 出处', '内容类型']);

export function contentImportTemplate() {
  return `\ufeff${CONTENT_IMPORT_HEADERS.join(',')}\r\n`;
}

export function contentImportKey({ text, author = '', work = '' }) {
  return `${String(text).replace(/[\s％＆＠＋－＝／＼｜，。！？；：、（）《》〈〉「」『』【】〔〕“”‘’…—·～]/g, '')}|${String(author || '').trim()}|${String(work || '').trim()}`;
}

const invalid = message => Object.assign(new Error(message), { code: 'CONTENT_IMPORT_INVALID', status: 400 });
const normalizeText = value => value.replace(/\r\n?/g, '\n').replace(/[\u200b-\u200f\ufeff]/g, '').trim();
const aliases = new Map([
  ['正文', 'text'], ['正文(必填)', 'text'], ['正文（必填）', 'text'], ['text', 'text'],
  ['作者', 'author'], ['author', 'author'], ['作者署名', 'author'],
  ['作品/出处', 'work'], ['作品', 'work'], ['出处', 'work'], ['work', 'work'], ['source', 'work'],
  ['内容类型', 'category'], ['类型', 'category'], ['分类', 'category'], ['category', 'category'],
]);

function records(text, delimiter) {
  const result = [];
  let cells = [], cell = '', line = 1, startLine = 1, quoted = false, closedQuote = false;
  const finishCell = () => { cells.push(cell); cell = ''; closedQuote = false; };
  const finishRecord = () => {
    finishCell();
    if (cells.some(value => value.trim())) {
      result.push({ rowNumber: startLine, cells });
      if (result.length > CONTENT_IMPORT_MAX_ROWS + 1) throw invalid(`每次最多导入 ${CONTENT_IMPORT_MAX_ROWS} 条，请拆分文件后重试。`);
    }
    cells = [];
  };
  for (let index = 0; index < text.length; index++) {
    const char = text[index];
    if (quoted) {
      if (char === '"') {
        if (text[index + 1] === '"') { cell += '"'; index++; }
        else { quoted = false; closedQuote = true; }
      } else if (char === '\r' || char === '\n') {
        if (char === '\r' && text[index + 1] === '\n') index++;
        cell += '\n'; line++;
      } else cell += char;
      continue;
    }
    if (char === delimiter) { finishCell(); continue; }
    if (char === '\r' || char === '\n') {
      if (char === '\r' && text[index + 1] === '\n') index++;
      finishRecord(); line++; startLine = line; continue;
    }
    if (closedQuote) {
      if (char === ' ' || char === '\t') continue;
      throw invalid(`第 ${line} 行的引号后有多余字符，请检查分隔符。`);
    }
    if (char === '"') {
      if (cell) throw invalid(`第 ${line} 行的引号位置不正确；包含引号的单元格请用双引号包围，并将内部引号写成两个双引号。`);
      quoted = true;
    } else cell += char;
  }
  if (quoted) throw invalid(`第 ${startLine} 行开始的单元格缺少结束引号。`);
  if (cell || cells.length || closedQuote) finishRecord();
  return result;
}

export function parseContentImport(text, { format = 'csv' } = {}) {
  if (typeof text !== 'string') throw invalid('请先选择文件或粘贴带表头的内容。');
  if (!['csv', 'tsv'].includes(format)) throw invalid('仅支持 CSV 或制表符分隔的表格文本。');
  if (text.length > CONTENT_IMPORT_MAX_BYTES || new TextEncoder().encode(text).byteLength > CONTENT_IMPORT_MAX_BYTES) throw invalid('导入内容不能超过 1 MiB，请拆分文件后重试。');
  if (/[\u0000\ufffd\ufffe]/u.test(text)) throw invalid('文件编码无法识别，请在 Excel/WPS 中另存为 CSV UTF-8 后重试。');
  const parsed = records(text.replace(/^\ufeff/, ''), format === 'tsv' ? '\t' : ',');
  if (!parsed.length) throw invalid('文件为空，请保留模板表头并填写内容。');
  const columns = parsed[0].cells.map(value => aliases.get(value.trim().replace(/\s/g, '').toLowerCase()));
  if (columns.some(value => !value)) throw invalid('表头无法识别，请使用模板中的“正文、作者、作品 / 出处、内容类型”。');
  if (new Set(columns).size !== columns.length) throw invalid('表头存在重复列，请每个字段只保留一列。');
  if (!columns.includes('text')) throw invalid('缺少“正文”列，请使用导入模板并保留表头。');
  const rows = parsed.slice(1).map(({ rowNumber, cells }) => {
    const record = { text: '', author: '', work: '', category: '' }, issues = [];
    columns.forEach((key, index) => { record[key] = key === 'text' ? normalizeText(cells[index] || '') : (cells[index] || '').trim(); });
    if (cells.length !== columns.length) issues.push(`本行有 ${cells.length} 列，表头有 ${columns.length} 列；请检查逗号或制表符。`);
    const length = [...record.text].length;
    if (length < 4 || length > 240) issues.push(`正文须为 4–240 字（当前 ${length} 字）。`);
    if ([...record.author].length > 45) issues.push('作者不能超过 45 字。');
    if ([...(record.author + record.work)].length > 90) issues.push('作者与作品 / 出处合计不能超过 90 字。');
    if ([...record.category].length > 20) issues.push('内容类型不能超过 20 字。');
    if (/[\u0001-\u0008\u000b\u000c\u000e-\u001f\u007f]/u.test(record.text) || [record.author, record.work, record.category].some(value => /[\u0001-\u001f\u007f]/u.test(value))) issues.push('含有不可用的控制字符；仅正文支持单元格内换行。');
    if (Object.values(record).some(value => /[\ud800-\udbff](?![\udc00-\udfff])|(?<![\ud800-\udbff])[\udc00-\udfff]/u.test(value))) issues.push('含有不完整的 Unicode 字符，请重新复制原文。');
    record.category ||= '散文';
    return { rowNumber, record, issues };
  });
  return { rows, total: rows.length };
}
