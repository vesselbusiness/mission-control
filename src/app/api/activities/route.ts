import { NextRequest, NextResponse } from "next/server";
import { getActivities, Activity } from "@/lib/activity-logger";

export const dynamic = "force-dynamic";

export async function GET(request: NextRequest) {
  const searchParams = request.nextUrl.searchParams;
  const limit = Math.min(parseInt(searchParams.get("limit") || "50"), 1000);
  const offset = parseInt(searchParams.get("offset") || "0");
  const types = searchParams.getAll("type");
  const statuses = searchParams.getAll("status");
  const search = searchParams.get("search")?.toLowerCase() || "";
  const format = searchParams.get("format") || "json";

  try {
    let activities = getActivities();

    // Filter by types
    if (types.length > 0) {
      activities = activities.filter((a) => types.includes(a.type));
    }

    // Filter by statuses
    if (statuses.length > 0) {
      activities = activities.filter((a) => statuses.includes(a.status));
    }

    // Filter by search term
    if (search) {
      activities = activities.filter(
        (a) =>
          a.description.toLowerCase().includes(search) ||
          a.type.toLowerCase().includes(search) ||
          a.id.toLowerCase().includes(search)
      );
    }

    const total = activities.length;

    // CSV export
    if (format === "csv") {
      const headers = [
        "ID",
        "Timestamp",
        "Type",
        "Status",
        "Description",
        "Duration (ms)",
        "Tokens Used",
      ];
      const rows = activities
        .slice(offset, offset + limit)
        .map((a) => [
          a.id,
          a.timestamp,
          a.type,
          a.status,
          `"${a.description.replace(/"/g, '""')}"`,
          a.duration_ms || "",
          a.tokens_used || "",
        ]);

      const csv =
        [headers, ...rows]
          .map((row) => row.join(","))
          .join("\n") + "\n";

      return new NextResponse(csv, {
        headers: {
          "Content-Type": "text/csv; charset=utf-8",
          "Content-Disposition": `attachment; filename="activities-${new Date().toISOString().split("T")[0]}.csv"`,
        },
      });
    }

    // JSON response with pagination
    const paginated = activities.slice(offset, offset + limit);
    return NextResponse.json({
      activities: paginated,
      total,
      limit,
      offset,
      hasMore: offset + limit < total,
    });
  } catch (error) {
    console.error("Error fetching activities:", error);
    return NextResponse.json(
      { error: "Failed to fetch activities" },
      { status: 500 }
    );
  }
}
