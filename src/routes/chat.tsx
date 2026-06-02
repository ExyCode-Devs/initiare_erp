import { createFileRoute } from "@tanstack/react-router";
import { MessageSquare, Search, MoreVertical, Phone, Video, Mic, Plus, Smile } from "lucide-react";
import { useEffect, useRef, useState } from "react";

export const Route = createFileRoute("/chat")({
  head: () => ({ meta: [{ title: "Chat · Veridia" }] }),
  component: ChatPage,
});

function ChatPage() {
  const [messages, setMessages] = useState([
    { id: 1, from: "ai", text: "Olá, sou Veridia, como posso te ajudar?", time: new Date().toLocaleTimeString([], { hour: "2-digit", minute: "2-digit" }) },
  ]);
  const [input, setInput] = useState("");
  const endRef = useRef<HTMLDivElement | null>(null);

  useEffect(() => {
    endRef.current?.scrollIntoView({ behavior: "smooth" });
  }, [messages]);

  function send() {
    if (!input.trim()) return;
    const userMsg = { id: Date.now(), from: "user", text: input.trim(), time: new Date().toLocaleTimeString([], { hour: "2-digit", minute: "2-digit" }) };
    setMessages((s) => [...s, userMsg]);
    setInput("");

    // Simulate AI response
    setTimeout(() => {
      setMessages((s) => [...s, { id: Date.now() + 1, from: "ai", text: `Recebi: ${userMsg.text}`, time: new Date().toLocaleTimeString([], { hour: "2-digit", minute: "2-digit" }) }]);
    }, 700);
  }

  const contact = {
    id: "veridia-ia",
    name: "Veridia IA",
    last: "Última mensagem automática",
    time: "09:02",
    online: true,
  };

  return (
    <div className="h-[92vh] mx-2 my-4 rounded-xl overflow-hidden border border-border bg-card grid" style={{ gridTemplateColumns: '72px 300px 1fr' }}>
      {/* Left vertical icons (as in WhatsApp Web) */}
      <div className="flex flex-col items-center gap-4 py-4 bg-[#111313] text-white">
        <div className="w-10 h-10 rounded-full grid place-items-center bg-[#075E54]"> <MessageSquare /></div>
        <div className="w-10 h-10 rounded-full grid place-items-center hover:bg-accent"><Search /></div>
        <div className="w-10 h-10 rounded-full grid place-items-center hover:bg-accent"><MoreVertical /></div>
      </div>

      {/* Middle column - contact list (single contact) */}
      <div className="h-full bg-[#0f1413] border-r border-border flex flex-col">
        <div className="flex items-center justify-between px-4 py-3">
          <div className="text-lg font-semibold text-white">Conversas</div>
          <div className="flex items-center gap-2">
            <div className="w-9 h-9 rounded-full grid place-items-center bg-[#2b2b2b]">+</div>
          </div>
        </div>

        <div className="px-3">
          <input placeholder="Pesquisar ou começar uma nova conversa" className="w-full h-10 px-3 rounded-md bg-[#171918] border border-border text-sm text-white placeholder:text-white/60" />
        </div>

        <div className="flex-1 overflow-auto p-2">
          <div className="mt-3">
            <div className="flex items-center gap-3 p-3 rounded-md hover:bg-[#1f2a29] cursor-pointer">
              <div className="w-12 h-12 rounded-full bg-[#1b5e54] grid place-items-center text-white"> <MessageSquare /></div>
              <div className="flex-1">
                <div className="flex items-center justify-between text-white">
                  <div className="font-medium">{contact.name}</div>
                  <div className="text-[12px] text-white/70">{contact.time}</div>
                </div>
                <div className="text-[13px] text-white/70 truncate">{contact.last}</div>
              </div>
            </div>
          </div>
        </div>
      </div>

      {/* Right column - chat panel */}
      <div className="flex flex-col h-full">
        <div className="flex items-center gap-3 px-4 py-3" style={{ backgroundColor: '#075E54', color: 'white' }}>
          <div className="w-10 h-10 rounded-full bg-white/10 grid place-items-center"><MessageSquare /></div>
          <div className="flex-1">
            <div className="font-semibold">{contact.name}</div>
            <div className="text-[13px] text-white/90">{contact.online ? 'online' : 'último visto'}</div>
          </div>
          <div className="flex items-center gap-3 text-white/90">
            <Phone className="size-4" />
            <Video className="size-4" />
            <MoreVertical className="size-4" />
          </div>
        </div>

        <div className="flex-1 p-6 overflow-y-auto" style={{ background: 'repeating-linear-gradient(45deg, rgba(255,255,255,0.02) 0 14px, rgba(255,255,255,0.01) 14px 28px)' }}>
          <div className="space-y-4 max-w-[720px] mx-auto">
            {messages.map((m) => (
              <div key={m.id} className={`flex ${m.from === 'user' ? 'justify-end' : 'justify-start'}`}>
                <div className={`px-4 py-2 rounded-lg shadow-sm ${m.from === 'user' ? 'bg-[#dcf8c6] text-black rounded-tr-2xl rounded-tl-xl rounded-bl-2xl' : 'bg-white border border-border text-black rounded-tl-2xl rounded-tr-xl rounded-br-2xl'}`}>
                  <div className="text-[14px] leading-relaxed">{m.text}</div>
                  <div className="flex items-center justify-end gap-2 mt-1">
                    <div className="text-[11px] text-muted-foreground">{m.time}</div>
                    {m.from === 'user' ? <div className="text-[11px] text-muted-foreground">✓✓</div> : null}
                  </div>
                </div>
              </div>
            ))}
            <div ref={endRef} />
          </div>
        </div>

        <div className="p-4 bg-[#141918] border-t border-border">
          <div className="flex items-center gap-3">
            <div className="flex items-center gap-2">
              <button className="w-10 h-10 rounded-full bg-transparent border border-border grid place-items-center text-white/80"><Plus /></button>
            </div>
              <div className="flex-1 flex items-center gap-3">
              <input
                value={input}
                onChange={(e) => setInput(e.target.value)}
                onKeyDown={(e) => { if (e.key === 'Enter') send(); }}
                placeholder="Digite uma mensagem"
                className="flex-1 h-12 px-4 rounded-full bg-[#0f1413] border border-border text-white placeholder:text-white/60 focus:outline-none"
              />
              <button className="w-10 h-10 rounded-full bg-transparent grid place-items-center text-white/80"><Smile /></button>
              <button className="w-10 h-10 rounded-full bg-[#25D366] grid place-items-center text-white" onClick={send}><Mic /></button>
            </div>
          </div>
        </div>
      </div>
    </div>
  );
}

