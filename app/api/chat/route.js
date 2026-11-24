import { NextResponse } from "next/server";
import { randomUUID } from "crypto";
import { claude } from "@/lib/claude";
import { turso } from "@/lib/turso";

export async function POST(request) {
  try {
    const { conversationId, message } = await request.json();

    if (!conversationId || typeof conversationId !== "string") {
      return NextResponse.json(
        { error: "Conversation ID is required." },
        { status: 400 },
      );
    }

    if (!message || typeof message !== "string" || !message.trim()) {
      return NextResponse.json(
        { error: "Please enter a message." },
        { status: 400 },
      );
    }

    // 1. Check conversation
    const conversationResult = await turso.execute({
      sql: "SELECT id, title FROM conversations WHERE id = ?",
      args: [conversationId],
    });

    if (conversationResult.rows.length === 0) {
      return NextResponse.json(
        { error: "Conversation not found." },
        { status: 404 },
      );
    }

    const conversation = conversationResult.rows[0];

    // 2. Load previous messages
    const historyResult = await turso.execute({
      sql: `
        SELECT role, content
        FROM messages
        WHERE conversation_id = ?
        ORDER BY created_at ASC, rowid ASC
      `,
      args: [conversationId],
    });

    const history = historyResult.rows.map((row) => ({
      role: row.role,
      content: row.content,
    }));

    // 3. Save user message
    const userMessageId = randomUUID();
    const cleanMessage = message.trim();

    await turso.execute({
      sql: `
        INSERT INTO messages
          (id, conversation_id, role, content)
        VALUES (?, ?, ?, ?)
      `,
      args: [userMessageId, conversationId, "user", cleanMessage],
    });

    // 4. Send conversation history to Claude
    const response = await claude.messages.create({
      model: "claude-sonnet-4-6",
      max_tokens: 2048,
      messages: [
        ...history,
        {
          role: "user",
          content: cleanMessage,
        },
      ],
    });

    const answer = response.content
      .filter((item) => item.type === "text")
      .map((item) => item.text)
      .join("\n");

    // 5. Save Claude's response
    const assistantMessageId = randomUUID();

    await turso.execute({
      sql: `
        INSERT INTO messages
          (id, conversation_id, role, content)
        VALUES (?, ?, ?, ?)
      `,
      args: [assistantMessageId, conversationId, "assistant", answer],
    });

    // 6. Set conversation title from its first message
    const newTitle =
      cleanMessage.length > 50
        ? cleanMessage.slice(0, 47) + "..."
        : cleanMessage;

    if (conversation.title === "New chat") {
      await turso.execute({
        sql: `
          UPDATE conversations
          SET title = ?, updated_at = datetime('now')
          WHERE id = ?
        `,
        args: [newTitle, conversationId],
      });
    } else {
      await turso.execute({
        sql: `
          UPDATE conversations
          SET updated_at = datetime('now')
          WHERE id = ?
        `,
        args: [conversationId],
      });
    }

    return NextResponse.json({
      success: true,
      userMessage: {
        id: userMessageId,
        role: "user",
        content: cleanMessage,
      },
      assistantMessage: {
        id: assistantMessageId,
        role: "assistant",
        content: answer,
      },
    });
  } catch (error) {
    console.error("Claude Chat Error:", error);

    return NextResponse.json(
      { error: error.message || "Something went wrong." },
      { status: 500 },
    );
  }
}
