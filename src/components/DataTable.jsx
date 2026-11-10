import { Empty } from './UI';

/**
 * columns: [{ key, label, render?(row), className? }]
 * Renders a table on desktop; CSS converts rows to cards on mobile using data-label.
 */
export default function DataTable({ columns, rows, actions, empty = 'No records' }) {
  if (!rows.length) return <Empty text={empty} />;
  return (
    <div className="table-wrap">
      <table className="dt">
        <thead>
          <tr>
            {columns.map((c) => <th key={c.key} className={c.className}>{c.label}</th>)}
            {actions && <th className="right">Actions</th>}
          </tr>
        </thead>
        <tbody>
          {rows.map((r) => (
            <tr key={r.id}>
              {columns.map((c) => (
                <td key={c.key} data-label={c.label} className={c.className}>
                  {c.render ? c.render(r) : r[c.key]}
                </td>
              ))}
              {actions && <td className="right dt-actions" data-label="">{actions(r)}</td>}
            </tr>
          ))}
        </tbody>
      </table>
    </div>
  );
}
