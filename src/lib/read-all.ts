/** Read every API page, including projects configured with a smaller row cap.
 * Callers supply a stable ordering; id is appended as a unique tiebreaker.
 * Errors are never converted to an empty or partially populated successful list.
 */
export async function readAll<T>(query: {
  order(column: string, options: { ascending: boolean }): unknown;
  range(from: number, to: number): PromiseLike<{ data: T[] | null; error: { message: string } | null }>;
}): Promise<{ data: T[]; error: { message: string } | null }> {
  query.order("id", { ascending: true });
  const rows: T[] = [];
  for (;;) {
    const { data, error } = await query.range(rows.length, rows.length + 499);
    if (error) throw new Error(`Unable to load records: ${error.message}`);
    if (!data?.length) return { data: rows, error: null };
    rows.push(...data);
  }
}
