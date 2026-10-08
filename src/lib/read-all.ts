/** Read every API page, including projects configured with a smaller row cap.
 * Callers supply a stable ordering; unique key columns are appended as tiebreakers.
 * Tables with compound keys can override the default id column.
 * Errors are never converted to an empty or partially populated successful list.
 */
export async function readAll<T>(query: {
  order(column: string, options: { ascending: boolean }): unknown;
  range(from: number, to: number): PromiseLike<{ data: T[] | null; error: { message: string } | null }>;
}, uniqueKey: readonly string[] = ["id"]): Promise<{ data: T[]; error: { message: string } | null }> {
  for (const column of uniqueKey) query.order(column, { ascending: true });
  const rows: T[] = [];
  for (;;) {
    const { data, error } = await query.range(rows.length, rows.length + 499);
    if (error) throw new Error(`Unable to load records: ${error.message}`);
    if (!data?.length) return { data: rows, error: null };
    rows.push(...data);
  }
}
