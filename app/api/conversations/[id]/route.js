import { NextResponse } from "next/server";
import { turso } from "@/lib/turso";

// GET: Load a conversation and its messages
export async function GET(request, { params }) {
  try {
    const { id } = await params;

    const conversation = await turso.execute({
      sql: `
        SELECT id, title, created_at, updated_at
        FROM conversations
        WHERE id = ?
      `,
      args: [id],
    });

    if (conversation.rows.length === 0) {
      return NextResponse.json(
        { error: "Conversation not found." },
        { status: 404 },
      );
    }

    const messages = await turso.execute({
      sql: `
        SELECT id, role, content, created_at
        FROM messages
        WHERE conversation_id = ?
        ORDER BY created_at ASC, rowid ASC
      `,
      args: [id],
    });

    return NextResponse.json({
      success: true,
      conversation: conversation.rows[0],
      messages: messages.rows,
    });
  } catch (error) {
    console.error("Get conversation error:", error);

    return NextResponse.json(
      { error: "Failed to load conversation." },
      { status: 500 },
    );
  }
}

// DELETE: Delete a conversation
export async function DELETE(request, { params }) {
  try {
    const { id } = await params;

    const result = await turso.execute({
      sql: "DELETE FROM conversations WHERE id = ?",
      args: [id],
    });

    if (result.rowsAffected === 0) {
      return NextResponse.json(
        { error: "Conversation not found." },
        { status: 404 },
      );
    }

    return NextResponse.json({
      success: true,
      message: "Conversation deleted.",
    });
  } catch (error) {
    console.error("Delete conversation error:", error);

    return NextResponse.json(
      { error: "Failed to delete conversation." },
      { status: 500 },
    );
  }
}
