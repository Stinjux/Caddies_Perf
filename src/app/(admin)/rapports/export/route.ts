import { requireScope } from "@/server/auth/context";
import { exporterKpiCsv } from "@/server/services/rapports";

/** Export CSV des KPI. Aucune donnée personnelle (FR-030). */
export async function GET(request: Request) {
  const { scope } = await requireScope();
  if (scope.role !== "admin") {
    return new Response("Accès refusé.", { status: 403 });
  }

  const url = new URL(request.url);
  const du = url.searchParams.get("du");
  const au = url.searchParams.get("au");

  const csv = await exporterKpiCsv(scope, {
    du: du ? new Date(du) : undefined,
    au: au ? new Date(au) : undefined,
  });

  return new Response("﻿" + csv, {
    headers: {
      "Content-Type": "text/csv; charset=utf-8",
      "Content-Disposition": `attachment; filename="kpi-caddies.csv"`,
    },
  });
}
