import { NextResponse } from "next/server";
import { randomUUID } from "crypto";
import { turso } from "@/lib/turso";

// GET: List all conversations
export async function GET() {
  try {
    const result = await turso.execute(`
      SELECT id, title, created_at, updated_at
      FROM conversations
      ORDER BY updated_at DESC
    `);

    return NextResponse.json({
      success: true,
      conversations: result.rows,
    });
  } catch (error) {
    console.error("Get conversations error:", error);

    return NextResponse.json(
      { error: "Failed to load conversations." },
      { status: 500 },
    );
  }
}

// POST: Create a new conversation
export async function POST() {
  try {
    const id = randomUUID();

    await turso.execute({
      sql: `
        INSERT INTO conversations (id, title)
        VALUES (?, ?)
      `,
      args: [id, "New chat"],
    });

    return NextResponse.json({
      success: true,
      conversation: {
        id,
        title: "New chat",
      },
    });
  } catch (error) {
    console.error("Create conversation error:", error);

    return NextResponse.json(
      { error: "Failed to create conversation." },
      { status: 500 },
    );
  }
}
