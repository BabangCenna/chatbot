"use client";

import { useEffect, useState } from "react";
import ReactMarkdown from "react-markdown";
import remarkGfm from "remark-gfm";

export default function Home() {
  const [conversations, setConversations] = useState([]);
  const [activeId, setActiveId] = useState(null);
  const [messages, setMessages] = useState([]);
  const [input, setInput] = useState("");

  const [loading, setLoading] = useState(true);
  const [sending, setSending] = useState(false);
  const [error, setError] = useState("");
  const [sidebarOpen, setSidebarOpen] = useState(false);

  // Load conversation list
  async function loadConversations() {
    const response = await fetch("/api/conversations");
    const data = await response.json();

    if (!response.ok) {
      throw new Error(data.error || "Failed to load conversations.");
    }

    setConversations(data.conversations);
    return data.conversations;
  }

  // Load messages for a conversation
  async function selectConversation(id) {
    setError("");
    setActiveId(id);
    setMessages([]);
    setSidebarOpen(false);

    try {
      const response = await fetch(`/api/conversations/${id}`);
      const data = await response.json();

      if (!response.ok) {
        throw new Error(data.error || "Failed to load conversation.");
      }

      setMessages(data.messages);
    } catch (err) {
      setError(err.message);
    }
  }

  // Initial load
  useEffect(() => {
    async function initialize() {
      try {
        await loadConversations();
      } catch (err) {
        setError(err.message);
      } finally {
        setLoading(false);
      }
    }

    initialize();
  }, []);

  // Create new conversation
  async function newChat() {
    setError("");

    try {
      const response = await fetch("/api/conversations", {
        method: "POST",
      });

      const data = await response.json();

      if (!response.ok) {
        throw new Error(data.error || "Failed to create conversation.");
      }

      const conversation = {
        ...data.conversation,
        created_at: new Date().toISOString(),
        updated_at: new Date().toISOString(),
      };

      setConversations((prev) => [conversation, ...prev]);

      setActiveId(conversation.id);
      setMessages([]);
      setInput("");
      setSidebarOpen(false);
    } catch (err) {
      setError(err.message);
    }
  }

  // Delete conversation
  async function deleteChat(id) {
    if (!window.confirm("Delete this conversation?")) {
      return;
    }

    try {
      const response = await fetch(`/api/conversations/${id}`, {
        method: "DELETE",
      });

      const data = await response.json();

      if (!response.ok) {
        throw new Error(data.error || "Failed to delete conversation.");
      }

      setConversations((prev) => prev.filter((chat) => chat.id !== id));

      if (activeId === id) {
        setActiveId(null);
        setMessages([]);
      }
    } catch (err) {
      setError(err.message);
    }
  }

  // Send message
  async function sendMessage(e) {
    e.preventDefault();

    const cleanMessage = input.trim();

    if (!cleanMessage || sending) return;

    setError("");
    setSending(true);
    setInput("");

    let conversationId = activeId;
    const tempId = `temp-${Date.now()}`;

    try {
      // Create conversation automatically if necessary
      if (!conversationId) {
        const createResponse = await fetch("/api/conversations", {
          method: "POST",
        });

        const createData = await createResponse.json();

        if (!createResponse.ok) {
          throw new Error(createData.error || "Failed to create conversation.");
        }

        conversationId = createData.conversation.id;

        setActiveId(conversationId);

        setConversations((prev) => [
          {
            ...createData.conversation,
            created_at: new Date().toISOString(),
            updated_at: new Date().toISOString(),
          },
          ...prev,
        ]);
      }

      // Show user message immediately
      setMessages((prev) => [
        ...prev,
        {
          id: tempId,
          role: "user",
          content: cleanMessage,
        },
      ]);

      // Send to Claude
      const response = await fetch("/api/chat", {
        method: "POST",
        headers: {
          "Content-Type": "application/json",
        },
        body: JSON.stringify({
          conversationId,
          message: cleanMessage,
        }),
      });

      const data = await response.json();

      if (!response.ok) {
        throw new Error(data.error || "Failed to send message.");
      }

      // Replace temporary message and add Claude response
      setMessages((prev) => [
        ...prev.filter((message) => message.id !== tempId),
        data.userMessage,
        data.assistantMessage,
      ]);

      // Refresh sidebar titles and timestamps
      await loadConversations();
    } catch (err) {
      setError(err.message);

      // Remove temporary message and reload saved messages.
      // The API may already have saved the user message.
      if (conversationId) {
        try {
          const detailResponse = await fetch(
            `/api/conversations/${conversationId}`,
          );

          if (detailResponse.ok) {
            const detailData = await detailResponse.json();
            setMessages(detailData.messages);
          }
        } catch {
          // Keep the original error.
        }
      }
    } finally {
      setSending(false);
    }
  }

  function formatDate(date) {
    if (!date) return "";

    const parsed = new Date(
      date.includes("T") ? date : date.replace(" ", "T") + "Z",
    );

    if (Number.isNaN(parsed.getTime())) return "";

    return parsed.toLocaleDateString(undefined, {
      month: "short",
      day: "numeric",
    });
  }

  return (
    <div className='flex h-dvh overflow-hidden bg-[#212121] text-white'>
      {/* Mobile sidebar backdrop */}
      {sidebarOpen && (
        <button
          className='fixed inset-0 z-20 bg-black/60 md:hidden'
          onClick={() => setSidebarOpen(false)}
          aria-label='Close sidebar'
        />
      )}

      {/* Sidebar */}
      <aside
        className={`
          fixed inset-y-0 left-0 z-30 flex w-[280px] flex-col
          border-r border-white/10 bg-[#171717]
          transition-transform duration-200
          md:static md:translate-x-0
          ${sidebarOpen ? "translate-x-0" : "-translate-x-full"}
        `}
      >
        {/* Brand */}
        <div className='flex h-16 items-center justify-between px-5'>
          <div className='flex items-center gap-3'>
            <div className='flex h-9 w-9 items-center justify-center rounded-xl bg-white text-lg font-bold text-black'>
              C
            </div>

            <span className='text-lg font-semibold tracking-tight'>
              Claude Chat
            </span>
          </div>

          <button
            onClick={() => setSidebarOpen(false)}
            className='rounded-lg p-2 text-gray-400 hover:bg-white/10 md:hidden'
          >
            ✕
          </button>
        </div>

        {/* New Chat */}
        <div className='px-3 py-3'>
          <button
            onClick={newChat}
            className='flex w-full items-center gap-3 rounded-xl border border-white/10 px-4 py-3 text-sm transition hover:bg-white/10'
          >
            <span className='text-lg'>＋</span>
            <span>New chat</span>
          </button>
        </div>

        {/* History */}
        <div className='flex-1 overflow-y-auto px-3 py-2'>
          <p className='mb-3 px-3 text-xs font-semibold uppercase tracking-wider text-gray-500'>
            Recent conversations
          </p>

          {loading ? (
            <p className='px-3 text-sm text-gray-500'>
              Loading conversations...
            </p>
          ) : conversations.length === 0 ? (
            <p className='px-3 text-sm text-gray-500'>No conversations yet.</p>
          ) : (
            <div className='space-y-1'>
              {conversations.map((chat) => (
                <div
                  key={chat.id}
                  className={`
                    group flex items-center gap-1 rounded-xl px-3 py-2
                    transition
                    ${activeId === chat.id ? "bg-white/10" : "hover:bg-white/5"}
                  `}
                >
                  <button
                    onClick={() => selectConversation(chat.id)}
                    className='min-w-0 flex-1 text-left'
                  >
                    <p className='truncate text-sm text-gray-200'>
                      {chat.title}
                    </p>

                    <p className='mt-1 text-xs text-gray-500'>
                      {formatDate(chat.updated_at)}
                    </p>
                  </button>

                  <button
                    onClick={() => deleteChat(chat.id)}
                    title='Delete conversation'
                    className='rounded-lg px-2 py-1 text-gray-500 opacity-100 transition hover:bg-red-500/20 hover:text-red-400 md:opacity-0 md:group-hover:opacity-100'
                  >
                    ⋯
                  </button>
                </div>
              ))}
            </div>
          )}
        </div>

        {/* Footer */}
        <div className='border-t border-white/10 p-4'>
          <div className='flex items-center gap-3 rounded-xl px-2 py-2'>
            <div className='flex h-9 w-9 items-center justify-center rounded-full bg-gradient-to-br from-orange-400 to-orange-700 font-semibold'>
              A
            </div>

            <div>
              <p className='text-sm font-medium'>My Workspace</p>
              <p className='text-xs text-gray-500'>Powered by Olagon AI</p>
            </div>
          </div>
        </div>
      </aside>

      {/* Main */}
      <main className='flex min-w-0 flex-1 flex-col'>
        {/* Header */}
        <header className='flex h-16 shrink-0 items-center justify-between border-b border-white/10 px-4 md:px-6'>
          <div className='flex items-center gap-3'>
            <button
              onClick={() => setSidebarOpen(true)}
              className='rounded-lg p-2 text-gray-400 hover:bg-white/10 md:hidden'
            >
              ☰
            </button>

            <div>
              <h1 className='text-sm font-semibold'>Claude Sonnet 4.6</h1>
              <p className='text-xs text-gray-500'>AI Assistant</p>
            </div>
          </div>

          <div className='flex items-center gap-2 rounded-full border border-white/10 px-3 py-1.5'>
            <span className='h-2 w-2 rounded-full bg-green-400' />
            <span className='text-xs text-gray-400'>Connected</span>
          </div>
        </header>

        {/* Messages */}
        <div className='flex-1 overflow-y-auto'>
          <div className='mx-auto flex min-h-full w-full max-w-4xl flex-col px-4 py-8 md:px-8'>
            {messages.length === 0 && !sending ? (
              <div className='flex flex-1 flex-col items-center justify-center py-16 text-center'>
                <div className='mb-6 flex h-16 w-16 items-center justify-center rounded-2xl bg-gradient-to-br from-orange-400 to-orange-700 text-3xl font-bold shadow-lg shadow-orange-900/20'>
                  C
                </div>

                <h2 className='text-3xl font-semibold tracking-tight'>
                  How can I help you?
                </h2>

                <p className='mt-3 max-w-md text-sm leading-6 text-gray-400'>
                  Ask me anything. Your conversations are automatically saved
                  and can be accessed anytime.
                </p>

                <div className='mt-8 grid w-full max-w-lg gap-3 sm:grid-cols-2'>
                  {[
                    "Explain something complex",
                    "Help me write some code",
                    "Brainstorm new ideas",
                    "Analyze a problem",
                  ].map((suggestion) => (
                    <button
                      key={suggestion}
                      onClick={() => setInput(suggestion)}
                      className='rounded-xl border border-white/10 p-4 text-left text-sm text-gray-300 transition hover:border-white/20 hover:bg-white/5'
                    >
                      {suggestion}
                    </button>
                  ))}
                </div>
              </div>
            ) : (
              <div className='space-y-8'>
                {messages.map((message) => (
                  <div
                    key={message.id}
                    className={`flex gap-4 ${
                      message.role === "user" ? "justify-end" : "justify-start"
                    }`}
                  >
                    {message.role === "assistant" && (
                      <div className='flex h-8 w-8 shrink-0 items-center justify-center rounded-lg bg-orange-500 font-bold'>
                        C
                      </div>
                    )}

                    <div
                      className={`
                        max-w-[85%] rounded-2xl px-4 py-3
                        ${
                          message.role === "user"
                            ? "bg-[#303030] text-gray-100"
                            : "bg-transparent text-gray-200"
                        }
                      `}
                    >
                      <div
                        className='prose prose-invert max-w-none break-words text-sm leading-7
                          prose-p:my-3
                          prose-headings:font-semibold
                          prose-strong:text-white
                          prose-a:text-blue-400
                          prose-li:my-1
                          prose-code:rounded
                          prose-code:bg-[#404040]
                          prose-code:px-1.5
                          prose-code:py-0.5
                          prose-code:text-orange-300
                          prose-pre:rounded-xl
                          prose-pre:bg-[#111111]
                          prose-pre:border
                          prose-pre:border-white/10
                          prose-blockquote:border-l-orange-500
                          prose-blockquote:text-gray-400
                          prose-hr:border-white/10
                        '
                      >
                        <ReactMarkdown remarkPlugins={[remarkGfm]}>
                          {message.content}
                        </ReactMarkdown>
                      </div>
                    </div>

                    {message.role === "user" && (
                      <div className='flex h-8 w-8 shrink-0 items-center justify-center rounded-full bg-gray-600 text-sm font-semibold'>
                        A
                      </div>
                    )}
                  </div>
                ))}

                {sending && (
                  <div className='flex items-center gap-4'>
                    <div className='flex h-8 w-8 items-center justify-center rounded-lg bg-orange-500 font-bold'>
                      C
                    </div>

                    <div className='flex items-center gap-1'>
                      <span className='h-2 w-2 animate-bounce rounded-full bg-gray-400' />
                      <span className='h-2 w-2 animate-bounce rounded-full bg-gray-400 [animation-delay:150ms]' />
                      <span className='h-2 w-2 animate-bounce rounded-full bg-gray-400 [animation-delay:300ms]' />
                    </div>
                  </div>
                )}
              </div>
            )}

            {error && (
              <div className='mt-6 rounded-xl border border-red-500/20 bg-red-500/10 px-4 py-3 text-sm text-red-300'>
                {error}
              </div>
            )}
          </div>
        </div>

        {/* Input */}
        <div className='shrink-0 px-4 pb-5 pt-2 md:px-8'>
          <div className='mx-auto max-w-3xl'>
            <form
              onSubmit={sendMessage}
              className='rounded-2xl border border-white/10 bg-[#303030] p-3 shadow-xl'
            >
              <textarea
                value={input}
                onChange={(e) => setInput(e.target.value)}
                onKeyDown={(e) => {
                  if (e.key === "Enter" && !e.shiftKey) {
                    e.preventDefault();
                    sendMessage(e);
                  }
                }}
                placeholder='Message Claude...'
                rows={2}
                disabled={sending}
                className='max-h-40 min-h-[48px] w-full resize-none bg-transparent px-2 py-2 text-sm text-white outline-none placeholder:text-gray-500 disabled:opacity-50'
              />

              <div className='flex items-center justify-between px-1'>
                <p className='text-xs text-gray-500'>
                  Claude can make mistakes. Verify important information.
                </p>

                <button
                  type='submit'
                  disabled={!input.trim() || sending}
                  className='flex h-9 w-9 items-center justify-center rounded-xl bg-white text-black transition hover:bg-gray-200 disabled:cursor-not-allowed disabled:opacity-30'
                  title='Send message'
                >
                  ↑
                </button>
              </div>
            </form>

            <p className='mt-3 text-center text-xs text-gray-600'>
              Powered by Claude · Olagon AI Gateway · Turso
            </p>
          </div>
        </div>
      </main>
    </div>
  );
}
