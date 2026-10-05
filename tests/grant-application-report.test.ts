import assert from "node:assert/strict";
import { test } from "node:test";
import { type SQL } from "drizzle-orm";
import { PgDialect } from "drizzle-orm/pg-core";
import postgres from "postgres";
import { buildWeeklyReport } from "../server/reporting";

const dateAtBoundary = (date: string, endOfDay = false) => {
  const result = new Date(date);
  result.setHours(endOfDay ? 23 : 0, endOfDay ? 59 : 0, endOfDay ? 59 : 0, endOfDay ? 999 : 0);
  return result;
};

const dateAtHour = (date: string, hour: number) => {
  const result = new Date(date);
  result.setHours(hour, 0, 0, 0);
  return result;
};

const databaseUrl = process.env.TEST_DATABASE_URL;

test(
  "grant application reports count only Applied applications in every period",
  {
    skip: databaseUrl ? false : "Set TEST_DATABASE_URL to run the PostgreSQL report regression test",
  },
  async () => {
    const client = postgres(databaseUrl!, { max: 1 });
    const rollback = new Error("Rollback test transaction");
    const schemaName = `report_test_${process.pid}_${Date.now()}`;
    const currentStart = dateAtBoundary("2025-06-10");
    const currentEnd = dateAtBoundary("2025-06-12", true);
    const previousStart = dateAtBoundary("2025-06-01");
    const previousEnd = dateAtBoundary("2025-06-03", true);
    const monthOnlyDate = dateAtHour("2025-06-05", 12);
    const currentMiddle = dateAtHour("2025-06-11", 12);
    const previousMiddle = dateAtHour("2025-06-02", 12);
    const nonAppliedStatuses = ["In Progress", "Under Review", "Accepted", "Rejected"];

    const records = [
      { status: "Applied", appliedAt: currentStart },
      { status: "Applied", appliedAt: currentEnd },
      ...nonAppliedStatuses.map((status) => ({ status, appliedAt: currentMiddle })),
      { status: "Applied", appliedAt: previousStart },
      { status: "Applied", appliedAt: previousEnd },
      ...nonAppliedStatuses.map((status) => ({ status, appliedAt: previousMiddle })),
      { status: "Applied", appliedAt: monthOnlyDate },
      ...nonAppliedStatuses.map((status) => ({ status, appliedAt: monthOnlyDate })),
    ];

    try {
      try {
        await client.begin(async (transaction) => {
          await transaction.unsafe(`CREATE SCHEMA "${schemaName}"`);
          await transaction.unsafe(`SET LOCAL search_path TO "${schemaName}"`);
          await transaction.unsafe(`
            CREATE TABLE payments (
              amount INTEGER NOT NULL,
              created_at TIMESTAMPTZ NOT NULL,
              status TEXT NOT NULL
            );
            CREATE TABLE users (
              created_at TIMESTAMPTZ NOT NULL,
              last_login_at TIMESTAMPTZ
            );
            CREATE TABLE user_grant_applications (
              user_id INTEGER NOT NULL,
              grant_id INTEGER NOT NULL,
              status TEXT NOT NULL,
              applied_at TIMESTAMPTZ NOT NULL
            );
            CREATE TABLE grant_writer_inquiries (
              created_at TIMESTAMPTZ NOT NULL
            );
          `);

          for (const record of records) {
            await transaction`
              INSERT INTO user_grant_applications (user_id, grant_id, status, applied_at)
              VALUES (1, 1, ${record.status}, ${record.appliedAt})
            `;
          }

          const dialect = new PgDialect();
          const report = await buildWeeklyReport({
            execute: (query: unknown) => {
              const compiled = dialect.sqlToQuery(query as SQL);
              return transaction.unsafe(compiled.sql, compiled.params);
            },
          }, {
            from: "2025-06-10",
            to: "2025-06-12",
            prevFrom: "2025-06-01",
            prevTo: "2025-06-03",
          });
          const applications = report.rows.find((row: { metric: string }) => row.metric === "Grant Applications");

          assert.ok(applications, "The report should include a Grant Applications row");
          assert.deepEqual(
            {
              current: applications.currentWeekRaw,
              comparison: applications.previousWeekRaw,
              monthToDate: applications.mtd,
            },
            {
              current: 2,
              comparison: 2,
              monthToDate: 5,
            },
          );

          throw rollback;
        });
      } catch (error) {
        if (error !== rollback) throw error;
      }
    } finally {
      await client.end();
    }
  },
);