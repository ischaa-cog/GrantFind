import { sql } from "drizzle-orm";

export type ReportDateRange = {
  from?: string;
  to?: string;
  prevFrom?: string;
  prevTo?: string;
};

export type PaymentMetrics = {
  current: { amountCents: number; count: number };
  previous: { amountCents: number; count: number };
  mtd: { amountCents: number; count: number };
};

type ReportDatabase = {
  execute(query: unknown): Promise<any>;
};

export async function buildWeeklyReport(
  db: ReportDatabase,
  params?: ReportDateRange,
  paymentMetrics?: PaymentMetrics,
): Promise<any> {
  const now = new Date();
  let curStart: Date;
  let curEnd: Date;
  let prevStart: Date;
  let prevEnd: Date;
  let monthStart: Date;

  const fmt = (date: Date) => date.toLocaleDateString("en-US", { month: "short", day: "numeric" });

  let curWeekLabel: string;
  let prevWeekLabel: string;
  let mtdLabel: string;

  if (params?.from && params?.to) {
    curStart = new Date(params.from);
    curStart.setHours(0, 0, 0, 0);
    curEnd = new Date(params.to);
    curEnd.setHours(23, 59, 59, 999);

    if (params.prevFrom && params.prevTo) {
      prevStart = new Date(params.prevFrom);
      prevStart.setHours(0, 0, 0, 0);
      prevEnd = new Date(params.prevTo);
      prevEnd.setHours(23, 59, 59, 999);
    } else {
      const durationMs = curEnd.getTime() - curStart.getTime();
      prevEnd = new Date(curStart.getTime() - 1);
      prevStart = new Date(prevEnd.getTime() - durationMs);
    }

    monthStart = new Date(curEnd.getFullYear(), curEnd.getMonth(), 1);
    curWeekLabel = `${fmt(curStart)} – ${fmt(curEnd)}`;
    prevWeekLabel = `${fmt(prevStart)} – ${fmt(prevEnd)}`;
    mtdLabel = `MTD (${curEnd.toLocaleDateString("en-US", { month: "long" })})`;
  } else {
    const dow = now.getDay();
    const daysToMon = dow === 0 ? 6 : dow - 1;
    curStart = new Date(now);
    curStart.setDate(now.getDate() - daysToMon);
    curStart.setHours(0, 0, 0, 0);
    curEnd = now;

    prevStart = new Date(curStart);
    prevStart.setDate(curStart.getDate() - 7);
    prevEnd = new Date(curStart);

    monthStart = new Date(now.getFullYear(), now.getMonth(), 1);

    const prevSun = new Date(prevEnd);
    prevSun.setDate(prevSun.getDate() - 1);
    curWeekLabel = `${fmt(curStart)} – ${fmt(now)}`;
    prevWeekLabel = `${fmt(prevStart)} – ${fmt(prevSun)}`;
    mtdLabel = `MTD (${now.toLocaleDateString("en-US", { month: "long" })})`;
  }

  const remark = (label: string, current: number, previous: number): string => {
    if (previous === 0 && current === 0) return `No ${label.toLowerCase()} recorded this period.`;
    if (previous === 0) return `${label} started this week with ${current} recorded.`;
    const pct = Math.round(((current - previous) / previous) * 100);
    const dir = current >= previous ? "increased" : "decreased";
    const sign = pct >= 0 ? "+" : "";
    return `${label} ${dir} from ${previous} to ${current} (${sign}${pct}%).`;
  };

  const value = (result: any): number => Number(result?.rows?.[0]?.val ?? result?.[0]?.val ?? 0);
  const cS = curStart.toISOString();
  const cE = curEnd.toISOString();
  const pS = prevStart.toISOString();
  const pE = prevEnd.toISOString();
  const mS = monthStart.toISOString();

  const [
    revCur, revPrev, revMTD,
    newCur, newPrev, newMTD,
    actCur, actPrev, actMTD,
    appCur, appPrev, appMTD,
    inqCur, inqPrev, inqMTD,
    paidCur, paidPrev, paidMTD,
  ] = await Promise.all([
    sql`SELECT COALESCE(SUM(amount),0)::bigint as val FROM payments WHERE created_at >= ${cS}::timestamptz AND created_at <= ${cE}::timestamptz AND status='paid'`,
    sql`SELECT COALESCE(SUM(amount),0)::bigint as val FROM payments WHERE created_at >= ${pS}::timestamptz AND created_at <= ${pE}::timestamptz AND status='paid'`,
    sql`SELECT COALESCE(SUM(amount),0)::bigint as val FROM payments WHERE created_at >= ${mS}::timestamptz AND created_at <= ${cE}::timestamptz AND status='paid'`,
    sql`SELECT COUNT(*)::int as val FROM users WHERE created_at >= ${cS}::timestamptz AND created_at <= ${cE}::timestamptz`,
    sql`SELECT COUNT(*)::int as val FROM users WHERE created_at >= ${pS}::timestamptz AND created_at <= ${pE}::timestamptz`,
    sql`SELECT COUNT(*)::int as val FROM users WHERE created_at >= ${mS}::timestamptz AND created_at <= ${cE}::timestamptz`,
    sql`SELECT COUNT(*)::int as val FROM users WHERE last_login_at >= ${cS}::timestamptz AND last_login_at <= ${cE}::timestamptz`,
    sql`SELECT COUNT(*)::int as val FROM users WHERE last_login_at >= ${pS}::timestamptz AND last_login_at <= ${pE}::timestamptz`,
    sql`SELECT COUNT(*)::int as val FROM users WHERE last_login_at >= ${mS}::timestamptz AND last_login_at <= ${cE}::timestamptz`,
    sql`SELECT COUNT(*)::int as val FROM user_grant_applications WHERE status = 'Applied' AND applied_at >= ${cS}::timestamptz AND applied_at <= ${cE}::timestamptz`,
    sql`SELECT COUNT(*)::int as val FROM user_grant_applications WHERE status = 'Applied' AND applied_at >= ${pS}::timestamptz AND applied_at <= ${pE}::timestamptz`,
    sql`SELECT COUNT(*)::int as val FROM user_grant_applications WHERE status = 'Applied' AND applied_at >= ${mS}::timestamptz AND applied_at <= ${cE}::timestamptz`,
    sql`SELECT COUNT(*)::int as val FROM grant_writer_inquiries WHERE created_at >= ${cS}::timestamptz AND created_at <= ${cE}::timestamptz`,
    sql`SELECT COUNT(*)::int as val FROM grant_writer_inquiries WHERE created_at >= ${pS}::timestamptz AND created_at <= ${pE}::timestamptz`,
    sql`SELECT COUNT(*)::int as val FROM grant_writer_inquiries WHERE created_at >= ${mS}::timestamptz AND created_at <= ${cE}::timestamptz`,
    sql`SELECT COUNT(*)::int as val FROM payments WHERE created_at >= ${cS}::timestamptz AND created_at <= ${cE}::timestamptz AND status='paid'`,
    sql`SELECT COUNT(*)::int as val FROM payments WHERE created_at >= ${pS}::timestamptz AND created_at <= ${pE}::timestamptz AND status='paid'`,
    sql`SELECT COUNT(*)::int as val FROM payments WHERE created_at >= ${mS}::timestamptz AND created_at <= ${cE}::timestamptz AND status='paid'`,
  ].map((query) => db.execute(query)));

  const dollars = (cents: number) => `$${Math.round(cents / 100).toLocaleString()}`;
  const revC = paymentMetrics?.current.amountCents ?? value(revCur);
  const revP = paymentMetrics?.previous.amountCents ?? value(revPrev);
  const revM = paymentMetrics?.mtd.amountCents ?? value(revMTD);
  const newC = value(newCur), newP = value(newPrev), newM = value(newMTD);
  const actC = value(actCur), actP = value(actPrev), actM = value(actMTD);
  const appC = value(appCur), appP = value(appPrev), appM = value(appMTD);
  const inqC = value(inqCur), inqP = value(inqPrev), inqM = value(inqMTD);
  const paidC = paymentMetrics?.current.count ?? value(paidCur);
  const paidP = paymentMetrics?.previous.count ?? value(paidPrev);
  const paidM = paymentMetrics?.mtd.count ?? value(paidMTD);

  return {
    currentWeekLabel: curWeekLabel,
    previousWeekLabel: prevWeekLabel,
    mtdLabel,
    generatedAt: now.toISOString(),
    rows: [
      { metric: "Total Revenue", currentWeek: dollars(revC), previousWeek: dollars(revP), mtd: dollars(revM), currentWeekRaw: Math.round(revC / 100), previousWeekRaw: Math.round(revP / 100), remark: remark("Total Revenue", Math.round(revC / 100), Math.round(revP / 100)) },
      { metric: "New Members", currentWeek: newC, previousWeek: newP, mtd: newM, currentWeekRaw: newC, previousWeekRaw: newP, remark: remark("New members", newC, newP) },
      { metric: "Active Members", currentWeek: actC, previousWeek: actP, mtd: actM, currentWeekRaw: actC, previousWeekRaw: actP, remark: remark("Active members", actC, actP) },
      { metric: "Paid Subscriptions", currentWeek: paidC, previousWeek: paidP, mtd: paidM, currentWeekRaw: paidC, previousWeekRaw: paidP, remark: remark("Paid subscriptions", paidC, paidP) },
      { metric: "Grant Applications", currentWeek: appC, previousWeek: appP, mtd: appM, currentWeekRaw: appC, previousWeekRaw: appP, remark: remark("Grant applications", appC, appP) },
      { metric: "Support Requests", currentWeek: inqC, previousWeek: inqP, mtd: inqM, currentWeekRaw: inqC, previousWeekRaw: inqP, remark: remark("Support requests (inquiries)", inqC, inqP) },
    ],
  };
}