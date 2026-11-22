export type Bind = string | number | null;

export async function run(db: D1Database, sql: string, ...args: Bind[]) {
  return db.prepare(sql).bind(...args).run();
}

export async function first<T = Record<string, unknown>>(db: D1Database, sql: string, ...args: Bind[]): Promise<T | null> {
  return db.prepare(sql).bind(...args).first<T>();
}

export async function all<T = Record<string, unknown>>(db: D1Database, sql: string, ...args: Bind[]): Promise<T[]> {
  return (await db.prepare(sql).bind(...args).all<T>()).results;
}
