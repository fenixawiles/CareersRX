/**
 * Generates a plpgsql guard trigger: raises an exception when `when` holds for the affected row.
 * This is the Postgres translation of the SQLite `BEGIN SELECT RAISE(ABORT, …); END` triggers that
 * enforce CareersRX's invariants (immutability, append-only tables, citation integrity).
 *
 * `when` is a SQL boolean expression over NEW/OLD. Omitting it forbids the operation entirely.
 */
export function forbid(options: {
  name: string;
  table: string;
  operation: "INSERT" | "UPDATE" | "DELETE";
  message: string;
  when?: string;
}): string {
  const { name, table, operation, message, when } = options;
  const returning = operation === "DELETE" ? "OLD" : "NEW";
  const condition = when ?? "TRUE";
  // The exception message is embedded as a literal; escape quotes defensively.
  const literal = message.replaceAll("'", "''");
  return `
    CREATE FUNCTION trg_${name}() RETURNS trigger AS $trigger$
    BEGIN
      IF ${condition} THEN
        RAISE EXCEPTION '${literal}';
      END IF;
      RETURN ${returning};
    END
    $trigger$ LANGUAGE plpgsql;
    CREATE TRIGGER ${name}
    BEFORE ${operation} ON ${table}
    FOR EACH ROW EXECUTE FUNCTION trg_${name}();
  `;
}
