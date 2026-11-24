import { NextResponse } from "next/server";
import { turso } from "@/lib/turso";

export async function GET() {
  try {
    const result = await turso.execute(
      "SELECT name FROM sqlite_master WHERE type = 'table' ORDER BY name",
    );

    return NextResponse.json({
      success: true,
      message: "Successfully connected to Turso!",
      tables: result.rows.map((row) => row.name),
    });
  } catch (error) {
    console.error("Turso Error:", error);

    return NextResponse.json(
      {
        success: false,
        error: error.message,
      },
      { status: 500 },
    );
  }
}
