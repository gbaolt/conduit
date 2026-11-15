import {
  $convertFromMarkdownString,
  $convertToMarkdownString,
  CHECK_LIST,
  ELEMENT_TRANSFORMERS,
  type ElementTransformer,
  MULTILINE_ELEMENT_TRANSFORMERS,
  TEXT_FORMAT_TRANSFORMERS,
  TEXT_MATCH_TRANSFORMERS,
  type Transformer,
} from '@lexical/markdown';
import {
  $createTableCellNode,
  $createTableNode,
  $createTableRowNode,
  $isTableCellNode,
  $isTableNode,
  $isTableRowNode,
  TableCellHeaderStates,
  TableCellNode,
  TableNode,
  TableRowNode,
} from '@lexical/table';
import {
  $createParagraphNode,
  $isParagraphNode,
  $isTextNode,
  type LexicalNode,
} from 'lexical';

// import { EMOJI } from "@/registry/new-york-v4/editor/transformers/markdown-emoji-transformer"
import { HR } from '@/components/editor/transformers/markdown-hr-transformer';
import { IMAGE } from '@/components/editor/transformers/markdown-image-transformer';

// import { TWEET } from "@/registry/new-york-v4/editor/transformers/markdown-tweet-transformer"

const TABLE_ROW_REG_EXP = /^(?:\|)(.+)(?:\|)\s?$/;
const TABLE_ROW_DIVIDER_REG_EXP = /^(\| ?:?-*:? ?)+\|\s?$/;

const OTHER_MARKDOWN_TRANSFORMERS = [
  HR,
  IMAGE,
  // EMOJI,
  // TWEET,
  CHECK_LIST,
  ...ELEMENT_TRANSFORMERS,
  ...MULTILINE_ELEMENT_TRANSFORMERS,
  ...TEXT_FORMAT_TRANSFORMERS,
  ...TEXT_MATCH_TRANSFORMERS,
];

/**
 * A GFM table. Each cell's Markdown is read and written with `cellTransformers`. The first row is the
 * header, since GFM has no table without one. A cell holds one line, so its line breaks become spaces and
 * its pipes are escaped.
 */
export function createTableTransformer(
  cellTransformers: Transformer[]
): ElementTransformer {
  const $createTableCell = (markdown: string): TableCellNode => {
    const cell = $createTableCellNode(TableCellHeaderStates.NO_STATUS);
    $convertFromMarkdownString(
      markdown.trim().replace(/\\\|/g, '|'),
      cellTransformers,
      cell
    );
    return cell;
  };

  const mapToTableCells = (textContent: string): TableCellNode[] | null => {
    const match = textContent.match(TABLE_ROW_REG_EXP);
    if (!match?.[1]) return null;
    return match[1].split(/(?<!\\)\|/).map($createTableCell);
  };

  return {
    dependencies: [TableNode, TableRowNode, TableCellNode],
    export: (node: LexicalNode) => {
      if (!$isTableNode(node)) return null;

      const output: string[] = [];
      for (const row of node.getChildren()) {
        if (!$isTableRowNode(row)) continue;

        const cells = row
          .getChildren()
          .filter($isTableCellNode)
          .map((cell) =>
            $convertToMarkdownString(cellTransformers, cell)
              .replace(/\s*\n\s*/g, ' ')
              .replace(/(?<!\\)\|/g, '\\|')
          );
        output.push(`| ${cells.join(' | ')} |`);
        if (output.length === 1) {
          output.push(`| ${cells.map(() => '---').join(' | ')} |`);
        }
      }

      return output.join('\n');
    },
    regExp: TABLE_ROW_REG_EXP,
    replace: (parentNode, _children, match, isImport) => {
      const rowText = match[0];
      if (rowText === undefined) return;

      if (TABLE_ROW_DIVIDER_REG_EXP.test(rowText)) {
        const table = parentNode.getPreviousSibling();
        if (!$isTableNode(table)) return;

        const lastRow = table.getLastChild();
        if (!$isTableRowNode(lastRow)) return;

        lastRow.getChildren().forEach((cell) => {
          if ($isTableCellNode(cell)) {
            cell.setHeaderStyles(
              TableCellHeaderStates.ROW,
              TableCellHeaderStates.ROW
            );
          }
        });
        parentNode.remove();
        if (!isImport) $ensureLineAfter(table).selectEnd();
        return;
      }

      const matchCells = mapToTableCells(rowText);
      if (matchCells == null) return;

      const rows = [matchCells];
      let sibling = parentNode.getPreviousSibling();
      let maxCells = matchCells.length;

      while ($isParagraphNode(sibling) && sibling.getChildrenSize() === 1) {
        const firstChild = sibling.getFirstChild();
        if (!$isTextNode(firstChild)) break;

        const cells = mapToTableCells(firstChild.getTextContent());
        if (cells == null) break;

        maxCells = Math.max(maxCells, cells.length);
        rows.unshift(cells);
        const previousSibling = sibling.getPreviousSibling();
        sibling.remove();
        sibling = previousSibling;
      }

      const table = $createTableNode();
      for (const cells of rows) {
        const tableRow = $createTableRowNode();
        table.append(tableRow);
        for (let i = 0; i < maxCells; i++) {
          tableRow.append(cells[i] ?? $createTableCell(''));
        }
      }

      const previousSibling = parentNode.getPreviousSibling();
      let target = table;
      if (
        $isTableNode(previousSibling) &&
        getTableColumnsSize(previousSibling) === maxCells
      ) {
        previousSibling.append(...table.getChildren());
        parentNode.remove();
        target = previousSibling;
      } else {
        parentNode.replace(table);
      }

      if (!isImport) $ensureLineAfter(target).selectEnd();
    },
    type: 'element',
  };
}

/** A table typed with a shortcut needs a line after it, for the next row or the rest of the message. The caret goes there. */
function $ensureLineAfter(table: TableNode) {
  const next = table.getNextSibling();
  if (next) return next;
  const line = $createParagraphNode();
  table.insertAfter(line);
  return line;
}

export const TABLE = createTableTransformer(OTHER_MARKDOWN_TRANSFORMERS);

function getTableColumnsSize(table: TableNode) {
  const row = table.getFirstChild();
  return $isTableRowNode(row) ? row.getChildrenSize() : 0;
}
