export function AccessibleChartSummary({ caption, columns, rows }: { caption: string; columns: (string | number)[]; rows: (string | number)[][] }) {
  return <details className="mt-4 border-t border-border pt-3">
    <summary className="cursor-pointer py-2 font-medium text-sm">查看表格数据 · {caption}</summary>
    <div className="overflow-x-auto"><table className="w-full text-left text-sm">
      <caption className="sr-only">{caption}</caption>
      <thead><tr>{columns.map((name, i) => <th key={i} scope="col" className="border-b p-2 font-semibold">{name}</th>)}</tr></thead>
      <tbody>{rows.map((row, i) => <tr key={i}>{row.map((value, j) => j === 0 ? <th key={j} scope="row" className="border-b p-2 font-medium">{value}</th> : <td key={j} className="border-b p-2 tabular-nums">{value}</td>)}</tr>)}</tbody>
    </table></div>
  </details>;
}
